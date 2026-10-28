// Matched deterministic policies. Zero-latency policies inspect each kitchen minute;
// delayed-reach waits four playback seconds after observing a portion before tapping.
// These are availability gaps, not measured human reading or reaction times.
// first300AttendedGap includes food acts, the active Finish on instinct choice,
// and directly spoken request answers. It excludes staffing forms and repeated
// claims for an already held chefNext. first300SecondsLongestUnavailable is the
// narrower ready-food-only metric. Delegation-generated steps are never inputs.
// Free-chef and busy-observed reach attempts are split: before a tap, no claim exists.
import { restore, snapshot, tick } from '@adam0white/human-framework-legacy';
import * as k from '../src/sim/kitchen.ts';
import { clockPlayback } from '../src/ui/clock.ts';

type Policy = 'careful' | 'plain' | 'mixed' | 'instinct' | 'hands-off' | 'delayed-reach';
type Sample = { minute: number; seconds: number; startSeconds: number; available: boolean };
type Reach = { ticket: number; station: k.FoodStation; due: number; observedWhileBusy: boolean };
function longestGap(samples: Sample[], until = Infinity) {
  let current = 0;
  let longest = 0;
  for (const sample of samples) {
    if (sample.startSeconds >= until) break;
    current = sample.available ? 0 : current + Math.min(sample.seconds, until - sample.startSeconds);
    longest = Math.max(longest, current);
  }
  return longest;
}
function gapSpan(samples: Sample[], until = 300) {
  let current = { seconds: 0, startMinute: 0, endMinute: 0 };
  let longest = { ...current };
  for (const sample of samples) {
    if (sample.startSeconds >= until) break;
    if (sample.available) current = { seconds: 0, startMinute: 0, endMinute: 0 };
    else {
      if (!current.seconds) current.startMinute = sample.minute;
      current.seconds += Math.min(sample.seconds, until - sample.startSeconds);
      current.endMinute = sample.minute + 1;
      if (current.seconds > longest.seconds) longest = { ...current };
    }
  }
  return longest;
}
function run(edition: string, seed: number, policy: Policy) {
  const s = k.newGame(seed, edition);
  const handledStaff = new Set<string>();
  const lastAsk = new Map<string, number>();
  let reach: Reach | null = null;
  let service = 0;
  let seconds = 0;
  let samples: Sample[] = [];
  let attendedSamples: Sample[] = [];
  let freeChefReachAttempts = 0;
  let freeChefPreClaimLosses = 0;
  let reachAttempts = 0;
  let acceptedClaims = 0;
  let queuedClaims = 0;
  let preClaimLossesToCrew = 0;
  let rejectedBusy = 0;
  let rejectedOther = 0;
  let reservedClaimsLostToCrew = 0;
  let lossKeys = new Set<string>();
  let steps = 0;
  let calls = 0;
  let now = 0;
  let careful = 0;
  let delegationTaps = 0;
  let managementInputs = 0;
  let closeExertion = 0;
  let guard = 0;
  while (s.night <= 6 && s.phase !== 'end') {
    if (++guard > 20000) throw Error(`Safety bound ${edition}/${seed}/${policy}`);
    if (s.phase === 'board') {
      k.queueInput(s, { kind: 'board', rows: k.boardDefaults(s) });
      k.queueInput(s, { kind: 'open' });
      continue;
    }
    if (s.phase === 'evening') {
      if (s.night === 3) k.queueInput(s, { kind: 'jar', choice: 'talk' });
      k.queueInput(s, { kind: 'open' });
      continue;
    }
    if (s.phase !== 'service') break;
    if (service !== s.night) {
      service = s.night;
      seconds = 0;
      samples = [];
      attendedSamples = [];
      freeChefReachAttempts = freeChefPreClaimLosses = 0;
      reach = null;
      reachAttempts = acceptedClaims = queuedClaims = preClaimLossesToCrew = rejectedBusy = rejectedOther = 0;
      steps = calls = now = careful = delegationTaps = managementInputs = 0;
      reservedClaimsLostToCrew = 0;
      lossKeys = new Set<string>();
    }
    const portion = k.helpOptions(s)[0];
    const action = k.cookingStep(s);
    const choice = edition === 'pass@8' ? k.cookingChoice(s) : null;
    // A queue already held is not an invitation to tap the same claim repeatedly.
    const available =
      (!s.help?.instinct && !!action?.ready) ||
      (!s.help?.instinct && !!choice) ||
      k.plateOptions(s).length > 0 ||
      (!!portion && !s.chefNext);
    const attendedAvailable =
      available || (edition === 'pass@8' && !!s.help && !s.help.instinct) || s.request?.state === 'asking';
    if (s.request?.state === 'asking') {
      k.queueInput(s, { kind: 'answer', choice: 'yes' });
      managementInputs++;
    }
    const reserved = new Set<string>();
    for (const decision of s.staffing ?? []) {
      if (decision.state !== 'asking') continue;
      const key = `${s.night}:${decision.id}`;
      const options = k.staffingOptions(s, decision).filter((id) => !reserved.has(id));
      const cover = handledStaff.has(key) ? null : (options[0] ?? null);
      k.queueInput(s, { kind: 'staff', id: decision.id, cover });
      handledStaff.add(key);
      managementInputs++;
      if (cover) reserved.add(cover);
    }
    const demand = { ...k.owed(s), dish: s.plates.pile };
    const covered = new Set(
      k
        .onShift(s)
        .map((id) => k.stationOf(s, id))
        .filter(Boolean),
    );
    if (s.minute % 5 === 0) {
      for (const station of k.stationsTonight(s)) {
        if (demand[station] <= 0 || covered.has(station)) continue;
        const cook = k.onShift(s).find((id) => {
          if (reserved.has(id) || k.cookOf(s, id).pending || k.stationOf(s, id)) return false;
          const activity = k.personOf(s, id).activity;
          if (activity && activity.affordanceId !== 'wait') return false;
          if (s.minute - (lastAsk.get(`${id}:${station}`) ?? -Infinity) < 20) return false;
          const hint = k.hints(s, id).find((h) => h.verb === station);
          return hint && hint.verdict !== 'refused';
        });
        if (cook) {
          k.queueInput(s, { kind: 'ask', cook, verb: station });
          managementInputs++;
          lastAsk.set(`${cook}:${station}`, s.minute);
          reserved.add(cook);
          covered.add(station);
        }
      }
    }
    if (policy !== 'hands-off') {
      const priority = k.priorityOptions(s)[0];
      if (priority) {
        k.queueInput(s, { kind: 'pass-priority', ticket: priority.ticket });
        managementInputs++;
      }
      for (const call of k.plateOptions(s)) {
        k.queueInput(s, { kind: 'call-plate', ticket: call.ticket });
        calls++;
      }
      if (policy === 'instinct' && edition === 'pass@8') {
        if (s.help && !s.help.instinct) {
          k.queueInput(s, { kind: 'finish-portion', ticket: s.help.ticket });
          delegationTaps++;
        }
      } else if (choice) {
        const carefulChoice =
          policy === 'careful' ||
          ((policy === 'mixed' || policy === 'delayed-reach') && (now + careful) % 2 === 0);
        k.queueInput(s, {
          kind: 'cook-choice',
          ticket: choice.ticket,
          choice: carefulChoice ? 'careful' : 'now',
        });
        if (carefulChoice) careful++;
        else now++;
      } else if (action?.ready && !s.help?.instinct) {
        k.queueInput(s, {
          kind: 'cook-step',
          ticket: action.ticket,
          instinct: edition === 'pass@7' && (policy === 'plain' || policy === 'instinct'),
        });
        steps++;
      }
      if (!reach && !s.chefNext) {
        const candidate = k.helpOptions(s)[0];
        if (candidate)
          reach = {
            ...candidate,
            due: seconds + (policy === 'delayed-reach' ? 4 : 0),
            observedWhileBusy: !!s.help,
          };
      }
      if (reach && seconds >= reach.due) {
        const target = reach;
        reach = null;
        const before = s.help;
        const nextBefore = s.chefNext;
        k.queueInput(s, { kind: 'help', ticket: target.ticket, station: target.station });
        reachAttempts++;
        if (!target.observedWhileBusy) freeChefReachAttempts++;
        const match = (claim: { ticket: number; station: string } | null | undefined) =>
          claim?.ticket === target.ticket && claim.station === target.station;
        if (match(s.help) && s.help !== before) acceptedClaims++;
        else if (match(s.chefNext) && s.chefNext !== nextBefore) {
          acceptedClaims++;
          queuedClaims++;
        } else {
          const t = s.tickets.find((ticket) => ticket.id === target.ticket);
          const remaining =
            t &&
            (target.station === 'grill'
              ? t.grill - t.doneGrill
              : target.station === 'cold'
                ? t.cold - t.doneCold
                : t.oven - t.doneOven);
          if (
            t &&
            t.status !== 'walked' &&
            (t.status === 'served' || t.platedAt !== undefined || remaining === 0)
          ) {
            preClaimLossesToCrew++;
            if (!target.observedWhileBusy) freeChefPreClaimLosses++;
          } else if (before) rejectedBusy++;
          else rejectedOther++;
        }
      }
    }
    const duration = 1 / clockPlayback(s, 1).rate;
    samples.push({ minute: s.minute, seconds: duration, startSeconds: seconds, available });
    attendedSamples.push({
      minute: s.minute,
      seconds: duration,
      startSeconds: seconds,
      available: attendedAvailable,
    });
    seconds += duration;
    if (s.minute + 1 === k.closeAt(s.night)) {
      const chef = restore(snapshot(s.chef));
      tick(chef, s.minute);
      closeExertion = chef.body.exertion;
    }
    k.step(s);
    // An active or queued reservation is lost if crew completion exhausts its
    // station while that exact reservation is still held after the tick.
    for (const claim of [s.help, s.chefNext]) {
      if (!claim) continue;
      const ticket = s.tickets.find((t) => t.id === claim.ticket);
      if (!ticket || ticket.status === 'walked') continue;
      const remaining =
        claim.station === 'grill'
          ? ticket.grill - ticket.doneGrill
          : claim.station === 'cold'
            ? ticket.cold - ticket.doneCold
            : ticket.oven - ticket.doneOven;
      const key = `${claim.ticket}:${claim.station}`;
      if (remaining <= 0 && !lossKeys.has(key)) {
        reservedClaimsLostToCrew++;
        lossKeys.add(key);
      }
    }
    if (s.phase === 'service') continue;
    const served = s.tickets.filter((t) => t.status === 'served');
    const quality: Record<string, number> = {};
    for (const ticket of served) {
      const key = `${ticket.quality ?? 'unrecorded'}/${ticket.freshness ?? 'unrecorded'}`;
      quality[key] = (quality[key] ?? 0) + 1;
    }
    console.log(
      JSON.stringify({
        edition,
        seed,
        policy,
        night: service,
        reachLatencySeconds: policy === 'delayed-reach' ? 4 : 0,
        reactionModel: 'inspect once per kitchen minute; other actions zero latency',
        handsOnInputs: acceptedClaims + steps + calls + now + careful + delegationTaps,
        reachAttempts,
        freeChefReachAttempts,
        freeChefPreClaimLosses,
        acceptedClaims,
        queuedClaims,
        preClaimLossesToCrew,
        rejectedBusy,
        rejectedOther,
        reservedClaimsLostToCrew,
        cookingStepInputs: steps,
        plateCalls: calls,
        foodChoices: now + careful,
        nowChoices: now,
        carefulChoices: careful,
        delegationTaps,
        managementInputs,
        fed: served.filter((t) => t.due === undefined).length,
        total: s.tickets.filter((t) => t.due === undefined).length,
        quality,
        chefExertionAtCloseBeforeRecovery: closeExertion,
        durationSeconds: seconds,
        longestUnavailableSeconds: longestGap(samples),
        first300SecondsLongestUnavailable: longestGap(samples, 300),
        first300GapSpan: gapSpan(samples),
        first300AttendedGap: gapSpan(attendedSamples),
        longestAttendedUnavailableSeconds: longestGap(attendedSamples),
      }),
    );
  }
}
for (const edition of ['pass@7', 'pass@8']) {
  for (const seed of [7, 21, 42]) {
    for (const policy of [
      'careful',
      'plain',
      'mixed',
      'instinct',
      'hands-off',
      'delayed-reach',
    ] as Policy[]) {
      run(edition, seed, policy);
    }
  }
}

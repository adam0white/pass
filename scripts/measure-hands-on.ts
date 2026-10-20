// Deterministic policies inspect once per simulation minute, with no reaction latency.
// Gap availability is sampled before policy inputs. Durations integrate clockPlayback(s, 1)
// after inputs, as the browser would before stepping. Priority is a form decision, not an act.
// Instinct uses the same default playback timing as attentive; it compares quality,
// not browser Fast duration. Close exertion is sampled before evening recovery.
import { restore, snapshot, tick } from '@adam0white/human-framework';
import * as kitchen from '../src/sim/kitchen.ts';
import { clockPlayback } from '../src/ui/clock.ts';

const {
  boardDefaults,
  closeAt,
  cookOf,
  hints,
  newGame,
  onShift,
  owed,
  personOf,
  queueInput,
  staffingOptions,
  stationOf,
  stationsTonight,
  step,
  helpOptions,
  priorityOptions,
} = kitchen;
type Policy = 'hands-off' | 'attentive' | 'instinct';
type Sample = { minute: number; seconds: number; startSeconds: number; available: boolean };
type Stats = {
  helpStarts: number;
  cookingSteps: number;
  plateCalls: number;
  priorityDecisions: number;
  manualAsks: number;
  staffingDecisions: number;
  samples: Sample[];
  chefExertionAtClose: number;
  fed: number;
  total: number;
  lastFeedMinute: number;
  quality: Record<string, number>;
};
function longestGap(samples: Sample[], untilSeconds = Infinity, untilMinute = Infinity) {
  let longest = { seconds: 0, startMinute: 0, endMinute: 0 },
    current = { ...longest };
  for (const sample of samples) {
    if (sample.minute >= untilMinute || sample.startSeconds >= untilSeconds) break;
    const seconds = Math.min(sample.seconds, untilSeconds - sample.startSeconds);
    if (sample.available) current = { seconds: 0, startMinute: 0, endMinute: 0 };
    else {
      if (!current.seconds) current.startMinute = sample.minute;
      current.seconds += seconds;
      current.endMinute = sample.minute + 1;
      if (current.seconds > longest.seconds) longest = { ...current };
    }
  }
  return longest;
}
const rows = [];
for (const edition of ['pass@6', 'pass@7'])
  for (const seed of [7, 21, 42])
    for (const policy of ['hands-off', 'attentive', 'instinct'] as Policy[]) {
      const s = newGame(seed, edition),
        stats = new Map<number, Stats>();
      const handledStaff = new Set<string>(),
        lastAsk = new Map<string, number>();
      const stat = () => {
        let row = stats.get(s.night);
        if (!row) {
          row = {
            helpStarts: 0,
            cookingSteps: 0,
            plateCalls: 0,
            priorityDecisions: 0,
            manualAsks: 0,
            staffingDecisions: 0,
            samples: [],
            chefExertionAtClose: 0,
            fed: 0,
            total: 0,
            lastFeedMinute: s.minute,
            quality: {},
          };
          stats.set(s.night, row);
        }
        return row;
      };
      let guard = 0;
      while (s.night <= 6 && s.phase !== 'end') {
        if (++guard > 20000) throw Error(`Safety bound ${edition}/${seed}/${policy}/${s.night}`);
        const row = stat();
        if (s.phase === 'board') {
          queueInput(s, { kind: 'board', rows: boardDefaults(s) });
          queueInput(s, { kind: 'open' });
          continue;
        }
        if (s.phase === 'evening') {
          if (s.night === 3) queueInput(s, { kind: 'jar', choice: 'talk' });
          queueInput(s, { kind: 'open' });
          continue;
        }
        if (s.phase !== 'service') break;
        const cooking = kitchen.cookingStep(s);
        const calls = kitchen.plateOptions(s);
        const portions = helpOptions(s);
        const available = !!cooking?.ready || calls.length > 0 || portions.length > 0;
        if (s.request?.state === 'asking') queueInput(s, { kind: 'answer', choice: 'yes' });
        const reserved = new Set<string>();
        for (const decision of s.staffing ?? []) {
          if (decision.state !== 'asking') continue;
          const key = `${s.night}:${decision.id}`;
          const options = staffingOptions(s, decision).filter((id) => !reserved.has(id));
          const cover = handledStaff.has(key) ? null : (options[0] ?? null);
          queueInput(s, { kind: 'staff', id: decision.id, cover });
          if (!handledStaff.has(key)) row.staffingDecisions++;
          handledStaff.add(key);
          if (cover) reserved.add(cover);
        }
        const demand = { ...owed(s), dish: s.plates.pile };
        const covered = new Set(
          onShift(s)
            .map((id) => stationOf(s, id))
            .filter(Boolean),
        );
        if (s.minute % 5 === 0)
          for (const station of stationsTonight(s)) {
            if (demand[station] <= 0 || covered.has(station)) continue;
            const cook = onShift(s).find((id) => {
              if (reserved.has(id) || cookOf(s, id).pending || stationOf(s, id)) return false;
              const activity = personOf(s, id).activity;
              if (activity && activity.affordanceId !== 'wait') return false;
              if (s.minute - (lastAsk.get(`${id}:${station}`) ?? -Infinity) < 20) return false;
              const hint = hints(s, id).find((h) => h.verb === station);
              return hint && hint.verdict !== 'refused';
            });
            if (cook) {
              queueInput(s, { kind: 'ask', cook, verb: station });
              row.manualAsks++;
              lastAsk.set(`${cook}:${station}`, s.minute);
              reserved.add(cook);
              covered.add(station);
            }
          }
        if (policy !== 'hands-off') {
          const priority = priorityOptions(s)[0];
          if (priority) {
            queueInput(s, { kind: 'pass-priority', ticket: priority.ticket });
            row.priorityDecisions++;
          }
          for (const call of kitchen.plateOptions(s)) {
            queueInput(s, { kind: 'call-plate', ticket: call.ticket });
            row.plateCalls++;
          }
          const action = kitchen.cookingStep(s);
          if (action?.ready) {
            queueInput(s, { kind: 'cook-step', ticket: action.ticket, instinct: policy === 'instinct' });
            row.cookingSteps++;
          }
          const portion = helpOptions(s)[0];
          if (portion) {
            queueInput(s, { kind: 'help', ticket: portion.ticket, station: portion.station });
            row.helpStarts++;
            if (policy === 'instinct' && edition === 'pass@7')
              queueInput(s, { kind: 'cook-step', ticket: portion.ticket, instinct: true });
          }
        }
        const seconds = 1 / clockPlayback(s, 1).rate;
        const prior = row.samples.at(-1);
        row.samples.push({
          minute: s.minute,
          seconds,
          startSeconds: prior ? prior.startSeconds + prior.seconds : 0,
          available,
        });
        const night = s.night;
        if (s.minute + 1 === closeAt(s.night)) {
          // chefMinute ticks to this minute before closeNight lives the evening.
          const atClose = restore(snapshot(s.chef));
          tick(atClose, s.minute);
          row.chefExertionAtClose = atClose.body.exertion;
        }
        step(s);
        const served = s.tickets.filter((t) => t.status === 'served');
        row.fed = served.length;
        row.total = s.tickets.length;
        row.lastFeedMinute = Math.max(...served.map((t) => t.servedAt ?? 0), row.samples[0]?.minute ?? 0);
        row.quality = {};
        for (const ticket of served) {
          const key = `${ticket.quality ?? 'unrecorded'}/${ticket.freshness ?? 'unrecorded'}`;
          row.quality[key] = (row.quality[key] ?? 0) + 1;
        }
        if (s.night !== night) throw Error('Unexpected direct night transition');
      }
      for (const [night, row] of stats) {
        if (!row.samples.length) continue;
        const result = {
          edition,
          seed,
          policy,
          night,
          handsOnActs: row.helpStarts + row.cookingSteps + row.plateCalls,
          helpStarts: row.helpStarts,
          cookingSteps: row.cookingSteps,
          plateCalls: row.plateCalls,
          priorityDecisions: row.priorityDecisions,
          manualAsks: row.manualAsks,
          staffingDecisions: row.staffingDecisions,
          fed: row.fed,
          total: row.total,
          quality: row.quality,
          chefExertionAtClose: row.chefExertionAtClose,
          durationSeconds: row.samples.reduce((n, sample) => n + sample.seconds, 0),
          longestGap: longestGap(row.samples),
          first300SecondsGap: longestGap(row.samples, 300),
          throughLastFeedGap: longestGap(row.samples, Infinity, row.lastFeedMinute),
          lastFeedMinute: row.lastFeedMinute,
        };
        rows.push(result);
        console.log(JSON.stringify(result));
      }
    }
for (const edition of ['pass@6', 'pass@7'])
  for (const policy of ['hands-off', 'attentive', 'instinct']) {
    const selected = rows.filter((row) => row.edition === edition && row.policy === policy);
    const sum = (
      key: 'handsOnActs' | 'fed' | 'total' | 'manualAsks' | 'staffingDecisions' | 'chefExertionAtClose',
    ) => selected.reduce((n, row) => n + row[key], 0);
    const monday = selected.filter((row) => row.night === 1);
    console.log(
      JSON.stringify({
        summary: true,
        edition,
        policy,
        services: selected.length,
        averages: Object.fromEntries(
          ['handsOnActs', 'fed', 'total', 'manualAsks', 'staffingDecisions', 'chefExertionAtClose'].map(
            (key) => [key, sum(key as Parameters<typeof sum>[0]) / selected.length],
          ),
        ),
        mondayWorstWholeService: [...monday].sort((a, b) => b.longestGap.seconds - a.longestGap.seconds)[0],
        mondayWorstFirst300: [...monday].sort(
          (a, b) => b.first300SecondsGap.seconds - a.first300SecondsGap.seconds,
        )[0],
        mondayWorstThroughLastFeed: [...monday].sort(
          (a, b) => b.throughLastFeedGap.seconds - a.throughLastFeedGap.seconds,
        )[0],
      }),
    );
  }

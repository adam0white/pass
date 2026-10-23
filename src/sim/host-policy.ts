// Deterministic host decisions shared by measurements and the first-week shortcut.
import {
  boardDefaults,
  cookingChoice,
  cookingStep,
  cookOf,
  type GameState,
  helpOptions,
  hints,
  memberOf,
  onShift,
  owed,
  personOf,
  plateOptions,
  priorityOptions,
  queueInput,
  staffingOptions,
  stationOf,
  stationsTonight,
  step,
} from './kitchen.ts';

export type Policy = 'none' | 'ask' | 'insist' | 'care' | 'flex' | 'push' | 'flex-chef';

const WORK = { grill: 5, cold: 3.5, oven: 6, dish: 1.4 } as const;

export function bot(s: GameState, policy: Policy) {
  if (policy === 'flex-chef') policy = 'flex';
  if (policy === 'none' || s.minute % 5 !== 0) return;
  const open = s.tickets.filter((t) => t.status === 'open');
  const asked: Record<string, string> = {};
  for (const id of onShift(s)) {
    const c = cookOf(s, id);
    if (c.pending) continue;
    const st = stationOf(s, id);
    const want = memberOf(s, id).home;
    if (policy === 'flex' || policy === 'push') {
      const push = policy === 'push';
      const o = owed(s);
      const need: Record<string, number> = {
        grill: o.grill * WORK.grill,
        cold: o.cold * WORK.cold,
        oven: o.oven * WORK.oven + (s.oven.heat < 0.7 ? 10 : 0),
        dish: s.plates.pile * WORK.dish - s.plates.clean,
      };
      const taken = onShift(s).map(
        (x) => asked[x] ?? (cookOf(s, x).pending?.verb as string | undefined) ?? stationOf(s, x),
      );
      const best = stationsTonight(s)
        .filter((x) => (need[x] ?? 0) > 0)
        .sort(
          (a, b) =>
            (need[b] ?? 0) - (taken.includes(b) ? 8 : 0) - ((need[a] ?? 0) - (taken.includes(a) ? 8 : 0)),
        )[0];
      const h = best ? hints(s, id).find((x) => x.verb === best) : undefined;
      if (best && st !== best && h && h.verdict !== 'refused' && (!st || (need[st] ?? 0) < 2)) {
        queueInput(s, { kind: 'ask', cook: id, verb: best, insist: push });
        asked[id] = best;
      } else if (!st && open.length === 0 && personOf(s, id).body.satiety < 0.5)
        queueInput(s, { kind: 'ask', cook: id, verb: 'eat' });
      continue;
    }
    if (policy === 'care') {
      const h = hints(s, id).find((x) => x.verb === want);
      if (!st && open.length > 0 && h && (h.verdict === 'assented' || h.verdict === 'modified'))
        queueInput(s, { kind: 'ask', cook: id, verb: want });
      continue;
    }
    if (
      !st &&
      open.length > 0 &&
      (!['pass@10', 'pass@11', 'pass@12'].includes(s.version) ||
        hints(s, id, policy === 'insist').find((h) => h.verb === want)?.verdict !== 'refused')
    )
      queueInput(s, { kind: 'ask', cook: id, verb: want, insist: policy === 'insist' });
  }
}

export type Arm = 'promise-all' | 'promise-none' | 'promise-first';

export function sunday(s: GameState, arm: Arm = 'promise-none') {
  const p = s.sunday;
  if (!p) return;
  if (p.candidates[0]) queueInput(s, { kind: 'choose', key: 'hire', value: p.candidates[0] });
  if (p.offday) queueInput(s, { kind: 'choose', key: 'offday', value: 'yes' });
  for (const t of p.tabs) queueInput(s, { kind: 'choose', key: `tab:${t}`, value: 'ask' });
  for (const id of p.parties ?? [])
    queueInput(s, {
      kind: 'choose',
      key: `promise:${id}`,
      value:
        arm === 'promise-all' || (arm === 'promise-first' && id === p.parties?.[0]) ? 'promise' : 'plain',
    });
  if (p.sell) queueInput(s, { kind: 'choose', key: 'sell', value: 'keep' });
}

/** Careful food work once per kitchen minute, matching hands-on-b's careful arm. */
export function carefulChef(s: GameState) {
  const priority = priorityOptions(s)[0];
  if (priority) queueInput(s, { kind: 'pass-priority', ticket: priority.ticket });
  for (const call of plateOptions(s)) queueInput(s, { kind: 'call-plate', ticket: call.ticket });
  const choice = cookingChoice(s);
  const action = cookingStep(s);
  if (choice) queueInput(s, { kind: 'cook-choice', ticket: choice.ticket, choice: 'careful' });
  else if (action?.ready && !s.help?.instinct)
    queueInput(s, { kind: 'cook-step', ticket: action.ticket, instinct: false });
  if (!s.chefNext) {
    const portion = helpOptions(s)[0];
    if (portion) queueInput(s, { kind: 'help', ticket: portion.ticket, station: portion.station });
  }
}

/** One deterministic host turn. Opening screens does not consume a kitchen minute. */
export function advance(s: GameState, policy: Policy, arm: Arm = 'promise-none') {
  if (s.phase === 'board') {
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    queueInput(s, { kind: 'open' });
    return;
  }
  for (const d of s.staffing ?? []) {
    if (d.state !== 'asking') continue;
    queueInput(s, {
      kind: 'staff',
      id: d.id,
      cover: policy === 'none' ? null : (staffingOptions(s, d)[0] ?? null),
    });
  }
  if (s.phase === 'evening') {
    if (s.night === 3) queueInput(s, { kind: 'jar', choice: 'leave' });
    queueInput(s, { kind: 'open' });
    return;
  }
  if (s.phase === 'sunday') {
    sunday(s, arm);
    queueInput(s, { kind: 'open' });
    return;
  }
  if (s.request?.state === 'asking') queueInput(s, { kind: 'answer', choice: 'yes' });
  bot(s, policy);
  if (policy === 'flex-chef') carefulChef(s);
  step(s);
}

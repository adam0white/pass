// Headless balance measure: policy bots x seeds -> nights, takings, bills, trust, quits.
// Run: npm run measure [-- seeds=4] [p=flex,care]
import { weekOf } from '../src/sim/campaign.ts';
import {
  activeCrew,
  boardDefaults,
  cookOf,
  type GameState,
  hints,
  memberOf,
  newGame,
  onShift,
  owed,
  personOf,
  queueInput,
  staffingOptions,
  stationOf,
  stationsTonight,
  step,
  trustOf,
} from '../src/sim/kitchen.ts';

type Policy = 'none' | 'ask' | 'insist' | 'care' | 'flex' | 'push';
let push = false;

const WORK = { grill: 5, cold: 3.5, oven: 6, dish: 1.4 } as const;

function bot(s: GameState, policy: Policy) {
  if (policy === 'none' || s.minute % 5 !== 0) return;
  const open = s.tickets.filter((t) => t.status === 'open');
  const asked: Record<string, string> = {};
  for (const id of onShift(s)) {
    const c = cookOf(s, id);
    if (c.pending) continue;
    const st = stationOf(s, id);
    const want = memberOf(s, id).home;
    if (policy === 'flex' || policy === 'push') {
      push = policy === 'push';
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
    if (!st && open.length > 0)
      queueInput(s, { kind: 'ask', cook: id, verb: want, insist: policy === 'insist' });
  }
}

function sunday(s: GameState) {
  const p = s.sunday;
  if (!p) return;
  if (p.candidates[0]) queueInput(s, { kind: 'choose', key: 'hire', value: p.candidates[0] });
  if (p.offday) queueInput(s, { kind: 'choose', key: 'offday', value: 'yes' });
  for (const t of p.tabs) queueInput(s, { kind: 'choose', key: `tab:${t}`, value: 'ask' });
  if (p.sell) queueInput(s, { kind: 'choose', key: 'sell', value: 'keep' });
}

export function run(seed: number, policy: Policy) {
  const s = newGame(seed);
  const t0 = performance.now();
  while (s.phase !== 'end') {
    if (s.phase === 'board') {
      queueInput(s, { kind: 'board', rows: boardDefaults(s) });
      queueInput(s, { kind: 'open' });
      continue;
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
      continue;
    }
    if (s.phase === 'sunday') {
      sunday(s);
      queueInput(s, { kind: 'open' });
      continue;
    }
    if (s.request?.state === 'asking') queueInput(s, { kind: 'answer', choice: 'yes' });
    bot(s, policy);
    step(s);
  }
  const ms = Math.round(performance.now() - t0);
  const bills = s.reports.filter((r) => r.bill).map((r) => r.bill);
  return {
    seed,
    policy,
    ms,
    lost: s.lost,
    bills: bills.map((b) => (b ? `${b.paid ? 'paid' : `short ${b.short}`}/${b.amount}` : '')).join(' '),
    weekTakings: [1, 2, 3, 4].map((w) =>
      s.reports.filter((r) => weekOfNight(r.night) === w).reduce((a, r) => a + r.takings, 0),
    ),
    nights: s.reports.map((r) => `${r.served}/${r.served + r.walked}`).join(' '),
    crew: activeCrew(s)
      .map((m) => `${m.id}:${trustOf(personOf(s, m.id)).toFixed(2)}`)
      .join(' '),
    left: s.crew
      .filter((m) => m.left)
      .map((m) => m.id)
      .join(','),
    stamps: s.stamps.map((x) => x.id).join(','),
  };
}

import { planOf } from '../src/sim/campaign.ts';

const weekOfNight = (n: number) => planOf(n).week;
void weekOf;

const seeds = Number(process.argv.find((a) => a.startsWith('seeds='))?.slice(6) ?? 3);
const policies = (process.argv
  .find((a) => a.startsWith('p='))
  ?.slice(2)
  .split(',') ?? ['none', 'ask', 'insist', 'care', 'flex']) as Policy[];
for (const policy of policies)
  for (let i = 0; i < seeds; i++) console.log(JSON.stringify(run(1000 + i, policy)));

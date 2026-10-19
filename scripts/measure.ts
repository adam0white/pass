// Headless balance measure: policy bots x seeds -> served, walked, takings, skims, walkouts, trust.
// Run: npm run measure [-- seeds=4]
import { COOKS, type CookId, HOME_STATION } from '../src/sim/cooks.ts';
import {
  BANK_TARGET,
  cookOf,
  type GameState,
  hints,
  newGame,
  personOf,
  queueInput,
  stationOf,
  step,
} from '../src/sim/kitchen.ts';

type Policy = 'none' | 'ask' | 'insist' | 'care' | 'flex';

function bot(s: GameState, policy: Policy) {
  if (policy === 'none' || s.minute % 5 !== 0) return;
  const open = s.tickets.filter((t) => t.status === 'open');
  for (const id of COOKS) {
    const c = cookOf(s, id);
    if (!c.here || c.gone || c.pending) continue;
    const st = stationOf(s, id);
    const want = HOME_STATION[id];
    if (policy === 'flex') {
      const g = open.reduce((n, t) => n + t.grill - t.doneGrill, 0);
      const c2 = open.reduce((n, t) => n + t.cold - t.doneCold, 0);
      const pile = s.plates.pile;
      const need: Record<'grill' | 'cold' | 'dish', number> = {
        grill: g * 5,
        cold: c2 * 3.5,
        dish: s.night === 1 ? -1 : pile * 1.4 - s.plates.clean,
      };
      const taken = COOKS.map((x) => stationOf(s, x)).filter(Boolean);
      const best = (['grill', 'cold', 'dish'] as const)
        .filter((x) => need[x] > 0)
        .sort((a, b) => need[b] - need[a] - (taken.includes(b) ? 6 : 0) + (taken.includes(a) ? 6 : 0))[0];
      const h = best ? hints(s, id).find((x) => x.verb === best) : undefined;
      if (best && st !== best && h && h.verdict !== 'refused' && (!st || need[st] < 2))
        queueInput(s, { kind: 'ask', cook: id, verb: best });
      else if (!st && open.length === 0 && personOf(s, id).body.satiety < 0.5)
        queueInput(s, { kind: 'ask', cook: id, verb: 'eat' });
      continue;
    }
    if (policy === 'care') {
      const fatigue = personOf(s, id).body;
      void fatigue;
      const h = hints(s, id).find((x) => x.verb === want);
      if (!st && open.length > 0 && h && (h.verdict === 'assented' || h.verdict === 'modified'))
        queueInput(s, { kind: 'ask', cook: id, verb: want });
      continue;
    }
    if (!st && open.length > 0)
      queueInput(s, { kind: 'ask', cook: id, verb: want, insist: policy === 'insist' });
  }
}

function run(seed: number, policy: Policy) {
  const s = newGame(seed);
  const t0 = performance.now();
  while (s.phase !== 'end') {
    if (s.phase === 'evening') {
      if (s.night === 3) queueInput(s, { kind: 'jar', choice: 'leave' });
      queueInput(s, { kind: 'open' });
      continue;
    }
    if (s.call === 'asking') queueInput(s, { kind: 'call', choice: 'go' });
    bot(s, policy);
    step(s);
  }
  const ms = Math.round(performance.now() - t0);
  return {
    seed,
    policy,
    ms,
    till: s.till,
    met: s.till >= BANK_TARGET,
    nights: s.reports.map((r) => `${r.served}/${r.served + r.walked}`).join(' '),
    skimmed: s.jarSkimmed,
    critic: s.reports[4]?.critic,
    trust: COOKS.map((id: CookId) => personOf(s, id).will.voices[0]?.trust.toFixed(2)).join(' '),
    reviews: s.reports
      .flatMap((r) => r.reviews.filter((x) => x.line).map((x) => `${r.night}${x.id[0]}:${x.line}`))
      .slice(0, 4),
  };
}

const seeds = Number(process.argv.find((a) => a.startsWith('seeds='))?.slice(6) ?? 3);
const policies = (process.argv
  .find((a) => a.startsWith('p='))
  ?.slice(2)
  .split(',') ?? ['none', 'ask', 'insist', 'care', 'flex']) as Policy[];
for (const policy of policies)
  for (let i = 0; i < seeds; i++) console.log(JSON.stringify(run(1000 + i, policy)));

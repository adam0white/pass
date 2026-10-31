/** F-2167: a cook who defers every job for the toilet must be able to finish going. */
import { expect, it } from 'vitest';
import { nightStart } from '../src/sim/campaign.ts';
import { boardDefaults, cookOf, newGame, personOf, queueInput, step } from '../src/sim/kitchen.ts';

const fill = (s: ReturnType<typeof newGame>, id: string) =>
  (personOf(s, id).body as { bladder: { fill: number } }).bladder.fill;

/** Service with the default plan and no chef input, so only the cooks' own choices run. */
function service(seed: number) {
  const s = newGame(seed, 'pass@20');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  return s;
}

for (const seed of [7, 42, 99]) {
  it(`seed ${seed}: each toilet visit empties the bladder and a prayer runs to its end`, () => {
    const s = service(seed);
    const visits: { id: string; before: number; after: number }[] = [];
    const plannedBreak = (id: string) =>
      s.board?.rows.some((r) => {
        const late = s.minute - nightStart(s.night) - r.breakAt;
        return r.cook === id && (late === 0 || late === 1 || late === 20 || late === 21);
      }) ?? false;
    const prayers: { id: string; ends: number; cutAt?: number }[] = [];
    const open = new Map<string, { before: number }>();
    const watching = new Map<string, { ends: number; cutAt?: number }>();
    for (let i = 0; i < 500 && s.minute < 1400; i++) {
      step(s);
      if (s.phase !== 'service') continue;
      for (const id of ['selim', 'dilek']) {
        if (cookOf(s, id).gone) continue;
        const act = personOf(s, id).activity?.affordanceId;
        const was = open.get(id);
        if (act === 'toilet' && !was) open.set(id, { before: fill(s, id) });
        if (act !== 'toilet' && was) {
          // A planned meal break starting is a real interruption, not the review cutting the visit short.
          if (!plannedBreak(id)) visits.push({ id, before: was.before, after: fill(s, id) });
          open.delete(id);
        }
        const p = watching.get(id);
        if (act === 'pray' && !p) {
          const ends = personOf(s, id).activity?.endsAt ?? s.minute;
          const rec = { id, ends };
          watching.set(id, rec);
          prayers.push(rec);
        } else if (p && act !== 'pray') {
          if (s.minute < p.ends - 1) p.cutAt = s.minute;
          watching.delete(id);
        } else if (p && s.minute >= p.ends) watching.delete(id);
      }
    }
    expect(visits.length).toBeGreaterThan(0);
    // Before the fix a visit was cut after two of its three minutes, so the fill only ever rose.
    for (const v of visits) expect(v.after, `${v.id} fill ${v.before} -> ${v.after}`).toBeLessThan(v.before);
    expect(visits.length, 'no cook should cycle through the bathroom all night').toBeLessThan(12);
    for (const p of prayers)
      expect(p.cutAt, `${p.id} prayer cut at ${p.cutAt} (ends ${p.ends})`).toBeUndefined();
  }, 60000);
}

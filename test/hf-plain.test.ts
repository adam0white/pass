import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CAST, freshActor } from '../src/sim/cast-chapter.ts';
import { replayExport } from '../src/sim/continuation.ts';
import { HIRES, makeHire } from '../src/sim/cooks.ts';
import { advance } from '../src/sim/host-policy.ts';
import { boardDefaults, cloneState, exportRun, newGame, queueInput, step } from '../src/sim/kitchen.ts';
import { hfMechanics } from './hf-state.ts';

describe('published HF plain narration', () => {
  const baseline = JSON.parse(
    readFileSync(new URL('./fixtures/hf-2.18-mechanics.json', import.meta.url), 'utf8'),
  ) as { rows: { seed: number; before: string }[] };
  for (const row of baseline.rows)
    it(`preserves HF 2.18 mechanics and semantic history for seed ${row.seed}`, () => {
      const s = newGame(row.seed);
      let guard = 0;
      while (s.phase !== 'end' && guard++ < 40000) advance(s, 'ask', 'promise-none');
      expect(s.phase).toBe('end');
      expect(
        createHash('sha256')
          .update(JSON.stringify(hfMechanics(cloneState(s))))
          .digest('hex'),
      ).toBe(row.before);
    });

  it('preserves semantic line history and mechanics in the upgrade proof', () => {
    expect(hfMechanics({ usedLines: ['selim:First line'] })).not.toEqual(
      hfMechanics({ usedLines: ['dilek:First line'] }),
    );
    expect(hfMechanics({ intention: 'missed' })).not.toEqual(hfMechanics({ intention: 'I want to eat.' }));
    expect(hfMechanics({ rng: { a: 1 } })).not.toEqual(hfMechanics({ rng: { a: 2 } }));
    expect(hfMechanics({ text: 'Old reply', lexicon: { plainEnglish: true }, plainNarration: true })).toEqual(
      hfMechanics({ text: 'New reply' }),
    );
  });
  it('opts every fresh founder, chef and canonical hire into persisted plain narration', () => {
    const s = newGame(42);
    for (const p of [
      ...s.people,
      s.chef,
      ...HIRES.filter((h) => CAST.some((c) => c.castId.split('.')[2] === h.id)).map((h) =>
        makeHire(h, 42, 1045, 'pass@13'),
      ),
      freshActor('selim', 42),
    ])
      expect(p.lexicon?.plainEnglish).toBe(true);
  });
  it('replays current exports exactly and preserves an explicitly saved narration choice', () => {
    for (const choice of [true, false]) {
      const s = newGame(42, undefined, undefined, choice);
      queueInput(s, { kind: 'board', rows: boardDefaults(s) });
      queueInput(s, { kind: 'open' });
      for (let i = 0; i < 20; i++) step(s);
      const ex = exportRun(s, '2.21.0');
      expect(cloneState(replayExport(ex))).toEqual(cloneState(s));
      expect(replayExport(ex).people[0]?.lexicon?.plainEnglish).toBe(choice || undefined);
    }
  });
});

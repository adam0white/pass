import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cloneState, type newGame, replay, restoreState, step } from '../src/sim/kitchen.ts';

const legacy = JSON.parse(readFileSync(new URL('./fixtures/edition4-hashes.json', import.meta.url), 'utf8'));
const hash = (s: ReturnType<typeof newGame>) =>
  createHash('sha256')
    .update(JSON.stringify(cloneState(s)))
    .digest('hex');

// Captured before pass@5 from the baseline commit recorded in the fixture.
// Hash every serialized field, including HF people, RNG state, inputs and logs.
describe('pass@5 legacy full-state replay', () => {
  for (const row of legacy.rows) {
    it(`${row.edition}, seed ${row.seed}, ${row.policy}: three nights and restored continuations`, () => {
      expect(row.checkpoints.map((c: { night: number }) => c.night)).toEqual([1, 3, 6]);
      for (const checkpoint of row.checkpoints) {
        const s = replay(
          row.seed,
          row.inputs.slice(0, checkpoint.inputCount),
          checkpoint.minute,
          row.edition,
        );
        expect(s.version).toBe(row.edition);
        expect(hash(s), `night ${checkpoint.night}, minute ${checkpoint.minute}`).toBe(checkpoint.hash);
        const restored = restoreState(JSON.parse(JSON.stringify(cloneState(s))));
        expect(restored.version).toBe(row.edition);
        for (let k = 0; k < 30; k++) step(restored);
        expect(hash(restored)).toBe(checkpoint.restoredAfter30);
      }
    }, 20000);
  }
});

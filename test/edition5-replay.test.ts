import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cloneState,
  type Export,
  exportRun,
  type GameState,
  type Input,
  replay,
  restoreState,
  step,
} from '../src/sim/kitchen.ts';
import { legacyHash, legacyState, proseFree } from './hash.ts';

interface Checkpoint {
  night: number;
  minute: number;
  inputCount: number;
  hash: string;
  restoredHash: string;
  restoredAfter30: string;
}
interface Baseline {
  baselineCommit: string;
  framework: string;
  sampleNotebook: Export;
  rows: { edition: string; seed: number; policy: string; inputs: Input[]; checkpoints: Checkpoint[] }[];
}
const baseline: Baseline = JSON.parse(
  readFileSync(new URL('./fixtures/edition5-hashes.json', import.meta.url), 'utf8'),
);
const hash = (s: GameState) => legacyHash(s, baseline.framework);
const serializedExport = (s: GameState, framework: string): Export =>
  JSON.parse(JSON.stringify(exportRun(s, framework)));
const replayNotebook = (notebook: Export) =>
  replay(notebook.seed, notebook.inputs, notebook.state.minute, notebook.game);

// Captured from the immutable source commit before the UI edits. The fixture keeps
// baseline input logs, all hashes, and one complete exported notebook as an example.
// Hash every serialized field, including HF people, RNG state, inputs and logs.
describe('pass@5 baseline notebook replay', () => {
  it('records the immutable source commit and the complete seed/policy matrix', () => {
    expect(baseline.baselineCommit).toBe('87f570185054cb17b6eb6fa76ba6465c85cb4add');
    expect(baseline.framework).toBe('2.8.0');
    expect(baseline.rows.map(({ seed, policy }) => [seed, policy])).toEqual(
      [42, 1001, 2026].flatMap((seed) => ['idle', 'plain', 'insist'].map((policy) => [seed, policy])),
    );
  });

  it('replays and re-exports a complete notebook exported by the baseline', () => {
    const notebook = baseline.sampleNotebook;
    expect(notebook.game).toBe('pass@5');
    expect(notebook.framework).toBe(baseline.framework);
    expect(notebook.inputs).toEqual(notebook.state.inputs);
    const replayed = replayNotebook(notebook);
    expect(proseFree(legacyState(replayed, notebook.framework))).toEqual(proseFree(notebook.state));
    expect(
      proseFree({
        ...serializedExport(replayed, notebook.framework),
        state: legacyState(replayed, notebook.framework),
      }),
    ).toEqual(proseFree(notebook));
  });

  for (const row of baseline.rows) {
    it(`seed ${row.seed}, ${row.policy}: full-state replay, restore and re-export`, () => {
      expect(row.edition).toBe('pass@5');
      expect(row.checkpoints.map((c) => c.night)).toEqual([1, 3, 6]);
      for (const checkpoint of row.checkpoints) {
        const label = `night ${checkpoint.night}, minute ${checkpoint.minute}`;
        const replayed = replay(
          row.seed,
          row.inputs.slice(0, checkpoint.inputCount),
          checkpoint.minute,
          row.edition,
        );
        expect(replayed.version).toBe(row.edition);
        expect(replayed.night).toBe(checkpoint.night);
        expect(replayed.minute).toBe(checkpoint.minute);
        expect(hash(replayed), `${label}: replay`).toBe(checkpoint.hash);

        const exported = serializedExport(replayed, baseline.framework);
        expect(hash(replayNotebook(exported)), `${label}: re-export replay`).toBe(checkpoint.hash);
        const restored = restoreState(exported.state);
        expect(cloneState(restored)).toEqual(exported.state);
        // HF restore preserves values but can change object key insertion order.
        expect(hash(restored), `${label}: restored export`).toBe(checkpoint.restoredHash);
        for (let k = 0; k < 30; k++) step(restored);
        expect(hash(restored), `${label}: restored continuation`).toBe(checkpoint.restoredAfter30);
      }
    }, 30000);
  }
});

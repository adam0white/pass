import { createHash } from 'node:crypto';
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
  provenance: { source: string; assetSha256: string; assetBytes: number };
  sampleNotebook: Export;
  rows: { edition: string; seed: number; policy: string; inputs: Input[]; checkpoints: Checkpoint[] }[];
}
const baseline: Baseline = JSON.parse(
  readFileSync(new URL('./fixtures/edition5-live-d-hashes.json', import.meta.url), 'utf8'),
);
const hash = (s: GameState) =>
  createHash('sha256')
    .update(JSON.stringify(cloneState(s)))
    .digest('hex');
const serializedExport = (s: GameState, framework: string): Export =>
  JSON.parse(JSON.stringify(exportRun(s, framework)));
const replayNotebook = (notebook: Export) =>
  replay(notebook.seed, notebook.inputs, notebook.state.minute, notebook.game);

// Captured by executing the downloaded live production JavaScript before edition 6.
// The fixture records the asset URL and SHA-256, input logs and a complete notebook.
// Hash every serialized field, including HF people, RNG state, inputs and logs.
describe('pass@6 preserves the live pass@5 production notebook', () => {
  it('records the immutable source commit and the complete seed/policy matrix', () => {
    expect(baseline.baselineCommit).toBe('7116cfc8fe32b8e2504ed9f29ba382d515d599b6');
    expect(baseline.framework).toBe('2.8.0');
    expect(baseline.provenance.source).toBe('https://pass.adamwhite.work/assets/index-Qfwn1qIG.js');
    expect(baseline.provenance.assetSha256).toBe(
      'd67c9b80a1106a8dfcf765ab05657936d7da21468d9f138c4ab9f071ab32eb43',
    );
    expect(baseline.provenance.assetBytes).toBe(324396);
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
    expect(cloneState(replayed)).toEqual(notebook.state);
    expect(serializedExport(replayed, notebook.framework)).toEqual(notebook);
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

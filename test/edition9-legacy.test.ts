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
import { legacyHash, legacyState } from './hash.ts';

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
  sampleNotebooks: Export[];
  rows: { edition: string; seed: number; policy: string; inputs: Input[]; checkpoints: Checkpoint[] }[];
}
const baseline: Baseline = JSON.parse(
  readFileSync(new URL('./fixtures/edition8-live-pattern-hashes.json', import.meta.url), 'utf8'),
);
const hash = (s: GameState) => legacyHash(s, baseline.framework);
const serializedExport = (s: GameState, framework: string): Export =>
  JSON.parse(JSON.stringify(exportRun(s, framework)));
const replayNotebook = (notebook: Export) =>
  replay(notebook.seed, notebook.inputs, notebook.state.minute, notebook.game);

// Captured by executing the downloaded live production JavaScript before edition 9.
// The fixture records the asset URL and SHA-256, input logs and a complete notebook.
// Hash every serialized field, including HF people, RNG state, inputs and logs.
describe('pass@9 preserves live pass@8 production notebooks', () => {
  it('records the immutable source commit and the complete seed/policy matrix', () => {
    expect(baseline.baselineCommit).toBe('5a2a4498c3ffba787965e4d2c1bd0a91e5a49107');
    expect(baseline.framework).toBe('2.8.0');
    expect(baseline.provenance.source).toBe('https://pass.adamwhite.work/assets/index-CjSY9CaM.js');
    expect(baseline.provenance.assetSha256).toBe(
      '9594ebb59fb72d6b0b95dc9f39b685b2f4b1128ba41719d4a23aa72a4ab9c8e5',
    );
    expect(baseline.provenance.assetBytes).toBe(349981);
    expect(baseline.rows.map(({ edition, seed, policy }) => [edition, seed, policy])).toEqual(
      ['pass@8'].flatMap((edition) =>
        [42, 1001, 2026].flatMap((seed) =>
          ['idle', 'plain', 'insist'].map((policy) => [edition, seed, policy]),
        ),
      ),
    );
  });

  it('replays and re-exports a complete notebook exported by the baseline', () => {
    for (const notebook of baseline.sampleNotebooks) {
      expect(['pass@8']).toContain(notebook.game);
      expect(notebook.framework).toBe(baseline.framework);
      expect(notebook.inputs).toEqual(notebook.state.inputs);
      const replayed = replayNotebook(notebook);
      expect(legacyState(replayed, notebook.framework)).toEqual(notebook.state);
      expect({
        ...serializedExport(replayed, notebook.framework),
        state: legacyState(replayed, notebook.framework),
      }).toEqual(notebook);
    }
  });

  for (const row of baseline.rows) {
    it(`${row.edition}, seed ${row.seed}, ${row.policy}: full-state replay, restore and re-export`, () => {
      expect(['pass@8']).toContain(row.edition);
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

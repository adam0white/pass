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
  provenance: { source: string; assetSha256: string; assetBytes: number };
  sampleNotebooks: Export[];
  rows: { edition: string; seed: number; policy: string; inputs: Input[]; checkpoints: Checkpoint[] }[];
}
const baseline: Baseline = JSON.parse(
  readFileSync(new URL('./fixtures/edition7-live-pattern-hashes.json', import.meta.url), 'utf8'),
);
const hash = (s: GameState) => legacyHash(s, baseline.framework);
const serializedExport = (s: GameState, framework: string): Export =>
  JSON.parse(JSON.stringify(exportRun(s, framework)));
const replayNotebook = (notebook: Export) =>
  replay(notebook.seed, notebook.inputs, notebook.state.minute, notebook.game);

// Captured by executing the downloaded live production JavaScript before edition 8.
// The fixture records the asset URL and SHA-256, input logs and a complete notebook.
// Hash every serialized field, including HF people, RNG state, inputs and logs.
describe('pass@8 preserves live pass@7 production notebooks', () => {
  it('records the immutable source commit and the complete seed/policy matrix', () => {
    expect(baseline.baselineCommit).toBe('bf28f56a244bc23afe4c4d3ae555720741771369');
    expect(baseline.framework).toBe('2.8.0');
    expect(baseline.provenance.source).toBe('https://pass.adamwhite.work/assets/index-Cw89a6Ob.js');
    expect(baseline.provenance.assetSha256).toBe(
      '7d9f24535f32b02e466b13511327b7e9033b1fd26a532455875fafbf93c22a21',
    );
    expect(baseline.provenance.assetBytes).toBe(343554);
    expect(baseline.rows.map(({ edition, seed, policy }) => [edition, seed, policy])).toEqual(
      ['pass@7'].flatMap((edition) =>
        [42, 1001, 2026].flatMap((seed) =>
          ['idle', 'plain', 'insist'].map((policy) => [edition, seed, policy]),
        ),
      ),
    );
  });

  it('replays and re-exports a complete notebook exported by the baseline', () => {
    for (const notebook of baseline.sampleNotebooks) {
      expect(['pass@7']).toContain(notebook.game);
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
    }
  });

  for (const row of baseline.rows) {
    it(`${row.edition}, seed ${row.seed}, ${row.policy}: full-state replay, restore and re-export`, () => {
      expect(['pass@7']).toContain(row.edition);
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

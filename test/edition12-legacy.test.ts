import { expect, it } from 'vitest';
import { cloneState, type Input, replay } from '../src/sim/kitchen.ts';
import baseline from './fixtures/edition11-one-cast-baseline.json';
import { pinHash } from './hash.ts';

it('keeps pass@11 service and Sunday behavior from the pre-upgrade source', () => {
  for (const row of baseline.rows) {
    const state = cloneState(replay(row.seed, row.inputs as Input[], row.minute, row.edition));
    for (const p of [...state.people, state.chef]) p.engine = baseline.framework;
    expect(pinHash(state)).toBe(row.hash);
  }
});

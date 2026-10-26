import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { advance } from '../src/sim/host-policy.ts';
import { cloneState, newGame } from '../src/sim/kitchen.ts';
import baseline from './fixtures/hf3-full-state.json';

for (const row of baseline.rows) {
  const seed = Number.parseInt(row.file, 10);
  it(`preserves the complete pre-HF3 campaign state for seed ${seed}`, () => {
    const state = newGame(seed);
    let turns = 0;
    while (state.phase !== 'end' && turns++ < 40000) advance(state, 'ask', 'promise-none');
    expect(state.phase).toBe('end');
    const raw = cloneState(state);
    const allowed = [...raw.people.map((_, index) => `/people/${index}/engine`), '/chef/engine'];
    expect(allowed).toEqual(row.allowedPaths);
    for (const person of [...raw.people, raw.chef]) {
      expect(person.engine).toBe('2.23.0');
      person.engine = baseline.framework;
    }
    // These exact fields are the complete allowlist. No prose or history is removed.
    expect(createHash('sha256').update(JSON.stringify(raw)).digest('hex')).toBe(row.beforeRawSHA256);
  });
}

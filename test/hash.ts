import { createHash } from 'node:crypto';
import { cloneState, type GameState } from '../src/sim/kitchen.ts';

/** HF CHANGELOG 2.9.0 adds review:resolve ref; 2.13.0 stamps migrated people.
 * These metadata fields are the only permitted differences from pre-upgrade fixtures.
 * Keep all other fields and insertion order, including non-review ref fields.
 */
export function legacyState(s: GameState, framework: string): GameState {
  const state = cloneState(s);
  for (const p of [...state.people, state.chef]) p.engine = framework;
  const terms = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (record.source === 'review:resolve') delete record.ref;
    for (const child of Object.values(record)) terms(child);
  };
  terms(state);
  return state;
}

export function legacyHash(s: GameState, framework: string): string {
  return createHash('sha256')
    .update(JSON.stringify(legacyState(s, framework)))
    .digest('hex');
}

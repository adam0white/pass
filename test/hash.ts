import { createHash } from 'node:crypto';
import { cloneState, type GameState } from '../src/sim/kitchen.ts';

/** Player-facing prose (anything with a space, and break wording) outside HF people is blanked, so wording edits keep replay pins.
 * HF people, numbers, ids, inputs and every other field stay exact.
 */
export function proseFree<T>(state: T): T {
  const blank = (value: unknown, key?: string): unknown => {
    if (key === 'people' || key === 'chef') return value;
    // A deferred break names its rest in one word ("ten-minute break" before 2026-10-25, "ten" earlier).
    if (key === 'rest' && typeof value === 'string') return '·';
    if (typeof value === 'string') return /\s/u.test(value) ? '·' : value;
    if (Array.isArray(value)) return value.map((v) => blank(v));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, blank(v, k)]));
  };
  return blank(state) as T;
}

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

const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export const legacyHash = (s: GameState, framework: string): string => pinHash(legacyState(s, framework));

/** Hash an already-normalized state for a replay pin. */
export function pinHash(state: unknown): string {
  return sha(proseFree(state));
}

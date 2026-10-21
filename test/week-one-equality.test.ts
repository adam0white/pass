import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { advance, type Policy } from '../src/sim/host-policy.ts';
import { cloneState, type GameState, newGame, openAt } from '../src/sim/kitchen.ts';

function hash(s: GameState) {
  const normalized = cloneState(s);
  normalized.version = 'week-one';
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
const policies: Policy[] = ['none', 'ask', 'insist', 'care', 'flex', 'push', 'flex-chef'];

describe('pass@9 week one is exactly pass@8', () => {
  for (const seed of [1000, 1001, 1002, 1003])
    for (const policy of policies) {
      it(`seed ${seed}, ${policy}: every field through Saturday close, version normalized only`, () => {
        const old = newGame(seed, 'pass@8');
        const next = newGame(seed, 'pass@9');
        const checkpoints: string[] = [];
        for (let ticks = 0; ticks < 3000; ticks++) {
          expect([next.night, next.phase, next.minute]).toEqual([old.night, old.phase, old.minute]);
          const elapsed = old.minute - openAt(old.night);
          if ((old.phase === 'service' && [0, 5, 35, 90, 180].includes(elapsed)) || old.phase === 'evening') {
            const label = `night ${old.night}, ${old.phase}, minute ${old.minute}`;
            expect(hash(next), label).toBe(hash(old));
            checkpoints.push(label);
          }
          if (old.night === 6 && old.phase === 'evening') break;
          advance(old, policy);
          advance(next, policy);
        }
        expect(old.night).toBe(6);
        expect(old.phase).toBe('evening');
        for (let night = 1; night <= 6; night++)
          expect(
            checkpoints.filter((label) => label.startsWith(`night ${night},`)).length,
          ).toBeGreaterThanOrEqual(5);
      }, 30000);
    }
});

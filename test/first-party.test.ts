import { expect, it } from 'vitest';
import { beginAtWeekTwo, firstPartyBoard } from '../src/sim/firstweek.ts';
import { boardDefaults, fingerprint, queueInput, replay } from '../src/sim/kitchen.ts';

it('gives the player the target board, uses the board fallback before seating, and replays ordinary inputs', () => {
  for (const promised of [true, false]) {
    const s = beginAtWeekTwo(42);
    const parties = [...(s.bookings ?? [])].filter((b) => b.week === 2).sort((a, b) => a.at - b.at);
    const expected = promised ? parties.at(-1) : parties[0];
    if (!expected) throw new Error('Expected a party');
    if (promised) queueInput(s, { kind: 'choose', key: `promise:${expected.party}`, value: 'promise' });
    queueInput(s, { kind: 'open' });
    const target = firstPartyBoard(s);
    expect(target.party).toBe(expected.party);
    expect(s.phase).toBe('board');
    expect(s.night).toBe(target.night);
    expect(s.board?.agreed).toBeFalsy();
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    queueInput(s, { kind: 'open' });

    expect(s.minute).toBeLessThanOrEqual(target.at - 5);
    expect(s.help).toBeFalsy();
    const restored = replay(s.seed, s.inputs, s.minute, s.version);
    expect(fingerprint(restored)).toBe(fingerprint(s));
    expect(restored).toEqual(s);
  }
});

/**
 * Begin at the second week (pass@9): a steady hand runs week 1 with a fixed host policy whose decisions are
 * ordinary inputs, so the notebook replays exactly. Returns the state on Sunday of week 1, phase 'sunday'.
 */
import { advance } from './host-policy.ts';
import { type Booking, type GameState, newGame, queueInput } from './kitchen.ts';

export function beginAtWeekTwo(seed: number, pace?: 'nevin'): GameState {
  const s = newGame(seed);
  if (pace) queueInput(s, { kind: 'pace', value: pace });
  for (let turns = 0; turns <= 10000; turns++) {
    if (s.lost || s.phase === 'end') throw new Error('The first-week host run ended in a loss.');
    if (s.phase === 'sunday') {
      if (s.sunday?.week !== 1 || !s.reports.some((r) => r.bill?.week === 1 && r.bill.paid))
        throw new Error('The first-week host run did not reach Sunday with its bill paid.');
      return s;
    }
    if (turns === 10000) throw new Error('The first-week host run exceeded 10000 turns.');
    advance(s, 'flex-chef', 'promise-none');
  }
  throw new Error('The first-week host run did not finish.');
}

/**
 * After the player's first Sunday choices, run the preceding nights with ordinary host inputs.
 * Stop at the earliest promised party's board (or the earliest party if none was promised).
 * The player owns that board and service. The mid-service shortcut cannot guarantee free hands
 * before seating minus five: the unchanged host policy can chain reserved portions.
 */
export function firstPartyBoard(s: GameState): Booking {
  const parties = (s.bookings ?? []).filter((b) => b.week === 2);
  const promised = parties.filter((b) => b.promised);
  const target = [...(promised.length ? promised : parties)].sort((a, b) => a.at - b.at)[0];
  if (!target) throw new Error('No first party is booked.');
  for (let turns = 0; turns < 10000; turns++) {
    if (s.phase === 'board' && s.night === target.night) return target;
    if (s.lost || s.phase === 'end' || s.night > target.night)
      throw new Error('The host did not reach the first party board.');
    advance(s, 'flex-chef', 'promise-none');
  }
  throw new Error('The first-party host run exceeded 10000 turns.');
}

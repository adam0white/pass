/**
 * Begin at the second week (pass@9): a steady hand runs week 1 with a fixed host policy whose decisions are
 * ordinary inputs, so the notebook replays exactly. Returns the state on Sunday of week 1, phase 'sunday'.
 */
import { advance } from './host-policy.ts';
import { type GameState, newGame, queueInput } from './kitchen.ts';

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

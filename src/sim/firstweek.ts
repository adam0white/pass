/**
 * Begin at the second week (pass@9): a steady hand runs week 1 with a fixed host policy whose decisions are
 * ordinary inputs, so the notebook replays exactly. Returns the state on Sunday of week 1, phase 'sunday'.
 * Stub; the engine worker implements.
 */
import { type GameState, newGame } from './kitchen.ts';

export function beginAtWeekTwo(seed: number, _pace?: 'nevin'): GameState {
  return newGame(seed);
}

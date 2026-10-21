import type { GameState } from '../sim/kitchen.ts';

/** Both editions use the same portion choices, reservation and playback rules. */
export const portionEdition = (s: Pick<GameState, 'version'> | null) =>
  s?.version === 'pass@8' || s?.version === 'pass@9' || s?.version === 'pass@10';

import { type GameState, peopleRun } from '../sim/kitchen.ts';

/** Historical chef editions retain portion rules for replay; continuation uses people. */
export const portionEdition = (s: Pick<GameState, 'version' | 'peopleRun'> | null) =>
  !!s && !peopleRun(s) && ['pass@8', 'pass@9', 'pass@10'].includes(s.version);

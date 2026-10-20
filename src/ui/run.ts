import type { Export } from '../sim/kitchen.ts';

/** The send dialog can omit the redundant state while preserving an exact replay. */
export function compactRun(run: Export) {
  const { game, framework, seed, inputs, state } = run;
  return { game, framework, seed, inputs, minute: state.minute };
}

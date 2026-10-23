import type { Export } from '../sim/kitchen.ts';

/** The send dialog can omit the redundant state while preserving an exact replay. */
export function compactRun(run: Export) {
  const { state, ...header } = run;
  return { ...header, minute: state.minute };
}

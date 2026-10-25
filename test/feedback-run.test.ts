import { expect, it } from 'vitest';
import { validateReplayFile } from '../src/sim/continuation.ts';
import { cloneState, exportRun, newGame } from '../src/sim/kitchen.ts';
import { unlinkedFeedbackRun } from '../src/ui/feedback-run.ts';

it('omits only the browser consent key while the real run decoder preserves replay', async () => {
  const state = newGame(17);
  const run = {
    ...exportRun(state, '2.21.0'),
    continuity: { recordingKey: 'pass-run-browser-only', fileUnlinked: true, envelope: null, oneCast: [] },
  };
  const copy = unlinkedFeedbackRun(run) as typeof run;
  expect(copy.continuity).not.toHaveProperty('recordingKey');
  expect(copy.state).toBe(run.state);
  expect(run.continuity.recordingKey).toBe('pass-run-browser-only');
  expect(cloneState(await validateReplayFile(copy))).toEqual(cloneState(state));
});

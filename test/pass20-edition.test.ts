/** pass@20 is the only current edition: older HF4 notebooks are refused, and pass@20 replays exactly. */
import { expect, it } from 'vitest';
import { replayExport, validateReplayFile } from '../src/sim/continuation.ts';
import { verifyCommunity } from '../src/sim/hf4-person.ts';
import {
  boardDefaults,
  canReplay,
  cloneState,
  cookOf,
  exportRun,
  newGame,
  personOf,
  queueInput,
  step,
} from '../src/sim/kitchen.ts';
import pass19 from './fixtures/pass19-hf412-export.json';

const raw = (s: ReturnType<typeof newGame>) => JSON.parse(JSON.stringify(cloneState(s)));

it('refuses a real pass@19 notebook through both replay entries', async () => {
  expect(canReplay('pass@19')).toBe(false);
  expect(canReplay('pass@20')).toBe(true);
  const file = pass19 as unknown as Parameters<typeof replayExport>[0];
  expect(() => replayExport(file)).toThrow('not a supported Pass notebook');
  await expect(validateReplayFile(file)).rejects.toThrow();
  // Relabelling grants no continuation: a pass@20 file that still carries the old full state is refused.
  const relabelled = { ...file, game: 'pass@20', state: { version: 'pass@19', minute: file.minute } };
  await expect(
    validateReplayFile(relabelled as unknown as Parameters<typeof replayExport>[0]),
  ).rejects.toThrow();
}, 120000);

it('replays pass@20 exactly across a finished bathroom visit and the next inputs', async () => {
  const s = newGame(7, 'pass@20');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  let visited = false;
  for (let i = 0; i < 500 && s.phase === 'service' && !visited; i++) {
    step(s);
    for (const id of ['selim', 'dilek'])
      if (!cookOf(s, id).gone && personOf(s, id).activity?.affordanceId === 'toilet') visited = true;
  }
  expect(visited, 'a cook must go to the bathroom in the played prefix').toBe(true);
  for (let i = 0; i < 8; i++) step(s);
  const file = exportRun(s, '4.12.0');
  const replayed = await validateReplayFile(file);
  expect(raw(replayed)).toEqual(raw(s));
  for (let i = 0; i < 40; i++) {
    step(s);
    step(replayed);
  }
  expect(raw(replayed)).toEqual(raw(s));
  expect(verifyCommunity(s.chef).verified).toBe(true);
  expect(verifyCommunity(replayed.chef).verified).toBe(true);
}, 120000);

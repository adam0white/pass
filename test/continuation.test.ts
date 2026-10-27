import { readFileSync } from 'node:fs';
import { canonicalPersona } from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import { replayExport, validateReplayFile } from '../src/sim/continuation.ts';
import {
  boardDefaults,
  canReplay,
  cloneState,
  type Export,
  exportRun,
  fingerprint,
  newGame,
  queueInput,
  replay,
  step,
} from '../src/sim/kitchen.ts';

describe('pinned chapter replay', () => {
  it('keeps an explicitly old opening in its exact edition', () => {
    const old = newGame(19, 'pass@11');
    expect(replayExport(exportRun(old, '2.15.0'))).toEqual(replay(19, [], old.minute, 'pass@11'));
    expect(canReplay('pass@12')).toBe(true);
    expect(newGame(19).version).toBe('pass@13');
  });
  it('rejects a return chapter whose departure is another return', () => {
    expect(() =>
      replayExport({
        game: 'pass@12',
        seed: 1,
        inputs: [],
        minute: 1,
        returnChapter: { v: 1, prefix: { returnChapter: {} }, initial: {}, envelope: {} },
      } as never),
    ).toThrow();
  });
});

const retainedFullRun = (): Export =>
  JSON.parse(readFileSync(new URL('./fixtures/followup-pass@13-before.json', import.meta.url), 'utf8'));

it.each(['person RNG', 'chef RNG', 'world price'] as const)(
  'refuses a full notebook with altered %s outside the compact fingerprint',
  async (field) => {
    const original = retainedFullRun();
    const altered = structuredClone(original);
    if (field === 'person RNG') {
      const person = altered.state.people[0];
      if (!person) throw new Error('The retained notebook has no person.');
      person.rng.a += 1;
    } else if (field === 'chef RNG') altered.state.chef.rng.a += 1;
    else altered.state.price += 1;
    expect(fingerprint(altered.state)).toBe(fingerprint(original.state));
    expect(canonicalPersona(altered.state)).not.toBe(canonicalPersona(original.state));
    await expect(validateReplayFile(altered)).rejects.toThrow();
  },
);

it('refuses a present null state instead of treating it as a compact notebook', async () => {
  await expect(validateReplayFile({ ...retainedFullRun(), state: null } as never)).rejects.toThrow();
});

it('keeps the complete retained full notebook and its original continuation', async () => {
  const file = retainedFullRun();
  const loaded = await validateReplayFile(file);
  expect(cloneState(loaded)).toEqual(file.state);
  for (let i = 0; i < 80; i++) step(loaded);
  expect(cloneState(loaded)).toEqual(
    JSON.parse(
      readFileSync(new URL('./fixtures/followup-pass@13-continued-before.json', import.meta.url), 'utf8'),
    ),
  );
});

it('keeps current full and compact notebooks on the same complete continuation', async () => {
  const original = newGame(42, 'pass@16');
  queueInput(original, { kind: 'board', rows: boardDefaults(original) });
  queueInput(original, { kind: 'open' });
  for (let i = 0; i < 12; i++) step(original);
  const full = JSON.parse(JSON.stringify(exportRun(original, '3.0.0'))) as Export;
  const { state: _state, ...header } = full;
  const compact = { ...header, minute: original.minute };
  const loadedFull = await validateReplayFile(full);
  const loadedCompact = await validateReplayFile(compact);
  expect(cloneState(loadedFull)).toEqual(full.state);
  expect(cloneState(loadedCompact)).toEqual(full.state);
  for (let i = 0; i < 8; i++) {
    step(original);
    step(loadedFull);
    step(loadedCompact);
  }
  expect(cloneState(loadedFull)).toEqual(cloneState(original));
  expect(cloneState(loadedCompact)).toEqual(cloneState(original));
});

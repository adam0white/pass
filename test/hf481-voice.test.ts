import { expect, it } from 'vitest';
import { communityRun, glimpsePerson, predictAs } from '../src/sim/hf4-person.ts';
import {
  boardDefaults,
  cloneState,
  hints,
  newGame,
  offersFor,
  personOf,
  queueInput,
  restoreState,
} from '../src/sim/kitchen.ts';
import { suggestionWords } from '../src/sim/lines.ts';

it('voices agreed board answers once and keeps familiar cooks in ink', () => {
  const s = newGame(42, 'pass@20');
  const before = JSON.stringify(cloneState(s));
  expect(hints(s, 'selim').every((hint) => !hint.guess)).toBe(true);
  expect(JSON.stringify(cloneState(s))).toBe(before);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  const answer = s.board?.rows.find((row) => row.cook === 'selim');
  expect(answer?.accepted).toBe(true);
  expect(hints(s, 'selim').every((hint) => !hint.guess)).toBe(true);
  expect(answer?.answer).toMatch(/^(I |Chef, I |For now, I )/);
  expect(answer?.answer).not.toMatch(/assented|decided|I will work at.*I will work at.*I will work at/);
}, 60000);

it('sharpens an observer preview after repeated looks and retains that learning on restore', () => {
  const s = newGame(42, 'pass@20');
  const cook = personOf(s, 'selim');
  const confidence = () =>
    predictAs(s.chef, cook, offersFor(s, 'selim', 'grill'), {
      voiceId: 'chef',
      affordanceId: 'grill',
      strength: 0.5,
    }).confidence;
  expect(confidence()).toBe(0);
  glimpsePerson(s.chef, cook, 540, 0.8);
  const first = confidence();
  expect(first).toBeGreaterThan(0);
  expect(first).toBeLessThan(0.6);
  glimpsePerson(s.chef, cook, 555, 0.8);
  glimpsePerson(s.chef, cook, 570, 0.8);
  expect(confidence()).toBeGreaterThanOrEqual(0.6);
  const saved = JSON.parse(JSON.stringify(cloneState(s)));
  const restored = restoreState(saved);
  expect(
    predictAs(restored.chef, personOf(restored, 'selim'), offersFor(restored, 'selim', 'grill'), {
      voiceId: 'chef',
      affordanceId: 'grill',
      strength: 0.5,
    }).confidence,
  ).toBe(confidence());
  expect(communityRun(s.chef).verify().verified).toBe(true);
}, 60000);

it('uses the framework-rendered answer for current cooks', () => {
  const p = personOf(newGame(42, 'pass@20'), 'selim');
  const resolution = {
    verdict: 'modified',
    reason: 'busy',
    says: 'I will finish my meal first. I am busy with something else.',
  } as Parameters<typeof suggestionWords>[1];
  expect(suggestionWords(p, resolution, 'grill')?.text).toBe(resolution.says);
}, 60000);

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
  const s = newGame(42, 'pass@19');
  const before = JSON.stringify(cloneState(s));
  expect(hints(s, 'selim').every((hint) => !hint.guess)).toBe(true);
  expect(JSON.stringify(cloneState(s))).toBe(before);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  const answer = s.board?.rows.find((row) => row.cook === 'selim');
  expect(answer?.accepted).toBe(true);
  expect(hints(s, 'selim').every((hint) => !hint.guess)).toBe(true);
  expect(answer?.answer).toMatch(/^Yes, Chef\./);
  expect(answer?.answer).not.toMatch(/assented|decided|I will work at.*I will work at.*I will work at/);
}, 60000);

it('sharpens an observer preview after repeated looks and retains that learning on restore', () => {
  const s = newGame(42, 'pass@19');
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

it('gives reluctant assent a cook voice and names each unpaid alternative plainly', () => {
  const p = personOf(newGame(42, 'pass@19'), 'selim');
  const base = {
    verdict: 'modified',
    decidedBy: { kind: 'term', source: 'material', margin: 1 },
  } as Parameters<typeof suggestionWords>[1];
  const lines = ['break', 'eat', 'home'].map((verb) => suggestionWords(p, base, verb));
  expect(new Set(lines.map((line) => line?.short)).size).toBe(3);
  expect(lines.every((line) => !line?.text.includes('paid work'))).toBe(true);
  expect(suggestionWords(p, { ...base, verdict: 'complied' }, 'grill')?.text).toBe(
    'All right, Chef. If you insist.',
  );
}, 60000);

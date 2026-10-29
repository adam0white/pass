/** Scope: physical guidance and actual food work through existing HF choices.
 * This adds no cognitive faculty, private competence read, synthetic skill witness
 * or felt/voice outcome. Compliance after ordinary insist is not voluntary assent.
 */
import { beforeAll, expect, it } from 'vitest';
import { replayExport } from '../src/sim/continuation.ts';
import { interrupt, verifyCommunity } from '../src/sim/hf4-person.ts';
import {
  boardDefaults,
  cloneState,
  exportRun,
  newGame,
  personOf,
  queueInput,
  replay,
  restoreState,
  stationOf,
  step,
} from '../src/sim/kitchen.ts';
import { grillLessonAvailable } from '../src/sim/kitchen-edition.ts';
import prefix from './fixtures/host-clearing-prefix.json';

const raw = (s: ReturnType<typeof newGame>) => JSON.parse(JSON.stringify(cloneState(s)));
let checkpoint: ReturnType<typeof cloneState>;
beforeAll(() => {
  // Original ordinary-input night-two prefix, followed by an actual private invite.
  // No Person, task demand, body, skill, clock, actor or horizon is edited.
  const s = replay(prefix.seed, prefix.inputs as Parameters<typeof replay>[1], prefix.minute, 'pass@19');
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'invite' });
  for (let i = 0; i < 5; i++) step(s);
  expect(s.privateAccounts?.selim).toBeDefined();
  checkpoint = raw(s);
}, 120000);

it('offers no lesson before actual disclosure or without a waiting grill order', () => {
  const s = newGame(42, 'pass@19');
  expect(grillLessonAvailable(s, 'dilek')).toBe(false);
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'listen' });
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  expect(grillLessonAvailable(s, 'dilek')).toBe(false);
  expect(grillLessonAvailable(s, 'selim')).toBe(false);
});

it('records real guidance and later food work, preserving full replay and cold continuation', () => {
  const s = restoreState(checkpoint);
  expect(grillLessonAvailable(s, 'rafi')).toBe(true);
  queueInput(s, { kind: 'grill-lesson', learner: 'rafi' });
  expect(s.grillLessons?.[0]?.teacherVerdict).toBe('assented');
  expect(raw(replayExport(exportRun(s, '4.12.0')))).toEqual(raw(s));
  expect(stationOf(s, 'selim')).toBeNull();
  const teacherWork = personOf(s, 'selim').activity;
  expect(teacherWork?.affordanceId).toBe('conversation');
  expect((teacherWork?.endsAt ?? 0) - (teacherWork?.startedAt ?? 0)).toBe(3);
  expect(stationOf(s, 'rafi')).toBe('dish');
  // Exactly one existing insist request. HF supplies actual compliance and its cost.
  queueInput(s, { kind: 'ask', cook: 'rafi', verb: 'grill', insist: true });
  for (let i = 0; i < 6; i++) step(s);
  const lesson = s.grillLessons?.[0];
  expect(lesson?.state).toBe('practised');
  expect(lesson?.learnerVerdict).toBe('complied');
  expect(lesson?.learnerInsisted).toBe(true);
  expect(lesson?.guidedWork).toBeGreaterThan(0);
  expect(lesson?.learnerWork).toBeGreaterThan(0);
  expect(lesson?.food).toBeDefined();
  expect(lesson?.teacherCompleted).toBeGreaterThan(lesson?.at ?? 0);
  expect(s.inputs[lesson?.id ?? -1]?.kind).toBe('grill-lesson');
  const file = exportRun(s, '4.12.0');
  const replayed = replayExport(file),
    cold = restoreState(raw(s));
  expect(raw(replayed)).toEqual(raw(s));
  expect(raw(cold)).toEqual(raw(s));
  for (let i = 0; i < 30; i++) {
    step(s);
    step(replayed);
    step(cold);
  }
  expect(raw(replayed)).toEqual(raw(s));
  expect(raw(cold)).toEqual(raw(s));
  expect(verifyCommunity(s.chef).verified).toBe(true);
}, 120000);

it('does not credit food work when the learner defers the ordinary request', () => {
  const s = restoreState(checkpoint);
  queueInput(s, { kind: 'grill-lesson', learner: 'rafi' });
  expect(s.grillLessons?.[0]?.teacherVerdict).toBe('assented');
  queueInput(s, { kind: 'ask', cook: 'rafi', verb: 'grill', insist: false });
  for (let i = 0; i < 6; i++) step(s);
  expect(s.cooks.find((cook) => cook.id === 'rafi')?.night.events.at(-1)).toMatchObject({
    verb: 'grill',
    verdict: 'deferred',
    insisted: false,
  });
  expect(s.grillLessons?.[0]?.learnerActivity).toBeUndefined();
  expect(s.grillLessons?.[0]?.guidedWork).toBe(0);
  expect(s.grillLessons?.[0]?.food).toBeUndefined();
  expect(s.grillLessons?.[0]?.state).toBe('no-food-work');
  expect(s.said.some((line) => line.who === 'rafi' && line.kind === 'answer')).toBe(true);
}, 120000);

it('does not credit food work when the learner modifies the ordinary request', () => {
  const s = replay(7, prefix.inputs as Parameters<typeof replay>[1], prefix.minute, 'pass@19');
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'invite' });
  for (let i = 0; i < 5; i++) step(s);
  expect(s.privateAccounts?.selim).toBeDefined();
  expect(grillLessonAvailable(s, 'rafi')).toBe(true);
  queueInput(s, { kind: 'grill-lesson', learner: 'rafi' });
  expect(s.grillLessons?.[0]?.teacherVerdict).toBe('assented');
  queueInput(s, { kind: 'ask', cook: 'rafi', verb: 'grill', insist: false });
  for (let i = 0; i < 6; i++) step(s);
  expect(s.cooks.find((cook) => cook.id === 'rafi')?.night.events.at(-1)).toMatchObject({
    verb: 'grill',
    verdict: 'modified',
    insisted: false,
  });
  expect(s.grillLessons?.[0]?.learnerActivity).toBeUndefined();
  expect(s.grillLessons?.[0]?.guidedWork).toBe(0);
  expect(s.grillLessons?.[0]?.food).toBeUndefined();
  expect(s.grillLessons?.[0]?.state).toBe('no-food-work');
}, 120000);

it('does not offer a second lesson to a learner already working at the grill', () => {
  const s = restoreState(checkpoint);
  queueInput(s, { kind: 'grill-lesson', learner: 'rafi' });
  queueInput(s, { kind: 'ask', cook: 'rafi', verb: 'grill', insist: true });
  for (let i = 0; i < 6; i++) step(s);
  expect(s.grillLessons?.[0]?.state).toBe('practised');
  expect(stationOf(s, 'rafi')).toBe('grill');
  expect(s.tickets.some((t) => t.status === 'open' && t.doneGrill < t.grill)).toBe(true);
  expect(grillLessonAvailable(s, 'rafi')).toBe(false);
  queueInput(s, { kind: 'grill-lesson', learner: 'rafi' });
  expect(s.grillLessons).toHaveLength(1);
}, 120000);

it('never completes interrupted guidance from a later ordinary activity', () => {
  const s = restoreState(checkpoint);
  queueInput(s, { kind: 'grill-lesson', learner: 'rafi' });
  const activity = s.grillLessons?.[0]?.teacherActivity;
  expect(activity).toBeDefined();
  interrupt(personOf(s, 'selim'), s.minute, 'control:guidance-interrupted');
  queueInput(s, { kind: 'ask', cook: 'rafi', verb: 'grill', insist: true });
  for (let i = 0; i < 10; i++) step(s);
  expect(s.grillLessons?.[0]?.state).toBe('interrupted');
  expect(s.grillLessons?.[0]?.food).toBeUndefined();
  expect(s.grillLessons?.[0]?.teacherCompleted).toBeUndefined();
  expect(verifyCommunity(s.chef).verified).toBe(true);
}, 120000);

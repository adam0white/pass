/** Scope: physical guidance and actual food work through existing HF choices.
 * This adds no cognitive faculty, private competence read, synthetic skill witness
 * or felt/voice outcome. Compliance after ordinary insist is not voluntary assent.
 */
import { beforeAll, expect, it } from 'vitest';
import { replayExport, validateReplayFile } from '../src/sim/continuation.ts';
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
import historicalExport from './fixtures/grill-lesson-historical-public-export.json';
import historicalMeta from './fixtures/grill-lesson-historical-public-export.meta.json';
import native from './fixtures/grill-lesson-native-modified.json';
import prefix from './fixtures/grill-lesson-prefix.json';

const raw = (s: ReturnType<typeof newGame>) => JSON.parse(JSON.stringify(cloneState(s)));
let checkpoint: ReturnType<typeof cloneState>;
beforeAll(() => {
  // Original ordinary-input night-two prefix, followed by an actual private invite.
  // No Person, task demand, body, skill, clock, actor or horizon is edited.
  const s = replay(prefix.seed, prefix.inputs as Parameters<typeof replay>[1], prefix.minute, 'pass@20');
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'invite' });
  for (let i = 0; i < 5; i++) step(s);
  expect(s.privateAccounts?.selim).toBeDefined();
  checkpoint = raw(s);
}, 120000);

it('offers no lesson before actual disclosure or without a waiting grill order', () => {
  const s = newGame(42, 'pass@20');
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

/** HISTORICAL NATIVE UNIT TEST — not a current C1 public-replay witness.
 * The negative-credit handler is exercised on a genuine R3 pass@20 / HF4.12 ordinary-input witness: seed 7, 62 public
 * inputs to minute 2670, a real invite and five steps (actual private disclosure), checkpointed BEFORE any teacher or
 * learner request. The complete native HF archive was written by the immutable R3 source (generator, source hashes and
 * the actual R3 outcome are in the fixture's `meta`). Nothing in it is edited, and no verdict is written by hand.
 * It is restored only here; the production reader has no legacy fallback and the old public export is refused below.
 * Whether the current C1 seed-plus-public-input path reaches a `modified` verdict is UNOBSERVED (Deferred, 2026-11-03).
 */
it('does not credit food work when the learner modifies the ordinary request (historical native unit)', () => {
  const s = restoreState(structuredClone(native.checkpoint) as unknown as ReturnType<typeof cloneState>);
  expect(verifyCommunity(s.chef).verified).toBe(true);
  expect(native.meta.archiveVerified).toBe(true);
  expect(s.privateAccounts?.selim).toBeDefined();
  expect(grillLessonAvailable(s, 'rafi')).toBe(true);
  // The native cold suffix: a second cold restore stays identical to the first through the same real inputs.
  const twin = restoreState(structuredClone(native.checkpoint) as unknown as ReturnType<typeof cloneState>);
  for (const x of [s, twin]) {
    queueInput(x, { kind: 'grill-lesson', learner: 'rafi' });
    queueInput(x, { kind: 'ask', cook: 'rafi', verb: 'grill', insist: false });
  }
  expect(s.grillLessons?.[0]?.teacherVerdict).toBe('assented');
  for (let i = 0; i < 6; i++) {
    step(s);
    step(twin);
  }
  expect(s.cooks.find((cook) => cook.id === 'rafi')?.night.events.at(-1)).toMatchObject({
    verb: 'grill',
    verdict: 'modified',
    insisted: false,
  });
  expect(s.grillLessons?.[0]?.learnerActivity).toBeUndefined();
  expect(s.grillLessons?.[0]?.guidedWork).toBe(0);
  expect(s.grillLessons?.[0]?.food).toBeUndefined();
  expect(s.grillLessons?.[0]?.state).toBe('no-food-work');
  expect(raw(twin)).toEqual(raw(s));
  expect(verifyCommunity(s.chef).verified).toBe(true);
  expect(verifyCommunity(twin.chef).verified).toBe(true);
}, 120000);

/** The file is a genuine R3 public export serialized before any mutation (generator and source hashes in the .meta sidecar), and the
 * generator proved it VALID under R3's own strict replay. Its three input counts agree, so a refusal here is not an artefact of a
 * malformed file. The refusal shows only that current strict replay does not accept an R3 export; it does not show R3 validity.
 */
it('refuses the internally consistent historical R3 public export under current strict replay', async () => {
  const ex = historicalExport as unknown as Parameters<typeof validateReplayFile>[0] & {
    inputs: unknown[];
    state: { inputs: unknown[]; applied: number; minute: number };
  };
  expect(ex.inputs).toHaveLength(historicalMeta.prefix.inputs);
  expect(ex.state.inputs).toHaveLength(ex.inputs.length);
  expect(ex.state.applied).toBe(ex.inputs.length);
  expect(ex.state.minute).toBe(historicalMeta.prefix.minute);
  expect(ex.state.inputs).toEqual(ex.inputs);
  expect(historicalMeta.listsAgree).toBe(true);
  expect(historicalMeta.validUnderR3Replay).toBe(true);
  await expect(validateReplayFile(ex)).rejects.toThrow('does not match its replay');
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

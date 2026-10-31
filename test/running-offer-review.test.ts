/** C1: a pass@20 HF4 review keeps the cook's running offer on the menu, so HF can choose to continue it. */
import { expect, it, vi } from 'vitest';
import { validateReplayFile } from '../src/sim/continuation.ts';
import { kitchenOffer, kitchenPeople, kitchenSpec } from '../src/sim/hf4-authoring.ts';
import { KitchenRun } from '../src/sim/hf4-run.ts';
import {
  boardDefaults,
  cloneState,
  exportRun,
  newGame,
  queueInput,
  remainingMinutes,
  staffingOptions,
  step,
} from '../src/sim/kitchen.ts';

const MIN = 60000;
const raw = (s: ReturnType<typeof newGame>) => JSON.parse(JSON.stringify(cloneState(s)));

interface Review {
  at: number;
  person: string;
  menu: { id: string; minutes: number }[];
  suggestion: boolean;
  before?: { id: string; offer: string; end: number };
  after?: { id: string; offer: string; end: number };
  chosen: string | null;
  review: boolean;
}

/** Seed 7, ordinary inputs: default board, open, and the first offered cover for each staffing question. */
function play(until: number) {
  const reviews: Review[] = [];
  const original = KitchenRun.prototype.decide;
  const spy = vi.spyOn(KitchenRun.prototype, 'decide').mockImplementation(function (
    this: InstanceType<typeof KitchenRun>,
    person,
    offers,
    ...rest
  ) {
    const view = (a?: (typeof this.active)[number]) =>
      a && { id: a.id, offer: a.offer.id, end: (a.start + a.offer.durationMs) / MIN };
    const before = view(this.active.find((a) => a.person === person));
    const result = original.call(this, person, offers, ...rest);
    const d = result.events.find((e) => e.data.kind === 'decision')?.data as
      | { decision: { chosenAffordanceId: string | null; review?: boolean } }
      | undefined;
    reviews.push({
      at: rest[0],
      person,
      menu: offers.map((o) => ({ id: o.id, minutes: o.durationMs / MIN })),
      suggestion: !!rest[1],
      before,
      after: view(this.active.find((a) => a.person === person)),
      chosen: d?.decision.chosenAffordanceId ?? null,
      review: d?.decision.review ?? false,
    });
    return result;
  });
  const s = newGame(7, 'pass@20');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  const answered = new Set<number>();
  try {
    for (let i = 0; i < 900 && s.night === 1 && s.minute < until; i++) {
      step(s);
      for (const d of s.staffing ?? [])
        if (d.state === 'asking' && !answered.has(d.id)) {
          answered.add(d.id);
          queueInput(s, { kind: 'staff', id: d.id, cover: staffingOptions(s, d)[0] ?? null });
        }
    }
  } finally {
    spy.mockRestore();
  }
  return { s, reviews };
}

it('a scheduled review offers the running activity with its remaining time and no suggestion', () => {
  const { reviews } = play(1145);
  const withRunning = reviews.filter((r) => r.before && !r.suggestion);
  expect(withRunning.length, 'the played prefix reaches scheduled reviews of running work').toBeGreaterThan(
    0,
  );
  for (const r of withRunning) {
    const own = r.menu.find((o) => o.id === r.before?.offer);
    expect(own, `${r.person} at ${r.at}: running offer ${r.before?.offer} is on the menu`).toBeDefined();
    // The offered time is what is left, so a review cannot lengthen the activity.
    expect(own?.minutes).toBeCloseTo((r.before?.end ?? 0) - r.at, 1);
  }
});

it('choosing the running offer continues the same activity with an unchanged end; a different choice interrupts without starting', () => {
  const { reviews } = play(1145);
  const kept = reviews.filter((r) => r.before && r.chosen === r.before.offer);
  expect(kept.length, 'HF continues running work at least once in this prefix').toBeGreaterThan(0);
  for (const r of kept) {
    expect(r.review).toBe(true);
    expect(r.after?.id).toBe(r.before?.id);
    expect(r.after?.end).toBe(r.before?.end);
  }
  const switched = reviews.filter((r) => r.before && r.chosen !== null && r.chosen !== r.before.offer);
  expect(switched.length, 'HF chooses something else at least once in this prefix').toBeGreaterThan(0);
  for (const r of switched) {
    expect(r.review).toBe(false);
    expect(r.after).toBeUndefined();
  }
});

it('the review menu keeps the other legitimate offers beside the running one', () => {
  const { reviews } = play(1145);
  const scheduled = reviews.filter((r) => r.before && !r.suggestion);
  const ids = new Set(scheduled.flatMap((r) => r.menu.map((o) => o.id)));
  expect(ids.has('pray')).toBe(true);
  expect(ids.has('toilet')).toBe(true);
  expect(ids.has('break')).toBe(true);
  expect(ids.has('home')).toBe(true);
  for (const r of scheduled) expect(r.menu.length).toBeGreaterThan(1);
}, 120000);

it('replays the continued-work state exactly and keeps an actual next input equal', async () => {
  const { s } = play(1145);
  const replayed = await validateReplayFile(exportRun(s, '4.12.0'));
  expect(raw(replayed)).toEqual(raw(s));
  const next = { kind: 'ask', cook: 'dilek', verb: 'cold' } as const;
  queueInput(s, next);
  queueInput(replayed, next);
  for (let i = 0; i < 8; i++) {
    step(s);
    step(replayed);
  }
  expect(raw(replayed)).toEqual(raw(s));
}, 120000);

it('HF wrapper boundary: one millisecond left is offered as one millisecond; the activity keeps its identity and end', () => {
  const run = new KitchenRun(kitchenSpec(7), kitchenPeople());
  const work = kitchenOffer('selim', {
    id: 'grill',
    action: 'grill',
    label: 'work at the grill',
    duration: 5,
    effort: 0.4,
    advertises: { competence: 0.3 },
  });
  run.decide('selim', [work], 540);
  const started = run.active.find((a) => a.person === 'selim');
  expect(started).toBeDefined();
  const end = (started?.start ?? 0) + (started?.offer.durationMs ?? 0);
  // Tick to one millisecond before the end, as cookMinute does before a review.
  run.advance(end - 1);
  const before = run.active.find((a) => a.person === 'selim');
  expect(before?.id).toBe(started?.id);
  const minutes = remainingMinutes(end / MIN, (end - 1) / MIN);
  const offered = kitchenOffer('selim', {
    id: 'grill',
    action: 'grill',
    label: 'work at the grill',
    duration: minutes,
    effort: 0.4,
    advertises: { competence: 0.3 },
  });
  expect(offered.durationMs).toBe(1);
  const result = run.decide('selim', [offered], Math.floor((end - 1) / MIN));
  const decision = result.events.find((e) => e.data.kind === 'decision')?.data as
    | { decision: { chosenAffordanceId: string | null; review?: boolean } }
    | undefined;
  // HF answered with a review frame; the original activity was neither replaced nor extended.
  expect(decision?.decision.review ?? false).toBe(
    decision?.decision.chosenAffordanceId === 'grill' || decision?.decision.chosenAffordanceId === null,
  );
  const after = run.active.find((a) => a.person === 'selim');
  if (after) {
    expect(after.id).toBe(started?.id);
    expect(after.start + after.offer.durationMs).toBe(end);
  }
  expect(run.verify().verified).toBe(true);
});

it('remaining time keeps whole-millisecond precision and never goes below one millisecond', () => {
  expect(remainingMinutes(1151, 1130)).toBe(21);
  expect(remainingMinutes(1151.0000333333, 1130)).toBeCloseTo(21.0000333333, 9);
  expect(remainingMinutes(1130.0000000167, 1130) * MIN).toBe(1);
  expect(remainingMinutes(1130, 1130) * MIN).toBe(1);
});

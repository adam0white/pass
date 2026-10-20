import { describe, expect, it } from 'vitest';
import {
  boardDefaults,
  cloneState,
  cookOf,
  newGame,
  openAt,
  queueInput,
  replay,
  stationOf,
  step,
} from '../src/sim/kitchen.ts';

const isServing = (s: ReturnType<typeof newGame>): boolean => s.phase === 'service';

function open(seed = 42) {
  const s = newGame(seed);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  return s;
}
describe('pass@5 standing rota', () => {
  it('starts at a playable default board and opens with spoken agreements', () => {
    const s = newGame(42);
    expect(s.version).toBe('pass@5');
    expect(s.phase).toBe('board');
    expect(boardDefaults(s).map((r) => r.station)).toEqual(['grill', 'cold']);
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    expect(s.board?.rows.every((r) => r.answer)).toBe(true);
    queueInput(s, { kind: 'open' });
    expect(s.phase).toBe('service');
    expect(stationOf(s, 'selim')).toBe('grill');
    expect(cookOf(s, 'selim').cover).toBeTruthy();
  });
  it('keeps agreed stations without repeated asks and takes the agreed break then returns', () => {
    const s = open();
    const row = s.board?.rows.find((r) => r.cook === 'selim');
    expect(row?.accepted).toBe(true);
    while (s.minute < (row?.breakAt ?? 0)) step(s);
    step(s);
    expect(stationOf(s, 'selim')).toBeNull();
    while (s.minute < (row?.breakAt ?? 0) + 21) step(s);
    expect(stationOf(s, 'selim')).toBe('grill');
    expect(cookOf(s, 'selim').night.asked).toBe(0);
  });
  it('replays board inputs and mid-break continuation exactly', () => {
    const s = open(7);
    while (s.minute < openAt(1) + 90) step(s);
    expect(cloneState(replay(s.seed, s.inputs, s.minute, s.version))).toEqual(cloneState(s));
  });
});

import { personOf, restoreState, staffingOptions, trustOf } from '../src/sim/kitchen.ts';

function tuesday() {
  const s = open();
  while (isServing(s)) step(s);
  queueInput(s, { kind: 'open' });
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  return s;
}

describe('board exceptions and boundaries', () => {
  it('a refused revision removes the earlier agreement and its live cover', () => {
    const s = newGame(42);
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    expect(cookOf(s, 'selim').cover?.station).toBe('grill');
    queueInput(s, {
      kind: 'board',
      rows: boardDefaults(s).map((r) => ({ ...r, station: 'cold', breakAt: 1290 })),
    });
    const row = s.board?.rows.find((r) => r.cook === 'selim');
    expect(row?.accepted).toBe(false);
    expect(row?.answer).toMatch(/instead|rather|not|No/);
    expect(cookOf(s, 'selim').cover).toBeNull();
    expect(
      personOf(s, 'selim').agenda.commitments.filter((c) => c.status === 'pending' && c.label === 'board 1'),
    ).toEqual([]);
  });
  it('does not create interruption decisions for agreed uncovered meal breaks', () => {
    const s = open();
    while (s.minute < 1140) step(s);
    expect(s.staffing).toEqual([]);
    expect(stationOf(s, 'selim')).toBe('grill');
  });
  it('rejects overlapping relief instead of taking away an agreed meal', () => {
    const s = newGame(42);
    const rows = boardDefaults(s).map((r) => ({
      ...r,
      breakAt: 1100,
      cover: r.cook === 'selim' ? 'dilek' : 'selim',
    }));
    queueInput(s, { kind: 'board', rows });
    expect(s.board?.rows.every((r) => r.coverAccepted === false)).toBe(true);
    expect(s.board?.rows.every((r) => r.answer?.includes('overlaps'))).toBe(true);
  });
  it('a bodily need creates one named gap; choosing leave does not repeat it', () => {
    const s = tuesday();
    personOf(s, 'dilek').body.satiety = 0.01;
    step(s);
    const d = s.staffing?.find((d) => d.who === 'dilek' && d.station === 'cold');
    expect(d?.reason).toContain('plate');
    expect(d?.until).toBe(s.minute + 19);
    queueInput(s, { kind: 'staff', id: d?.id ?? -1, cover: null });
    for (let k = 0; k < 15; k++) step(s);
    expect(s.staffing?.filter((d) => d.who === 'dilek' && d.station === 'cold')).toHaveLength(1);
    expect(d?.state).toBe('left');
    const restored = restoreState(JSON.parse(JSON.stringify(cloneState(s))));
    for (let k = 0; k < 10; k++) {
      step(s);
      step(restored);
    }
    expect(cloneState(restored)).toEqual(cloneState(s));
    expect(stationOf(s, 'dilek')).toBe('cold');
  });
  it('temporary relief returns to its agreed station at the expected end', () => {
    const s = tuesday();
    personOf(s, 'dilek').body.satiety = 0.01;
    step(s);
    const d = s.staffing?.find((d) => d.who === 'dilek');
    expect(d).toBeTruthy();
    if (!d) throw new Error('Missing staffing decision');
    // Isolate return scheduling with a cook willing to take this particular temporary cover.
    const voice = personOf(s, 'rafi').will.voices.find((v) => v.voiceId === 'chef');
    if (voice) voice.trust = 1;
    personOf(s, 'rafi').habits = [];
    expect(staffingOptions(s, d)).toContain('rafi');
    queueInput(s, { kind: 'staff', id: d.id, cover: 'rafi' });
    step(s);
    expect(d.state).toBe('covered');
    expect(stationOf(s, 'rafi')).toBe('cold');
    while (s.minute <= d.until) step(s);
    expect(stationOf(s, 'rafi')).toBe('dish');
    expect(stationOf(s, 'dilek')).toBe('cold');
  });
  it('keeps board defaults across nights while adding the arriving cook', () => {
    const s = tuesday();
    expect(s.previousBoard?.map((r) => r.cook)).toEqual(['selim', 'dilek']);
    expect(boardDefaults(s).map((r) => r.cook)).toEqual(['selim', 'dilek', 'rafi']);
  });
  it('keeps insisting and its trust cost available in the new edition', () => {
    const s = open();
    const before = trustOf(personOf(s, 'selim'));
    for (let k = 0; k < 5; k++) {
      queueInput(s, { kind: 'ask', cook: 'selim', verb: 'cold', insist: true });
      step(s);
    }
    expect(cookOf(s, 'selim').night.insisted).toBe(5);
    while (isServing(s)) step(s);
    expect(trustOf(personOf(s, 'selim'))).toBeLessThan(before);
  });
});

describe('agreed relief', () => {
  it('executes accepted relief and restores both cooks without another ask', () => {
    const s = tuesday();
    // A willing relief fixture tests scheduling separately from Rafi's normal dish habit/refusal.
    s.phase = 'board';
    personOf(s, 'rafi').habits = [];
    const voice = personOf(s, 'rafi').will.voices.find((v) => v.voiceId === 'chef');
    if (voice) voice.trust = 1;
    queueInput(s, {
      kind: 'board',
      rows: boardDefaults(s).map((row) => ({ ...row, cover: row.cook === 'dilek' ? 'rafi' : null })),
    });
    const row = s.board?.rows.find((r) => r.cook === 'dilek');
    expect(row?.coverAccepted).toBe(true);
    queueInput(s, { kind: 'open' });
    const at = Math.floor(s.minute / 1440) * 1440 + (row?.breakAt ?? 0);
    while (s.minute <= at) step(s);
    expect(stationOf(s, 'dilek')).toBeNull();
    expect(stationOf(s, 'rafi')).toBe('cold');
    while (s.minute <= at + 20) step(s);
    expect(stationOf(s, 'rafi')).toBe('dish');
    expect(stationOf(s, 'dilek')).toBe('cold');
    expect(s.staffing).toEqual([]);
  });
});

it('does not call an agreed board a night when the chef never asked anything', () => {
  const s = open();
  while (isServing(s)) step(s);
  const lines = s.reports[0]?.reviews.map((r) => r.aboutYou).join(' ') ?? '';
  expect(lines).not.toMatch(/never once asked|Not a word|Nobody told|didn’t look at me once/);
});

it('keeps the tip jar active inside agreed breaks', () => {
  const s = tuesday();
  while (isServing(s)) step(s);
  queueInput(s, { kind: 'open' });
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  while (isServing(s)) step(s);
  expect(s.night).toBe(3);
  expect(s.jarSkimmed).toBeGreaterThan(0);
  expect(personOf(s, 'rafi').promptings?.recent.some((r) => r.action === 'skim')).toBe(true);
});

it('keeps prayer a quiet private choice inside the agreed break', () => {
  const s = newGame(42);
  queueInput(s, {
    kind: 'board',
    rows: boardDefaults(s).map((r) => ({ ...r, breakAt: r.cook === 'selim' ? 1125 : r.breakAt })),
  });
  queueInput(s, { kind: 'open' });
  while (s.minute <= 1125) step(s);
  expect(personOf(s, 'selim').activity?.affordanceId).toBe('pray');
  expect(s.said.some((line) => line.text.includes('maghrib'))).toBe(true);
  expect(s.staffing).toEqual([]);
});

it('replays next-night boards and keeps the notebook edition through continuation', () => {
  const s = open(21);
  for (let night = 1; night <= 3; night++) {
    while (isServing(s)) {
      if (s.request?.state === 'asking') queueInput(s, { kind: 'answer', choice: 'yes' });
      step(s);
    }
    const replayed = replay(s.seed, s.inputs, s.minute, s.version);
    expect(cloneState(replayed)).toEqual(cloneState(s));
    queueInput(s, { kind: 'open' });
    expect(s.phase).toBe('board');
    expect(cloneState(replay(s.seed, s.inputs, s.minute, s.version))).toEqual(cloneState(s));
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    queueInput(s, { kind: 'open' });
  }
});

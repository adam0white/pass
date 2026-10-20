import { describe, expect, it } from 'vitest';
import { NIGHT_PLANS, nightStart } from '../src/sim/campaign.ts';
import {
  boardDefaults,
  cloneState,
  cookingStep,
  helpOptions,
  newGame,
  plateOptions,
  queueInput,
  replay,
  restoreState,
  step,
} from '../src/sim/kitchen.ts';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing fixture');
  return value;
}

function open() {
  const s = newGame(42, 'pass@7');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  while (!helpOptions(s).length) step(s);
  return s;
}

describe('hands-on service', () => {
  it('cannot sear a ready portion after the gas goes out', () => {
    const s = open();
    const portion = required(helpOptions(s).find((option) => option.station === 'grill'));
    queueInput(s, { kind: 'help', ticket: portion.ticket, station: portion.station });
    const outage = required(NIGHT_PLANS.find((night) => night.gasOut));
    s.night = outage.n;
    s.minute = nightStart(s.night) + required(outage.gasOut).from;
    expect(cookingStep(s)?.ready).toBe(false);
    queueInput(s, { kind: 'cook-step', ticket: portion.ticket });
    expect(s.help?.act).toBe(0);
    expect(s.said.at(-1)?.text).toContain('gas');
  });
  it('keeps a plated table for the runner without losing its allocated plate', () => {
    const s = open();
    const t = required(s.tickets.find((t) => t.status === 'open'));
    Object.assign(t, { doneGrill: t.grill, doneCold: t.cold, doneOven: t.oven, patience: 0 });
    step(s);
    expect(t.status).toBe('open');
    expect(t.platedAt).toBeDefined();
    for (let i = 0; i < 13; i++) step(s);
    expect(t.status).toBe('served');
    expect(s.plates.dirty.length).toBeGreaterThan(0);
  });

  it('calls an already allocated plate while the last clean plate waits for priority', () => {
    const s = open();
    const first = required(s.tickets.find((t) => t.status === 'open'));
    const second = required(s.tickets.find((t) => t.id !== first.id));
    Object.assign(first, { doneGrill: first.grill, doneCold: first.cold, doneOven: first.oven });
    s.passDecision = null;
    step(s);
    expect(first.platedAt).toBeDefined();
    Object.assign(second, { status: 'open', grill: 1, doneGrill: 0 });
    s.passDecision = { at: s.minute, state: 'chosen', tickets: [first.id, second.id], ticket: second.id };
    s.plates.clean = 1;
    queueInput(s, { kind: 'call-plate', ticket: first.id });
    expect(first.status).toBe('served');
    expect(s.plates.clean).toBe(1);
  });
  it('starts pass@7 and keeps each reserved portion through several readable acts', () => {
    const s = open();
    expect(s.version).toBe('pass@7');
    const o = required(helpOptions(s)[0]);
    queueInput(s, { kind: 'help', ticket: o.ticket, station: o.station });
    let acts = 0;
    while (s.help && acts < 8) {
      const action = required(cookingStep(s));
      expect(action.deadline - action.readyAt).toBeGreaterThanOrEqual(8);
      while (s.minute < action.readyAt) step(s);
      expect(cookingStep(s)?.ready).toBe(true);
      queueInput(s, { kind: 'cook-step', ticket: o.ticket });
      acts++;
    }
    expect(acts).toBeGreaterThanOrEqual(3);
    expect(s.help).toBeNull();
    expect(s.tickets.find((t) => t.id === o.ticket)?.quality).toBe('careful');
    expect(s.said.some((x) => x.text.includes('ready to'))).toBe(true);
  });

  it('waits for a plate call, then serves hot; unattended plates still leave with the runner', () => {
    const s = open();
    const t = required(s.tickets.find((t) => t.status === 'open'));
    Object.assign(t, { doneGrill: t.grill, doneCold: t.cold, doneOven: t.oven });
    step(s);
    expect(t.status).toBe('open');
    expect(plateOptions(s).some((o) => o.ticket === t.id)).toBe(true);
    queueInput(s, { kind: 'call-plate', ticket: t.id });
    expect(t.status).toBe('served');
    expect(t.freshness).toBe('hot');
    const unattended = open();
    const u = required(unattended.tickets.find((t) => t.status === 'open'));
    Object.assign(u, { doneGrill: u.grill, doneCold: u.cold, doneOven: u.oven });
    for (let i = 0; i < 20; i++) step(unattended);
    expect(u.status).toBe('served');
    expect(u.freshness).toBe('cooling');
  });

  it('replays and restores pending readiness and acknowledges stale taps immediately', () => {
    const s = open();
    const o = required(helpOptions(s)[0]);
    queueInput(s, { kind: 'help', ticket: o.ticket, station: o.station });
    queueInput(s, { kind: 'cook-step', ticket: o.ticket, instinct: true });
    for (let i = 0; i < 8; i++) step(s);
    expect(cloneState(replay(s.seed, s.inputs, s.minute, s.version))).toEqual(cloneState(s));
    const copy = restoreState(cloneState(s));
    for (let i = 0; i < 50; i++) {
      step(s);
      step(copy);
    }
    expect(cloneState(copy)).toEqual(cloneState(s));
    const before = s.said.length;
    queueInput(s, { kind: 'cook-step', ticket: o.ticket });
    expect(s.said.length).toBeGreaterThan(before);
    for (const edition of ['pass@3', 'pass@4', 'pass@5', 'pass@6']) {
      expect(
        newGame(42, edition).tickets.every(
          (t) => !Object.hasOwn(t, 'quality') && !Object.hasOwn(t, 'platedAt'),
        ),
      ).toBe(true);
    }
  });
  it('makes late, skipped and instinct acts plain, slows skipped work, and resets instinct', () => {
    for (const mode of ['late', 'skipped', 'instinct']) {
      const s = open();
      const o = required(helpOptions(s)[0]);
      queueInput(s, { kind: 'help', ticket: o.ticket, station: o.station });
      const first = required(cookingStep(s));
      const before = s.chef.body.exertion;
      if (mode === 'instinct') queueInput(s, { kind: 'cook-step', ticket: o.ticket, instinct: true });
      while (s.help?.act === 0) {
        if (mode === 'late' && s.minute > first.deadline)
          queueInput(s, { kind: 'cook-step', ticket: o.ticket });
        step(s);
      }
      expect(s.help?.plain).toBe(true);
      expect(s.help?.instinct).toBe(false);
      expect(s.chef.body.exertion).toBeGreaterThan(before);
      if (mode === 'skipped') expect(required(cookingStep(s)).readyAt - s.minute).toBeGreaterThanOrEqual(4);
      while (s.help) {
        const action = required(cookingStep(s));
        while (s.minute < action.readyAt) step(s);
        queueInput(s, { kind: 'cook-step', ticket: o.ticket });
      }
      expect(s.tickets.find((t) => t.id === o.ticket)?.quality).toBe('plain');
    }
  });

  it('delays tired hands and replays accepted acts and a hot call', () => {
    const s = open();
    const tired = restoreState(cloneState(s));
    tired.chef.body.exertion = 0.9;
    const o = required(helpOptions(s)[0]);
    for (const state of [s, tired]) queueInput(state, { kind: 'help', ticket: o.ticket, station: o.station });
    expect(required(cookingStep(tired)).readyAt).toBeGreaterThan(required(cookingStep(s)).readyAt);
    while (s.help) {
      const a = required(cookingStep(s));
      while (s.minute < a.readyAt) step(s);
      queueInput(s, { kind: 'cook-step', ticket: o.ticket });
    }
    let guard = 0;
    while (!plateOptions(s).length && guard++ < 50) step(s);
    const plate = required(plateOptions(s)[0]);
    expect(plate).toBeTruthy();
    queueInput(s, { kind: 'call-plate', ticket: plate.ticket });
    expect(cloneState(replay(s.seed, s.inputs, s.minute, s.version))).toEqual(cloneState(s));
  });
});

import { describe, expect, it } from 'vitest';
import {
  boardDefaults,
  cloneState,
  cookingChoice,
  cookingStep,
  exportRun,
  helpOptions,
  newGame,
  queueInput,
  replay,
  restoreState,
  step,
} from '../src/sim/kitchen.ts';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing test fixture');
  return value;
}

function open() {
  const s = newGame(42, 'pass@10');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  while (!helpOptions(s).length) step(s);
  return s;
}
describe('pass@8 portions', () => {
  it('replays queued claims, choices and restored continuation exactly', () => {
    const s = open();
    const a = required(helpOptions(s)[0]);
    queueInput(s, { kind: 'help', ticket: a.ticket, station: a.station });
    const b = required(helpOptions(s)[0]);
    queueInput(s, { kind: 'help', ticket: b.ticket, station: b.station });
    while (!cookingChoice(s)) {
      if (cookingStep(s)?.ready) queueInput(s, { kind: 'cook-step', ticket: a.ticket });
      else step(s);
    }
    queueInput(s, { kind: 'cook-choice', ticket: a.ticket, choice: 'careful' });
    const notebook = JSON.parse(JSON.stringify(exportRun(s, '2.8.0')));
    expect(exportRun(replay(s.seed, s.inputs, s.minute, s.version), '2.8.0')).toEqual(notebook);
    const restored = restoreState(cloneState(s));
    for (let i = 0; i < 30; i++) {
      step(s);
      step(restored);
    }
    expect(cloneState(restored)).toEqual(cloneState(s));
    for (const edition of ['pass@3', 'pass@4', 'pass@5', 'pass@6', 'pass@7']) {
      const old = newGame(42, edition);
      expect(Object.hasOwn(old, 'chefNext')).toBe(false);
      expect(Object.hasOwn(old, 'chefGrace')).toBe(false);
    }
  });
  it('lets the crew take an unanswered invitation, then acknowledges a late reach', () => {
    const s = open();
    const a = required(helpOptions(s)[0]);
    const t = required(s.tickets.find((t) => t.id === a.ticket));
    t[a.station] = 1;
    for (let i = 0; i < 8; i++) {
      s.work[a.station] = 100;
      step(s);
    }
    expect(a.station === 'grill' ? t.doneGrill : a.station === 'cold' ? t.doneCold : t.doneOven).toBe(1);
    const before = s.said.length;
    queueInput(s, { kind: 'help', ticket: a.ticket, station: a.station });
    expect(s.said.length).toBeGreaterThan(before);
    expect(s.help).toBeNull();
  });
  it('queues a reserved next portion while hands are busy', () => {
    const s = open();
    const a = required(helpOptions(s)[0]);
    queueInput(s, { kind: 'help', ticket: a.ticket, station: a.station });
    while (helpOptions(s).length === 0) step(s);
    const b = required(helpOptions(s).find((o) => o.ticket !== a.ticket || o.station !== a.station));
    queueInput(s, { kind: 'help', ticket: b.ticket, station: b.station });
    expect(s.chefNext).toEqual({ ticket: b.ticket, station: b.station });
    queueInput(s, { kind: 'finish-portion', ticket: a.ticket });
    let n = 0;
    while (s.chefNext && n++ < 100) step(s);
    expect(s.help?.ticket).toBe(b.ticket);
    expect(s.help?.station).toBe(b.station);
  });
  it('offers a food choice in every recipe and spends extra time for care', () => {
    for (const station of ['cold', 'grill', 'oven'] as const) {
      const s = open();
      s.oven.heat = 1;
      const t = required(s.tickets.find((t) => t.status === 'open'));
      t[station] = 2;
      t.patience = 1000;
      queueInput(s, { kind: 'help', ticket: t.id, station });
      let n = 0;
      while (!cookingChoice(s) && n++ < 40) {
        const a = cookingStep(s);
        if (a?.ready) queueInput(s, { kind: 'cook-step', ticket: t.id });
        else step(s);
      }
      const choice = required(cookingChoice(s));
      expect(choice?.minutes).toBe(3);
      const minute = s.minute;
      queueInput(s, { kind: 'cook-choice', ticket: t.id, choice: 'careful' });
      expect(s.help?.readyAt).toBe(minute + 3);
    }
  });
  it('plates cold food now or spends exactly three more minutes on care, with guest words', () => {
    for (const choice of ['now', 'careful'] as const) {
      const s = open();
      const t = required(s.tickets.find((t) => t.status === 'open'));
      Object.assign(t, {
        grill: 0,
        doneGrill: 0,
        cold: 1,
        doneCold: 0,
        oven: 0,
        doneOven: 0,
        patience: 1000,
      });
      queueInput(s, { kind: 'help', ticket: t.id, station: 'cold' });
      while (!cookingChoice(s)) {
        if (cookingStep(s)?.ready) queueInput(s, { kind: 'cook-step', ticket: t.id });
        else step(s);
      }
      const minute = s.minute;
      queueInput(s, { kind: 'cook-choice', ticket: t.id, choice });
      if (choice === 'now') expect(s.help).toBeNull();
      else {
        expect(s.help?.readyAt).toBe(minute + 3);
        while (!cookingStep(s)?.ready) step(s);
        queueInput(s, { kind: 'cook-step', ticket: t.id });
      }
      expect(t.doneCold).toBe(1);
      expect(t.quality).toBe(choice === 'careful' ? 'careful' : 'plain');
      step(s);
      queueInput(s, { kind: 'call-plate', ticket: t.id });
      expect(
        s.said.some((line) =>
          line.text.includes(choice === 'careful' ? 'I can taste it' : 'Plain and filling'),
        ),
      ).toBe(true);
    }
  });
  it('delegates the rest of one portion at plain quality', () => {
    const s = open();
    const a = required(helpOptions(s)[0]);
    queueInput(s, { kind: 'help', ticket: a.ticket, station: a.station });
    queueInput(s, { kind: 'finish-portion', ticket: a.ticket });
    let n = 0;
    while (s.help && n++ < 100) step(s);
    expect(s.help).toBeNull();
    expect(s.tickets.find((t) => t.id === a.ticket)?.quality).toBe('plain');
  });
  it('keeps care in a second portion after the first portion was plain', () => {
    const s = open();
    const t = required(s.tickets.find((ticket) => ticket.status === 'open'));
    Object.assign(t, { grill: 0, doneGrill: 0, cold: 2, doneCold: 0, oven: 0, doneOven: 0, patience: 1000 });
    queueInput(s, { kind: 'help', ticket: t.id, station: 'cold' });
    queueInput(s, { kind: 'help', ticket: t.id, station: 'cold' });
    for (const choice of ['now', 'careful'] as const) {
      while (!cookingChoice(s)) {
        if (cookingStep(s)?.ready) queueInput(s, { kind: 'cook-step', ticket: t.id });
        else step(s);
      }
      queueInput(s, { kind: 'cook-choice', ticket: t.id, choice });
      if (choice === 'careful') {
        while (!cookingStep(s)?.ready) step(s);
        queueInput(s, { kind: 'cook-step', ticket: t.id });
      }
    }
    expect(t.quality).toBe('mixed');
    expect(t.chefPortions).toEqual([
      { station: 'cold', quality: 'plain' },
      { station: 'cold', quality: 'careful' },
    ]);
    step(s);
    queueInput(s, { kind: 'call-plate', ticket: t.id });
    expect(s.said.some((line) => line.text.includes('Some of this had extra care'))).toBe(true);
  });
  it('gives free hands readable crew grace before allocation', () => {
    const s = open();
    const a = required(helpOptions(s)[0]);
    s.work[a.station] = 100;
    const t = required(s.tickets.find((t) => t.id === a.ticket));
    const done = () => (a.station === 'cold' ? t.doneCold : a.station === 'grill' ? t.doneGrill : t.doneOven);
    const before = done();
    step(s);
    expect(s.chefGrace?.some((g) => g.ticket === t.id && g.station === a.station)).toBe(true);
    expect(done()).toBeLessThan(t[a.station]);
    expect(done()).toBeGreaterThanOrEqual(before);
    expect(s.said.some((x) => x.text.includes('Yours, Chef?'))).toBe(true);
  });
});

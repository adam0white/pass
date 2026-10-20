import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cloneState, newGame, replay, restoreState, step } from '../src/sim/kitchen.ts';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected seeded fixture value');
  return value;
}

const legacy = JSON.parse(readFileSync(new URL('./fixtures/edition3-hashes.json', import.meta.url), 'utf8'));
const hash = (s: ReturnType<typeof newGame>) =>
  createHash('sha256')
    .update(JSON.stringify(cloneState(s)))
    .digest('hex');

describe('game editions', () => {
  it('starts new runs on pass@6 and retains explicit pass@3 creation', () => {
    expect(newGame(42).version).toBe('pass@6');
    expect(newGame(42, 'pass@3').version).toBe('pass@3');
  });
  for (const row of legacy) {
    it(`replays every full-state pass@3 checkpoint and continues restored states: ${row.policy}`, () => {
      for (const checkpoint of row.checkpoints) {
        const inputs = row.inputs.filter((i: { at: number }) => i.at < checkpoint.minute);
        const s = replay(row.seed, inputs, checkpoint.minute, 'pass@3');
        expect(hash(s), `night ${checkpoint.night}, minute ${checkpoint.minute}`).toBe(checkpoint.hash);
        const restored = restoreState(JSON.parse(JSON.stringify(cloneState(s))));
        for (let k = 0; k < 30; k++) step(restored);
        expect(hash(restored)).toBe(checkpoint.restoredAfter30);
      }
    }, 20000);
  }
});

import {
  cookOf,
  coverLine,
  helpOptions,
  hints,
  offersFor,
  openAt,
  personOf,
  queueInput,
  stationOf,
} from '../src/sim/kitchen.ts';

describe('pass@4 kitchen work', () => {
  it('keeps an accepted station through batch ends and reviews until its spoken end', () => {
    const s = newGame(42, 'pass@4');
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'grill' });
    step(s);
    expect(cookOf(s, 'selim').cover?.station).toBe('grill');
    expect(coverLine(s, 'selim')).toContain('20:30');
    expect(s.said.at(-1)?.text).toContain('20:30');
    const until = required(cookOf(s, 'selim').cover).until;
    while (s.minute < until) {
      step(s);
      expect(stationOf(s, 'selim')).toBe('grill');
    }
    expect(personOf(s, 'selim').now).toBe(s.minute - 1);
    step(s);
    expect(cookOf(s, 'selim').cover).toBeNull();
  });
  it('offers three early tables with seeded dishes and chefs can finish one portion', () => {
    const s = newGame(42, 'pass@4');
    expect(s.tickets.slice(0, 3).map((t) => t.at - openAt(1))).toEqual([1, 9, 17]);
    while (s.minute <= openAt(1) + 1) step(s);
    const option = required(helpOptions(s)[0]);
    expect(option).toBeTruthy();
    const t = required(s.tickets.find((t) => t.id === option.ticket));
    const field = option.station === 'grill' ? 'doneGrill' : 'doneCold';
    const before = t[field];
    // Isolate the chef's portion from the crew's output.
    for (const c of s.cooks) c.here = false;
    queueInput(s, { kind: 'help', ticket: option.ticket, station: option.station });
    step(s);
    expect(s.help?.ticket).toBe(t.id);
    expect(helpOptions(s)).toEqual([]);
    while (s.help) step(s);
    expect(t[field]).toBe(before + 1);
    expect(s.said.some((x) => x.text.includes('I finished'))).toBe(true);
  });
  it('replays and restores a chef task exactly while it is in progress', () => {
    const s = newGame(42, 'pass@4');
    while (s.minute <= openAt(1) + 1) step(s);
    const o = required(helpOptions(s)[0]);
    queueInput(s, { kind: 'help', ticket: o.ticket, station: o.station });
    step(s);
    const r = replay(s.seed, s.inputs, s.minute, 'pass@4');
    expect(hash(r)).toBe(hash(s));
    const restored = restoreState(JSON.parse(JSON.stringify(cloneState(s))));
    for (let k = 0; k < 10; k++) {
      step(s);
      step(restored);
    }
    expect(cloneState(restored)).toEqual(cloneState(s));
  });
});

describe('pass@4 request and food boundaries', () => {
  it('replaces cover with an accepted explicit request, without moving the other cook', () => {
    const s = newGame(42, 'pass@4');
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'grill' });
    step(s);
    expect(cookOf(s, 'selim').cover).toBeTruthy();
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'cold', insist: true });
    step(s);
    expect(stationOf(s, 'selim')).toBe('cold');
    expect(cookOf(s, 'selim').cover?.station).toBe('cold');
  });
  it('ignores invalid or overlapping chef tasks and cancels a task when its table leaves', () => {
    const s = newGame(42, 'pass@4');
    while (s.minute <= openAt(1) + 1) step(s);
    queueInput(s, { kind: 'help', ticket: -1, station: 'cold' });
    step(s);
    expect(s.help).toBeNull();
    const o = required(helpOptions(s)[0]);
    queueInput(s, { kind: 'help', ticket: o.ticket, station: o.station });
    step(s);
    const task = { ...required(s.help) };
    queueInput(s, { kind: 'help', ticket: o.ticket, station: o.station });
    step(s);
    expect(s.help).toEqual(task);
    required(s.tickets.find((t) => t.id === o.ticket)).status = 'walked';
    step(s);
    expect(s.help).toBeNull();
  });
  it('never creates food actions or cover state on a pass@3 run', () => {
    const s = newGame(42, 'pass@3');
    while (s.minute <= openAt(1) + 1) step(s);
    expect(helpOptions(s)).toEqual([]);
    queueInput(s, { kind: 'help', ticket: required(s.tickets[0]).id, station: 'cold' });
    step(s);
    expect(Object.hasOwn(s, 'help')).toBe(false);
    expect(s.cooks.every((c) => !Object.hasOwn(c, 'cover'))).toBe(true);
  });
});

describe('station request forecasts', () => {
  it('predicts the same requested duration and answer that the cook receives', () => {
    for (const seed of [7, 42, 1001]) {
      for (const verb of ['grill', 'cold'] as const) {
        const s = newGame(seed, 'pass@4');
        const expected = required(hints(s, 'selim').find((h) => h.verb === verb));
        const offer = required(offersFor(s, 'selim', verb).find((a) => a.id === verb));
        expect(offer.duration).toBe(1230 - s.minute);
        queueInput(s, { kind: 'ask', cook: 'selim', verb });
        step(s);
        expect(s.lastAnswer?.verdict).toBe(expected.verdict);
        if (expected.verdict === 'assented') expect(cookOf(s, 'selim').cover?.until).toBe(1230);
        else expect(cookOf(s, 'selim').cover).toBeNull();
      }
    }
  });
  it('keeps bodily costs running during accepted cover', () => {
    const s = newGame(42, 'pass@4');
    const before = { ...personOf(s, 'selim').body };
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'grill' });
    step(s);
    for (let k = 0; k < 90; k++) step(s);
    const after = personOf(s, 'selim').body;
    expect(after.exertion).toBeGreaterThan(before.exertion);
    expect(after.hydration).toBeLessThan(before.hydration);
    expect(after.sleepPressure).toBeGreaterThan(before.sleepPressure);
    expect(stationOf(s, 'selim')).toBe('grill');
  });
});

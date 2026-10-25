import { describe, expect, it } from 'vitest';
import {
  boardDefaults,
  cloneState,
  helpOptions,
  newGame,
  openAt,
  personOf,
  queueInput,
  replay,
  restoreState,
  step,
} from '../src/sim/kitchen.ts';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing test fixture');
  return value;
}

function open(seed = 42) {
  const s = newGame(seed, 'pass@6');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  return s;
}
function waiting() {
  const s = open();
  while (s.minute <= openAt(1) + 4) step(s);
  return s;
}

describe('chef portions and pass decisions', () => {
  it('reserves a waiting portion immediately and the crew cannot finish it first', () => {
    const s = waiting();
    const option = helpOptions(s)[0];
    expect(option).toBeTruthy();
    if (!option) throw new Error('No waiting portion');
    const t = required(s.tickets.find((t) => t.id === option.ticket));
    queueInput(s, { kind: 'help', ticket: t.id, station: option.station });
    expect(s.help?.ticket).toBe(t.id);
    const field =
      option.station === 'grill' ? 'doneGrill' : option.station === 'cold' ? 'doneCold' : 'doneOven';
    const total = option.station === 'grill' ? t.grill : option.station === 'cold' ? t.cold : t.oven;
    s.work[option.station] = 100;
    step(s);
    expect(t[field]).toBeLessThan(total);
    const before = s.chef.body.exertion;
    let guard = 0;
    while (s.help && guard++ < 40) step(s);
    expect(s.help).toBeNull();
    expect(t[field]).toBe(total);
    expect(s.chef.body.exertion).toBeGreaterThan(before);
    expect(s.said.some((x) => x.text.includes('I finished') && x.text.includes(`table ${t.table}`))).toBe(
      true,
    );
    expect(s.said.some((x) => x.text.includes('ingredients back'))).toBe(false);
  });

  it('offers one consequential priority choice in a natural first service', () => {
    for (const seed of [7, 21, 42]) {
      const s = open(seed);
      while (!s.passDecision && s.minute < openAt(1) + 30) step(s);
      expect(s.passDecision?.state, `seed ${seed}`).toBe('asking');
      expect(s.passDecision?.tickets.length).toBeGreaterThan(1);
      const target = required(required(s.passDecision).tickets.at(-1));
      queueInput(s, { kind: 'pass-priority', ticket: target });
      step(s);
      expect(s.passDecision?.ticket).toBe(target);
      expect(s.passDecision?.state).toBe('chosen');
      while (s.phase === 'service') step(s);
      expect(s.said.filter((x) => x.text.includes('Which table goes first'))).toHaveLength(1);
    }
  });

  it('allocates the next portion and scarce plate to the chosen table', () => {
    const s = waiting();
    for (const c of s.cooks) c.here = false;
    const [first, second] = s.tickets;
    if (!first || !second) throw new Error('Missing tickets');
    for (const t of s.tickets) t.status = 'waiting';
    for (const t of [first, second]) {
      Object.assign(t, {
        status: 'open',
        grill: 1,
        cold: 0,
        oven: 0,
        doneGrill: 0,
        doneCold: 0,
        doneOven: 0,
      });
    }
    s.passDecision = { at: s.minute, state: 'asking', tickets: [first.id, second.id] };
    s.plates.clean = 1;
    s.work.grill = 5;
    queueInput(s, { kind: 'pass-priority', ticket: second.id });
    step(s);
    expect(second.status).toBe('served');
    expect(first.status).toBe('open');
    expect(first.doneGrill).toBe(0);
  });

  it('replays and restores a reserved portion and priority without adding old-edition keys', () => {
    const s = waiting();
    const option = required(helpOptions(s)[0]);
    queueInput(s, { kind: 'help', ticket: option.ticket, station: option.station });
    // Calling a priority waits until the chef's hands are free.
    if (s.passDecision?.state === 'asking') {
      queueInput(s, { kind: 'pass-priority', ticket: required(s.passDecision.tickets[0]) });
      expect(s.passDecision.state).toBe('asking');
    }
    expect(cloneState(replay(s.seed, s.inputs, s.minute, s.version))).toEqual(cloneState(s));
    const restored = restoreState(cloneState(s));
    for (let k = 0; k < 30; k++) {
      step(s);
      step(restored);
    }
    expect(cloneState(restored)).toEqual(cloneState(s));
    for (const edition of ['pass@3', 'pass@4', 'pass@5'])
      expect(Object.hasOwn(newGame(42, edition), 'passDecision')).toBe(false);
  });

  it('uses a quiet prayer window by default only for new runs', () => {
    const s = open();
    while (s.minute <= 1115) step(s);
    expect(personOf(s, 'selim').activity?.affordanceId).toBe('pray');
    const old = newGame(42, 'pass@5');
    expect(boardDefaults(old).map((r) => r.breakAt)).toEqual([1090, 1115]);
    expect(s.staffing).toEqual([]);
  });
  it('dismisses an ignored pass call after its tables are fed', () => {
    const s = open();
    while (s.minute < openAt(1) + 40) step(s);
    expect(s.passDecision?.state).not.toBe('asking');
  });

  it('makes tired chef work slower and recovers before the following service', () => {
    const rested = waiting();
    const tired = restoreState(cloneState(rested));
    tired.chef.body.exertion = 0.9;
    const o = required(helpOptions(rested)[0]);
    for (const s of [rested, tired]) queueInput(s, { kind: 'help', ticket: o.ticket, station: o.station });
    expect(required(tired.help).until).toBeGreaterThan(required(rested.help).until);
    while (tired.phase === 'service') step(tired);
    queueInput(tired, { kind: 'open' });
    expect(tired.chef.body.exertion).toBeLessThan(0.2);
  });

  it('borrowing Rafi until Friday close accepts the named dish gap once', () => {
    const s = open();
    while (s.night < 5) {
      while (s.phase === 'service') {
        if (s.request?.state === 'asking') queueInput(s, { kind: 'answer', choice: 'yes' });
        step(s);
      }
      queueInput(s, { kind: 'open' });
      queueInput(s, { kind: 'board', rows: boardDefaults(s) });
      queueInput(s, { kind: 'open' });
    }
    while (s.request?.kind !== 'mother' && s.phase === 'service') step(s);
    expect(s.request?.kind).toBe('mother');
    queueInput(s, { kind: 'answer', choice: 'yes' });
    step(s);
    const gap = s.staffing?.find((d) => d.who === 'dilek' && d.state === 'asking');
    expect(gap).toBeTruthy();
    const rafi = personOf(s, 'rafi');
    rafi.habits = [];
    const voice = rafi.will.voices.find((v) => v.voiceId === 'chef');
    if (voice) voice.trust = 1;
    queueInput(s, { kind: 'staff', id: required(gap).id, cover: 'rafi' });
    step(s);
    expect(gap?.cover).toBe('rafi');
    for (let k = 0; k < 30; k++) step(s);
    expect(s.staffing?.some((d) => d.who === 'rafi' && d.station === 'dish' && d.state === 'asking')).toBe(
      false,
    );
    expect(
      s.said.some(
        (x) => x.who === 'rafi' && x.text.includes('Nobody will work at the dishes while I work at'),
      ),
    ).toBe(true);
  });

  it('holds the last plate for a chosen table still being cooked', () => {
    const s = waiting();
    for (const c of s.cooks) c.here = false;
    const [first, second] = s.tickets;
    if (!first || !second) throw new Error('Missing tickets');
    for (const t of s.tickets) t.status = 'waiting';
    Object.assign(first, { status: 'open', grill: 0, cold: 0, oven: 0 });
    Object.assign(second, { status: 'open', grill: 1, cold: 0, oven: 0, doneGrill: 0 });
    s.passDecision = { at: s.minute, state: 'asking', tickets: [first.id, second.id] };
    s.plates.clean = 1;
    s.work.grill = 0;
    queueInput(s, { kind: 'pass-priority', ticket: second.id });
    step(s);
    expect(first.status).toBe('open');
    expect(s.plates.clean).toBe(1);
  });
  it('seats simultaneous orders at distinct tables', () => {
    const s = waiting();
    const tables = s.tickets.filter((t) => t.status === 'open').map((t) => t.table);
    expect(new Set(tables).size).toBe(tables.length);
  });
});

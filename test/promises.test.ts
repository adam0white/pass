import { describe, expect, it } from 'vitest';
import { PROMISE_WORDS, partyOf, planOf } from '../src/sim/campaign.ts';
import { beginAtWeekTwo } from '../src/sim/firstweek.ts';
import { advance } from '../src/sim/host-policy.ts';
import {
  type Booking,
  boardDefaults,
  canReplay,
  cloneState,
  closeAt,
  cookingChoice,
  cookingStep,
  type GameState,
  newGame,
  partyCard,
  partyChoices,
  personOf,
  queueInput,
  replay,
  restoreState,
  step,
} from '../src/sim/kitchen.ts';

const required = <T>(x: T | null | undefined): T => {
  if (x == null) throw new Error('Missing fixture');
  return x;
};
function sunday(seed = 42, week = 1, historical: Booking[] = [], walked = 0) {
  const s = newGame(seed, 'pass@9');
  s.night = [6, 10, 14][week - 1] as number;
  s.minute = closeAt(s.night);
  s.phase = 'service';
  s.tickets = [];
  s.till = 100000;
  s.bookings = historical;
  step(s);
  required(s.reports.at(-1)).walked = walked;
  queueInput(s, { kind: 'open' });
  expect(s.phase).toBe('sunday');
  return s;
}
function leave(s: GameState, promise = false) {
  for (const id of s.sunday?.parties ?? [])
    queueInput(s, { kind: 'choose', key: `promise:${id}`, value: promise ? 'promise' : 'plain' });
  queueInput(s, { kind: 'open' });
  return s;
}
function booked(party = 'hasan', promised = true, week = 2): Booking {
  const p = required(partyOf(party));
  const night = [7, 11, 15][week - 2] as number;
  const at = planOf(night).day * 1440 + p.at;
  return {
    party,
    week,
    night,
    at,
    servedBy: at + 25,
    order: { grill: p.order.grill ?? 0, cold: p.order.cold ?? 0, oven: p.order.oven ?? 0 },
    signature: p.signature.station,
    promised,
  };
}
function service(promised = true, busy = false) {
  const s = leave(sunday());
  const b = booked('hasan', promised);
  s.bookings = [b];
  // Start a fresh board through the ordinary next-night path so ticket insertion runs.
  s.phase = 'evening';
  s.night = 6;
  s.phase = 'sunday';
  s.sunday = { ...required(sunday().sunday), parties: [] };
  queueInput(s, { kind: 'open' });
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  s.minute = b.at;
  for (const t of s.tickets) if (t.party !== b.party) t.status = 'served';
  if (busy) {
    const other = required(s.tickets.find((t) => !t.party));
    Object.assign(other, { status: 'open', cold: 2, doneCold: 0, patience: 1000, at: s.minute });
    queueInput(s, { kind: 'help', ticket: other.id, station: 'cold' });
  }
  step(s);
  return { s, b, t: required(s.tickets.find((t) => t.party === b.party)) };
}
function cookSignature(s: GameState, ticket: number, choice: 'careful' | 'now') {
  for (let n = 0; n < 50 && !cookingChoice(s); n++) {
    if (cookingStep(s)?.ready) queueInput(s, { kind: 'cook-step', ticket });
    else step(s);
  }
  expect(cookingChoice(s)?.ticket).toBe(ticket);
  queueInput(s, { kind: 'cook-choice', ticket, choice });
  for (let n = 0; n < 20 && s.help?.ticket === ticket; n++) {
    if (cookingStep(s)?.ready) queueInput(s, { kind: 'cook-step', ticket });
    else step(s);
  }
}
function finishOrder(s: GameState, t: GameState['tickets'][number]) {
  t.doneGrill = t.grill;
  t.doneCold = t.cold;
  t.doneOven = t.oven;
  step(s);
  queueInput(s, { kind: 'call-plate', ticket: t.id });
}

describe('returning parties and the promises the chef makes', () => {
  it('chooses two distinct nights from seed and week, with the writer conditional on Friday', () => {
    for (let seed = 0; seed < 100; seed++)
      for (const week of [1, 2, 3]) {
        const ids = partyChoices(seed, week);
        expect(ids).toHaveLength(2);
        expect(new Set(ids.map((id) => required(partyOf(id)).weekday)).size).toBe(2);
        expect(ids).not.toContain('writer');
        expect(partyChoices(seed, week)).toEqual(ids);
        if (week === 1) expect(partyChoices(seed, week, true)).toContain('writer');
      }
  });
  it('does not choose parties from Sunday inputs and defaults to ordinary service', () => {
    const a = sunday();
    const b = cloneState(a);
    queueInput(a, { kind: 'choose', key: 'price', value: 'raise' });
    expect(a.sunday?.parties).toEqual(b.sunday?.parties);
    leave(a);
    queueInput(b, { kind: 'open' });
    expect(a.bookings?.map((x) => x.party)).toEqual(b.bookings?.map((x) => x.party));
    expect(b.bookings).toHaveLength(2);
    expect(b.bookings?.every((x) => !x.promised)).toBe(true);
  });
  it('grows the base order for a clean week and at most two kept promises', () => {
    const historical: Booking[] = [0, 1, 2].map(() => ({ ...booked(), outcome: 'kept' }));
    const s = sunday(42, 2, historical);
    const id = required(s.sunday?.parties?.[0]);
    const p = required(partyOf(id));
    leave(s);
    const b = required(s.bookings?.find((x) => x.party === id && x.week === 3));
    expect(b.order[p.grows]).toBe((p.order[p.grows] ?? 0) + 3);
  });
  it('adds no extra portion after a week with walkouts and no kept promise', () => {
    const s = sunday(42, 1, [], 1);
    for (const b of s.bookings ?? []) {
      const p = required(partyOf(b.party));
      expect(b.order).toEqual({
        grill: p.order.grill ?? 0,
        cold: p.order.cold ?? 0,
        oven: p.order.oven ?? 0,
      });
    }
    expect(s.bookings).toHaveLength(2);
  });
  it('replaces the regular ticket instead of seating the same guest twice', () => {
    const { s, b } = service();
    expect(s.tickets.filter((t) => t.party === b.party)).toHaveLength(1);
    expect(s.tickets.filter((t) => t.regular === 'hasan')).toHaveLength(1);
  });
  it('reserves the signature from crew work and keeps careful, timely service', () => {
    const { s, b, t } = service();
    expect(s.help?.ticket ?? s.chefNext?.ticket).toBe(t.id);
    const waiting = required(s.tickets.find((other) => other.id !== t.id));
    Object.assign(waiting, {
      status: 'open',
      at: s.minute,
      grill: 0,
      doneGrill: 0,
      cold: 30,
      doneCold: 0,
      oven: 0,
      doneOven: 0,
      patience: 1000,
    });
    const regard = required(s.regulars.hasan).regard;
    for (let n = 0; n < 2; n++) {
      s.work.grill = 100;
      step(s);
    }
    expect(t.doneGrill).toBeLessThan(t.grill);
    cookSignature(s, t.id, 'careful');
    const till = s.till;
    finishOrder(s, t);
    expect(b.outcome).toBe('kept');
    expect(s.regulars.hasan?.friendNext).toBe(true);
    expect(required(s.regulars.hasan).regard).toBeGreaterThan(regard);
    expect(s.till - till).toBeGreaterThan(t.price);
    expect(b.waited).toBe(waiting.table);
    expect(s.said.some((line) => line.text.includes(`Table ${waiting.table} waited longest`))).toBe(true);
  });
  it('holds a promised signature behind the chef current portion', () => {
    const { s, t } = service(true, true);
    const current = required(s.help);
    expect(current.ticket).not.toBe(t.id);
    expect(s.chefNext).toEqual({ ticket: t.id, station: 'grill' });
    for (let n = 0; n < 3; n++) {
      s.work.grill = 100;
      step(s);
    }
    expect(t.doneGrill).toBeLessThan(t.grill);
    queueInput(s, { kind: 'finish-portion', ticket: current.ticket });
    for (let n = 0; n < 40 && s.help?.ticket !== t.id; n++) step(s);
    expect(s.help?.ticket).toBe(t.id);
  });
  it('breaks careful food served after the deadline and gives promised parties 35 minutes', () => {
    const { s, b, t } = service();
    expect(t.patience).toBe(35);
    cookSignature(s, t.id, 'careful');
    s.minute = b.servedBy + 1;
    Object.assign(t, { doneGrill: t.grill, doneCold: t.cold, doneOven: t.oven, platedAt: s.minute });
    queueInput(s, { kind: 'call-plate', ticket: t.id });
    expect(t.servedAt).toBe(b.servedBy + 1);
    expect(t.status).toBe('served');
    expect(b.outcome).toBe('broken');
  });
  it('keeps a careful promise served exactly at its deadline', () => {
    const { s, b, t } = service();
    cookSignature(s, t.id, 'careful');
    s.minute = b.servedBy;
    Object.assign(t, { doneGrill: t.grill, doneCold: t.cold, doneOven: t.oven, platedAt: s.minute });
    queueInput(s, { kind: 'call-plate', ticket: t.id });
    expect(t.servedAt).toBe(b.servedBy);
    expect(b.outcome).toBe('kept');
  });
  it('a promised plate still waiting at 35 minutes walks at 36 before the runner can serve it', () => {
    const { s, b, t } = service();
    cookSignature(s, t.id, 'careful');
    Object.assign(t, { doneGrill: t.grill, doneCold: t.cold, doneOven: t.oven });
    s.minute = b.at + 35;
    step(s);
    expect(t.status).toBe('open');
    expect(t.platedAt).toBe(b.at + 35);
    const clean = s.plates.clean;
    const dirty = s.plates.dirty.length;
    step(s);
    expect(t.status).toBe('walked');
    expect(b.outcome).toBe('broken');
    expect(s.plates.clean).toBe(clean);
    expect(s.plates.dirty.length).toBe(dirty + 1);
    expect(t.servedAt).toBeUndefined();
  });
  it.each(['late', 'missed'] as const)('preserves the existing %s act quality when judging care', (kind) => {
    const { s, b, t } = service();
    const action = required(cookingStep(s));
    s.minute = action.deadline + (kind === 'missed' ? 4 : 1);
    if (kind === 'missed') step(s);
    else queueInput(s, { kind: 'cook-step', ticket: t.id });
    cookSignature(s, t.id, 'careful');
    finishOrder(s, t);
    expect(b.signatureQuality).toBe(kind === 'late' ? 'careful' : 'plain');
    expect(b.outcome).toBe(kind === 'late' ? 'kept' : 'broken');
  });
  it('does not reserve a second copy of an active promised signature', () => {
    const { s, t } = service();
    t.grill = t.doneGrill + 1;
    queueInput(s, { kind: 'help', ticket: t.id, station: 'grill' });
    expect(s.help?.ticket).toBe(t.id);
    expect(s.chefNext).toBeNull();
  });
  it('does not overwrite a queued promised signature with another portion', () => {
    const { s, t } = service(true, true);
    const current = required(s.help);
    const queued = { ...required(s.chefNext) };
    queueInput(s, { kind: 'help', ticket: current.ticket, station: 'cold' });
    expect(s.chefNext).toEqual(queued);
    expect(s.chefNext?.ticket).toBe(t.id);
  });
  it('names the table that waited during signature cooking rather than before it', () => {
    const { s, b, t } = service();
    const others = s.tickets.filter((other) => other.id !== t.id);
    const a = required(others[0]);
    const full = required(others[1]);
    for (const [other, table, at] of [
      [a, 90, b.at - 30],
      [full, 91, b.at],
    ] as const)
      Object.assign(other, {
        status: 'open',
        table,
        at,
        grill: 0,
        doneGrill: 0,
        cold: 30,
        doneCold: 0,
        oven: 0,
        doneOven: 0,
        patience: 1000,
      });
    step(s);
    a.status = 'served';
    cookSignature(s, t.id, 'careful');
    finishOrder(s, t);
    expect(b.outcome).toBe('kept');
    expect(b.waited).toBe(full.table);
    expect(s.said.some((line) => line.text.includes(`Table ${full.table} waited longest`))).toBe(true);
  });
  it('replays and restores queued signatures, active signatures and resolved parties exactly in week two', () => {
    const s = beginAtWeekTwo(42);
    const checked = new Set<string>();
    function checkpoint(label: string) {
      if (checked.has(label)) return;
      const replayed = replay(s.seed, s.inputs, s.minute, s.version);
      expect(cloneState(replayed), label).toEqual(cloneState(s));
      const restored = restoreState(cloneState(s));
      expect(cloneState(restored), `${label}: restored`).toEqual(cloneState(s));
      for (let n = 0; n < 30; n++) {
        step(replayed);
        step(restored);
      }
      expect(cloneState(restored), `${label}: continuation`).toEqual(cloneState(replayed));
      checked.add(label);
    }
    for (let turns = 0; turns < 2000 && checked.size < 3; turns++) {
      if (s.help?.signature) checkpoint('active signature');
      if (
        s.chefNext &&
        s.bookings?.some(
          (b) => b.promised && b.signatureQuality === undefined && b.ticket === s.chefNext?.ticket,
        )
      )
        checkpoint('queued signature');
      if (s.bookings?.some((b) => b.outcome)) checkpoint('party outcome');
      advance(s, 'flex-chef', 'promise-all');
    }
    expect([...checked].sort()).toEqual(['active signature', 'party outcome', 'queued signature']);
  }, 30000);
  it('breaks a plain signature even when the whole order is timely', () => {
    const { s, b, t } = service();
    cookSignature(s, t.id, 'now');
    finishOrder(s, t);
    expect(b.outcome).toBe('broken');
  });
  it('finishing a reserved signature on instinct delegates it and breaks the promise', () => {
    const { s, b, t } = service();
    queueInput(s, { kind: 'finish-portion', ticket: t.id });
    for (let n = 0; n < 20 && s.help; n++) step(s);
    finishOrder(s, t);
    expect(b.outcome).toBe('broken');
  });
  it('ordinary parties do not reserve chef work or incur broken promises', () => {
    const { s, b, t } = service(false);
    expect(s.help?.ticket).not.toBe(t.id);
    expect(s.chefNext?.ticket).not.toBe(t.id);
    finishOrder(s, t);
    expect(b.outcome).toBe('served');
  });
  it.each(['open', 'asked', 'paying'] as const)(
    'ordinary regular parties preserve the %s tab payment',
    (tab) => {
      const { s, t } = service(false);
      const regular = required(s.regulars.hasan);
      regular.tab = tab;
      const till = s.till;
      finishOrder(s, t);
      expect(s.till - till).toBe(tab === 'open' ? 0 : t.price + (tab === 'asked' ? 300 : 0));
      expect(regular.tab).toBe(tab === 'asked' ? 'paying' : tab);
    },
  );
  it.each([2, 27])('ordinary regular parties retain regard and friend rules after %i minutes', (wait) => {
    const { s, b, t } = service(false);
    const regular = required(s.regulars.hasan);
    regular.tab = 'paying';
    regular.regard = 0.75;
    regular.friendNext = false;
    s.minute = b.at + wait - 1;
    finishOrder(s, t);
    expect(t.servedAt).toBe(b.at + wait);
    expect(regular.regard).toBeCloseTo(wait < 15 ? 0.85 : 0.7);
    expect(regular.friendNext).toBe(wait < 15);
  });
  it('shows the signature station cook speaking from their trust band', () => {
    const s = sunday();
    const id = required(s.sunday?.parties?.find((id) => partyOf(id)?.signature.station === 'grill'));
    for (const [trust, band] of [
      [0.1, 'cool'],
      [0.5, 'even'],
      [0.9, 'warm'],
    ] as const) {
      const voice = required(personOf(s, 'selim').will.voices.find((v) => v.voiceId === 'chef'));
      voice.trust = trust;
      const card = required(partyCard(s, id));
      expect(card.cook?.who).toBe('selim');
      const words = required(PROMISE_WORDS.selim?.[band]);
      expect(card.cook?.text).toBe(
        words.replaceAll('{signature}', card.signature).replaceAll('{host}', card.host),
      );
      expect(card.servedBy - card.at).toBe(25);
      expect(card.order.length).toBeGreaterThan(0);
    }
  });
  it.each([2, 3, 4])('takes one strike for several broken promises and a short bill in week %i', (week) => {
    const s = newGame(42, 'pass@9');
    s.night = [0, 0, 10, 14, 18][week] as number;
    s.minute = closeAt(s.night);
    s.phase = 'service';
    s.tickets = [];
    s.till = 0;
    s.bookings = [booked('hasan', true, week), booked('writer', true, week)].map((b) => ({
      ...b,
      outcome: 'broken',
    }));
    step(s);
    expect(s.strikes).toBe(1);
    expect(s.reports.at(-1)?.bill?.promiseBroken).toBe(true);
    expect(s.lost).toBe(week === 4);
  });
  it('a broken promise alone in week four is a strike, not instant loss', () => {
    const s = newGame(42, 'pass@9');
    s.night = 18;
    s.minute = closeAt(18);
    s.phase = 'service';
    s.tickets = [];
    s.till = 100000;
    s.bookings = [{ ...booked('hasan', true, 4), outcome: 'broken' }];
    step(s);
    expect(s.strikes).toBe(1);
    expect(s.lost).toBe(false);
    expect(s.reports.at(-1)?.bill?.paid).toBe(true);
  });
  it('accepts Nevin pace only as the first input in pass@9', () => {
    expect(canReplay('pass@9')).toBe(true);
    const s = newGame(42, 'pass@9');
    queueInput(s, { kind: 'pace', value: 'nevin' });
    expect(s.pace).toBe('nevin');
    const late = newGame(42, 'pass@9');
    queueInput(late, { kind: 'open' });
    queueInput(late, { kind: 'pace', value: 'nevin' });
    expect(late.pace).toBeUndefined();
    const old = newGame(42, 'pass@8');
    queueInput(old, { kind: 'pace', value: 'nevin' });
    expect(old.pace).toBeUndefined();
  });
  it('keeps ordinary week-two patience at 38 while promised parties retain their order and deadline', () => {
    const easy = beginAtWeekTwo(42, 'nevin');
    const standard = beginAtWeekTwo(42);
    const partyFacts = (s: GameState) =>
      s.bookings?.map(({ party, order, at, servedBy }) => ({ party, order, at, servedBy }));
    expect(partyFacts(easy)).toEqual(partyFacts(standard));
    advance(easy, 'flex-chef', 'promise-all');
    advance(standard, 'flex-chef', 'promise-all');
    expect([easy.night, easy.phase]).toEqual([7, 'board']);
    expect(easy.tickets.some((t) => t.regular)).toBe(true);
    expect(easy.tickets.every((t) => t.patience === 38)).toBe(true);
    const firstPartyNight = Math.min(...required(easy.bookings).map((b) => b.night));
    for (const s of [easy, standard]) {
      for (let turns = 0; turns < 1000 && !(s.night === firstPartyNight && s.phase === 'board'); turns++)
        advance(s, 'flex-chef', 'promise-all');
      expect([s.night, s.phase]).toEqual([firstPartyNight, 'board']);
      expect(s.tickets.filter((t) => t.party).length).toBeGreaterThan(0);
      expect(s.tickets.filter((t) => t.party).every((t) => t.patience === 35)).toBe(true);
    }
    expect(easy.tickets.filter((t) => !t.party).every((t) => t.patience === 38)).toBe(true);
    expect(partyFacts(easy)).toEqual(partyFacts(standard));
  });
  it('begins at week-one Sunday with its bill paid and exact ordinary-input replay across twenty seeds', () => {
    for (let seed = 1000; seed < 1020; seed++)
      for (const pace of [undefined, 'nevin'] as const) {
        let s: GameState;
        try {
          s = beginAtWeekTwo(seed, pace);
        } catch (cause) {
          throw new Error(`beginAtWeekTwo failed: seed ${seed}, pace ${pace ?? 'default'}`, { cause });
        }
        expect(s.phase).toBe('sunday');
        expect(s.night).toBe(6);
        expect(s.sunday?.parties).toHaveLength(2);
        expect(s.reports.at(-1)?.bill?.paid).toBe(true);
        expect(s.pace).toBe(pace);
        expect(cloneState(replay(s.seed, s.inputs, s.minute, s.version))).toEqual(cloneState(s));
        if (pace) expect(s.inputs[0]).toMatchObject({ kind: 'pace', value: pace });
      }
  }, 120000);
});

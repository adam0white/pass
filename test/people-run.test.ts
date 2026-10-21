import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { beginAtWeekTwo, firstPartyBoard } from '../src/sim/firstweek.ts';
import {
  boardDefaults,
  cloneState,
  continueThroughPeople,
  cookingStep,
  helpOptions,
  newGame,
  PEOPLE_RUN_NOTE,
  partyCard,
  peopleRun,
  personOf,
  queueInput,
  replay,
  step,
} from '../src/sim/kitchen.ts';
import owner from './fixtures/owner-r-eezsdpskcr.json';

it('runs new service through people and dispatches finished food without a table call', () => {
  const s = newGame(42);
  expect(s.version).toBe('pass@11');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  for (let i = 0; i < 120 && !s.tickets.some((t) => t.status === 'served'); i++) step(s);
  expect(s.tickets.some((t) => t.status === 'served')).toBe(true);
  expect(helpOptions(s)).toEqual([]);
  expect(cookingStep(s)).toBeNull();
  expect(s.chefNext).toBeUndefined();
  expect(s.passDecision).toBeUndefined();
  expect(s.inputs.some((i) => ['help', 'call-plate', 'cook-step'].includes(i.kind))).toBe(false);
  expect(
    personOf(s, 'selim').agenda.commitments.some((c) => c.label === 'my rule about the plates' && c.firm),
  ).toBe(true);
  expect(personOf(s, 'selim').will.suggestionReasons).toBe(true);
  expect(cloneState(replay(s.seed, s.inputs, s.minute, s.version))).toEqual(cloneState(s));
});

it.each([true, false])('a party promise depends on the served-by time, onTime=%s', (onTime) => {
  const s = beginAtWeekTwo(42, 'nevin');
  const party = s.sunday?.parties?.[0];
  if (!party) throw new Error('Expected party');
  expect(partyCard(s, party)?.signature).toContain('first');
  queueInput(s, { kind: 'choose', key: `promise:${party}`, value: 'promise' });
  queueInput(s, { kind: 'open' });
  const booking = firstPartyBoard(s);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  while (s.minute <= booking.at) step(s);
  const t = s.tickets.find((t) => t.id === booking.ticket);
  if (!t) throw new Error('Expected party ticket');
  expect(s.chefNext).toBeUndefined();
  if (!onTime) s.minute = booking.servedBy + 1;
  t.doneGrill = t.grill;
  t.doneCold = t.cold;
  t.doneOven = t.oven;
  s.plates.clean = 1;
  step(s);
  expect(t.status).toBe('served');
  expect(booking.outcome).toBe(onTime ? 'kept' : 'broken');
  expect(booking.signatureQuality).toBeUndefined();
  expect(s.pace).toBe('nevin');
});

it('loads the owner notebook exactly, migrates once, and replays the continued history', () => {
  const s = replay(
    owner.seed,
    owner.inputs as import('../src/sim/kitchen.ts').Input[],
    owner.minute,
    owner.game,
  );
  expect(
    createHash('sha256')
      .update(JSON.stringify(cloneState(s)))
      .digest('hex'),
  ).toBe(owner.stateSha256);
  expect(continueThroughPeople(s)).toBe(true);
  expect(continueThroughPeople(s)).toBe(false);
  expect(peopleRun(s)).toBe(true);
  expect(s.help).toBeNull();
  expect(s.chefNext).toBeNull();
  expect(s.said.at(-1)?.text).toBe(PEOPLE_RUN_NOTE);
  expect(cloneState(replay(s.seed, s.inputs, s.minute, s.version))).toEqual(cloneState(s));
});

it.each(['pass@4', 'pass@6', 'pass@7', 'pass@8', 'pass@9', 'pass@10'])(
  'migration frees unfinished work and accounts for plated inventory in %s',
  (edition) => {
    const s = newGame(42, edition);
    if (s.phase === 'board') {
      queueInput(s, { kind: 'board', rows: boardDefaults(s) });
      queueInput(s, { kind: 'open' });
    }
    const t = s.tickets[0];
    if (!t) throw new Error('Expected ticket');
    t.status = 'open';
    t.doneGrill = t.grill;
    t.doneCold = t.cold;
    t.doneOven = t.oven;
    t.platedAt = s.minute;
    s.plates.clean = 0;
    s.help = { ticket: t.id, station: 'grill', until: s.minute + 5 };
    s.chefNext = { ticket: t.id, station: 'cold' };
    expect(continueThroughPeople(s)).toBe(true);
    expect(s.plates.clean).toBe(1);
    expect(t.platedAt).toBeUndefined();
    expect(helpOptions(s)).toEqual([]);
    step(s);
    expect(t.status).toBe('served');
    expect(s.plates.clean).toBe(0);
  },
);

/** Scope: finite opt-in restaurant opportunities and world costs, with ordinary inputs.
 * The wedding control is explicitly world-only. It never injects or retunes a Person.
 */
import { expect, it } from 'vitest';
import { NIGHT_PLANS } from '../src/sim/campaign.ts';
import { replayExport } from '../src/sim/continuation.ts';
import { advance } from '../src/sim/host-policy.ts';
import {
  boardDefaults,
  cloneState,
  exportRun,
  newGame,
  openAt,
  personOf,
  queueInput,
  replay,
  stationOf,
  step,
} from '../src/sim/kitchen.ts';
import { KITCHEN_EDITION, kitchenMinute, kitchenNight, takeIngredient } from '../src/sim/kitchen-edition.ts';
import hirePrefix from './fixtures/hulya-hire-prefix.json';

function service() {
  const s = newGame(42, KITCHEN_EDITION);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  return s;
}
function exact(s: ReturnType<typeof newGame>) {
  expect(cloneState(replayExport(exportRun(s, '3.0.0')))).toEqual(cloneState(s));
  expect(cloneState(replay(s.seed, s.inputs, s.minute, s.version, undefined, true))).toEqual(cloneState(s));
}
it('keeps the default edition and historical kitchens outside the new world', () => {
  const s = newGame(42);
  expect(s.version).toBe('pass@13');
  expect(s.kitchen).toBeUndefined();
  queueInput(s, { kind: 'kitchen-task', who: 'selim', task: 'room' });
  expect(s.kitchen).toBeUndefined();
});
it('lets a cook decline conversation, then spends three service minutes when another agrees', () => {
  const s = service();
  queueInput(s, { kind: 'kitchen-task', who: 'selim', task: 'conversation' });
  expect(s.kitchen?.conversations.at(-1)?.verdict).toBe('deferred');
  expect(personOf(s, 'selim').activity?.affordanceId).toBe('grill');
  for (let i = 0; i < 5; i++) step(s);
  queueInput(s, { kind: 'kitchen-task', who: 'dilek', task: 'conversation' });
  expect(personOf(s, 'dilek').activity?.affordanceId).toBe('conversation');
  expect(stationOf(s, 'dilek')).toBeNull();
  const at = s.minute;
  const grill = s.tickets.reduce((n, t) => n + t.doneGrill, 0);
  for (let i = 0; i < 4; i++) step(s);
  expect(s.minute).toBe(at + 4);
  expect(s.kitchen?.conversations.at(-1)?.completed).toBe(at + 3);
  expect(s.tickets.reduce((n, t) => n + t.doneGrill, 0)).toBeGreaterThanOrEqual(grill);
  expect(s.said.some((line) => line.who === 'dilek' && line.text.includes('pan handle'))).toBe(true);
  exact(s);
});
it('assigns the actual cook to the room and takes that person off food production', () => {
  const s = service();
  for (let i = 0; i < 12; i++) step(s);
  const people = s.people.map((p) => p.id),
    till = s.till;
  queueInput(s, { kind: 'kitchen-task', who: 'rafi', task: 'room' });
  expect(personOf(s, 'rafi').activity).toBeNull(); // He has not arrived on Monday.
  queueInput(s, { kind: 'kitchen-task', who: 'dilek', task: 'room' });
  expect(personOf(s, 'dilek').activity?.affordanceId).toBe('room');
  expect(personOf(s, 'dilek').activity?.endsAt).toBe(s.minute + 15);
  expect(stationOf(s, 'dilek')).toBeNull();
  expect(s.people.map((p) => p.id)).toEqual(people);
  expect(s.till).toBe(till);
  exact(s);
});
it('hears guests, explains an accepted request and refuses one that conflicts with Selim’s plates rule', () => {
  const s = service();
  while (s.night < 2) advance(s, 'ask', 'promise-none');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  while (s.phase === 'service') step(s);
  expect(s.kitchen?.guests.some((g) => g.verdict === 'assented' && g.outcome === 'explained')).toBe(true);
  expect(
    s.kitchen?.guests.some(
      (g) =>
        g.who === 'selim' && g.action === 'dish' && g.verdict === 'refused' && g.outcome === 'unanswered',
    ),
  ).toBe(true);
  expect(s.said.some((line) => line.text.includes('Wash our plates now.'))).toBe(true);
  exact(s);
});
it('chooses a costed boundary and then a real voluntary departure under repeated ordinary pressure', () => {
  const s = service();
  let boundarySeen = false;
  while (s.phase === 'service' && !s.crew.find((m) => m.id === 'dilek')?.left) {
    if (s.minute % 2 === 0)
      queueInput(s, {
        kind: 'ask',
        cook: 'dilek',
        verb: s.minute % 4 === 0 ? 'grill' : 'cold',
        insist: true,
      });
    step(s);
    if (personOf(s, 'dilek').activity?.affordanceId === 'no-replies') {
      boundarySeen = true;
      expect(stationOf(s, 'dilek')).toBeNull();
      const n = personOf(s, 'dilek').trace.length;
      queueInput(s, { kind: 'kitchen-task', who: 'dilek', task: 'room' });
      expect(personOf(s, 'dilek').trace.length).toBe(n);
    }
  }
  expect(boundarySeen).toBe(true);
  const p = personOf(s, 'dilek');
  expect(p.activity?.affordanceId).toBe('resign');
  expect(p.activity?.action).toBe('home');
  expect(p.activity?.endsAt).toBe(s.minute - 1 + 30);
  expect(s.crew.find((m) => m.id === 'dilek')?.left).toBeDefined();
  expect(
    p.trace.some(
      (d) => d.chosenAffordanceId === 'resign' && d.considered.some((o) => o.affordanceId === 'cold'),
    ),
  ).toBe(true);
  exact(s);
  const control = service();
  while (control.minute < s.minute) step(control);
  expect(control.crew.find((m) => m.id === 'dilek')?.left).toBeUndefined();
});
it('binds failure to the authored wedding and conserves paid replacement stock (world-only fixture)', () => {
  const s = newGame(42, KITCHEN_EDITION);
  const wedding = NIGHT_PLANS.find((p) => p.wedding);
  if (!wedding) throw new Error('Missing authored wedding.');
  // World-only fixture: move calendar, tickets and till. People are untouched and never advanced here.
  s.night = wedding.n;
  s.phase = 'service';
  s.minute = openAt(wedding.n);
  s.tickets = [
    {
      id: 1,
      table: 0,
      at: s.minute,
      grill: 8,
      cold: 8,
      oven: 4,
      doneGrill: 0,
      doneCold: 0,
      doneOven: 0,
      patience: 9999,
      price: 1600,
      due: s.minute + 150,
      status: 'open',
    },
  ];
  s.till = 1000;
  const people = JSON.stringify(s.people),
    tickets = JSON.stringify(s.tickets);
  kitchenNight(s);
  expect(takeIngredient(s, 'grill')).toBe(false);
  kitchenMinute(s);
  expect(s.kitchen?.supply.failed).toBe(false);
  s.minute += 30;
  kitchenMinute(s);
  expect(s.kitchen?.supply.failed).toBe(true);
  expect(s.kitchen?.stock.grill).toBe(0);
  queueInput(s, { kind: 'replacement' });
  queueInput(s, { kind: 'replacement' });
  expect(s.till).toBe(760);
  s.minute += 44;
  kitchenMinute(s);
  expect(s.kitchen?.stock.grill).toBe(0);
  s.minute++;
  kitchenMinute(s);
  expect(s.kitchen?.stock.grill).toBe(8);
  for (let i = 0; i < 8; i++) expect(takeIngredient(s, 'grill')).toBe(true);
  expect(takeIngredient(s, 'grill')).toBe(false);
  expect(s.kitchen?.used.grill).toBe(8);
  expect(JSON.stringify(s.tickets)).toBe(tickets);
  expect(JSON.stringify(s.people)).toBe(people);
});

it('hears a hire’s own words beside the actual HF answer without granting new skills', () => {
  // Mechanism control: replay a captured ordinary service prefix, then make the live request.
  // This does not test the host policy end to end; campaign and direct replay controls remain.
  const s = replay(
    hirePrefix.seed,
    hirePrefix.inputs as Parameters<typeof replay>[1],
    hirePrefix.minute,
    hirePrefix.edition,
    undefined,
    hirePrefix.plainNarration,
  );
  const skills = structuredClone(personOf(s, 'hulya').skills);
  queueInput(s, { kind: 'ask', cook: 'hulya', verb: 'cold', insist: true });
  step(s);
  const answer = s.said.findLast((line) => line.who === 'hulya' && line.kind === 'answer');
  expect(answer?.text).toContain('Antalya kitchens');
  expect(s.lastAnswer?.verdict).toBe('complied');
  expect(personOf(s, 'hulya').skills).toEqual(skills);
  // This no-chapter export uses the same six replay arguments as exact()'s direct call.
  // Keep full exported-state equality; omit only that duplicate traversal in this control.
  expect(cloneState(replayExport(exportRun(s, '3.0.0')))).toEqual(cloneState(s));
});

// Closing must not turn a thirty-minute journey into a twenty-six-minute journey.
it('finishes a late resignation journey at its actual arrival time and replays exactly', () => {
  const s = service();
  while (s.minute < 1250) step(s);
  while (s.phase === 'service' && s.minute < 1319) {
    if (s.minute % 2 === 0)
      queueInput(s, {
        kind: 'ask',
        cook: 'dilek',
        verb: s.minute % 4 === 0 ? 'grill' : 'cold',
        insist: true,
      });
    step(s);
  }
  const p = personOf(s, 'dilek');
  expect(p.activity?.affordanceId).toBe('resign');
  expect(p.activity?.startedAt).toBe(1294);
  expect(p.activity?.endsAt).toBe(1324);
  expect(s.crew.find((m) => m.id === 'dilek')?.left?.night).toBe(1);
  expect(stationOf(s, 'dilek')).toBeNull();
  expect(p.memory.episodes.some((e) => e.action === 'home' && e.tags.includes('completed'))).toBe(false);
  step(s);
  expect(s.phase).toBe('evening');
  expect(p.activity).toBeNull();
  expect(p.now).toBe(1324);
  expect(
    p.memory.episodes.filter((e) => e.action === 'home' && e.tags.includes('completed')).map((e) => e.at),
  ).toEqual([1324]);
  exact(s);
});

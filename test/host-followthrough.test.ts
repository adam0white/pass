/** Scope: finite heard words, consent-based private time and physical abandoned plates.
 * HF chooses the activity; these controls never set a Person's feelings or decision.
 */
import { expect, it } from 'vitest';
import { PRIVATE_CLUES } from '../src/sim/cast-scenes.ts';
import { replayExport } from '../src/sim/continuation.ts';
import { interrupt, verifyCommunity } from '../src/sim/hf4-person.ts';
import {
  boardDefaults,
  cloneState,
  contactAvailable,
  exportRun,
  newGame,
  personOf,
  queueInput,
  replay,
  restoreState,
  stationOf,
  step,
} from '../src/sim/kitchen.ts';
import {
  clearingAvailable,
  heardTopic,
  heardTopics,
  privateConversationAvailable,
} from '../src/sim/kitchen-edition.ts';
import { offerUnavailable } from '../src/ui/people-offers.ts';
import clearingPrefix from './fixtures/host-clearing-prefix.json';

function service() {
  const s = newGame(42, 'pass@19');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  return s;
}
const raw = (s: ReturnType<typeof service>) => JSON.parse(JSON.stringify(cloneState(s)));

it('keeps private words unheard until an actual conversation completes, then offers their source', () => {
  const s = service();
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'invite' });
  expect(s.kitchen?.conversations.at(-1)?.verdict).toBe('deferred');
  expect(s.said.some((line) => line.text === PRIVATE_CLUES.dilek)).toBe(false);
  for (let i = 0; i < 5; i++) step(s);
  expect(privateConversationAvailable(s, 'dilek')).toBe(true);
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'invite' });
  expect(personOf(s, 'dilek').activity?.affordanceId).toBe('conversation');
  expect(stationOf(s, 'dilek')).toBeNull();
  expect(s.said.some((line) => line.text === PRIVATE_CLUES.dilek)).toBe(false);
  const restored = restoreState(raw(s));
  for (let i = 0; i < 5; i++) {
    step(s);
    step(restored);
  }
  expect(s.said.filter((line) => line.text === PRIVATE_CLUES.dilek)).toHaveLength(1);
  expect(privateConversationAvailable(s, 'dilek')).toBe(false);
  // Source-causal presentation control: real HF settlement remains fractional,
  // while the actual coverage call uses a whole-minute public clock.
  expect(s.staffing?.some((gap) => !Number.isInteger(gap.until))).toBe(true);
  const calls = s.said.filter((line) => line.kind === 'call' && line.text.includes('Someone needs to work'));
  expect(calls.length).toBeGreaterThan(0);
  expect(calls.every((line) => !/\d{2}:\d{2}\.\d/.test(line.text))).toBe(true);
  expect(heardTopics(s, 'dilek').some((topic) => topic.text === PRIVATE_CLUES.dilek)).toBe(true);
  expect(heardTopics(s, 'selim').some((topic) => topic.text === PRIVATE_CLUES.dilek)).toBe(false);
  expect(raw(restored)).toEqual(raw(s));
  const topic = heardTopics(s, 'dilek').find((topic) => topic.text === PRIVATE_CLUES.dilek);
  if (!topic) throw new Error('Missing actually heard account.');
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'follow-up', topic: topic.id });
  expect(s.kitchen?.conversations.at(-1)?.source).toEqual({ at: topic.at, text: topic.text });
  expect(contactAvailable(s, 'dilek', 'follow-up')).toBe(false);
  expect(s.said.some((line) => line.who === 'chef' && line.text.includes(topic.text))).toBe(true);
  expect(raw(replayExport(exportRun(s, '4.12.0')))).toEqual(raw(s));
  expect(verifyCommunity(s.chef).verified).toBe(true);
  // Presentation retention control: evict the rolling speech log, leaving actual
  // completed work and HF untouched. This edited-log fixture makes no host replay claim.
  const aged = restoreState(raw(s));
  aged.said = [];
  for (let i = 0; i < 5; i++) step(aged);
  expect(privateConversationAvailable(aged, 'dilek')).toBe(false);
  expect(offerUnavailable(aged, 'dilek')).toContain('already heard');
  expect(heardTopics(aged, 'dilek').some((entry) => entry.text === PRIVATE_CLUES.dilek)).toBe(true);
  const cold = restoreState(raw(aged));
  expect(heardTopics(cold, 'dilek')).toEqual(heardTopics(aged, 'dilek'));
}, 120000);

it('reveals no account from an interrupted private activity or a later ordinary completion', () => {
  const s = service();
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'invite' });
  for (let i = 0; i < 5; i++) step(s);
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'invite' });
  expect(personOf(s, 'dilek').activity?.affordanceId).toBe('conversation');
  // Receipt control: interrupt the real activity through HF. No Person fields are edited.
  interrupt(personOf(s, 'dilek'), s.minute, 'control:conversation-interrupted');
  for (let i = 0; i < 5; i++) step(s);
  queueInput(s, { kind: 'cast-talk', who: 'dilek', choice: 'check-in' });
  for (let i = 0; i < 5; i++) step(s);
  expect(
    s.kitchen?.conversations.find((entry) => entry.private && entry.activity)?.interrupted,
  ).toBeDefined();
  expect(s.said.some((line) => line.text === PRIVATE_CLUES.dilek)).toBe(false);
  expect(heardTopics(s, 'dilek').some((topic) => topic.text === PRIVATE_CLUES.dilek)).toBe(false);
  expect(verifyCommunity(s.chef).verified).toBe(true);
}, 120000);

it('clears one real abandoned meal, conserves its plate, and retains fallback after interruption', () => {
  // Headless ordinary-input prefix: night two, Dilek takes room work, table 23 leaves.
  const s = replay(
    clearingPrefix.seed,
    clearingPrefix.inputs as Parameters<typeof replay>[1],
    clearingPrefix.minute,
    'pass@19',
  );
  const ticket = s.tickets.find((ticket) => clearingAvailable(s, ticket.id));
  if (!ticket) throw new Error('The actual played prefix must leave an abandoned plate.');
  expect(ticket.status).toBe('walked');
  expect(
    heardTopics(s, 'dilek').some((topic) => topic.text.includes('dining room for fifteen minutes')),
  ).toBe(true);
  expect(heardTopic(s, 'dilek')).toBeDefined();
  const fallback = s.plates.dirty.find((plate) => plate.abandonedTicket === ticket.id)?.at;
  const plates = () => s.plates.clean + s.plates.pile + s.plates.dirty.length;
  const total = plates(),
    till = s.till;
  queueInput(s, { kind: 'clear-table', who: 'dilek', ticket: ticket.id });
  queueInput(s, { kind: 'clear-table', who: 'selim', ticket: ticket.id });
  expect(personOf(s, 'selim').activity?.affordanceId).toBe('clear-table');
  expect(stationOf(s, 'selim')).toBeNull();
  expect(s.till).toBe(till);
  const restored = restoreState(raw(s));
  const interrupted = restoreState(raw(s));
  interrupt(personOf(interrupted, 'selim'), interrupted.minute, 'control:clearing-interrupted');
  for (let i = 0; i < 5; i++) {
    step(s);
    step(restored);
    step(interrupted);
  }
  expect(s.kitchen?.clearings?.at(-1)?.outcome).toBe('returned');
  expect(s.plates.dirty.some((plate) => plate.abandonedTicket === ticket.id)).toBe(false);
  expect(plates()).toBe(total);
  expect(ticket.status).toBe('walked');
  expect(interrupted.kitchen?.clearings?.at(-1)?.outcome).toBe('interrupted');
  expect(interrupted.plates.dirty.find((plate) => plate.abandonedTicket === ticket.id)?.at).toBe(fallback);
  expect(raw(restored)).toEqual(raw(s));
  expect(raw(replayExport(exportRun(s, '4.12.0')))).toEqual(raw(s));
  expect(verifyCommunity(s.chef).verified).toBe(true);
}, 300000);

it('rejects an unheard topic without choosing an activity or speaking', () => {
  const s = service();
  const before = raw(s);
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'follow-up', topic: 'said:999999' });
  expect(s.said).toEqual(before.said);
  expect(raw(s).hf4).toEqual(before.hf4);
}, 120000);

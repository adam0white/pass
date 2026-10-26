/** Controls catch ungrounded topic replies, missing physical delivery and repeated interruption
 * of an HF-chosen work interval. People are created and advanced by production code. */
import fs from 'node:fs';
import { expect, it } from 'vitest';
import { required } from '../src/required.ts';
import { replayExport } from '../src/sim/continuation.ts';
import { advance } from '../src/sim/host-policy.ts';
import {
  boardDefaults,
  cloneState,
  exportRun,
  newGame,
  personOf,
  queueInput,
  restoreState,
  step,
} from '../src/sim/kitchen.ts';
import { heardTopic } from '../src/sim/kitchen-edition.ts';

function service(edition = 'pass@15', seed = 42) {
  const s = newGame(seed, edition);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  return s;
}
function exact(s: ReturnType<typeof service>) {
  const full = exportRun(s, '3.0.0');
  const compact = { ...full, minute: s.minute, state: undefined };
  for (const file of [full, compact]) {
    const loaded = replayExport(JSON.parse(JSON.stringify(file)));
    expect(cloneState(loaded)).toEqual(cloneState(s));
    const continued = restoreState(cloneState(s));
    for (let i = 0; i < 8; i++) {
      step(loaded);
      step(continued);
    }
    expect(cloneState(loaded)).toEqual(cloneState(continued));
  }
}
it('preserves complete baseline13 and kitchen14 saves and actual continuation without normalization', () => {
  for (const edition of ['pass@13', 'pass@14']) {
    const prefix = new URL('./fixtures/', import.meta.url);
    const file = JSON.parse(fs.readFileSync(new URL(`followup-${edition}-before.json`, prefix), 'utf8'));
    const s = replayExport(file);
    expect(cloneState(s)).toEqual(file.state);
    for (let i = 0; i < 80; i++) step(s);
    expect(cloneState(s)).toEqual(
      JSON.parse(fs.readFileSync(new URL(`followup-${edition}-continued-before.json`, prefix), 'utf8')),
    );
  }
});
it('offers a prayer follow-up only after Selim actually said the prior evening line', () => {
  const s = service('pass@15', 1);
  const before = s.said.length;
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'follow-up' });
  expect(s.said.length).toBe(before);
  while (s.phase === 'service') step(s);
  while (s.night < 2) advance(s, 'ask', 'promise-none');
  const source = s.reports
    .flatMap((r) => r.reviews)
    .find((x) => x.id === 'selim' && x.line.includes('missed the sunset prayer'));
  expect(source).toBeDefined();
  if (!source) throw new Error('Missing actual prayer statement.');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'follow-up' });
  expect(s.said.some((x) => x.who === 'chef' && x.text.includes(source.line))).toBe(true);
  expect(s.said.some((x) => x.who === 'chef' && x.text.includes('sunset prayer'))).toBe(true);
  expect(s.kitchen?.conversations.at(-1)?.verdict).toBe('deferred');
  for (let i = 0; i < 10; i++) step(s);
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'follow-up' });
  expect(personOf(s, 'selim').activity?.affordanceId).toBe('conversation');
  const at = s.minute;
  for (let i = 0; i < 4; i++) step(s);
  expect(s.kitchen?.conversations.at(-1)?.completed).toBe(at + 3);
  expect(s.said.some((x) => x.who === 'selim' && x.text.includes('I missed it that evening'))).toBe(true);
  exact(s);
});
it('gives an assenting room worker an elapsed carry with a real served-table outcome', () => {
  const s = service();
  for (let i = 0; i < 12; i++) step(s);
  queueInput(s, { kind: 'kitchen-task', who: 'dilek', task: 'room' });
  expect(personOf(s, 'dilek').activity?.affordanceId).toBe('room');
  while (s.minute < 1100 && !s.kitchen?.followup?.deliveries.some((d) => d.outcome === 'carrying')) step(s);
  const pending = required(s.kitchen?.followup?.deliveries.find((d) => d.outcome === 'carrying'));
  expect(required(s.tickets.find((t) => t.id === pending.ticket)).status).toBe('open');
  exact(s);
  while (s.minute < 1100) step(s);
  const delivery = required(s.kitchen?.followup?.deliveries.find((d) => d.outcome === 'served'));
  expect(delivery).toBeDefined();
  const table = required(s.tickets.find((t) => t.id === delivery.ticket));
  expect(table.status).toBe('served');
  expect(table.servedAt).toBe(delivery.at + 2);
  expect(table.platedAt).toBe(delivery.at);
  expect(
    s.said.some((x) => x.who === 'dilek' && x.text.includes('carried') && x.text.includes('table')),
  ).toBe(true);
  exact(s);
});
it('stops repeated rush interruptions until the chosen work reaches its next HF review', () => {
  const s = service();
  let refused = false;
  for (let i = 0; i < 80 && !refused; i++) {
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'dish', insist: true });
    step(s);
    if (s.lastAnswer?.verdict !== 'refused') continue;
    refused = true;
    const p = personOf(s, 'selim');
    const raw = JSON.stringify(p),
      asked = required(s.cooks.find((c) => c.id === 'selim')).night.asked;
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'cold', insist: true });
    expect(JSON.stringify(p)).toBe(raw);
    expect(required(s.cooks.find((c) => c.id === 'selim')).night.asked).toBe(asked);
    expect(s.said.some((x) => x.who === 'selim' && x.text.includes('finish this part'))).toBe(true);
  }
  expect(refused).toBe(true);
  exact(s);
});

it('keeps the newest actual prayer report available after an ordinary check-in', () => {
  const s = service('pass@15', 1);
  const finishService = () => {
    while (s.phase === 'service') step(s);
  };
  finishService();
  while (s.night < 2) advance(s, 'ask', 'promise-none');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  const source = required(heardTopic(s, 'selim'));
  expect(source.night).toBe(1);
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'check-in' });
  for (let i = 0; i < 10; i++) step(s);
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'check-in' });
  expect(s.kitchen?.conversations.at(-1)?.verdict).toBe('assented');
  expect(s.said.some((line) => line.who === 'selim' && line.text.includes('These are her pans.'))).toBe(true);
  expect(heardTopic(s, 'selim')).toEqual(source);
  for (let i = 0; i < 4; i++) step(s);
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'follow-up' });
  expect(s.kitchen?.conversations.at(-1)?.source?.text).toBe(source.text);
  expect(s.said.some((line) => line.who === 'chef' && line.text.includes(source.text))).toBe(true);
  exact(s);
  finishService();
  const latest = required(
    s.reports.find((report) => report.night === 2)?.reviews.find((r) => r.id === 'selim'),
  );
  expect(latest.line).toContain('I missed the sunset prayer tonight.');
  expect(heardTopic(s, 'selim')?.night).toBe(2);
  expect(heardTopic(s, 'selim')?.text).toBe(latest.line);
  // World-only order control uses actual played reports and leaves all Person/history/RNG bytes untouched.
  const reordered = { ...s, reports: [...s.reports].reverse() };
  expect(heardTopic(reordered, 'selim')).toEqual(heardTopic(s, 'selim'));
  exact(s);
});

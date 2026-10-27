/** Panel fixes change new kitchens only; recorded editions retain their exact inputs and rules. */
import { expect, it } from 'vitest';
import { PRIVATE_CLUES } from '../src/sim/cast-scenes.ts';
import { replayExport } from '../src/sim/continuation.ts';
import { advance } from '../src/sim/host-policy.ts';
import {
  boardDefaults,
  cloneState,
  exportRun,
  newGame,
  PANEL_EDITION,
  queueInput,
  step,
} from '../src/sim/kitchen.ts';
import { heardTopic } from '../src/sim/kitchen-edition.ts';

function service(edition = PANEL_EDITION) {
  const s = newGame(42, edition);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  return s;
}
it('gives night one one seeded founder decision near 18:30 and replays its answer', () => {
  const s = service();
  while (s.minute < 1114) step(s);
  expect(s.request).toMatchObject({ who: 'dilek', state: 'asking' });
  expect(s.request?.at).toBeGreaterThanOrEqual(1108);
  expect(s.request?.at).toBeLessThanOrEqual(1112);

  queueInput(s, { kind: 'answer', choice: 'yes' });
  for (let i = 0; i < 12; i++) step(s);
  const full = exportRun(s, '3.0.0');
  expect(cloneState(replayExport(full))).toEqual(cloneState(s));
  const compact = replayExport({ ...full, minute: s.minute, state: undefined });
  expect(cloneState(compact)).toEqual(cloneState(s));
  for (let i = 0; i < 8; i++) {
    step(compact);
    step(s);
  }
  expect(cloneState(compact)).toEqual(cloneState(s));
  const old = service('pass@16');
  while (old.minute < 1110) step(old);
  expect(old.request).toBeNull();
});
it('shows each served table when its actual payment reaches the till', () => {
  const s = service();
  while (s.phase === 'service') step(s);
  const served = s.tickets.filter((t) => t.status === 'served');
  expect(served.length).toBeGreaterThan(0);
  const receipts = s.said.filter((line) => line.text.includes('added to the till.'));
  expect(receipts).toHaveLength(served.length);
  for (const t of served) {
    expect(
      receipts.find(
        (line) =>
          line.at === t.servedAt && line.text === `Table ${t.table} served. ₺${t.price} added to the till.`,
      ),
    ).toBeDefined();
  }
});
it('answers each private offer immediately and grounds its follow-up in that heard note', () => {
  const s = service();
  while (s.night < 2) advance(s, 'ask');
  const replies: string[] = [];
  for (const who of ['selim', 'dilek', 'rafi']) {
    queueInput(s, { kind: 'cast-talk', who, choice: 'listen' });
    expect(s.said.at(-1)).toMatchObject({ who, text: PRIVATE_CLUES[who] });
    const topic = heardTopic(s, who);
    expect(topic?.text).toBe(PRIVATE_CLUES[who]);
    replies.push(topic?.reply ?? '');
  }
  expect(new Set(replies).size).toBe(3);
  expect(replies.join(' ')).toContain('Nevin');
  expect(replies.join(' ')).toContain('recording');
  expect(replies.join(' ')).toContain('deposit');
  expect(cloneState(replayExport(exportRun(s, '3.0.0')))).toEqual(cloneState(s));
});
it('gives each founder their own answer even when HF refuses the talk', () => {
  const s = service();
  while (s.night < 2) advance(s, 'ask');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  const replies: string[] = [];
  for (const who of ['selim', 'dilek', 'rafi']) {
    queueInput(s, { kind: 'cast-talk', who, choice: 'check-in' });
    replies.push(s.said.at(-1)?.text ?? '');
  }
  expect(new Set(replies).size).toBe(3);
  expect(replies.every((reply) => reply.length > 20)).toBe(true);
});

it('keeps the public week-two handover on the current edition with an exact replay', async () => {
  const { beginAtWeekTwo } = await import('../src/sim/firstweek.ts');
  const s = beginAtWeekTwo(42, undefined, PANEL_EDITION);
  expect(s.version).toBe(PANEL_EDITION);
  expect(s.phase).toBe('sunday');
  expect(cloneState(replayExport(exportRun(s, '3.0.0')))).toEqual(cloneState(s));
});

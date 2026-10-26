import { expect, it } from 'vitest';
import { replayExport } from '../src/sim/continuation.ts';
import { boardDefaults, cloneState, exportRun, newGame, queueInput } from '../src/sim/kitchen.ts';

function service() {
  const s = newGame(42);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  return s;
}

it('allows ordinary contact with a working cook without interrupting work or changing a person', () => {
  const s = service();
  expect(s.people[0]?.activity).toBeTruthy();
  const before = cloneState(s);
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'check-in' });
  expect(s.said.at(-1)?.who).toBe('selim');
  expect(s.said.at(-1)?.text).toContain('grill');
  expect(s.people).toEqual(before.people);
  expect(s.minute).toBe(before.minute);
  expect(s.staffing).toEqual(before.staffing);
  expect(replayExport(exportRun(s, '3.0.0'))).toEqual(s);
});

it('lets the chef acknowledge an actual remark without making a job request', () => {
  const s = service();
  const remark = s.said.findLast((line) => line.who === 'selim');
  expect(remark).toBeTruthy();
  const before = cloneState(s);
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'follow-up' });
  expect(
    s.said
      .slice(before.said.length)
      .map((line) => line.text)
      .join(' '),
  ).toContain(remark?.text);
  expect(s.said.at(-1)?.text).toBe('Thank you for listening, Chef.');
  expect(s.people).toEqual(before.people);
  expect(s.lastAnswer).toEqual(before.lastAnswer);
  expect(replayExport(exportRun(s, '3.0.0'))).toEqual(s);
});

it('keeps contact bounded per cook, topic and night and refuses absent or legacy people', () => {
  const s = service();
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'check-in' });
  const lines = s.said.length;
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'check-in' });
  expect(s.said).toHaveLength(lines);
  queueInput(s, { kind: 'cast-talk', who: 'hulya', choice: 'check-in' });
  expect(s.said).toHaveLength(lines);
  const old = newGame(42, 'pass@12');
  const before = cloneState(old);
  queueInput(old, { kind: 'cast-talk', who: 'selim', choice: 'check-in' });
  expect(old.said).toEqual(before.said);
  expect(old.people).toEqual(before.people);
});

it('does not consume a topic when the cook is out of the kitchen', () => {
  const s = service();
  const cook = s.cooks.find((c) => c.id === 'selim');
  if (!cook) throw new Error('Expected Selim');
  const original = cook.here;
  cook.here = false;
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'check-in' });
  const lines = s.said.length;
  cook.here = original;
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'check-in' });
  expect(s.said.length).toBeGreaterThan(lines);
});

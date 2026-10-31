import { describe, expect, it } from 'vitest';
import { boardDefaults, cloneState, newGame, queueInput, step } from '../src/sim/kitchen.ts';
import { boardReplies, breakSlots, earlyCoverageWarnings, openingBoard } from '../src/ui/board.ts';

function tuesday() {
  const s = newGame(42);
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  while (s.phase === 'service') step(s);
  queueInput(s, { kind: 'open' });
  return s;
}

describe('board presentation choices', () => {
  it('names the default break that leaves the grill empty for the 18:12 table (F-2168)', () => {
    const s = newGame(42, 'pass@20');
    const rows = openingBoard(s);
    const warnings = earlyCoverageWarnings(s, rows);
    // The default plan is unchanged: someone still has a break that overlaps the early table.
    expect(rows.some((row) => row.breakAt === 1090)).toBe(true);
    expect(warnings.length).toBeGreaterThan(0);
    for (const line of warnings)
      expect(line).toMatch(/meal break \(\d\d:\d\d\u2013\d\d:\d\d\) leaves the (grill|cold side) empty/);
    expect(warnings.join(' ')).toMatch(/Selim|Dilek/);
    // Moving every break past the early table, or choosing a cover, removes the warning.
    const moved = rows.map((row) => ({ ...row, breakAt: 1185 + (row.cook === 'selim' ? 0 : 25) }));
    expect(earlyCoverageWarnings(s, moved)).toEqual([]);
    const covered = rows.map((row) => ({ ...row, cover: row.cook === 'selim' ? 'dilek' : 'selim' }));
    expect(earlyCoverageWarnings(s, covered)).toEqual([]);
    // Historical editions and Thursday onward keep their own words.
    expect(earlyCoverageWarnings({ ...s, version: 'pass@17' }, rows)).toEqual([]);
    expect(earlyCoverageWarnings({ ...s, night: 4 }, rows)).toEqual([]);
  });
  it('offers named 24-hour slots within the existing allowed interval, retaining a saved time', () => {
    expect(breakSlots(1115)).toEqual([
      { minute: 1090, label: '18:10 before the rush' },
      { minute: 1115, label: '18:35 during the rush' },
      { minute: 1185, label: '19:45 during the rush' },
      { minute: 1260, label: '21:00 after the rush' },
    ]);
    expect(breakSlots(1260).some((slot) => slot.minute === 1115)).toBe(true);
    for (const time of [1050, 1295]) {
      expect(breakSlots(time).some((slot) => slot.minute === time)).toBe(true);
      expect(breakSlots(time).every((slot) => slot.minute >= 1050 && slot.minute <= 1295)).toBe(true);
    }
  });
  it('leaves Monday gaps explicit and fills carried gaps when relief joins on Tuesday', () => {
    const monday = newGame(42);
    expect(openingBoard(monday).every((row) => row.cover === null)).toBe(true);
    const s = tuesday();
    const before = cloneState(s);
    const rows = openingBoard(s);
    expect(rows.filter((row) => row.cook !== 'rafi').every((row) => row.cover === 'rafi')).toBe(true);
    expect(cloneState(s)).toEqual(before);
    queueInput(s, { kind: 'board', rows });
    for (const row of s.board?.rows.filter((row) => row.cover === 'rafi') ?? []) {
      expect(row.answer).toContain('Rafi:');
      expect(typeof row.coverAccepted).toBe('boolean');
    }
  });
  it('keeps pass@20 opening relief as an explicit player choice', () => {
    const s = newGame(42, 'pass@20');
    s.previousBoard = boardDefaults(s).slice(0, -1);
    expect(openingBoard(s).every((row) => row.cover === null)).toBe(true);
  }, 120000);
  it('previews real answers without changing a notebook and matches the committed answers', () => {
    const s = tuesday();
    const before = cloneState(s);
    const replies = boardReplies(s);
    expect(cloneState(s)).toEqual(before);
    queueInput(s, { kind: 'board', rows: openingBoard(s) });
    expect(s.board?.rows).toEqual(replies);
    expect(boardReplies(s)).toEqual(replies);
  });
  it('preserves an intentional uncovered board when the same crew returns', () => {
    const s = tuesday();
    s.previousBoard = boardDefaults(s).map((row) => ({ ...row, cover: null }));
    expect(openingBoard(s).every((row) => row.cover === null)).toBe(true);
  });
});

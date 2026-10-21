import { expect, it } from 'vitest';
import { newGame } from '../src/sim/kitchen.ts';
import { endingTally, START_APPROACHES } from '../src/ui/notebook.ts';

it('voices the longer wait and unchanged default through cooks who work here', () => {
  expect(START_APPROACHES.pace).toContain('Selim:');
  expect(START_APPROACHES.pace).toContain('all month');
  expect(START_APPROACHES.normal).toContain('Dilek:');
  expect(START_APPROACHES.normal).toContain('Leave this unchosen');
});

it('keeps the tally out of play and off by choice, then discloses its components without changing state', () => {
  const s = newGame(42);
  expect(endingTally(s, true)).toBe('');
  s.phase = 'end';
  s.lost = true;
  s.reports = [
    {
      night: 1,
      served: 12,
      walked: 3,
      takings: 100,
      tips: 0,
      skimmed: 0,
      reviews: [],
      stamps: [],
      regulars: [],
      bill: { week: 1, owed: 'bank', amount: 100, paid: true, short: 0 },
    },
  ];
  const before = JSON.stringify(s);
  expect(endingTally(s, false)).toBe('');
  const tally = endingTally(s, true);
  expect(tally).toContain('tally: 19');
  expect(tally).toContain('served (12)');
  expect(tally).toContain('walked (3)');
  expect(tally).toContain('10 × weekly bills paid (1)');
  expect(tally).toContain('not a measure of people');
  s.lost = false;
  expect(endingTally(s, true)).toBe(tally);
  s.lost = true;
  expect(JSON.stringify(s)).toBe(before);
});

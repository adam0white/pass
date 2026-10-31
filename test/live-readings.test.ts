import { expect, it } from 'vitest';
import { checkpoint } from '../src/sim/hf4-person.ts';
import { newGame } from '../src/sim/kitchen.ts';
import { liveReadingWords } from '../src/ui/live-readings.ts';

it('reads my current feelings in words without changing the run or disclosing another cook', () => {
  const s = newGame(42, 'pass@20');
  const before = JSON.stringify(checkpoint(s.chef));
  const words = liveReadingWords(s.chef, s.chef);
  expect(words.join(' ')).toContain('I feel');
  expect(words.join(' ')).not.toMatch(/[0-9]|valence|arousal|successRate/);
  const cook = s.people[0];
  if (!cook) throw new Error('Missing cook');
  expect(liveReadingWords(s.chef, cook)).toEqual([]);
  expect(JSON.stringify(checkpoint(s.chef))).toBe(before);
});

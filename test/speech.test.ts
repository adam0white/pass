import { expect, it } from 'vitest';
import type { Said } from '../src/sim/kitchen.ts';
import { unseenSpeech } from '../src/ui/speech.ts';

it('finds a new identical spoken line after the 200-entry log trims its head', () => {
  const lines: Said[] = Array.from({ length: 200 }, (_, at) => ({
    at,
    who: 'selim',
    kind: 'answer',
    text: 'Yes, Chef.',
  }));
  const last = lines.at(-1);
  const fresh: Said = { at: 200, who: 'selim', kind: 'answer', text: 'Yes, Chef.' };
  lines.shift();
  lines.push(fresh);
  expect(unseenSpeech(lines, last)).toEqual([fresh]);
  expect(unseenSpeech(lines, fresh)).toEqual([]);
});

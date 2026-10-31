/** F-2169: a deferred answer says the need once, in the cook's own words, not twice. */
import { expect, it } from 'vitest';
import { boardDefaults, newGame, queueInput, step } from '../src/sim/kitchen.ts';

it('does not say "first" twice when a cook defers a job for a bodily need', () => {
  const answers: string[] = [];
  for (const seed of [7, 42]) {
    const s = newGame(seed, 'pass@20');
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    queueInput(s, { kind: 'open' });
    let seen = 0;
    for (let i = 0; i < 90; i++) {
      step(s);
      if (s.phase === 'service' && i % 7 === 0)
        queueInput(s, { kind: 'ask', cook: i % 14 ? 'selim' : 'dilek', verb: 'grill' });
      for (; seen < s.said.length; seen++) {
        const l = s.said[seen];
        if (l?.kind === 'answer' && /bathroom|eat|drink|rest|sleep/.test(l.text) && / first/.test(l.text))
          answers.push(l.text);
      }
    }
  }
  expect(answers.some((t) => /bathroom first/.test(t))).toBe(true);
  for (const text of answers) {
    expect(text.match(/ first/g)?.length ?? 0, text).toBeLessThanOrEqual(1);
    expect(text, text).not.toMatch(/toilet first/);
  }
}, 60000);

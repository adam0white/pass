import { describe, expect, it } from 'vitest';
import { boardDefaults, cookingStep, helpOptions, newGame, queueInput, step } from '../src/sim/kitchen.ts';
import { clockPlayback } from '../src/ui/clock.ts';

describe('hands-on playback', () => {
  it('gives a ready act reading time without changing simulation state', () => {
    const s = newGame(42);
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    queueInput(s, { kind: 'open' });
    while (!helpOptions(s).length && s.phase === 'service') step(s);
    const portion = helpOptions(s)[0];
    if (!portion) throw new Error('Expected a portion');
    queueInput(s, { kind: 'help', ticket: portion.ticket, station: portion.station });
    while (!cookingStep(s)?.ready && s.help) step(s);
    const before = JSON.stringify(s);
    expect(clockPlayback(s, 1).rate).toBe(0.1);
    expect(clockPlayback(s, 1).reason).toMatch(/ready/i);
    expect(clockPlayback(s, 2).rate).toBe(3.5);
    expect(JSON.stringify(s)).toBe(before);
  });
});

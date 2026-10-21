import { describe, expect, it } from 'vitest';
import {
  boardDefaults,
  cookingChoice,
  cookingStep,
  helpOptions,
  newGame,
  queueInput,
  step,
} from '../src/sim/kitchen.ts';
import { clockPlayback } from '../src/ui/clock.ts';

function opening() {
  const s = newGame(42, 'pass@10');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  return s;
}

function quiet(s: ReturnType<typeof opening>) {
  s.passDecision = null;
  s.request = null;
  s.staffing = [];
}

describe('pass@9 cooking playback', () => {
  it('keeps Fast during a portion invitation and clears its reason when it expires', () => {
    const s = opening();
    while (!s.chefGrace?.some((claim) => claim.until > s.minute)) step(s);
    quiet(s);
    const before = JSON.stringify(s);
    expect(clockPlayback(s, 2)).toMatchObject({ rate: 3.5, reason: expect.stringContaining('Yours, Chef?') });
    expect(JSON.stringify(s)).toBe(before);
    for (const claim of s.chefGrace ?? []) claim.until = s.minute;
    expect(clockPlayback(s, 2).rate).toBe(3.5);
    expect(clockPlayback(s, 2).reason).not.toContain('Yours, Chef?');
  });

  it('slows ready acts at Steady and keeps the care decision readable even at Fast', () => {
    const s = opening();
    while (!helpOptions(s).length) step(s);
    const portion = helpOptions(s)[0];
    if (!portion) throw new Error('Expected a waiting portion');
    queueInput(s, { kind: 'help', ticket: portion.ticket, station: portion.station });
    while (!cookingStep(s)?.ready && s.help) step(s);
    quiet(s);
    expect(cookingStep(s)?.ready).toBe(true);
    expect(clockPlayback(s, 1).rate).toBe(0.1);
    expect(clockPlayback(s, 2).rate).toBe(3.5);
    for (let turns = 0; turns < 30 && !cookingChoice(s); turns++) {
      if (cookingStep(s)?.ready) queueInput(s, { kind: 'cook-step', ticket: portion.ticket });
      step(s);
    }
    quiet(s);
    expect(cookingChoice(s)).not.toBeNull();
    const before = JSON.stringify(s);
    expect(clockPlayback(s, 2).rate).toBe(0.1);
    expect(JSON.stringify(s)).toBe(before);
    queueInput(s, { kind: 'cook-choice', ticket: portion.ticket, choice: 'careful' });
    expect(clockPlayback(s, 2).rate).toBe(3.5);
    queueInput(s, { kind: 'finish-portion', ticket: portion.ticket });
    expect(clockPlayback(s, 1).rate).toBe(1.5);
  });
});

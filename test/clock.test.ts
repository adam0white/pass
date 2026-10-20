import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cloneState, newGame, queueInput, replay, step } from '../src/sim/kitchen.ts';
import { clockPlayback } from '../src/ui/clock.ts';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/clarity-counter-save.json', import.meta.url), 'utf8'),
);
const baseline = JSON.parse(
  readFileSync(new URL('./fixtures/clock-replay-hashes.json', import.meta.url), 'utf8'),
);
const hash = (s: ReturnType<typeof newGame>) =>
  createHash('sha256')
    .update(JSON.stringify(cloneState(s)))
    .digest('hex');

describe('clock playback', () => {
  it('names the actual chosen and clear-rail rates without changing state', () => {
    const s = newGame(42);
    for (const t of s.tickets) t.at += 30;
    const before = JSON.stringify(s);
    expect(clockPlayback(s, 1)).toMatchObject({ rate: 6, label: 'Steady · 6 min/s', reason: 'Rail clear.' });
    expect(JSON.stringify(s)).toBe(before);
    const first = s.tickets[0];
    if (!first) throw new Error('Expected a seeded ticket');
    first.status = 'open';
    first.grill = 0;
    first.cold = 0;
    expect(clockPlayback(s, 2)).toMatchObject({
      rate: 3.5,
      label: 'Fast · 3.5 min/s',
      reason: 'Your chosen speed.',
    });
    // Policy calls are reads, including a first-service unanswered request.
    const request = newGame(42);
    request.request = { kind: 'phone', who: 'dilek', state: 'asking', at: request.minute };
    const snapshot = JSON.stringify(request);
    expect(clockPlayback(request, 2)).toMatchObject({ rate: 0.1, reason: 'Dilek needs an answer.' });
    expect(JSON.stringify(request)).toBe(snapshot);
  });

  it('slows first-service missing coverage until the player requests a cook', () => {
    const s = newGame(42);
    while (s.minute < 1131) step(s);
    expect(clockPlayback(s, 2)).toMatchObject({ rate: 0.1, reason: 'A station needs a cook.' });
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'grill' });
    expect(clockPlayback(s, 2).rate).toBe(3.5);
  });

  it('keeps a consequential request slow after a queued answer until it resolves', () => {
    const s = newGame(42);
    s.request = { kind: 'phone', who: 'dilek', state: 'asking', at: s.minute };
    queueInput(s, { kind: 'answer', choice: 'yes' });
    expect(clockPlayback(s, 2).rate).toBe(0.1);
    step(s);
    expect(clockPlayback(s, 2).rate).toBe(3.5);
  });

  it('preserves exact replay and continuation of the pre-change pass@3 save across playback policies', () => {
    const s = replay(fixture.seed, fixture.inputs, fixture.minute, 'pass@3');
    expect(hash(s)).toBe(baseline.at);
    for (let i = 0; i < 60 && s.phase === 'service'; i++) {
      clockPlayback(s, i % 3);
      step(s);
    }
    expect(hash(s)).toBe(baseline.after60);
  });
});

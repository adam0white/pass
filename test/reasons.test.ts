import { predict } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { HIRES, makeCook, makeHire } from '../src/sim/cooks.ts';
import {
  boardDefaults,
  canReplay,
  cloneState,
  cookOf,
  hints,
  newGame,
  offersFor,
  personOf,
  queueInput,
  RUSH_FROM,
  restoreState,
  step,
} from '../src/sim/kitchen.ts';

it('enables reasons for pass@10 founders and hires, keeping earlier people unchanged', () => {
  const s = newGame(42);
  expect(s.version).toBe('pass@12');
  expect(canReplay('pass@10')).toBe(true);
  expect(s.people.every((p) => p.will.suggestionReasons === true)).toBe(true);
  for (const edition of ['pass@3', 'pass@9']) {
    expect(newGame(42, edition).people.every((p) => p.will.suggestionReasons === undefined)).toBe(true);
    expect(makeCook('selim', 42, 540, edition).agenda.commitments.every((c) => c.firm === undefined)).toBe(
      true,
    );
    for (const hire of HIRES) expect(makeHire(hire, 42, 540, edition).will.suggestionReasons).toBeUndefined();
  }
  for (const hire of HIRES) expect(makeHire(hire, 42, 540, 'pass@10').will.suggestionReasons).toBe(true);
});

it('Selim refuses plates in the rush even when insisted, with his own line and a plain no', () => {
  const s = newGame(42, 'pass@10');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  while (s.phase === 'service') step(s);
  queueInput(s, { kind: 'open' });
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  while (s.minute < 1440 + RUSH_FROM) step(s);
  const p = personOf(s, 'selim');
  expect(hints(s, 'selim').find((h) => h.verb === 'dish')?.short).toBe('no');
  expect(personOf(restoreState(cloneState(s)), 'selim').agenda.commitments.some((c) => c.firm)).toBe(true);
  for (const insist of [false, true]) {
    const r = predict(p, offersFor(s, 'selim', 'dish'), {
      voiceId: 'chef',
      affordanceId: 'dish',
      strength: insist ? 0.85 : 0.5,
      insist,
    });
    expect(r).toMatchObject({ verdict: 'refused', kind: 'willNot', reason: 'rule:my rule about the plates' });
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'dish', insist });
    step(s);
    expect(s.lastAnswer?.verdict).toBe('refused');
    expect(s.lastAnswer?.text).toContain('Twenty years on Nevin’s grill');
    expect(s.lastAnswer?.text).toContain('I don’t wash plates in the rush.');
    expect(cookOf(s, 'selim').cover?.station).not.toBe('dish');
  }
});

import { suggestionWords } from '../src/sim/lines.ts';

it('names the sunset prayer plainly when it decided a deferral', () => {
  const p = personOf(newGame(42), 'selim');
  const r = (decidedBy: { kind: 'term'; source: string; margin: number }) =>
    suggestionWords(
      p,
      { voiceId: 'chef', verdict: 'deferred', reason: 'x', says: 'stock', decidedBy },
      'grill',
    );
  expect(r({ kind: 'term', source: 'norm:salah', margin: 0.57 })).toEqual({
    text: 'Let me pray first, Chef.',
    short: 'after I pray',
  });
});

it('keeps an unknown reason neutral and never prints its source or margin', () => {
  const p = personOf(newGame(42), 'selim');
  expect(
    suggestionWords(
      p,
      {
        voiceId: 'chef',
        verdict: 'deferred',
        reason: 'alien:secret',
        says: 'stock',
        decidedBy: { kind: 'term', source: 'alien:secret', margin: 0.123 },
      },
      'grill',
    ),
  ).toEqual({ text: 'Not now, Chef.', short: 'not now' });
});

import { beginAtWeekTwo, firstPartyBoard, runToSeating } from '../src/sim/firstweek.ts';
import { advance, bot } from '../src/sim/host-policy.ts';
import { replay } from '../src/sim/kitchen.ts';

function smoking() {
  const s = newGame(1, 'pass@10');
  while (s.minute < 1091) advance(s, 'none');
  expect(personOf(s, 'dilek').activity?.affordanceId).toBe('smoke');
  return s;
}

it('an inertia deferral says the current break and retains that reason until its end', () => {
  const s = smoking();
  const p = personOf(s, 'dilek');
  const r = predict(p, offersFor(s, 'dilek', 'cold'), {
    voiceId: 'chef',
    affordanceId: 'cold',
    strength: 0.5,
  });
  expect(r.decidedBy?.kind).toBe('inertia');
  queueInput(s, { kind: 'ask', cook: 'dilek', verb: 'cold' });
  step(s);
  const first = s.lastAnswer?.text;
  expect(first).toContain('Off my cigarette for the cold side? Let me finish it.');
  expect(first).not.toContain('I’d do.');
  expect(hints(s, 'dilek').find((h) => h.verb === 'cold')?.short).toBe('let me finish my cigarette');
  // A later HF explanation changes; the original no remains until this break ends.
  const restored = restoreState(cloneState(s));
  for (const state of [s, restored]) {
    const cook = personOf(state, 'dilek');
    cook.body.depletion = 0.9;
    const next = predict(cook, offersFor(state, 'dilek', 'cold'), {
      voiceId: 'chef',
      affordanceId: 'cold',
      strength: 0.5,
    });
    expect(next.decidedBy).toMatchObject({ kind: 'term', source: 'effort' });
    queueInput(state, { kind: 'ask', cook: 'dilek', verb: 'cold' });
    step(state);
    expect(state.lastAnswer?.verdict).toBe('deferred');
    expect(state.lastAnswer?.text).toBe(first);
    while (state.minute <= 1097) step(state);
    expect(hints(state, 'dilek').find((h) => h.verb === 'cold')?.short).not.toBe(
      'let me finish my cigarette',
    );
  }
  expect(cloneState(restored)).toEqual(cloneState(s));
});

it('a body forecast on a break says the body reason, even when legacy reason says habit', () => {
  const s = smoking();
  const p = personOf(s, 'dilek');
  p.body.depletion = 0.5;
  // Autonomous offers retain the known rest-of-rush exertion. Cover offers omit that follow-on.
  const r = predict(p, offersFor(s, 'dilek'), { voiceId: 'chef', affordanceId: 'grill', strength: 0.5 });
  expect(r).toMatchObject({
    verdict: 'deferred',
    reason: 'habit',
    decidedBy: { kind: 'term', source: 'forecast:body' },
  });
  const words = suggestionWords(p, r, 'grill');
  expect(words?.text).toBe('That job would leave me spent for the rest of the service, Chef.');
  expect(words?.short).toBe('I’d be spent later');
  expect(words?.text).not.toMatch(/cigarette|I’d do|habit|forecast|margin/);
});

it.each([
  ['effort', 'I’d rather take the lighter job, Chef.', 'rather the lighter job'],
  ['material', 'I’d rather stay on paid work, Chef.', 'rather paid work'],
])('phrases the actual %s source in kitchen words', (source, text, short) => {
  expect(
    suggestionWords(
      personOf(newGame(42), 'selim'),
      {
        voiceId: 'chef',
        verdict: 'deferred',
        reason: source,
        says: 'stock',
        decidedBy: { kind: 'term', source, margin: 0.1 },
      },
      'break',
    ),
  ).toEqual({ text, short });
});

it('the insisting host skips a firm refusal instead of asking it again', () => {
  const s = smoking();
  s.night = 2;
  s.minute = 1110;
  const p = personOf(s, 'selim');
  p.activity = null;
  const member = s.crew.find((m) => m.id === 'selim');
  const ticket = s.tickets[0];
  if (!member || !ticket) throw new Error('Expected a cook and ticket');
  member.home = 'dish';
  ticket.status = 'open';
  expect(hints(s, 'selim', true).find((h) => h.verb === 'dish')?.verdict).toBe('refused');
  bot(s, 'insist');
  expect(s.inputs.some((i) => i.kind === 'ask' && i.cook === 'selim' && i.verb === 'dish')).toBe(false);
});

it.each(Array.from({ length: 20 }, (_, i) => 1000 + i))(
  'pass@10 host shortcuts replay all state from seed %i and ordinary inputs',
  (seed) => {
    const s = beginAtWeekTwo(seed);
    expect(s.version).toBe('pass@12');
    expect(s.reports.at(-1)?.bill?.paid).toBe(true);
    expect(cloneState(replay(seed, s.inputs, s.minute, s.version))).toEqual(cloneState(s));
    const party = s.sunday?.parties?.[seed % 2];
    if (!party) throw new Error('Expected a party');
    queueInput(s, { kind: 'choose', key: `promise:${party}`, value: 'promise' });
    queueInput(s, { kind: 'open' });
    const target = firstPartyBoard(s);
    expect(target.party).toBe(party);
    queueInput(s, { kind: 'board', rows: boardDefaults(s) });
    queueInput(s, { kind: 'open' });
    runToSeating(s, target);
    expect(s.phase).toBe('service');
    expect(s.minute).toBe(target.at - 20);
    expect(cloneState(replay(seed, s.inputs, s.minute, s.version))).toEqual(cloneState(s));
  },
  30000,
);

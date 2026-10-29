import { expect, it } from 'vitest';
import { kitchenOffer } from '../src/sim/hf4-authoring.ts';
import {
  checkpoint,
  decide,
  freshCommunity,
  interrupt,
  livedHours,
  perceive,
  tick,
  verifyCommunity,
} from '../src/sim/hf4-person.ts';
import {
  boardDefaults,
  cloneState,
  cookOf,
  newGame,
  offersFor,
  pace,
  personOf,
  queueInput,
  replay,
  restoreState,
  step,
} from '../src/sim/kitchen.ts';

it('records every custom completion when one community tick finishes two cooks', () => {
  const s = newGame(42, 'pass@19');
  if (!s.kitchen) throw new Error('Missing kitchen');
  // World-only opportunities before opening. Both activities must actually start through HF.
  for (const [who, action] of [
    ['selim', 'conversation'],
    ['dilek', 'explain-wait'],
  ] as const) {
    const person = personOf(s, who);
    const rec = decide(
      person,
      [
        {
          id: action,
          action,
          label: 'talk at the pass',
          duration: 3,
          effort: 0.12,
          advertises: { belonging: 0.2, autonomy: 0.1 },
          material: 6,
        },
      ],
      { suggestion: { voiceId: 'chef', affordanceId: action, strength: 0.5 } },
    );
    expect(person.activity?.affordanceId).toBe(action);
    const verdict = rec.suggestion?.verdict;
    expect(verdict).toBe('assented');
    if (!verdict) throw new Error('Missing actual answer');
    if (action === 'conversation') s.kitchen.conversations.push({ who, at: s.minute, verdict });
    else {
      const ticket = s.tickets[0];
      if (!ticket) throw new Error('Missing authored table');
      s.kitchen.guests.push({
        ticket: ticket.id,
        who,
        at: s.minute,
        action,
        verdict,
        outcome: 'heard',
      });
    }
  }
  const restored = restoreState(JSON.parse(JSON.stringify(cloneState(s))));
  tick(s.chef, s.minute + 4);
  tick(restored.chef, restored.minute + 4);
  expect(s.kitchen.conversations[0]?.completed).toBeGreaterThan(s.minute);
  expect(s.kitchen.guests[0]?.outcome).toBe('explained');
  expect(s.said.filter((line) => line.text.includes('I have told the table'))).toHaveLength(1);
  expect(JSON.parse(JSON.stringify(cloneState(restored)))).toEqual(JSON.parse(JSON.stringify(cloneState(s))));
  const saved = JSON.parse(JSON.stringify(s.kitchen));
  tick(s.chef, s.minute + 5);
  expect(s.kitchen).toEqual(saved);
  expect(s.said.filter((line) => line.text.includes('I have told the table'))).toHaveLength(1);
  expect(verifyCommunity(s.chef).verified).toBe(true);
}, 30000);

it('resumes the planned meal after actual prayer completion and replays the break', () => {
  const s = newGame(42, 'pass@19');
  queueInput(s, {
    kind: 'board',
    rows: boardDefaults(s).map((row) => ({ ...row, breakAt: row.cook === 'selim' ? 1125 : row.breakAt })),
  });
  queueInput(s, { kind: 'open' });
  while (s.minute <= 1125) step(s);
  expect(personOf(s, 'selim').activity?.affordanceId).toBe('pray');
  while (s.minute < 1136) step(s);
  expect(personOf(s, 'selim').activity?.affordanceId).toBe('eat');
  const restored = restoreState(JSON.parse(JSON.stringify(cloneState(s))));
  const before = personOf(s, 'selim').body.satiety;
  while (s.minute <= 1145) {
    step(s);
    step(restored);
  }
  expect(personOf(s, 'selim').body.satiety).toBeGreaterThan(before);
  const receipts = checkpoint(s.chef)
    .archive.history.flatMap((t) => t.inputs)
    .filter((input) => input.kind === 'action.resolved');
  expect(
    receipts.some(
      (input) =>
        input.payload.person === 'selim' &&
        input.payload.stage === 'interrupt' &&
        input.payload.disposition === 'interrupted' &&
        input.payload.outcome?.actionId === 'eat' &&
        input.payload.outcome.end >= 1145 * 60_000 &&
        (input.payload.outcome?.actual.consumed?.food ?? 0) > 0,
    ),
  ).toBe(true);
  expect(JSON.parse(JSON.stringify(cloneState(restored)))).toEqual(JSON.parse(JSON.stringify(cloneState(s))));
  expect(JSON.parse(JSON.stringify(cloneState(replay(s.seed, s.inputs, s.minute, s.version))))).toEqual(
    JSON.parse(JSON.stringify(cloneState(s))),
  );
}, 120000);

it('clears an earlier request when a cook accepts a new dining-room task', () => {
  const s = newGame(42, 'pass@19');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  for (let minute = 0; minute < 9; minute++) {
    step(s);
    for (const who of ['selim', 'dilek']) {
      if (minute === 8 && who === 'dilek') queueInput(s, { kind: 'ask', cook: 'dilek', verb: 'grill' });
      queueInput(s, { kind: 'kitchen-task', who, task: 'room' });
    }
  }
  expect(personOf(s, 'dilek').activity?.affordanceId).toBe('room');
  expect(cookOf(s, 'dilek').pending).toBeNull();
});

it('records dated kitchen advice as replayable HF4 evidence', () => {
  const rafi = freshCommunity(42).people.find((p) => p.id === 'rafi');
  if (!rafi) throw new Error('Missing Rafi');
  perceive(rafi, [
    {
      at: 539,
      channel: 'told',
      kind: 'advice',
      actorId: 'chef',
      targetId: 'rafi',
      salience: 0.9,
      summary: 'The chef asked Rafi to scrub the trays.',
    },
  ]);
  const inputs = checkpoint(rafi).archive.history.flatMap((t) => t.inputs);
  const observation = inputs.find((input) => input.kind === 'observation.received');
  expect(observation?.payload.percepts[0]).toMatchObject({
    occurredAt: 32_340_000,
    channel: 'told',
    summary: 'The chef asked Rafi to scrub the trays.',
  });
  expect(verifyCommunity(rafi).verified).toBe(true);
});

it('keeps a relief cook at their agreed station until the scheduled break', () => {
  const s = newGame(42, 'pass@19');
  const rows = boardDefaults(s).map((row) => ({
    ...row,
    breakAt: row.cook === 'selim' ? 1090 : 1185,
    cover: row.cook === 'selim' ? 'dilek' : null,
  }));
  queueInput(s, { kind: 'board', rows });
  const own = s.board?.rows.find((row) => row.cook === 'dilek');
  expect(own?.accepted).toBe(true);
  expect(personOf(s, 'dilek').activity?.affordanceId).toBe(own?.station);
  expect(cookOf(s, 'dilek').cover?.station).toBe(own?.station);
  queueInput(s, { kind: 'open' });
  step(s);
  expect(cookOf(s, 'dilek').cover?.station).toBe(own?.station);
  expect(verifyCommunity(s.chef).verified).toBe(true);
}, 120000);

it('does not author copied home activities for departed people', () => {
  const community = freshCommunity(42);
  const chef = community.people.find((p) => p.id === 'chef');
  if (!chef) throw new Error('Missing chef');
  const before = checkpoint(chef).archive.history.length;
  livedHours(
    chef,
    [
      {
        person: chef,
        at: chef.now + 10,
        affordance: { id: 'meal', action: 'meal', label: 'meal', duration: 2, effort: 0, advertises: {} },
      },
    ],
    chef.now + 15,
    ['selim'],
  );
  const inputs = checkpoint(chef)
    .archive.history.slice(before)
    .flatMap((transaction) => transaction.inputs);
  expect(inputs.some((input) => 'person' in input.payload && input.payload.person === 'selim')).toBe(false);
  expect(inputs.some((input) => 'person' in input.payload && input.payload.person === 'dilek')).toBe(true);
}, 120000);

it('pins the released cook checkpoint across later community time', () => {
  const s = newGame(42, 'pass@19');
  const person = personOf(s, 'selim');
  interrupt(person, s.minute, 'release fixture');
  s.phase = 'evening';
  queueInput(s, { kind: 'cast-release', who: 'selim' });
  const saved = s.releasedCastProjections?.selim;
  expect(saved).toBeDefined();
  const original = JSON.stringify(saved);
  tick(s.chef, s.minute + 30);
  expect(JSON.stringify(s.releasedCastProjections?.selim)).toBe(original);
  expect(restoreState(JSON.parse(JSON.stringify(cloneState(s)))).releasedCastProjections?.selim).toEqual(
    saved,
  );
}, 120000);

it('retains actual protested work through refresh and restore', () => {
  const s = newGame(42, 'pass@19');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  for (let i = 0; i < 12; i++) step(s);
  queueInput(s, { kind: 'ask', cook: 'dilek', verb: 'grill', insist: true });
  step(s);
  const p = personOf(s, 'dilek');
  expect(s.lastAnswer?.verdict).toBe('complied');
  expect(p.activity?.protest).toBe(true);
  const slowed = pace(s, 'dilek', 'grill');
  if (!p.activity) throw new Error('Missing work');
  p.activity.protest = false;
  expect(slowed).toBeCloseTo(pace(s, 'dilek', 'grill') * 0.65);
  p.activity.protest = true;
  const restored = restoreState(JSON.parse(JSON.stringify(cloneState(s))));
  expect(personOf(restored, 'dilek').activity?.protest).toBe(true);
  const replayed = replay(s.seed, s.inputs, s.minute, s.version);
  expect(personOf(replayed, 'dilek').activity?.protest).toBe(true);
  expect(pace(replayed, 'dilek', 'grill')).toBeCloseTo(slowed);
  tick(s.chef, s.minute + 1);
  expect(p.activity?.protest).toBe(true);
}, 120000);

it('passes the remaining rush forecast to HF station offers', () => {
  const s = newGame(42, 'pass@19');
  s.phase = 'service';
  const offer = offersFor(s, 'dilek').find((a) => a.id === 'grill');
  if (!offer?.followedBy?.length) throw new Error('Missing authored rush continuation');
  const converted = kitchenOffer('dilek', offer);
  expect(converted.expected.followedBy).toEqual(
    offer.followedBy.map(({ duration, ...span }) => ({ ...span, durationMs: duration * 60000 })),
  );
  expect(kitchenOffer('dilek', { ...offer, followedBy: undefined }).expected.followedBy).toEqual([]);
  decide(personOf(s, 'dilek'), [offer]);
  const inputs = checkpoint(s.chef).archive.history.flatMap((transaction) => transaction.inputs);
  const received = inputs.findLast(
    (input) => input.kind === 'offers.received' && input.payload.offers.length,
  );
  expect(received?.kind === 'offers.received' && received.payload.offers[0]?.expected.followedBy).toEqual(
    converted.expected.followedBy,
  );
}, 120000);

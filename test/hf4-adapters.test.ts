import { expect, it } from 'vitest';
import { checkpoint, freshCommunity, perceive, verifyCommunity } from '../src/sim/hf4-person.ts';
import { boardDefaults, cookOf, newGame, personOf, queueInput, step } from '../src/sim/kitchen.ts';

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

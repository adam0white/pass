/** Synthetic semantic controls; these are not real browser-journey evidence. */
import { releaseCommitment, snapshot } from '@adam0white/human-framework';
import { createPersona, initialPersonaLife, preparePersonaLife } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import {
  freshActor,
  kitchenTransfer,
  prepareKitchenChapter,
  validateKitchenChapter,
} from '../src/sim/cast-chapter.ts';
import { replayExport, validateReplayFile } from '../src/sim/continuation.ts';
import { exportRun, newGame, queueInput } from '../src/sim/kitchen.ts';

async function source(sourceGame = 'goodhands', pendingShift = false) {
  const p = freshActor('hulya', 42, 510);
  if (!pendingShift)
    for (const c of p.agenda.commitments) if (c.status === 'pending') releaseCommitment(p, c.id);
  const transfer = await kitchenTransfer(p);
  const portable = transfer.kitchenPerson;
  if (sourceGame === 'goodhands') portable.person.mappingVersion = 'goodhands-agency-calendar/1';
  const body =
    sourceGame === 'goodhands'
      ? {
          castPassport: 'goodhands-agency/1',
          sourceRole: 'hulya',
          agencyPerson: portable,
          checkpoint: transfer.checkpoint,
        }
      : transfer;
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.hulya.pass',
    castRevision: '1',
    branchId: 'synthetic-control',
    parentRevision: null,
    source: {
      game: sourceGame,
      build: 'fixture',
      engine: '2.17.0',
      rules: sourceGame === 'pass' ? 'pass-13' : 'goodhands-6',
    },
    transfer: { ...body, life: initialPersonaLife('hf.cast.hulya.pass', 'synthetic-control', 0) },
    limitations: transfer.limitations,
  });
  return preparePersonaLife(parent, 0);
}
it('maps only actual compatible native practice, pins actors and replays without shelf or current time', async () => {
  const input = await source();
  const chapter = await prepareKitchenChapter([input], 42);
  expect(chapter.actors.hulya?.skills.oven).toEqual(
    input.parent.transfer.agencyPerson && (input.parent.transfer.agencyPerson as any).person.skills.oven,
  );
  expect(chapter.actors.hulya?.traits).toEqual(freshActor('hulya', 42).traits);
  await validateKitchenChapter(chapter);
  const s = newGame(42, 'pass@13', chapter);
  queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'listen' });
  const ex = exportRun(s, '2.21.0');
  expect(replayExport(ex)).toEqual(s);
  expect(await validateReplayFile(ex)).toEqual(s);
  const altered = structuredClone(ex);
  altered.castChapter!.actors.hulya!.values.achievement = 0.01;
  await expect(validateReplayFile(altered)).rejects.toThrow('Pinned kitchen');
});
it('refuses unsupported source duty before any target mutation', async () => {
  const input = await source('pass', true),
    before = JSON.stringify(input);
  await expect(prepareKitchenChapter([input], 42)).rejects.toThrow('duty');
  expect(JSON.stringify(input)).toBe(before);
});
it('pinned nonzero away-life affects real optional hiring availability while profiles remain carried', async () => {
  const input = await source();
  const later = preparePersonaLife(input.parent, 48 * 3600000);
  expect(later.life.clock.watermark).toBeGreaterThan(input.life.clock.watermark);
  const chapter = await prepareKitchenChapter([later], 42);
  expect(chapter.facts.hulya?.line).toContain('Hülya');
  expect(chapter.facts.hulya?.life).toEqual(later.life);
  expect(snapshot(chapter.actors.hulya!).traits).toEqual(
    (await prepareKitchenChapter([input], 42)).actors.hulya!.traits,
  );
});
it('offers a carried visitor work only at the actual opening; source family time is never skipped to Sunday', async () => {
  const input = await source(),
    chapter = await prepareKitchenChapter([input], 42),
    s = newGame(42, 'pass@13', chapter);
  expect(s.minute).toBe(chapter.actors.hulya!.now);
  expect(s.crew.some((p) => p.id === 'hulya')).toBe(false);
  queueInput(s, { kind: 'cast-invite', who: 'hulya' });
  expect(s.crew.some((p) => p.id === 'hulya')).toBe(true);
  expect(s.cooks.find((p) => p.id === 'hulya')?.pending?.verb).toBe('eat');
  expect(
    s.people
      .find((p) => p.id === 'hulya')
      ?.agenda.commitments.some((c) => c.label === 'my shift' && c.status === 'pending'),
  ).toBe(true);
  expect(replayExport(exportRun(s, 'test'))).toEqual(s);
  const later = newGame(42, 'pass@13', chapter);
  later.night = 6;
  later.minute += 6 * 1440;
  later.phase = 'sunday';
  queueInput(later, { kind: 'cast-invite', who: 'hulya' });
  expect(later.crew.some((p) => p.id === 'hulya')).toBe(false);
  expect(later.castChapter!.actors.hulya).toEqual(chapter.actors.hulya);
});
it('a fresh Zeynep chapter keeps the exact sons promise through an explicitly accepted current shift', async () => {
  const p = freshActor('zeynep', 42, 510);
  p.id = 'zeynep-pass';
  for (const c of p.agenda.commitments)
    if (c.label === 'my shift' && c.status === 'pending') releaseCommitment(p, c.id);
  const transfer = await kitchenTransfer(p);
  transfer.kitchenPerson.person.mappingVersion = 'goodhands-agency-calendar/1';
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.zeynep.pass',
    castRevision: '2',
    branchId: 'synthetic-family-control',
    parentRevision: null,
    source: { game: 'goodhands', build: 'fixture', engine: '2.17.0', rules: 'goodhands-6' },
    transfer: {
      castPassport: 'goodhands-agency/1',
      sourceRole: 'zeynep-pass',
      agencyPerson: transfer.kitchenPerson,
      checkpoint: transfer.checkpoint,
      life: initialPersonaLife('hf.cast.zeynep.pass', 'synthetic-family-control', 0),
    },
    limitations: transfer.limitations,
  });
  const chapter = await prepareKitchenChapter([preparePersonaLife(parent, 0)], 42),
    s = newGame(42, 'pass@13', chapter);
  const before = chapter.actors.zeynep!.agenda.commitments.find((c) => c.toId === 'sons')!;
  expect(before.from % 1440).toBe(1290);
  expect(before.until - before.from).toBe(40);
  queueInput(s, { kind: 'cast-invite', who: 'zeynep' });
  expect(s.people.find((p) => p.id === 'zeynep')?.agenda.commitments.find((c) => c.toId === 'sons')).toEqual(
    before,
  );
  expect(replayExport(exportRun(s, 'test'))).toEqual(s);
});

it.each([
  ['rafi', 'ravi', 'hf.cast.rafi.pass'],
  ['sam', 'sam', 'hf.cast.sam.smallworks'],
])(
  'maps only quiet native %s without converting repair practice or elapsed body time',
  async (id, sourceId, castId) => {
    const p = freshActor(id!, 42, 2535);
    p.id = sourceId!;
    p.body.health = 0.98;
    p.body.circadianPeak = 900;
    p.agenda.commitments = [];
    p.skills = { repair: { level: 0.1, practice: 174, lastPracticed: 480 } };
    const transfer = await kitchenTransfer(p);
    transfer.kitchenPerson.person.mappingVersion = 'neighbours-calendar/1';
    const parent = await createPersona({
      format: 'hf-persona/1',
      castId: castId!,
      castRevision: '1',
      branchId: 'synthetic-native-rafi',
      parentRevision: null,
      source: { game: 'neighbours', build: 'fixture', engine: '2.17.0', rules: 'neighbours-cast-1' },
      transfer: {
        castPassport: 'neighbours-cast/1',
        sourceRole: sourceId!,
        person: transfer.kitchenPerson,
        checkpoint: {
          schema: transfer.checkpoint.sourceSchema,
          sourceMinute: p.now,
          rng: transfer.checkpoint.sourceRng,
          sha256: transfer.checkpoint.checkpointDigest,
        },
        life: initialPersonaLife(castId!, 'synthetic-native-rafi', 0),
      },
      limitations: transfer.limitations,
    });
    const input = preparePersonaLife(parent, 0);
    const chapter = await prepareKitchenChapter([input], 42);
    const actor = chapter.actors[id!]!;
    expect(actor.now).toBe(1045);
    expect(actor.now - actor.life.bornAt).toBe(p.now - p.life.bornAt);
    expect(actor.body).toEqual({ ...snapshot(p).body, since: 1045 });
    expect(actor.traits).toEqual(p.traits);
    expect(actor.values).toEqual(p.values);
    expect(actor.rng).toEqual(snapshot(p).rng);
    expect(actor.skills.repair).toBeUndefined();
    expect(actor.skills.dish).toBeUndefined();
    expect(chapter.inputs[0]!.parent).toEqual(parent);
    expect(replayExport(exportRun(newGame(42, 'pass@13', chapter), 'test'))).toEqual(
      newGame(42, 'pass@13', chapter),
    );
    const unsupported = structuredClone(input);
    (unsupported.parent.transfer.person as typeof transfer.kitchenPerson).calendar.commitments =
      transfer.kitchenPerson.calendar.commitments = [
        {
          kind: 'promise',
          id: 'unsupported',
          toId: 'town',
          from: 2535,
          until: 2600,
          importance: 0.7,
          status: 'pending',
          actions: ['repair'],
        },
      ];
    // Re-seal so rejection is semantic rather than checksum validation.
    const { revision: _revision, ...unsealed } = unsupported.parent;
    unsupported.parent = await createPersona(unsealed);
    unsupported.life = preparePersonaLife(unsupported.parent, 0).life;
    await expect(prepareKitchenChapter([unsupported], 42)).rejects.toThrow('duty');
  },
);
it('validates historical canonical chapters without changing their saved narration choice', async () => {
  const input = await source();
  const chapter = await prepareKitchenChapter([input], 42, false);
  expect(chapter.actors.hulya?.lexicon?.plainEnglish).toBeUndefined();
  const before = structuredClone(chapter);
  await validateKitchenChapter(chapter);
  const state = newGame(42, 'pass@13', chapter, false);
  expect(await validateReplayFile(exportRun(state, '2.21.0'))).toEqual(state);
  expect(chapter).toEqual(before);
});

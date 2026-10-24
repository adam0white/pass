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
  const ex = exportRun(s, '2.18.0');
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

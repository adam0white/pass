import { createPersona, initialPersonaLife, preparePersonaLife } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { acceptKitchenShift } from '../src/sim/cooks.ts';
import { hf4KitchenTransfer, prepareHF4KitchenChapter } from '../src/sim/hf4-cast.ts';
import {
  checkpoint,
  decide,
  freshCommunity,
  restoreCommunity,
  stageRetainedVisitor,
  verifyCommunity,
} from '../src/sim/hf4-person.ts';
import { KitchenRun } from '../src/sim/hf4-run.ts';
import { advance } from '../src/sim/host-policy.ts';
import { cloneState, newGame, personOf, queueInput, replay, restoreState, step } from '../src/sim/kitchen.ts';

it('records actual HF4 promptings in kitchen minutes', () => {
  const s = newGame(42, 'pass@19');
  const phase = () => s.phase;
  while (!(s.night === 3 && s.phase === 'evening')) advance(s, 'ask', 'promise-none');
  queueInput(s, { kind: 'jar', choice: 'talk' });
  queueInput(s, { kind: 'open' });
  while (phase() === 'board') advance(s, 'ask', 'promise-none');
  while (phase() === 'service') step(s);
  expect(personOf(s, 'rafi').promptings?.recent.length).toBeGreaterThan(0);
  expect(s.said.some((line) => line.kind === 'prompt')).toBe(true);
}, 120000);

it('retains a hired cook shift through a community refresh and restore', () => {
  const community = freshCommunity(42);
  const hire = community.people.find((person) => person.id === 'hulya');
  if (!hire) throw new Error('Missing hire');
  acceptKitchenShift(hire, 540);
  const saved = JSON.parse(JSON.stringify(checkpoint(hire)));
  const restored = restoreCommunity(saved);
  const savedHire = restored.people.find((person) => person.id === 'hulya');
  expect(savedHire?.agenda.commitments.some((commitment) => commitment.label === 'my shift')).toBe(true);
  if (!savedHire) throw new Error('Missing restored hire');
  expect(JSON.parse(JSON.stringify(checkpoint(savedHire)))).toEqual(saved);
  expect(verifyCommunity(savedHire).verified).toBe(true);
});

it('projects a current person and admits the retained passport before the new run starts', async () => {
  const person = freshCommunity(42).people.find((p) => p.id === 'hulya');
  if (!person) throw new Error('Missing visitor');
  const transfer = await hf4KitchenTransfer(person);
  const castId = 'hf.cast.hulya.pass',
    branchId = 'fixture';
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId,
    castRevision: '1',
    branchId,
    parentRevision: null,
    source: { game: 'pass', build: 'fixture', engine: '4.8.1', rules: 'pass-19' },
    transfer: { ...transfer, life: initialPersonaLife(castId, branchId, 0) },
    limitations: transfer.limitations,
  });
  const chapter = await prepareHF4KitchenChapter([preparePersonaLife(parent, 0)], 43);
  expect(chapter.portable?.hulya?.person).toEqual(transfer.portable);
  const game = newGame(43, 'pass@19', chapter);
  expect(checkpoint(game.chef).archive.initial.people.some((p) => p.id === 'hulya')).toBe(false);
  const source = JSON.stringify(chapter.portable?.hulya);
  const beforeRefusal = JSON.stringify(checkpoint(game.chef));
  const admission = chapter.portable?.hulya;
  if (!admission) throw new Error('Missing retained visitor');
  const staged = stageRetainedVisitor(43, 'hulya', admission, checkpoint(game.chef).archive.current.at);
  const refused = decide(
    staged,
    [
      {
        id: 'keep-own-plans',
        action: 'keep-own-plans',
        label: 'keep my own plans',
        duration: 1,
        effort: 0,
        advertises: { autonomy: 0.4 },
      },
    ],
    { now: game.minute },
  );
  expect(refused.chosenAffordanceId).toBe('keep-own-plans');
  expect(verifyCommunity(staged).verified).toBe(true);
  expect(JSON.stringify(checkpoint(game.chef))).toBe(beforeRefusal);
  expect(JSON.stringify(chapter.portable?.hulya)).toBe(source);
  queueInput(game, { kind: 'cast-invite', who: 'hulya' });
  expect(game.crew.some((p) => p.id === 'hulya')).toBe(true);
  expect(JSON.stringify(chapter.portable?.hulya)).toBe(source);
  expect(checkpoint(game.chef).archive.current.people.hulya).toBeDefined();
  expect(verifyCommunity(game.chef).verified).toBe(true);
  const saved = JSON.parse(JSON.stringify(cloneState(game)));
  expect(JSON.parse(JSON.stringify(cloneState(restoreState(saved))))).toEqual(saved);
  expect(
    JSON.parse(JSON.stringify(cloneState(replay(43, game.inputs, game.minute, 'pass@19', chapter)))),
  ).toEqual(saved);
  expect(chapter.portable?.hulya?.person).toEqual(transfer.portable);
}, 30000);

it('fingerprints the host state as well as the HF archive', async () => {
  const { cloneState, fingerprint, newGame } = await import('../src/sim/kitchen.ts');
  const state = newGame(42, 'pass@19');
  const saved = JSON.parse(JSON.stringify(cloneState(state)));
  expect(fingerprint(state)).toBe(fingerprint(saved));
  saved.till += 1;
  expect(fingerprint(state)).not.toBe(fingerprint(saved));
});

it('keeps a retained visitor duty at its mapped wall time when paid work is accepted', async () => {
  const person = freshCommunity(42).people.find((p) => p.id === 'zeynep');
  if (!person) throw new Error('Missing visitor');
  const transfer = await hf4KitchenTransfer(person);
  const castId = 'hf.cast.zeynep.pass',
    branchId = 'duty-fixture';
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId,
    castRevision: '2',
    branchId,
    parentRevision: null,
    source: { game: 'pass', build: 'fixture', engine: '4.8.1', rules: 'pass-19' },
    transfer: { ...transfer, life: initialPersonaLife(castId, branchId, 0) },
    limitations: transfer.limitations,
  });
  const chapter = await prepareHF4KitchenChapter([preparePersonaLife(parent, 0)], 43);
  const game = newGame(43, 'pass@19', chapter);
  const original = JSON.stringify(chapter.portable?.zeynep);
  expect(checkpoint(game.chef).archive.initial.people.some((p) => p.id === 'zeynep')).toBe(false);
  queueInput(game, { kind: 'cast-invite', who: 'zeynep' });
  expect(game.crew.some((p) => p.id === 'zeynep')).toBe(true);
  expect(JSON.stringify(chapter.portable?.zeynep)).toBe(original);
  const duty = personOf(game, 'zeynep').agenda.commitments.find((c) => c.label === 'being home for my boys');
  expect(duty?.from).toBe(1290);
  expect(duty?.until).toBe(1330);
  expect(game.visitorDecisions?.zeynep?.chosen).toBe('kitchen-job');
  const stagedCheckpoint = game.visitorDecisions?.zeynep?.checkpoint;
  if (!stagedCheckpoint) throw new Error('Missing staged decision receipt');
  expect(KitchenRun.restore(stagedCheckpoint).verify().verified).toBe(true);
  expect(verifyCommunity(game.chef).verified).toBe(true);
  const saved = JSON.parse(JSON.stringify(cloneState(game)));
  expect(JSON.parse(JSON.stringify(cloneState(restoreState(saved))))).toEqual(saved);
  expect(
    JSON.parse(JSON.stringify(cloneState(replay(43, game.inputs, game.minute, 'pass@19', chapter)))),
  ).toEqual(saved);
}, 30000);

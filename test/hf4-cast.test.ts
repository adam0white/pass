import { createPersona, initialPersonaLife, preparePersonaLife } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { acceptKitchenShift } from '../src/sim/cooks.ts';
import { hf4KitchenTransfer, prepareHF4KitchenChapter } from '../src/sim/hf4-cast.ts';
import { checkpoint, freshCommunity, restoreCommunity, verifyCommunity } from '../src/sim/hf4-person.ts';
import { advance } from '../src/sim/host-policy.ts';
import { newGame, personOf, queueInput, step } from '../src/sim/kitchen.ts';

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
  expect(person).toBeDefined();
  const transfer = await hf4KitchenTransfer(person!);
  const castId = 'hf.cast.hulya.pass',
    branchId = 'fixture';
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId,
    castRevision: '1',
    branchId,
    parentRevision: null,
    source: { game: 'pass', build: 'fixture', engine: '4.7.0', rules: 'pass-19' },
    transfer: { ...transfer, life: initialPersonaLife(castId, branchId, 0) },
    limitations: transfer.limitations,
  });
  const chapter = await prepareHF4KitchenChapter([preparePersonaLife(parent, 0)], 43);
  expect(chapter.portable?.hulya?.person).toEqual(transfer.portable);
});

it('fingerprints the host state as well as the HF archive', async () => {
  const { cloneState, fingerprint, newGame } = await import('../src/sim/kitchen.ts');
  const state = newGame(42, 'pass@19');
  const saved = JSON.parse(JSON.stringify(cloneState(state)));
  expect(fingerprint(state)).toBe(fingerprint(saved));
  saved.till += 1;
  expect(fingerprint(state)).not.toBe(fingerprint(saved));
});

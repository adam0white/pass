import { createPersona, initialPersonaLife, preparePersonaLife } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { hf4KitchenTransfer, prepareHF4KitchenChapter } from '../src/sim/hf4-cast.ts';
import { freshCommunity } from '../src/sim/hf4-person.ts';

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

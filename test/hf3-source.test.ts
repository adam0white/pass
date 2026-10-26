import { readFileSync } from 'node:fs';
import { createPersona, preparePersonaLife } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { digest, prepareKitchenChapter, validateKitchenChapter } from '../src/sim/cast-chapter.ts';
import { validateReplayFile } from '../src/sim/continuation.ts';
import { boardDefaults, exportRun, newGame, queueInput, step } from '../src/sim/kitchen.ts';

for (const [role, id] of [
  ['ravi', 'rafi'],
  ['sam', 'sam'],
] as const) {
  it(`receives the actual current Neighbours ${role} checkpoint and replays without changing the source`, async () => {
    const read = (name: string) =>
      JSON.parse(
        readFileSync(new URL(`./fixtures/hf3-neighbours/${role}/${name}.json`, import.meta.url), 'utf8'),
      );
    const parent = read('persona');
    const raw = read('raw');
    const receipt = read('receipt');
    expect(parent.source.engine).toBe('2.23.0');
    expect(parent.source.build).toBe(receipt.source);
    expect(await digest(raw)).toBe(parent.transfer.checkpoint.sha256);
    expect(read('notebook').castLocal.sources[parent.transfer.checkpoint.sha256]).toEqual(raw);
    expect(raw.rng).toEqual(parent.transfer.checkpoint.rng);
    expect(raw.now).toBe(parent.transfer.checkpoint.sourceMinute);
    const before = structuredClone(parent);
    const chapter = await prepareKitchenChapter(
      [preparePersonaLife(parent, parent.transfer.life.clock.watermark)],
      42,
    );
    expect(chapter.actors[id]?.rng).toEqual(raw.rng);
    expect(chapter.actors[id]?.traits).toEqual(raw.traits);
    expect(chapter.actors[id]?.values).toEqual(raw.values);
    expect(chapter.inputs[0]?.parent).toEqual(before);
    expect(parent).toEqual(before);
    await validateKitchenChapter(chapter);
    const state = newGame(42, 'pass@13', chapter);
    if (id === 'sam') queueInput(state, { kind: 'cast-invite', who: id });
    queueInput(state, { kind: 'board', rows: boardDefaults(state) });
    queueInput(state, { kind: 'open' });
    for (let minute = 0; minute < 20; minute++) step(state);
    expect(await validateReplayFile(exportRun(state, '3.0.0'))).toEqual(state);
    for (const patch of [
      { engine: '3.0.0' },
      { engine: '2.22.0' },
      { engine: '9.0.0' },
      { rules: 'neighbours-cast-unknown' },
      { game: 'repair' },
    ]) {
      const { revision: _revision, ...unsigned } = structuredClone(parent);
      const bad = await createPersona({ ...unsigned, source: { ...unsigned.source, ...patch } });
      await expect(
        prepareKitchenChapter([preparePersonaLife(bad, parent.transfer.life.clock.watermark)], 42),
      ).rejects.toThrow('no supported native kitchen map');
    }
    const { revision: _revision, ...unsigned } = structuredClone(parent);
    unsigned.transfer.checkpoint.rng.a ^= 1;
    const bad = await createPersona(unsigned);
    await expect(
      prepareKitchenChapter([preparePersonaLife(bad, parent.transfer.life.clock.watermark)], 42),
    ).rejects.toThrow('checkpoint mismatch');
  });
}

it('preserves and refuses the actual earlier Sam checkpoint with an unresolved meal', async () => {
  const read = (name: string) =>
    JSON.parse(
      readFileSync(
        new URL(`./fixtures/hf3-neighbours/sam-refused-duty/${name}.json`, import.meta.url),
        'utf8',
      ),
    );
  const parent = read('persona');
  expect(read('raw').now).toBe(555);
  expect(await digest(read('raw'))).toBe(parent.transfer.checkpoint.sha256);
  const before = structuredClone(parent);
  await expect(
    prepareKitchenChapter([preparePersonaLife(parent, parent.transfer.life.clock.watermark)], 42),
  ).rejects.toThrow('unresolved source duty');
  expect(parent).toEqual(before);
});

it('receives actual signed Good Hands Zeynep while retaining the sons promise and exact source', async () => {
  const source = JSON.parse(
    readFileSync(new URL('./fixtures/hf3-goodhands-zeynep.json', import.meta.url), 'utf8'),
  );
  const parent = source.envelope;
  expect(source.source).toBe('509386298dfd89026c10bc6011d4f29e3323fb0c');
  expect(source.nativePublicationGuardPassed).toBe(true);
  expect(parent.source.engine).toBe('2.23.0');
  expect(await digest(source.raw)).toBe(parent.transfer.checkpoint.checkpointDigest);
  expect(source.raw.rng).toEqual(parent.transfer.checkpoint.sourceRng);
  const before = structuredClone(parent);
  const chapter = await prepareKitchenChapter(
    [preparePersonaLife(parent, parent.transfer.life.clock.watermark)],
    42,
  );
  const actor = chapter.actors.zeynep;
  expect(actor?.rng).toEqual(source.raw.rng);
  const family = actor?.agenda.commitments.find((c) => c.toId === 'sons');
  expect(family).toMatchObject({
    from: 1290,
    until: 1330,
    recurEvery: 1440,
    status: 'pending',
    actions: ['home'],
  });
  const s = newGame(42, 'pass@13', chapter);
  queueInput(s, { kind: 'cast-invite', who: 'zeynep' });
  expect(s.people.find((p) => p.id === 'zeynep')?.agenda.commitments.find((c) => c.toId === 'sons')).toEqual(
    family,
  );
  expect(await validateReplayFile(exportRun(s, '3.0.0'))).toEqual(s);
  for (const patch of [
    { engine: '3.0.0' },
    { engine: '2.22.0' },
    { rules: 'goodhands-unknown' },
    { game: 'repair' },
  ]) {
    const { revision: _revision, ...unsigned } = structuredClone(parent);
    const bad = await createPersona({ ...unsigned, source: { ...unsigned.source, ...patch } });
    await expect(
      prepareKitchenChapter([preparePersonaLife(bad, parent.transfer.life.clock.watermark)], 42),
    ).rejects.toThrow('no supported native kitchen map');
  }
  const { revision: _revision, ...unsigned } = structuredClone(parent);
  unsigned.transfer.agencyPerson.calendar.commitments[0].until += 1;
  const bad = await createPersona(unsigned);
  await expect(
    prepareKitchenChapter([preparePersonaLife(bad, parent.transfer.life.clock.watermark)], 42),
  ).rejects.toThrow('unresolved source work/family duty');
  expect(parent).toEqual(before);
});

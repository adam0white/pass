import { expect, it } from 'vitest';
import { communityRun } from '../src/sim/hf4-person.ts';
import { boardDefaults, fingerprint, newGame, queueInput, restoreJournalState } from '../src/sim/kitchen.ts';
import { Autosave, type JournalStorage } from '../src/ui/autosave.ts';

type Host = {
  state: ReturnType<typeof newGame>;
  host: ReturnType<ReturnType<typeof communityRun>['journalHost']>;
};
it('restores an appended journal and keeps the last committed save after a failed write', async () => {
  let record: Awaited<ReturnType<JournalStorage<Host>['read']>> = null;
  let fail = false;
  const storage: JournalStorage<Host> = {
    async read() {
      return record;
    },
    async commit(value) {
      if (fail) throw new Error('quota');
      const chunks =
        !value.fresh && record?.journal.head.lineage === value.head.lineage ? record.journal.chunks : [];
      record = structuredClone({
        host: value.host,
        journal: {
          opening: value.opening,
          head: value.head,
          chunks: [...chunks, ...(value.chunk ? [value.chunk] : [])],
        },
      });
    },
  };
  const store = new Autosave(storage);
  const state = newGame(42, 'pass@19');
  const run = communityRun(state.chef);
  const save = () =>
    store.write(() => ({ run, host: { state: structuredClone(state), host: run.journalHost() } }));
  expect(await save()).toBe(true);
  queueInput(state, { kind: 'board', rows: boardDefaults(state) });
  const committed = structuredClone(await store.read());
  fail = true;
  expect(await save()).toBe(false);
  expect(await store.read()).toEqual(committed);
  fail = false;
  expect(await save()).toBe(true);
  const saved = await store.read();
  if (!saved) throw new Error('Missing saved record');
  expect(saved.journal.chunks.length).toBeGreaterThan(0);
  const restored = restoreJournalState(saved.host.state, saved.host.host, saved.journal);
  expect(JSON.parse(fingerprint(restored.state))).toEqual(JSON.parse(fingerprint(state)));
  store.adopt(restored.run, saved.journal, restored.cursor);
  expect(
    await store.write(() => ({
      run: restored.run,
      host: {
        state: structuredClone(restored.state),
        host: restored.run.journalHost(),
      },
    })),
  ).toBe(true);
  expect((await store.read())?.journal.head).toEqual(saved.journal.head);
});

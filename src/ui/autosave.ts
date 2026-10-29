import type {
  DeepReadonly,
  RunJournalArchive,
  RunJournalChunk,
  RunJournalCursor,
  RunJournalHead,
  RunJournalOpening,
} from '@adam0white/human-framework';
import type { KitchenRun } from '../sim/hf4-run.ts';

type Journal = DeepReadonly<RunJournalArchive>;
type Commit<T> = {
  host: T;
  opening: DeepReadonly<RunJournalOpening>;
  chunk: DeepReadonly<RunJournalChunk> | null;
  head: DeepReadonly<RunJournalHead>;
  fresh: boolean;
};
export interface JournalStorage<T> {
  read(): Promise<{ host: T; journal: Journal } | null>;
  commit(value: Commit<T>): Promise<void>;
}

/** One transaction commits a new chunk, the head, and the matching host snapshot. */
export function indexedJournalStorage<T>(): JournalStorage<T> {
  let db: Promise<IDBDatabase> | undefined;
  const open = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('pass-journal', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('head');
        request.result.createObjectStore('chunks', { keyPath: ['lineage', 'first'] });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Saved game storage is blocked.'));
    }));
  return {
    async read() {
      const database = await open();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(['head', 'chunks'], 'readonly');
        const headRequest = tx.objectStore('head').get('current');
        let result: { host: T; journal: Journal } | null = null;
        headRequest.onsuccess = () => {
          const value = headRequest.result as Omit<Commit<T>, 'chunk'> | undefined;
          if (!value) return;
          const range = IDBKeyRange.bound(
            [value.head.lineage, 0],
            [value.head.lineage, Number.MAX_SAFE_INTEGER],
          );
          const chunks = tx.objectStore('chunks').getAll(range);
          chunks.onsuccess = () => {
            result = {
              host: value.host,
              journal: { opening: value.opening, head: value.head, chunks: chunks.result },
            };
          };
        };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Save read aborted.'));
      });
    },
    async commit(value) {
      const database = await open();
      return new Promise((resolve, reject) => {
        const tx = database.transaction(['head', 'chunks'], 'readwrite');
        const heads = tx.objectStore('head');
        const chunks = tx.objectStore('chunks');
        const old = heads.get('current');
        old.onsuccess = () => {
          const previous = old.result as Omit<Commit<T>, 'chunk'> | undefined;
          if (previous && (value.fresh || previous.head.lineage !== value.head.lineage)) {
            chunks.delete(
              IDBKeyRange.bound([previous.head.lineage, 0], [previous.head.lineage, Number.MAX_SAFE_INTEGER]),
            );
          }
          if (value.fresh && (!previous || previous.head.lineage !== value.head.lineage))
            chunks.delete(
              IDBKeyRange.bound([value.head.lineage, 0], [value.head.lineage, Number.MAX_SAFE_INTEGER]),
            );
          if (value.chunk) chunks.put(value.chunk);
          heads.put({ host: value.host, opening: value.opening, head: value.head }, 'current');
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Save write aborted.'));
      });
    },
  };
}

export class Autosave<T> {
  private run?: KitchenRun;
  private cursor?: RunJournalCursor;
  private opening?: DeepReadonly<RunJournalOpening>;
  private tail: Promise<void> = Promise.resolve();
  constructor(private storage: JournalStorage<T>) {}
  async read() {
    await this.tail;
    return this.storage.read();
  }
  adopt(run: KitchenRun, journal: Journal, cursor: RunJournalCursor) {
    this.run = run;
    this.cursor = cursor;
    this.opening = journal.opening;
  }
  write(capture: () => { run: KitchenRun; host: T } | null): Promise<boolean> {
    const result = this.tail.then(async () => {
      try {
        // Capture the host and export from the same live run without yielding.
        const value = capture();
        if (!value) return true;
        const same = value.run === this.run;
        const update = value.run.journal(same ? this.cursor : undefined);
        const opening = update.opening ?? (same ? this.opening : undefined);
        if (!opening) throw new Error('Missing journal opening.');
        await this.storage.commit({
          host: value.host,
          opening,
          chunk: update.chunk,
          head: update.head,
          fresh: !!update.opening,
        });
        this.run = value.run;
        this.cursor = update.cursor;
        this.opening = opening;
        return true;
      } catch {
        return false;
      }
    });
    this.tail = result.then(() => {});
    return result;
  }
}

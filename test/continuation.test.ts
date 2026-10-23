import { describe, expect, it } from 'vitest';
import { replayExport } from '../src/sim/continuation.ts';
import { canReplay, exportRun, newGame, replay } from '../src/sim/kitchen.ts';

describe('pinned chapter replay', () => {
  it('keeps an explicitly old opening in its exact edition', () => {
    const old = newGame(19, 'pass@11');
    expect(replayExport(exportRun(old, '2.15.0'))).toEqual(replay(19, [], old.minute, 'pass@11'));
    expect(canReplay('pass@12')).toBe(true);
    expect(newGame(19).version).toBe('pass@12');
  });
  it('rejects a return chapter whose departure is another return', () => {
    expect(() =>
      replayExport({
        game: 'pass@12',
        seed: 1,
        inputs: [],
        minute: 1,
        returnChapter: { v: 1, prefix: { returnChapter: {} }, initial: {}, envelope: {} },
      } as never),
    ).toThrow();
  });
});

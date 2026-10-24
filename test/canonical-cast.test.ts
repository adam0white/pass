import { MINUTES_PER_YEAR } from '@adam0white/human-framework';
import { castForGame } from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import { replayExport } from '../src/sim/continuation.ts';
import { HIRES, makeCook, makeHire } from '../src/sim/cooks.ts';
import { exportRun, newGame, queueInput } from '../src/sim/kitchen.ts';

describe('canonical kitchen edition', () => {
  it('uses complete canonical opening profiles without granting novice expertise', () => {
    for (const cast of castForGame('pass')) {
      const id = cast.castId.split('.')[2]!;
      const template = HIRES.find((t) => t.id === id);
      const p = template ? makeHire(template, 42, 540, 'pass@13') : makeCook(id, 42, 540, 'pass@13');
      expect(p.name).toBe(cast.name);
      expect(p.traits).toEqual(cast.traits);
      expect(p.values).toEqual(cast.values);
      expect((p.now - p.life.bornAt) / MINUTES_PER_YEAR).toBe(cast.age);
    }
    const sam = makeHire(HIRES.find((t) => t.id === 'sam')!, 42, 540, 'pass@13');
    expect(sam.skills.grill?.level ?? 0).toBeLessThan(0.3);
    expect(sam.skills.dish?.level).toBeLessThan(0.6);
  });
  it('discovers only after choosing an available private conversation and replays it', () => {
    const s = newGame(42);
    queueInput(s, { kind: 'cast-talk', who: 'selim', choice: 'listen' });
    expect(s.said.some((x) => x.text.includes('initials'))).toBe(true);
    expect(replayExport(exportRun(s, 'test'))).toEqual(s);
  });
});

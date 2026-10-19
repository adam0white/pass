import { describe, expect, it } from 'vitest';
import { COOKS, HOME_STATION } from '../src/sim/cooks.ts';
import {
  cloneState,
  cookOf,
  fingerprint,
  type GameState,
  hints,
  newGame,
  personOf,
  queueInput,
  replay,
  restoreState,
  rollTickets,
  stationOf,
  step,
} from '../src/sim/kitchen.ts';

/** A plain player: asks idle cooks back to their station every few minutes; answers the call as told. */
function play(
  s: GameState,
  opts: { nights?: number; call?: 'go' | 'stay'; jar?: 'talk' | 'move' | 'leave'; insist?: boolean } = {},
) {
  const nights = opts.nights ?? 6;
  while (s.phase !== 'end') {
    if (s.phase === 'evening') {
      if (s.night >= nights) return;
      if (s.night === 3) queueInput(s, { kind: 'jar', choice: opts.jar ?? 'leave' });
      queueInput(s, { kind: 'open' });
      continue;
    }
    if (s.call === 'asking') queueInput(s, { kind: 'call', choice: opts.call ?? 'go' });
    if (s.minute % 6 === 0)
      for (const id of COOKS) {
        const c = cookOf(s, id);
        if (c.here && !c.gone && !c.pending && !stationOf(s, id))
          queueInput(s, { kind: 'ask', cook: id, verb: HOME_STATION[id], insist: opts.insist });
      }
    step(s);
  }
}

describe('The Pass', () => {
  it('replays a run exactly from seed and input log', () => {
    const s = newGame(42);
    play(s, { nights: 2 });
    const r = replay(42, s.inputs, s.minute);
    expect(fingerprint(r)).toBe(fingerprint(s));
    expect(s.inputs.length).toBeGreaterThan(5);
  });

  it('pre-rolls tables from the seed alone, whatever the player does', () => {
    const a = newGame(7);
    const b = newGame(7);
    play(a, { nights: 1 });
    play(b, { nights: 1, insist: true });
    queueInput(a, { kind: 'open' });
    queueInput(b, { kind: 'open' });
    const strip = (s: GameState) => s.tickets.map((t) => [t.table, t.at, t.grill, t.cold, !!t.critic]);
    expect(strip(a)).toEqual(strip(b));
    expect(rollTickets(7, 5, 1).filter((t) => t.critic)).toHaveLength(1);
  });

  it('the telegraph is pure: reading hints changes nothing', () => {
    const s = newGame(9);
    for (let i = 0; i < 40; i++) step(s);
    const before = fingerprint(s);
    const rng = JSON.stringify(s.people.map((p) => p.rng));
    for (const id of ['selim', 'dilek'] as const) hints(s, id, true);
    expect(fingerprint(s)).toBe(before);
    expect(JSON.stringify(s.people.map((p) => p.rng))).toBe(rng);
  });

  it('insisting never turns a cannot or will-not into a yes', () => {
    const s = newGame(3);
    for (let i = 0; i < 60; i++) step(s);
    // Broken trust: Selim will not take the chef's word for anything.
    const v = personOf(s, 'selim').will.voices[0];
    if (v) {
      v.trust = 0.02;
      v.pressure = 0.9;
    }
    const asked = hints(s, 'selim', false);
    const pushed = hints(s, 'selim', true);
    const refused = asked.filter((h) => h.verdict === 'refused');
    expect(refused.length).toBeGreaterThan(0);
    for (const h of refused) expect(pushed.find((x) => x.verb === h.verb)?.verdict).toBe('refused');
  });

  it('insisting all week costs trust; asking does not', () => {
    const a = newGame(5);
    const b = newGame(5);
    play(a, { nights: 3 });
    play(b, { nights: 3, insist: true });
    const trust = (s: GameState) => COOKS.map((id) => personOf(s, id).will.voices[0]?.trust ?? 0);
    const ta = trust(a);
    const tb = trust(b);
    for (let i = 0; i < 3; i++) expect(tb[i] as number).toBeLessThan((ta[i] as number) - 0.05);
  });

  it('asking Dilek to stay through her mother’s fall comes back in her evening review', () => {
    const s = newGame(11);
    play(s, { nights: 5, call: 'stay' });
    const r = s.reports[4];
    const dilek = r?.reviews.find((x) => x.id === 'dilek');
    expect(dilek?.line).toMatch(/mother/);
    expect(dilek?.aboutYou).toMatch(/stay/);
  });

  it('a save restores and continues identically', () => {
    const s = newGame(13);
    for (let i = 0; i < 120; i++) step(s);
    const copy = restoreState(JSON.parse(JSON.stringify(cloneState(s))));
    for (let i = 0; i < 60; i++) {
      step(s);
      step(copy);
    }
    expect(fingerprint(copy)).toBe(fingerprint(s));
  });

  it('a week ends with six reports and the bank decided', () => {
    const s = newGame(21);
    play(s);
    expect(s.phase).toBe('end');
    expect(s.reports).toHaveLength(6);
    expect(s.till).toBeGreaterThan(0);
  });
});

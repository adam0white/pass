import { describe, expect, it } from 'vitest';
import { LAST_NIGHT, planOf } from '../src/sim/campaign.ts';
import {
  canReplay,
  cloneState,
  cookOf,
  fingerprint,
  type GameState,
  hints,
  memberOf,
  newGame,
  offersFor,
  onShift,
  personOf,
  queueInput,
  replay,
  restoreState,
  rollTickets,
  stationOf,
  stationsTonight,
  step,
  trustOf,
} from '../src/sim/kitchen.ts';

/** A plain player: asks idle cooks back to their station every few minutes; answers requests as told. */
function play(
  s: GameState,
  opts: {
    nights?: number;
    answer?: 'yes' | 'no';
    jar?: 'talk' | 'move' | 'leave';
    insist?: boolean;
    idle?: boolean;
  } = {},
) {
  const nights = opts.nights ?? LAST_NIGHT;
  while (s.phase !== 'end') {
    if (s.phase === 'evening') {
      if (s.night >= nights) return;
      if (s.night === 3) queueInput(s, { kind: 'jar', choice: opts.jar ?? 'leave' });
      queueInput(s, { kind: 'open' });
      continue;
    }
    if (s.phase === 'sunday') {
      const c = s.sunday?.candidates[0];
      if (c) queueInput(s, { kind: 'choose', key: 'hire', value: c });
      queueInput(s, { kind: 'open' });
      continue;
    }
    if (s.request?.state === 'asking') queueInput(s, { kind: 'answer', choice: opts.answer ?? 'yes' });
    if (!opts.idle && s.minute % 6 === 0)
      for (const id of onShift(s)) {
        const c = cookOf(s, id);
        if (!c.pending && !stationOf(s, id))
          queueInput(s, { kind: 'ask', cook: id, verb: memberOf(s, id).home, insist: opts.insist });
      }
    step(s);
  }
}

const copy = (s: GameState) => restoreState(JSON.parse(JSON.stringify(cloneState(s))));

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
    for (const id of ['selim', 'dilek']) hints(s, id, true);
    expect(fingerprint(s)).toBe(before);
    expect(JSON.stringify(s.people.map((p) => p.rng))).toBe(rng);
  });

  it('insisting never turns a cannot or will-not into a yes', () => {
    const s = newGame(3);
    for (let i = 0; i < 60; i++) step(s);
    const v = personOf(s, 'selim').will.voices[0];
    if (v) {
      v.trust = 0.02;
      v.pressure = 0.9;
    }
    const refused = hints(s, 'selim', false).filter((h) => h.verdict === 'refused');
    const pushed = hints(s, 'selim', true);
    expect(refused.length).toBeGreaterThan(0);
    for (const h of refused) expect(pushed.find((x) => x.verb === h.verb)?.verdict).toBe('refused');
  });

  it('insisting all week costs trust; asking does not', () => {
    const a = newGame(5);
    const b = newGame(5);
    play(a, { nights: 3 });
    play(b, { nights: 3, insist: true });
    for (const id of ['selim', 'dilek', 'rafi'])
      expect(trustOf(personOf(b, id))).toBeLessThan(trustOf(personOf(a, id)) - 0.05);
  });

  it('asking Dilek to stay through her mother’s fall comes back in her evening', () => {
    const s = newGame(11);
    play(s, { nights: 5, answer: 'no' });
    const dilek = s.reports[4]?.reviews.find((x) => x.id === 'dilek');
    expect(dilek?.line).toMatch(/mother/);
    expect(dilek?.aboutYou).toMatch(/stay|floor/);
  });

  it('letting Dilek go keeps her promise to her mother', () => {
    const s = newGame(11);
    play(s, { nights: 5, answer: 'yes' });
    const c = personOf(s, 'dilek').agenda.commitments.find((x) => x.label === 'going to my mother');
    expect(c?.status).not.toBe('broken');
    expect(s.reports[4]?.reviews.find((x) => x.id === 'dilek')?.aboutYou).toMatch(/let me go/);
  });

  it('a save restores and continues identically', () => {
    const s = newGame(13);
    for (let i = 0; i < 120; i++) step(s);
    const c = copy(s);
    for (let i = 0; i < 60; i++) {
      step(s);
      step(c);
    }
    expect(fingerprint(c)).toBe(fingerprint(s));
  });

  it('a break refusal stays coherent across asks', () => {
    // The owner's report: a cook on a break turned down one job, took another, then took the first after all.
    // Now the first answer says what is different about that job, the deferral is remembered for the rest of the
    // break, and taking it later is explained.
    const s = newGame(1);
    let checked = 0;
    while (s.phase === 'service' && checked === 0) {
      step(s);
      for (const id of onShift(s)) {
        const a = personOf(s, id).activity;
        if (!a || !['break', 'smoke', 'eat'].includes(a.affordanceId) || s.minute - a.startedAt !== 1)
          continue;
        const h = hints(s, id).filter((x) => (stationsTonight(s) as string[]).includes(x.verb));
        const no = h.find((x) => x.verdict === 'deferred');
        const yes = h.find((x) => x.verdict === 'assented');
        if (!no || !yes) continue;
        const t = copy(s);
        queueInput(t, { kind: 'ask', cook: id, verb: no.verb });
        step(t);
        expect(t.lastAnswer?.verdict).toBe('deferred');
        expect(t.lastAnswer?.text).toMatch(/I’d do\./);
        expect(t.lastAnswer?.text).not.toMatch(/^Not now/);
        queueInput(t, { kind: 'ask', cook: id, verb: yes.verb });
        step(t);
        expect(t.lastAnswer?.verdict).toBe('assented');
        // The deferral survives the other ask.
        expect(cookOf(t, id).breakDeferred?.verb).toBe(no.verb);
        step(t);
        queueInput(t, { kind: 'ask', cook: id, verb: no.verb });
        step(t);
        if (t.lastAnswer?.verdict === 'assented') expect(t.lastAnswer.text).toMatch(/up now anyway/);
        checked += 1;
        break;
      }
    }
    expect(checked).toBe(1);
  });

  it('somebody stays on the line: the last cook in the kitchen is not offered a break', () => {
    const s = newGame(2);
    for (let i = 0; i < 30; i++) step(s);
    const [a, b] = onShift(s);
    expect(a && b).toBeTruthy();
    const pb = personOf(s, b as string);
    // Send b out back by hand.
    pb.activity = {
      ...(pb.activity ?? {}),
      affordanceId: 'break',
      action: 'rest',
      startedAt: s.minute,
      endsAt: s.minute + 10,
      reviewAt: s.minute + 10,
    } as never;
    expect(offersFor(s, a as string).some((o) => o.id === 'break')).toBe(false);
    expect(offersFor(s, a as string).some((o) => o.id === 'grill')).toBe(true);
  });

  it('the oven bakes nothing until it is hot', () => {
    const s = newGame(4);
    play(s, { nights: 6 });
    queueInput(s, { kind: 'open' });
    queueInput(s, { kind: 'open' });
    expect(planOf(s.night).oven).toBe(true);
    expect(s.oven.heat).toBe(0);
    while (s.minute % 1440 < 17 * 60 + 35) step(s);
    queueInput(s, { kind: 'ask', cook: 'selim', verb: 'oven', insist: true });
    let baked = false;
    for (let i = 0; i < 40; i++) {
      step(s);
      if (s.work.oven > 0 || s.tickets.some((t) => t.doneOven > 0)) {
        baked = true;
        expect(s.oven.heat).toBeGreaterThanOrEqual(0.7);
        break;
      }
    }
    expect(s.oven.heat).toBeGreaterThan(0);
    void baked;
  });

  it('doing nothing loses the lokanta; a plain player reaches the end of the campaign', () => {
    const idle = newGame(21);
    play(idle, { idle: true });
    expect(idle.phase).toBe('end');
    expect(idle.lost).toBe(true);
    const s = newGame(21);
    play(s);
    expect(s.phase).toBe('end');
    expect(s.reports.length).toBeGreaterThan(6);
  }, 60_000);

  it('old pass@1 saves and exports are recognised as an earlier edition', () => {
    expect(canReplay('pass@1')).toBe(false);
    expect(canReplay('pass@2')).toBe(true);
  });
  it('a Sunday page can be turned back to: the inputs up to that Sunday rebuild it', () => {
    const s = newGame(31);
    play(s, { nights: 6 });
    queueInput(s, { kind: 'open' });
    expect(s.phase).toBe('sunday');
    const k = s.inputs.length;
    queueInput(s, { kind: 'open' });
    const back = replay(31, s.inputs.slice(0, k));
    expect(back.phase).toBe('sunday');
    expect(back.sunday?.week).toBe(1);
  });
});

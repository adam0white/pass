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
    answer?: 'yes' | 'no' | 'ignore';
    jar?: 'talk' | 'move' | 'leave';
    insist?: boolean;
    rich?: boolean;
    idle?: boolean;
  } = {},
) {
  const nights = opts.nights ?? LAST_NIGHT;
  while (s.phase !== 'end') {
    if (s.phase === 'evening') {
      if (s.night >= nights) return;
      // A test stand-in for good nights: keep the bills paid so later weeks can be reached.
      if (opts.rich) s.till += 20000;
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
    if (s.request?.state === 'asking' && opts.answer !== 'ignore')
      queueInput(s, { kind: 'answer', choice: opts.answer ?? 'yes' });
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
    const s = newGame(42, 'pass@4');
    play(s, { nights: 2 });
    const r = replay(42, s.inputs, s.minute, 'pass@4');
    expect(fingerprint(r)).toBe(fingerprint(s));
    expect(s.inputs.length).toBeGreaterThan(5);
  });

  it('pre-rolls tables from the seed alone, whatever the player does', () => {
    const a = newGame(7, 'pass@4');
    const b = newGame(7, 'pass@4');
    play(a, { nights: 1 });
    play(b, { nights: 1, insist: true });
    queueInput(a, { kind: 'open' });
    queueInput(b, { kind: 'open' });
    const strip = (s: GameState) => s.tickets.map((t) => [t.table, t.at, t.grill, t.cold, !!t.critic]);
    expect(strip(a)).toEqual(strip(b));
    expect(rollTickets(7, 5, 1).filter((t) => t.critic)).toHaveLength(1);
  });

  it('the telegraph is pure: reading hints changes nothing', () => {
    const s = newGame(9, 'pass@4');
    for (let i = 0; i < 40; i++) step(s);
    const before = fingerprint(s);
    const rng = JSON.stringify(s.people.map((p) => p.rng));
    for (const id of ['selim', 'dilek']) hints(s, id, true);
    expect(fingerprint(s)).toBe(before);
    expect(JSON.stringify(s.people.map((p) => p.rng))).toBe(rng);
  });

  it('the telegraph for a new hire, the chef’s guess, is pure too', () => {
    const s = newGame(9, 'pass@4');
    play(s, { nights: 11, rich: true });
    queueInput(s, { kind: 'open' });
    for (let i = 0; i < 60; i++) step(s);
    const hire = onShift(s).find((id) => !memberOf(s, id).founder);
    expect(hire).toBeTruthy();
    const chef = JSON.stringify(s.chef);
    const before = fingerprint(s);
    const h = hints(s, hire as string);
    expect(h.some((x) => x.guess)).toBe(true);
    expect(JSON.stringify(s.chef)).toBe(chef);
    expect(fingerprint(s)).toBe(before);
  });

  it('insisting never turns a cannot or will-not into a yes', () => {
    const s = newGame(3, 'pass@4');
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
    const a = newGame(5, 'pass@4');
    const b = newGame(5, 'pass@4');
    play(a, { nights: 3 });
    play(b, { nights: 3, insist: true });
    for (const id of ['selim', 'dilek', 'rafi'])
      expect(trustOf(personOf(b, id))).toBeLessThan(trustOf(personOf(a, id)) - 0.05);
  });

  it('asking Dilek to stay through her mother’s fall comes back in her evening', () => {
    const s = newGame(11, 'pass@4');
    play(s, { nights: 5, answer: 'no' });
    const dilek = s.reports[4]?.reviews.find((x) => x.id === 'dilek');
    expect(dilek?.line).toMatch(/mother/);
    expect(dilek?.aboutYou).toMatch(/stay|floor/);
  });

  it('letting Dilek go keeps her promise to her mother', () => {
    const s = newGame(11, 'pass@4');
    play(s, { nights: 5, answer: 'yes' });
    const c = personOf(s, 'dilek').agenda.commitments.find((x) => x.label === 'going to my mother');
    expect(c?.status).not.toBe('broken');
    expect(s.reports[4]?.reviews.find((x) => x.id === 'dilek')?.aboutYou).toMatch(/let me go/);
  });

  it('a save restores and continues identically', () => {
    const s = newGame(13, 'pass@4');
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
    // break, and the third answer is either taking it with a reason or the same no, said as the same no.
    const s = newGame(1, 'pass@4');
    const thirds: string[] = [];
    while (s.phase === 'service' && thirds.length < 6) {
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
        expect(t.lastAnswer?.counter).toBe(yes.verb);
        queueInput(t, { kind: 'ask', cook: id, verb: yes.verb });
        step(t);
        expect(t.lastAnswer?.verdict).toBe('assented');
        // The deferral survives the other ask.
        expect(cookOf(t, id).breakDeferred?.verb).toBe(no.verb);
        step(t);
        queueInput(t, { kind: 'ask', cook: id, verb: no.verb });
        step(t);
        const third = t.lastAnswer;
        if (third?.verdict === 'assented') expect(third.text).toMatch(/up now anyway/);
        else expect(third?.text).toMatch(/^I came off my .*not yet\.$/);
        thirds.push(third?.verdict ?? '');
      }
    }
    // Both endings occur on this seed: taking the job after all, and the same no.
    expect(thirds).toContain('assented');
    expect(thirds.some((v) => v !== 'assented')).toBe(true);
  });

  it('somebody stays on the line: the last cook in the kitchen is not offered a break', () => {
    const s = newGame(2, 'pass@4');
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
    const s = newGame(4, 'pass@4');
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
    const idle = newGame(21, 'pass@4');
    play(idle, { idle: true });
    expect(idle.phase).toBe('end');
    expect(idle.lost).toBe(true);
    const s = newGame(21, 'pass@4');
    play(s);
    // Either the campaign ended (lost) or the last night was played.
    expect(s.phase === 'end' || s.night === LAST_NIGHT).toBe(true);
    expect(s.reports.length).toBeGreaterThan(6);
  }, 60_000);

  it('old pass@1 and pass@2 saves and exports are recognised as an earlier edition', () => {
    expect(canReplay('pass@1')).toBe(false);
    expect(canReplay('pass@2')).toBe(false);
    expect(canReplay('pass@3')).toBe(true);
  });
  it('a Sunday page can be turned back to: the inputs up to that Sunday rebuild it', () => {
    const s = newGame(31, 'pass@4');
    play(s, { nights: 6 });
    queueInput(s, { kind: 'open' });
    expect(s.phase).toBe('sunday');
    const k = s.inputs.length;
    queueInput(s, { kind: 'open' });
    const back = replay(31, s.inputs.slice(0, k), undefined, 'pass@4');
    expect(back.phase).toBe('sunday');
    expect(back.sunday?.week).toBe(1);
  });

  it('a call left unanswered: Dilek goes to her mother anyway, and says so', () => {
    const s = newGame(11, 'pass@4');
    play(s, { nights: 5, answer: 'ignore' });
    expect(s.request?.ignored).toBe(true);
    expect(s.said.some((x) => x.who === 'dilek' && /can’t wait for you/.test(x.text))).toBe(true);
    expect(s.reports[4]?.reviews.find((x) => x.id === 'dilek')?.aboutYou).toMatch(/went anyway/);
  });

  it('a granted phone call is made once, not taken again and again', () => {
    const s = newGame(5, 'pass@4');
    play(s, { nights: 8, rich: true });
    while (!(s.request?.kind === 'phone' && s.request.rang) && s.phase !== 'end') {
      if (s.phase !== 'service') queueInput(s, { kind: 'open' });
      if (s.request?.state === 'asking') queueInput(s, { kind: 'answer', choice: 'yes' });
      step(s);
    }
    expect(s.request?.rang).toBe(true);
    expect(offersFor(s, 'dilek').some((a) => a.id === 'phone')).toBe(false);
  });

  it('the jar is decided once, on Wednesday of week 1', () => {
    const s = newGame(7, 'pass@4');
    play(s, { nights: 2 });
    queueInput(s, { kind: 'jar', choice: 'move' });
    expect(s.jarPlace).toBe('counter');
    play(s, { nights: 3 });
    queueInput(s, { kind: 'jar', choice: 'move' });
    expect(s.jarPlace).toBe('pass');
    queueInput(s, { kind: 'jar', choice: 'talk' });
    expect(s.talkedToRafi).toBe(false);
  });

  it('Selim keeps maghrib at home on days without service, so no review calls it missed', () => {
    const s = newGame(9191, 'pass@4');
    play(s, { nights: 12, rich: true });
    const missed = s.said.filter(
      (x) => x.who === 'selim' && /keep maghrib/.test(x.text) && /didn/.test(x.text),
    );
    expect(missed).toEqual([]);
  });

  it('a week of insisting on everything costs a cook at the first Sunday; asking costs none', () => {
    const pushed = newGame(1001, 'pass@3');
    play(pushed, { nights: 6, insist: true, rich: true });
    queueInput(pushed, { kind: 'open' });
    expect(pushed.sunday?.quits.length ?? 0).toBeGreaterThan(0);
    const asked = newGame(1001, 'pass@3');
    play(asked, { nights: 6, rich: true });
    queueInput(asked, { kind: 'open' });
    expect(asked.sunday?.quits ?? []).toEqual([]);
  });
});

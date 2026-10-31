/** F-2166 bookkeeping on real seed-7 nights: answers, expirations and a dropped choice stay truthful. */
import { expect, it } from 'vitest';
import { validateReplayFile } from '../src/sim/continuation.ts';
import { isHF4 } from '../src/sim/hf4-person.ts';
import {
  boardDefaults,
  cloneState,
  cookOf,
  exportRun,
  newGame,
  onShift,
  queueInput,
  replay,
  type StaffingDecision,
  staffingOptions,
  stationOf,
  step,
} from '../src/sim/kitchen.ts';
import { privateConversationNote } from '../src/sim/kitchen-edition.ts';

const raw = (s: ReturnType<typeof newGame>) => JSON.parse(JSON.stringify(cloneState(s)));

type Policy = 'ignore' | 'leave' | 'first';

function night(policy: Policy, until = 1330) {
  const s = newGame(7, 'pass@20');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  const answered = new Set<number>();
  const before = new Map<number, string>();
  const seen = {
    covered: [] as StaffingDecision[],
    lapsed: [] as StaffingDecision[],
    dropped: [] as { id: number; cover: string; at: number }[],
    duplicates: 0,
    heldPastEnd: 0,
  };
  for (let i = 0; i < 900 && s.night === 1 && s.minute < until; i++) {
    step(s);
    for (const d of s.staffing ?? []) {
      const was = before.get(d.id);
      const staffed = onShift(s).some((id) => stationOf(s, id) === d.station);
      if (was === 'asking' && d.state === 'covered' && !d.cover) seen.covered.push({ ...d, open: staffed });
      if (was === 'asking' && d.state === 'lapsed') seen.lapsed.push({ ...d });
      before.set(d.id, d.state);
      if (d.cover && d.open === true && s.minute > d.until) seen.heldPastEnd++;
      if (d.state === 'asking' && policy !== 'ignore' && !answered.has(d.id)) {
        answered.add(d.id);
        const cover = policy === 'leave' ? null : (staffingOptions(s, d)[0] ?? null);
        queueInput(s, { kind: 'staff', id: d.id, cover });
      }
    }
    const open = (s.staffing ?? []).filter((d) => d.open === true);
    const keys = open.map((d) => `${d.who}/${d.station}`);
    seen.duplicates += keys.length - new Set(keys).size;
  }
  return { s, seen };
}

it('an unanswered question lapses with nobody there; it is never recorded as covered', () => {
  const s = newGame(7, 'pass@20');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  let ask: StaffingDecision | undefined;
  for (let i = 0; i < 900 && s.night === 1 && !ask; i++) {
    step(s);
    ask = s.staffing?.find((d) => d.state === 'asking');
  }
  expect(ask, 'the played night must raise a staffing question').toBeDefined();
  // Both cooks leave the kitchen (the real "I have to leave" state), so nobody can staff the station.
  for (const c of s.cooks) c.gone = true;
  for (let i = 0; i < 40 && ask && s.minute <= ask.until + 1; i++) step(s);
  expect(ask?.state).toBe('lapsed');
  expect(ask?.cover).toBeUndefined();
  expect(s.staffing?.some((d) => d.state === 'covered' && !d.cover)).toBe(false);
}, 120000);

it('an answered "leave it empty" is not re-asked as a duplicate while that absence continues', () => {
  const { s, seen } = night('leave');
  expect(s.staffing?.some((d) => d.state === 'left')).toBe(true);
  expect(seen.duplicates).toBe(0);
}, 120000);

it('seed 7: a real HF takeover rejection is a cook answer; the host stale notice is separate', () => {
  const { s } = night('first', 1180);
  const old = s.said.find((l) => l.who !== 'narrator' && /I cannot take over that station\./.test(l.text));
  expect(old, 'the played night contains a real takeover rejection').toBeDefined();
  expect(old?.kind).toBe('answer');
  expect(s.said.some((l) => /Nobody was asked/.test(l.text))).toBe(false);
});

it('a stale staffing click gets a host notice, not a recorded refusal; the question stays open', () => {
  const s = newGame(7, 'pass@20');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  let ask: StaffingDecision | undefined;
  for (let i = 0; i < 400 && !ask; i++) {
    step(s);
    for (const d of s.staffing ?? []) {
      if (d.state !== 'asking' || ask) continue;
      // The first question that offers a cook is left for the stale click; earlier ones are left empty.
      if (staffingOptions(s, d).length) ask = d;
      else queueInput(s, { kind: 'staff', id: d.id, cover: null });
    }
  }
  expect(ask, 'the played night asks a question that offers a cook').toBeDefined();
  const cook = staffingOptions(s, ask as StaffingDecision)[0] ?? '';
  const spoken = s.said.length;
  // An ordinary request reaches that cook first, so the offered choice is stale when it is applied.
  queueInput(s, { kind: 'ask', cook, verb: 'grill' });
  queueInput(s, { kind: 'staff', id: (ask as StaffingDecision).id, cover: cook });
  step(s);
  const added = s.said.slice(spoken);
  const notice = added.find((l) => /Nobody was asked/.test(l.text));
  expect(notice?.who).toBe('narrator');
  expect(notice?.kind).toBe('journal');
  expect(added.some((l) => l.who === cook && /cannot take over/.test(l.text))).toBe(false);
  expect(ask?.state).toBe('asking');
  expect(ask?.cover).toBeUndefined();
});

it('seed 42: an actual accepted takeover works the agreed station and ends at its stated time', () => {
  const s = newGame(42, 'pass@20');
  queueInput(s, { kind: 'board', rows: boardDefaults(s) });
  queueInput(s, { kind: 'open' });
  const answered = new Set<number>();
  let taken: StaffingDecision | undefined;
  let worked = false;
  for (let i = 0; i < 900 && s.night === 1 && s.minute < 1260; i++) {
    step(s);
    for (const d of s.staffing ?? []) {
      if (d.state === 'asking' && !answered.has(d.id)) {
        answered.add(d.id);
        queueInput(s, { kind: 'staff', id: d.id, cover: staffingOptions(s, d)[0] ?? null });
      }
      if (d.cover && !taken) taken = d;
    }
    if (taken?.cover && s.minute < taken.until && stationOf(s, taken.cover) === taken.station) worked = true;
  }
  expect(taken, 'the played seed-42 night accepts one takeover through the real HF decision').toBeDefined();
  expect(taken?.state).toBe('covered');
  expect(worked, 'the relief cook worked the station while the agreement ran').toBe(true);
  expect(taken?.open).toBe(false);
  expect(s.minute).toBeGreaterThan(taken?.until ?? Infinity);
  // The window was not extended: the relief cook holds no cover past the stated end.
  const held = cookOf(s, taken?.cover ?? '').cover;
  expect(!held || held.until <= (taken?.until ?? 0) || held.station !== taken?.station).toBe(true);
}, 120000);

it('a retired HF4 edition never reaches the HF3 constructors; supported editions still build', () => {
  expect(() => newGame(7, 'pass@19')).toThrow('not supported');
  expect(() => replay(7, [], undefined, 'pass@19')).toThrow('not supported');
  expect(isHF4(newGame(7, 'pass@20').chef)).toBe(true);
  expect(isHF4(newGame(7, 'pass@13').chef)).toBe(false);
  expect(isHF4(replay(7, [], undefined, 'pass@10').chef)).toBe(false);
});

it('replays the staffing night exactly and keeps later inputs equal', async () => {
  const { s } = night('leave', 1180);
  const replayed = await validateReplayFile(exportRun(s, '4.12.0'));
  expect(raw(replayed)).toEqual(raw(s));
  // A real next input (a cold request to Dilek), then eight minutes on both copies.
  const next = { kind: 'ask', cook: 'dilek', verb: 'cold' } as const;
  queueInput(s, next);
  queueInput(replayed, next);
  for (let i = 0; i < 8; i++) {
    step(s);
    step(replayed);
  }
  expect(raw(replayed)).toEqual(raw(s));
}, 120000);

it('F-2172: the disabled private invitation says why, from the actual conditions', () => {
  const s = newGame(7, 'pass@20');
  expect(privateConversationNote(s, 'selim')).toMatch(
    /only while the kitchen is open|nothing private|already/,
  );
  expect(privateConversationNote(s, 'nobody-here')).toMatch(/nothing private/);
});

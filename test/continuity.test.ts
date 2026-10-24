import {
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { beforeEach, expect, it, vi } from 'vitest';
import { freshActor, kitchenTransfer } from '../src/sim/cast-chapter.ts';
import { newGame } from '../src/sim/kitchen.ts';

const mocks = vi.hoisted(() => ({
  shelf: { ready: Promise.resolve(true), enabled: true, request: vi.fn(), setEnabled: vi.fn() },
  lab: {
    trackRun: vi.fn(() => vi.fn()),
    setPersonaRecording: vi.fn(),
    allowPersonaRecording: vi.fn(),
    milestone: vi.fn(),
    build: () => ({ c: 'fixture' }),
    personaRecordingAllowed: false,
    playerId: 'fixture',
  },
}));
vi.mock('@adam0white/lab-client', async (original) => ({
  ...(await original<typeof import('@adam0white/lab-client')>()),
  personaChannel: () => mocks.shelf,
  watchPersonaCheckpoint: vi.fn(),
}));
vi.mock('@adam0white/lab-kit', () => ({ personaControls: () => document.createElement('section') }));
vi.mock('../src/ui/lab.ts', () => ({ lab: mocks.lab }));

import { continuity } from '../src/ui/continuity.ts';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', new EventTarget());
  mocks.shelf.enabled = true;
  mocks.shelf.request.mockResolvedValue(null);
  mocks.lab.personaRecordingAllowed = false;
});
const envelope = async () => {
  const p = freshActor('hulya', 42, 540);
  p.agenda.commitments = [];
  const transfer = await kitchenTransfer(p);
  return createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.hulya.pass',
    castRevision: '1',
    branchId: 'fixture-branch',
    parentRevision: null,
    source: { game: 'pass', build: 'fixture', engine: '2.17.0', rules: 'pass-13' },
    transfer: { ...transfer, life: initialPersonaLife('hf.cast.hulya.pass', 'fixture-branch', 0) },
    limitations: transfer.limitations,
  });
};
it('title and local reload do not claim a new chapter; file receipt stays nonowned after reload', async () => {
  const e = await envelope();
  const c = continuity(() => null, vi.fn(), vi.fn());
  await c.restore(
    { envelope: null, oneCast: [], ownedHeads: { [e.castId]: e }, recordingGroup: [e] },
    true,
    true,
  );
  expect(c.data().ownedHeads).toEqual({});
  expect(c.data().fileOrigin).toBe(true);
  await c.restore(c.data(), false, true);
  expect(c.data().ownedHeads).toEqual({});
  expect(c.data().fileOrigin).toBe(true);
  expect(mocks.shelf.request.mock.calls.some(([r]) => r.action === 'put' || r.action === 'putBatch')).toBe(
    false,
  );
});
it('preflights all seven expected heads once before accepting a fresh batch', async () => {
  const e = await envelope();
  mocks.shelf.request.mockImplementation(async (r) => {
    if (r.action === 'prepareBatch')
      return {
        expectedHeads: Object.fromEntries(
          (await import('@adam0white/lab-client'))
            .castForGame('pass')
            .map((c) => [c.castId, c.castId === e.castId ? e.revision : null]),
        ),
        inputs: [preparePersonaLife(e, 0)],
        blocked: [],
      };
    if (r.action === 'recordingBatch')
      return { sameEpoch: false, revisions: [e.revision], recordingEpoch: 'opaque' };
    return null;
  });
  const c = continuity(() => null, vi.fn(), vi.fn());
  const s = await c.fresh(42);
  expect(s.castChapter?.inputs[0]?.parent.revision).toBe(e.revision);
  const puts = mocks.shelf.request.mock.calls.filter(([r]) => r.action === 'putBatch');
  expect(puts).toHaveLength(1);
  expect(Object.keys(puts[0]![0].expectedHeads)).toHaveLength(7);
});
it('recording preference acknowledgments do not cancel pending fictional admission', async () => {
  let resolve!: (x: unknown) => void;
  mocks.shelf.request.mockImplementation((r) =>
    r.action === 'prepareBatch'
      ? new Promise((done) => {
          resolve = done;
        })
      : Promise.resolve(null),
  );
  const c = continuity(() => null, vi.fn(), vi.fn());
  const pending = c.fresh(42);
  await Promise.resolve();
  window.dispatchEvent(new Event('hf-lab-preference'));
  window.dispatchEvent(new Event('storage'));
  resolve({
    expectedHeads: Object.fromEntries(
      (await import('@adam0white/lab-client')).castForGame('pass').map((p) => [p.castId, null]),
    ),
    inputs: [],
    blocked: [],
  });
  expect((await pending).seed).toBe(42);
  expect(mocks.shelf.request.mock.calls.some(([r]) => r.action === 'recordingBatch')).toBe(false);
});
it('checkpoint CAS never retries against a newer head and imported files never publish', async () => {
  const s = newGame(42);
  s.phase = 'evening';
  s.releasedCast = ['selim'];
  s.people.find((p) => p.id === 'selim')!.activity = null;
  s.people.find((p) => p.id === 'selim')!.agenda.commitments = [];
  mocks.shelf.request.mockRejectedValue(new Error('stale'));
  const c = continuity(() => s, vi.fn(), vi.fn());
  await c.restore(undefined, true, true);
  await c.checkpoint();
  expect(mocks.shelf.request).not.toHaveBeenCalled();
});
it('Sunday rewind discards later ownership rather than requiring its future source state', async () => {
  const e = await envelope(),
    s = newGame(42),
    c = continuity(() => s, vi.fn(), vi.fn());
  await c.restore(
    { envelope: null, oneCast: [], ownedHeads: { [e.castId]: e }, recordingGroup: [e] },
    true,
    true,
    s,
  );
  expect(c.data().ownedHeads).toEqual({});
  expect(c.data().fileOrigin).toBe(true);
});
it('an owned unreleased death publishes terminal and its local save reloads without a release', async () => {
  const e = await envelope(),
    s = newGame(42),
    p = freshActor('hulya', 42, 540);
  p.body.alive = false;
  s.people.push(p);
  const c = continuity(() => s, vi.fn(), vi.fn());
  await c.restore({ envelope: null, oneCast: [], ownedHeads: { [e.castId]: e }, recordingGroup: [e] });
  mocks.shelf.request.mockImplementation(async (r) =>
    r.action === 'recordingBatch'
      ? {
          sameEpoch: false,
          revisions: r.envelopes.map((x: PersonaEnvelope) => x.revision),
          recordingEpoch: null,
        }
      : null,
  );
  await c.checkpoint();
  expect(c.data().ownedHeads?.[e.castId]?.terminal).toBeTruthy();
  await c.restore(c.data(), false, true, s);
  expect(c.data().ownedHeads?.[e.castId]?.terminal).toBeTruthy();
});
it('explicit fresh local play remains local even when browser continuity is enabled', async () => {
  const s = newGame(42);
  s.phase = 'evening';
  s.releasedCast = ['selim'];
  s.people[0]!.activity = null;
  const c = continuity(() => s, vi.fn(), vi.fn());
  await c.local();
  await c.checkpoint();
  expect(mocks.shelf.request).not.toHaveBeenCalled();
  expect(c.data().localOnly).toBe(true);
});

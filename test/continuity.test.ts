import {
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { beforeEach, expect, it, vi } from 'vitest';
import { required } from '../src/required.ts';
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
    telemetryOn: false,
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
  expect(Object.keys(required(puts[0])[0].expectedHeads)).toHaveLength(7);
  expect(mocks.lab.telemetryOn).toBe(false);
  expect(mocks.lab.allowPersonaRecording.mock.calls.every(([allow]) => !allow)).toBe(true);
});
it('automatic linkage does not query shelf permission for file history', async () => {
  const e = await envelope();
  const c = continuity(() => null, vi.fn(), vi.fn());
  await c.restore({
    envelope: null,
    oneCast: [],
    recordingGroup: [e],
    importedHistory: true,
    fileUnlinked: true,
  });
  mocks.shelf.request.mockRejectedValue(new Error('permission service unavailable'));
  await expect(c.chooseRecording(true)).resolves.toBeUndefined();
  expect(mocks.shelf.request).not.toHaveBeenCalled();
});
it('checkpoint CAS never retries against a newer head and imported files never publish', async () => {
  const s = newGame(42);
  s.phase = 'evening';
  s.releasedCast = ['selim'];
  required(s.people.find((p) => p.id === 'selim')).activity = null;
  required(s.people.find((p) => p.id === 'selim')).agenda.commitments = [];
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
  required(s.people[0]).activity = null;
  const c = continuity(() => s, vi.fn(), vi.fn());
  await c.local();
  await c.checkpoint();
  expect(mocks.shelf.request).not.toHaveBeenCalled();
  expect(c.data().localOnly).toBe(true);
});

it('does not cancel a pending kitchen admission when recording identity acknowledges', async () => {
  const { castForGame } = await import('@adam0white/lab-client');
  let release!: (value: unknown) => void;
  mocks.shelf.request.mockImplementation((request) => {
    if (request.action === 'prepareBatch')
      return new Promise((resolve) => {
        release = resolve;
      });
    if (request.action === 'recordingBatch')
      return Promise.resolve({
        sameEpoch: true,
        revisions: request.envelopes.map((p: { revision: string }) => p.revision),
        recordingEpoch: 'opaque',
      });
    return Promise.resolve({});
  });
  const c = continuity(() => null, vi.fn(), vi.fn());
  const pending = c.fresh(42);
  await vi.waitFor(() => expect(release).toBeTypeOf('function'));
  window.dispatchEvent(new Event('hf-lab-preference'));
  const storage = new Event('storage');
  Object.defineProperty(storage, 'key', { value: 'hf-lab-player' });
  window.dispatchEvent(storage);
  release({
    expectedHeads: Object.fromEntries(castForGame('pass').map((c) => [c.castId, null])),
    inputs: [],
    blocked: [],
  });
  await expect(pending).resolves.toHaveProperty('seed', 42);
});

it('ignores obsolete saved recording keys that the SDK would reject', async () => {
  mocks.lab.setPersonaRecording.mockImplementation((key: string | null) => {
    if (key !== null && !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(key))
      throw new Error('Invalid persona recording key.');
  });
  const c = continuity(() => null, vi.fn(), vi.fn());
  await expect(
    c.restore({ envelope: null, oneCast: [], recordingKey: 'old/head/'.repeat(30) }),
  ).resolves.toBeUndefined();
  expect(mocks.lab.setPersonaRecording).toHaveBeenLastCalledWith(null);
});

it('enables fictional continuity on startup without changing recording preferences', async () => {
  mocks.shelf.enabled = false;
  const c = continuity(() => null, vi.fn(), vi.fn());
  await c.ready;
  expect(mocks.shelf.setEnabled).toHaveBeenCalledWith(true);
  expect(mocks.lab.allowPersonaRecording).not.toHaveBeenCalled();
});

it('failed fresh admission preserves the running notebook receipts and recording-off state', async () => {
  const e = await envelope();
  const c = continuity(() => null, vi.fn(), vi.fn());
  await c.restore({ envelope: e, oneCast: [], ownedHeads: { [e.castId]: e }, recordingGroup: [e] });
  c.track();
  const stop = mocks.lab.trackRun.mock.results.at(-1)?.value;
  const before = c.data();
  mocks.shelf.request.mockRejectedValue(new Error('Continuity conflict'));
  await expect(c.fresh(123)).rejects.toThrow('Continuity conflict');
  expect(c.data()).toEqual(before);
  expect(stop).not.toHaveBeenCalled();
  expect(mocks.lab.telemetryOn).toBe(false);
});

it('re-enters the actual Pass-stamped claim of a current Neighbours source', async () => {
  const { readFileSync } = await import('node:fs');
  const { castForGame } = await import('@adam0white/lab-client');
  let head: PersonaEnvelope = JSON.parse(
    readFileSync(new URL('./fixtures/hf3-neighbours/ravi/persona.json', import.meta.url), 'utf8'),
  );
  mocks.shelf.request.mockImplementation(async (r) => {
    if (r.action === 'prepareBatch')
      return {
        expectedHeads: Object.fromEntries(
          castForGame('pass').map((c) => [c.castId, c.castId === head.castId ? head.revision : null]),
        ),
        inputs: [preparePersonaLife(head, 0)],
        blocked: [],
      };
    if (r.action === 'putBatch') {
      head = r.envelopes[0];
      return null;
    }
    return null;
  });
  const c = continuity(() => null, vi.fn(), vi.fn());
  await c.fresh(42);
  expect(head.source.game).toBe('pass');
  expect(head.source.engine).toBe('2.23.0');
  expect(head.transfer.castPassport).toBe('neighbours-cast/1');
  await expect(c.fresh(42)).resolves.toMatchObject({ version: 'pass@18' });
});

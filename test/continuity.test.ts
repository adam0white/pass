import {
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { beforeEach, expect, it, vi } from 'vitest';
import { required } from '../src/required.ts';
import { freshActor, kitchenTransfer } from '../src/sim/cast-chapter.ts';
import { hf4ReleaseProjection } from '../src/sim/hf4-cast.ts';
import { tick } from '../src/sim/hf4-person.ts';
import {
  boardDefaults,
  cloneState,
  newGame,
  queueInput,
  replay,
  restoreState,
  step,
} from '../src/sim/kitchen.ts';

const mocks = vi.hoisted(() => ({
  shelf: { ready: Promise.resolve(true), enabled: true, request: vi.fn(), setEnabled: vi.fn() },
  blockers: vi.fn((): string[] => []),
  close: vi.fn(),
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
vi.mock('@adam0white/lab-client', async (original) => {
  const actual = await original<typeof import('@adam0white/lab-client')>();
  mocks.close.mockImplementation(actual.closePersonaBranch);
  return {
    ...actual,
    personaChannel: () => mocks.shelf,
    portableWriteBlockers: mocks.blockers,
    closePersonaBranch: mocks.close,
    watchPersonaCheckpoint: vi.fn(),
  };
});
vi.mock('@adam0white/lab-kit', () => ({ personaControls: () => document.createElement('section') }));
vi.mock('../src/ui/lab.ts', () => ({ lab: mocks.lab }));

import { continuity } from '../src/ui/continuity.ts';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.blockers.mockReturnValue([]);
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
it('refuses an old incomplete passport before claiming any heads', async () => {
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
  await expect(c.fresh(42)).rejects.toThrow('omits the full retained history');
  const puts = mocks.shelf.request.mock.calls.filter(([r]) => r.action === 'putBatch');
  expect(puts).toHaveLength(0);
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

it('preserves a historical Neighbours source when its incomplete passport is refused', async () => {
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
  const before = structuredClone(head);
  await expect(c.fresh(42)).rejects.toThrow('omits the full retained history');
  expect(head).toEqual(before);
  expect(mocks.shelf.request.mock.calls.some(([r]) => r.action === 'putBatch')).toBe(false);
});

it('names skipped people and preserves their saved heads when the batch cannot claim them', async () => {
  const source = await envelope();
  const before = structuredClone(source);
  mocks.shelf.request.mockImplementation(async (request) => {
    if (request.action === 'prepareBatch')
      return {
        expectedHeads: Object.fromEntries(
          (await import('@adam0white/lab-client'))
            .castForGame('pass')
            .map((cast) => [cast.castId, cast.castId === source.castId ? source.revision : null]),
        ),
        inputs: [],
        blocked: [
          { castId: source.castId, reason: 'Hülya: saved history is read-only until another game is ready.' },
        ],
      };
    if (request.action === 'putBatch') {
      expect(request.envelopes).toEqual([]);
      return null;
    }
    return null;
  });
  const c = continuity(() => null, vi.fn(), vi.fn());
  const game = await c.fresh(42);
  expect(game.castChapter?.inputs).toEqual([]);
  expect(c.message).toContain('Hülya');
  expect(c.message).toMatch(/saved|history|story/i);
  expect(source).toEqual(before);
  expect(c.data().ownedHeads).toEqual({});
}, 120000);

// Synthetic peer status checks the host guard; it does not claim live peer readiness.
it.each([false, true])(
  'keeps a blocked current portable head unchanged, terminal=%s',
  async (terminal) => {
    const { hf4KitchenTransfer } = await import('../src/sim/hf4-cast.ts');
    const state = newGame(42, 'pass@19');
    const person = required(state.people.find((p) => p.id === 'selim'));
    const transfer = await hf4KitchenTransfer(person);
    const castId = 'hf.cast.selim.pass',
      branchId = 'guard-fixture';
    const parent = await createPersona({
      format: 'hf-persona/1',
      castId,
      castRevision: '1',
      branchId,
      parentRevision: null,
      source: { game: 'pass', build: 'fixture', engine: '4.8.1', rules: 'pass-19' },
      transfer: { ...transfer, life: initialPersonaLife(castId, branchId, 0) },
      limitations: transfer.limitations,
    });
    const before = structuredClone(parent);
    state.phase = 'evening';
    state.releasedCast = ['selim'];
    person.activity = null;
    if (terminal) person.body.alive = false;
    mocks.blockers.mockReturnValue(['repair']);
    const c = continuity(() => state, vi.fn(), vi.fn());
    await c.restore({
      envelope: null,
      oneCast: [],
      ownedHeads: { [castId]: parent },
      recordingGroup: [parent],
    });
    await c.checkpoint();
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.shelf.request.mock.calls.some(([r]) => r.action === 'put' || r.action === 'putBatch')).toBe(
      false,
    );
    expect(c.data().ownedHeads?.[castId]).toEqual(before);
    expect(c.message).toContain('Selim');
    expect(c.message).toContain('repair');
  },
  30000,
);

// Synthetic ready peers exercise the permitted host path; no live readiness is implied.
it('writes an eligible current portable checkpoint when the peer gate is open', async () => {
  const state = newGame(42, 'pass@19');
  const person = required(state.people.find((p) => p.id === 'selim'));
  state.phase = 'evening';
  state.releasedCast = ['selim'];
  person.activity = null;
  state.releasedCastProjections = { selim: hf4ReleaseProjection(person) };
  mocks.blockers.mockReturnValue([]);
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore();
  await c.checkpoint();
  const puts = mocks.shelf.request.mock.calls.filter(([r]) => r.action === 'put');
  expect(puts).toHaveLength(1);
  expect(required(puts[0])[0].envelope.castId).toBe('hf.cast.selim.pass');
  expect(c.data().ownedHeads?.['hf.cast.selim.pass']).toBeDefined();
}, 120000);

it('publishes the preserved release checkpoint after the live kitchen advances and reloads it', async () => {
  const { hf4KitchenTransfer } = await import('../src/sim/hf4-cast.ts');
  const state = newGame(42, 'pass@19');
  const person = required(state.people.find((p) => p.id === 'selim'));
  state.phase = 'evening';
  state.releasedCast = ['selim'];
  state.releasedCastProjections = { selim: hf4ReleaseProjection(person) };
  const release = await hf4KitchenTransfer(person);
  tick(person, person.now + 10);
  state.phase = 'service';
  expect((await hf4KitchenTransfer(person)).checkpoint.checkpointDigest).not.toBe(
    release.checkpoint.checkpointDigest,
  );
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore();
  await c.checkpoint();
  const saved = required(c.data().ownedHeads?.['hf.cast.selim.pass']);
  expect(saved.transfer.checkpoint).toEqual(release.checkpoint);
  await expect(c.restore(c.data(), false, true, state)).resolves.toBeUndefined();
}, 120000);

it('does not publish an HF4 release without its preserved checkpoint', async () => {
  const state = newGame(42, 'pass@19');
  state.phase = 'evening';
  state.releasedCast = ['selim'];
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore();
  await c.checkpoint();
  expect(mocks.shelf.request.mock.calls.some(([r]) => r.action === 'put')).toBe(false);
}, 120000);

it('replays and restores a release when the source cannot be projected', async () => {
  const state = newGame(42, 'pass@19');
  queueInput(state, { kind: 'board', rows: boardDefaults(state) });
  queueInput(state, { kind: 'open' });
  while (state.phase === 'service') step(state);
  queueInput(state, { kind: 'cast-release', who: 'selim' });
  expect(state.releasedCast).toContain('selim');
  const refusal = required(state.releasedCastProjections?.selim);
  expect(refusal).toHaveProperty('unavailable');
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore();
  await c.checkpoint();
  expect(mocks.shelf.request.mock.calls.some(([r]) => r.action === 'put')).toBe(false);
  expect(c.message).toContain('Selim');
  expect(c.message).toContain('cannot be saved');
  const restored = restoreState(JSON.parse(JSON.stringify(cloneState(state))));
  expect(restored.releasedCast).toContain('selim');
  expect(restored.releasedCastProjections?.selim).toEqual(refusal);
  const replayed = replay(state.seed, state.inputs, state.minute, state.version);
  expect(replayed.releasedCast).toContain('selim');
  expect(replayed.releasedCastProjections?.selim).toEqual(refusal);
}, 180000);

it('publishes the release projection even if the live person later dies', async () => {
  const state = newGame(42, 'pass@19');
  const person = required(state.people.find((p) => p.id === 'selim'));
  state.phase = 'evening';
  state.releasedCast = ['selim'];
  state.releasedCastProjections = { selim: hf4ReleaseProjection(person) };
  person.body.alive = false;
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore();
  await c.checkpoint();
  expect(c.data().ownedHeads?.['hf.cast.selim.pass']).toBeDefined();
  expect(c.data().ownedHeads?.['hf.cast.selim.pass']?.terminal).toBeFalsy();
}, 120000);

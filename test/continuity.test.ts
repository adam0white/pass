import { createHash } from 'node:crypto';
import { createPersona, type PersonaEnvelope } from '@adam0white/lab-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../src/sim/kitchen.ts';

const FIXTURE_EPOCH = createHash('sha256').update('hf-recording-epoch/1:fixture-player').digest('hex');

const mocks = vi.hoisted(() => ({
  shelf: { ready: Promise.resolve(true), enabled: true, request: vi.fn(), setEnabled: vi.fn() },
  controls: {} as { allowRecording?: (value: boolean) => void },
  lab: {
    trackRun: vi.fn(() => vi.fn()),
    setPersonaRecording: vi.fn(),
    allowPersonaRecording: vi.fn(),
    milestone: vi.fn(),
    build: () => ({ c: 'fixture' }),
    personaRecordingAllowed: false,
    playerId: 'fixture-player',
  },
}));
vi.mock('@adam0white/lab-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@adam0white/lab-client')>()),
  personaChannel: () => mocks.shelf,
  watchPersonaCheckpoint: vi.fn(),
}));
vi.mock('@adam0white/lab-kit', () => ({
  personaControls: (options: { allowRecording: (value: boolean) => void }) => {
    mocks.controls = options;
    return document.createElement('section');
  },
}));
vi.mock('../src/ui/lab.ts', () => ({ lab: mocks.lab }));
vi.mock('../src/sim/kitchen.ts', () => ({
  GAME_VERSION: 'pass@12',
  exportRun: (s: GameState) => ({ game: s.version, seed: s.seed, inputs: [], state: s }),
}));
vi.mock('../src/sim/one-cast.ts', () => ({
  ZEYNEP_CAST: 'hf.cast.zeynep.pass',
  zeynepDepartureStatus: () => ({ eligible: true }),
  projectZeynep: async (s: GameState) => ({
    person: { limitations: [] },
    checkpoint: { sourceNow: s.minute, checkpointDigest: `minute-${s.minute}` },
  }),
}));

import { continuity, guardedContinuity } from '../src/ui/continuity.ts';

const envelope = (parentRevision: string | null = null) =>
  createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.zeynep.pass',
    castRevision: '1',
    branchId: 'fixture-branch',
    parentRevision,
    source: { game: 'pass', build: 'fixture', engine: '2.14.1', rules: 'pass-12' },
    transfer: { person: {} },
    limitations: [],
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.shelf.ready = Promise.resolve(true);
  mocks.shelf.enabled = true;
  mocks.lab.personaRecordingAllowed = false;
  let key: string | null = null;
  mocks.lab.setPersonaRecording.mockImplementation((next) => {
    if (next !== key) mocks.lab.personaRecordingAllowed = false;
    key = next;
  });
  mocks.lab.allowPersonaRecording.mockImplementation((value) => {
    mocks.lab.personaRecordingAllowed = value;
  });
  mocks.shelf.request.mockImplementation(async (request) =>
    request.action === 'recording'
      ? {
          sameEpoch: true,
          recordingEpoch: FIXTURE_EPOCH,
          branchId: request.envelope?.branchId,
          revision: request.envelope?.revision,
        }
      : null,
  );
  Object.defineProperty(mocks.lab, 'playerId', {
    configurable: true,
    writable: true,
    value: 'fixture-player',
  });
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', {
    createElement: () => ({
      append: vi.fn(),
      setAttribute: vi.fn(),
      querySelectorAll: () => [],
      isConnected: false,
    }),
  });
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  });
});

describe('continuity upload gate and pinned checkpoints', () => {
  it('waits for central readiness before establishing a gate or recording association', async () => {
    let resolve!: (value: boolean) => void;
    mocks.shelf.ready = new Promise((r) => {
      resolve = r;
    });
    const c = continuity(() => null, vi.fn(), vi.fn());
    const pinned = await envelope();
    const restoring = c.restore({ envelope: pinned, oneCast: [] });
    expect(mocks.lab.setPersonaRecording).not.toHaveBeenCalled();
    resolve(true);
    await restoring;
    expect(mocks.lab.setPersonaRecording).toHaveBeenCalledWith(pinned.branchId);
    expect(mocks.lab.allowPersonaRecording).toHaveBeenCalledWith(true);
    expect(mocks.shelf.request).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'recording', envelope: pinned }),
    );
    expect(mocks.lab.trackRun).not.toHaveBeenCalled();
    c.track();
    expect(mocks.lab.trackRun).toHaveBeenCalledOnce();
  });

  it('uses the loaded pinned parent and serializes duplicate lifecycle checkpoints', async () => {
    const state = { version: 'pass@12', seed: 4, minute: 120, said: [] } as unknown as GameState;
    const c = continuity(() => state, vi.fn(), vi.fn());
    const pinned = await envelope();
    await c.restore({ envelope: pinned, oneCast: [] });
    await Promise.all([c.checkpoint(), c.checkpoint(), c.checkpoint()]);
    const puts = mocks.shelf.request.mock.calls
      .map(([request]) => request)
      .filter((request) => request.action === 'put');
    expect(puts).toHaveLength(1);
    expect(puts[0].envelope.parentRevision).toBe(pinned.revision);
    expect(puts[0].envelope.source.engine).toBe('2.14.1');
    expect(mocks.shelf.request.mock.calls.some(([request]) => request.action === 'get')).toBe(false);
    expect(c.data().oneCast).toHaveLength(1);
    expect(c.data().envelope?.revision).toBe((puts[0].envelope as PersonaEnvelope).revision);
  });

  it('does not trust a file recording association', async () => {
    const c = continuity(() => null, vi.fn(), vi.fn());
    await c.restore({ envelope: await envelope(), oneCast: [] }, true);
    expect(mocks.lab.setPersonaRecording).toHaveBeenCalledWith('fixture-branch');
    expect(mocks.shelf.request).toHaveBeenCalledWith(expect.objectContaining({ action: 'recording' }));
    expect(mocks.lab.allowPersonaRecording).toHaveBeenCalledWith(false);
    expect(mocks.lab.allowPersonaRecording).not.toHaveBeenCalledWith(true);
  });
});

it('refuses a return replay whose metadata would clear the imported-history recording gate', () => {
  const state = { returnChapter: { envelope: { branchId: 'retained-history' } } } as unknown as GameState;
  expect(() => guardedContinuity(state, undefined)).toThrow('last accepted');
  expect(() => guardedContinuity(state, { envelope: null, oneCast: [] })).toThrow('last accepted');
});

it('keeps an unresolved file linkage choice across a validated save reload', async () => {
  const original = continuity(() => null, vi.fn(), vi.fn());
  await original.restore({ envelope: await envelope(), oneCast: [] }, true);
  const saved = original.data();
  vi.clearAllMocks();
  const restored = continuity(() => null, vi.fn(), vi.fn());
  await restored.restore(saved);
  expect(mocks.lab.allowPersonaRecording).not.toHaveBeenCalledWith(true);
  expect(mocks.shelf.request).toHaveBeenCalledWith(expect.objectContaining({ action: 'recording' }));
});

it('gates raw source files before they have a portable person envelope', async () => {
  const c = continuity(() => null, vi.fn(), vi.fn());
  await c.restore(undefined, true);
  expect(mocks.lab.setPersonaRecording).toHaveBeenCalledWith(expect.stringMatching(/^pass-file-/));
  expect(mocks.lab.allowPersonaRecording).toHaveBeenCalledWith(false);
  expect(c.data().fileUnlinked).toBe(true);
  const saved = c.data();
  vi.clearAllMocks();
  await c.restore(saved, false, true);
  expect(mocks.lab.setPersonaRecording).toHaveBeenCalledWith(saved.recordingKey);
  expect(mocks.lab.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});

it('does not label an imported source checkpoint as authored history', async () => {
  const state = { version: 'pass@12', seed: 4, minute: 120, said: [] } as unknown as GameState;
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore(undefined, true);
  await c.checkpoint();
  expect(mocks.shelf.request).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'put', authored: false }),
  );
});

it('ignores a pending association after another gate or recording identity replaces it', async () => {
  let resolve!: (v: { sameEpoch: boolean }) => void;
  let queried!: () => void;
  const requested = new Promise<void>((r) => {
    queried = r;
  });
  mocks.shelf.request.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
        queried();
      }),
  );
  mocks.lab.personaRecordingAllowed = true;
  const c = continuity(() => null, vi.fn(), vi.fn());
  const restoring = c.restore({ envelope: await envelope(), oneCast: [] });
  await requested;
  await c.restore(undefined, true);
  resolve({ sameEpoch: true });
  await expect(restoring).rejects.toThrow('Another notebook');
  expect(mocks.lab.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});

it('keeps an authored saved run authored and retains its provisional gate key', async () => {
  const state = { version: 'pass@12', seed: 4, minute: 120, said: [] } as unknown as GameState;
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore();
  const saved = c.data();
  expect(saved.recordingKey).toMatch(/^pass-run-/);
  mocks.lab.personaRecordingAllowed = true;
  await c.restore(saved, false, true);
  expect(c.data().recordingKey).toBe(saved.recordingKey);
  await c.checkpoint();
  expect(mocks.shelf.request).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'put', authored: true }),
  );
});

it('a missing fresh arrival leaves an authored kitchen and resets file provenance', async () => {
  const state = { version: 'pass@12', seed: 4, minute: 120, said: [] } as unknown as GameState;
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore(undefined, true);
  expect(await c.fresh(vi.fn())).toBe(null);
  expect(c.data().importedHistory).toBe(false);
  expect(c.data().scope).toBe('shared');
  await c.checkpoint();
  expect(mocks.shelf.request).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'put', authored: true }),
  );
});

it('does not re-associate authored save history after recording identity changes', async () => {
  const state = { version: 'pass@12', seed: 4, minute: 120, said: [] } as unknown as GameState;
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore();
  const saved = c.data();
  mocks.lab.personaRecordingAllowed = false;
  await c.restore(saved, false, true);
  await c.checkpoint();
  expect(mocks.shelf.request).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'put', authored: false }),
  );
});

it('does not install a late fresh arrival over another loaded notebook', async () => {
  let resolve!: (v: PersonaEnvelope | null) => void;
  let queried!: () => void;
  const requested = new Promise<void>((r) => {
    queried = r;
  });
  mocks.shelf.request.mockImplementation((request) =>
    request.action === 'get'
      ? new Promise((r) => {
          resolve = r;
          queried();
        })
      : Promise.resolve(null),
  );
  const c = continuity(() => null, vi.fn(), vi.fn());
  const arriving = c.fresh(vi.fn());
  const rejected = expect(arriving).rejects.toThrow('Another notebook');
  await requested;
  await c.restore(undefined, true);
  const loaded = c.data();
  resolve(null);
  await rejected;
  expect(c.data()).toEqual(loaded);
});

it('invalidates pending central consent on cross-tab storage changes', async () => {
  let resolve!: (v: { sameEpoch: boolean }) => void;
  let queried!: () => void;
  const requested = new Promise<void>((r) => {
    queried = r;
  });
  mocks.shelf.request.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
        queried();
      }),
  );
  mocks.lab.personaRecordingAllowed = true;
  const c = continuity(() => null, vi.fn(), vi.fn());
  const restoring = c.restore({ envelope: await envelope(), oneCast: [] });
  await requested;
  window.dispatchEvent(new Event('storage'));
  mocks.lab.personaRecordingAllowed = false;
  resolve({ sameEpoch: true });
  await restoring;
  expect(mocks.lab.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});

it('does not trust an old active-head-only bridge response for a pinned branch', async () => {
  mocks.shelf.request.mockResolvedValue({ sameEpoch: true });
  const c = continuity(() => null, vi.fn(), vi.fn());
  await c.restore({ envelope: await envelope(), oneCast: [] });
  expect(mocks.lab.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});

it('sends the acknowledged epoch on authored put without saving the private token', async () => {
  const state = { version: 'pass@12', seed: 4, minute: 120, said: [] } as unknown as GameState;
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore();
  await c.checkpoint();
  expect(mocks.shelf.request).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'put', authored: true, recordingEpoch: FIXTURE_EPOCH }),
  );
  expect(JSON.stringify(c.data())).not.toContain('recordingEpoch');
  expect(JSON.stringify(c.run())).not.toContain(FIXTURE_EPOCH);
});

it('does not renew source authorship when identity changes while its initial epoch query is pending', async () => {
  let resolve!: (value: { recordingEpoch: string }) => void;
  let queried!: () => void;
  const requested = new Promise<void>((r) => {
    queried = r;
  });
  mocks.shelf.request.mockImplementation((request) => {
    if (request.action === 'recording' && !request.envelope)
      return new Promise((r) => {
        resolve = r;
        queried();
      });
    return Promise.resolve(
      request.action === 'recording'
        ? {
            sameEpoch: false,
            branchId: request.envelope.branchId,
            revision: request.envelope.revision,
            recordingEpoch: 'b'.repeat(64),
          }
        : null,
    );
  });
  const state = { version: 'pass@12', seed: 4, minute: 120, said: [] } as unknown as GameState;
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore();
  const saving = c.checkpoint();
  await requested;
  mocks.lab.personaRecordingAllowed = false;
  window.dispatchEvent(new Event('hf-lab-preference'));
  resolve({ recordingEpoch: FIXTURE_EPOCH });
  await saving;
  expect(mocks.shelf.request).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'put', authored: false, recordingEpoch: undefined }),
  );
  expect(mocks.shelf.request.mock.calls.some(([request]) => request.allowRecording === true)).toBe(false);
});

it('never refreshes earlier source consent after central identity changes before host notification', async () => {
  let changed = false;
  mocks.shelf.request.mockImplementation(async (request) => {
    if (request.action === 'put') {
      changed = true;
      return request.envelope;
    }
    if (request.action !== 'recording') return null;
    if (request.allowRecording === true) throw new Error('Stale original epoch rejected centrally');
    return {
      sameEpoch: false,
      branchId: request.envelope?.branchId,
      revision: request.envelope?.revision,
      recordingEpoch: changed ? 'b'.repeat(64) : FIXTURE_EPOCH,
    };
  });
  const state = { version: 'pass@12', seed: 4, minute: 120, said: [] } as unknown as GameState;
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore();
  await c.checkpoint();
  const grants = mocks.shelf.request.mock.calls.map(([r]) => r).filter((r) => r.allowRecording === true);
  expect(grants).toHaveLength(0);
  expect(mocks.lab.allowPersonaRecording).toHaveBeenLastCalledWith(false);
  expect(JSON.stringify(c.data())).not.toContain('recordingEpoch');
});

it('refuses a new central epoch when the approved local identity has not received the reset yet', async () => {
  mocks.shelf.request.mockImplementation(async (request) =>
    request.action === 'recording'
      ? {
          sameEpoch: true,
          branchId: request.envelope?.branchId,
          revision: request.envelope?.revision,
          recordingEpoch: 'b'.repeat(64),
        }
      : null,
  );
  const state = { version: 'pass@12', seed: 4, minute: 120, said: [] } as unknown as GameState;
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore();
  await c.checkpoint();
  expect(mocks.shelf.request).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'put', authored: false }),
  );
  expect(mocks.shelf.request.mock.calls.some(([r]) => r.allowRecording === true)).toBe(false);
  vi.clearAllMocks();
  mocks.lab.personaRecordingAllowed = false;
  await c.restore({ envelope: await envelope(), oneCast: [] });
  expect(mocks.lab.allowPersonaRecording).not.toHaveBeenCalledWith(true);
});

it('revokes an existing local branch allowance when the bridge proves a different identity', async () => {
  const c = continuity(() => null, vi.fn(), vi.fn());
  const pin = await envelope();
  await c.restore({ envelope: pin, oneCast: [] });
  expect(mocks.lab.personaRecordingAllowed).toBe(true);
  mocks.shelf.request.mockResolvedValue({
    sameEpoch: true,
    branchId: pin.branchId,
    revision: pin.revision,
    recordingEpoch: 'b'.repeat(64),
  });
  await c.restore({ envelope: pin, oneCast: [] });
  expect(mocks.lab.personaRecordingAllowed).toBe(false);
});

it('retains explicit recording from a menu opened before the source checkpoint arrived', async () => {
  Object.defineProperty(mocks.lab, 'playerId', {
    configurable: true,
    get: () => (mocks.lab.personaRecordingAllowed ? 'fixture-player' : null),
  });
  const state = { version: 'pass@12', seed: 4, minute: 120, said: [] } as unknown as GameState;
  const c = continuity(() => state, vi.fn(), vi.fn());
  await c.restore(undefined, true);
  c.controls();
  await c.checkpoint();
  mocks.controls.allowRecording?.(true);
  await vi.waitFor(() =>
    expect(
      mocks.shelf.request.mock.calls.some(
        ([r]) => r.action === 'recording' && r.allowRecording === true && r.recordingEpoch === FIXTURE_EPOCH,
      ),
    ).toBe(true),
  );
});

import { createPersona, type PersonaEnvelope } from '@adam0white/lab-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../src/sim/kitchen.ts';

const mocks = vi.hoisted(() => ({
  shelf: { ready: Promise.resolve(true), enabled: true, request: vi.fn(), setEnabled: vi.fn() },
  lab: {
    trackRun: vi.fn(() => vi.fn()),
    setPersonaRecording: vi.fn(),
    allowPersonaRecording: vi.fn(),
    milestone: vi.fn(),
    build: () => ({ c: 'fixture' }),
    personaRecordingAllowed: false,
  },
}));
vi.mock('@adam0white/lab-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@adam0white/lab-client')>()),
  personaChannel: () => mocks.shelf,
  watchPersonaCheckpoint: vi.fn(),
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
  mocks.shelf.request.mockImplementation(async (request) =>
    request.action === 'recording' ? { sameEpoch: true } : null,
  );
  vi.stubGlobal('window', new EventTarget());
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
    expect(mocks.shelf.request).not.toHaveBeenCalled();
    expect(mocks.lab.allowPersonaRecording).toHaveBeenCalledWith(false);
    expect(mocks.lab.allowPersonaRecording).not.toHaveBeenCalledWith(true);
  });
});

it('refuses a return replay whose metadata would clear the imported-history recording gate', () => {
  const state = { returnChapter: { envelope: { branchId: 'retained-history' } } } as unknown as GameState;
  expect(() => guardedContinuity(state, undefined)).toThrow('last accepted');
  expect(() => guardedContinuity(state, { envelope: null, oneCast: [] })).toThrow('last accepted');
});

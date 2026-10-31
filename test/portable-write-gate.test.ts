import {
  castForGame,
  createPersona,
  initialPersonaLife,
  portableWriteBlockers,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { beforeEach, expect, it, vi } from 'vitest';
import { required } from '../src/required.ts';
import { hf4KitchenTransfer } from '../src/sim/hf4-cast.ts';
import { freshCommunity } from '../src/sim/hf4-person.ts';
import { newGame } from '../src/sim/kitchen.ts';

const mocks = vi.hoisted(() => ({
  shelf: { ready: Promise.resolve(true), enabled: true, request: vi.fn(), setEnabled: vi.fn() },
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
    closePersonaBranch: mocks.close,
    watchPersonaCheckpoint: vi.fn(),
  };
});
vi.mock('@adam0white/lab-kit', () => ({ personaControls: () => document.createElement('section') }));
vi.mock('../src/ui/lab.ts', () => ({ lab: mocks.lab }));

import { continuity } from '../src/ui/continuity.ts';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', new EventTarget());
  mocks.shelf.enabled = true;
  mocks.shelf.request.mockResolvedValue(null);
});

async function fixture() {
  const state = newGame(42, 'pass@20');
  const person = required(state.people.find((p) => p.id === 'rafi'));
  const sourcePerson = required(freshCommunity(42).people.find((p) => p.id === 'rafi'));
  const transfer = await hf4KitchenTransfer(sourcePerson);
  const castId = 'hf.cast.rafi.pass',
    branchId = 'gate-fixture';
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId,
    castRevision: '1',
    branchId,
    parentRevision: null,
    source: { game: 'pass', build: 'fixture', engine: '4.12.0', rules: 'pass-19' },
    transfer: { ...transfer, life: initialPersonaLife(castId, branchId, 0) },
    limitations: transfer.limitations,
  });
  return { state, person, castId, parent };
}

it('uses the actual SDK gate to skip a named person and preserve the saved head', async () => {
  const { parent, castId } = await fixture();
  const before = structuredClone(parent);
  expect(portableWriteBlockers(castId, 'pass')).toContain('repair');
  mocks.shelf.request.mockImplementation(async (request) => {
    if (request.action === 'prepareBatch')
      return {
        expectedHeads: Object.fromEntries(
          castForGame('pass').map((cast) => [cast.castId, cast.castId === castId ? parent.revision : null]),
        ),
        inputs: [preparePersonaLife(parent, 0)],
        blocked: [],
      };
    if (request.action === 'putBatch') {
      expect(request.envelopes).toEqual([]);
      return null;
    }
    return null;
  });
  const c = continuity(() => null, vi.fn(), vi.fn());
  const game = await c.fresh(43);
  expect(game.castChapter?.inputs).toEqual([]);
  expect(c.message).toContain('Rafi');
  expect(parent).toEqual(before);
  expect(c.data().ownedHeads).toEqual({});
}, 120000);

it.each([false, true])(
  'uses the actual SDK gate before portable writes, terminal=%s',
  async (terminal) => {
    const { state, person, castId, parent } = await fixture();
    const before = structuredClone(parent);
    expect(portableWriteBlockers(castId, 'pass')).toContain('repair');
    state.phase = 'evening';
    state.releasedCast = ['rafi'];
    person.activity = null;
    if (terminal) person.body.alive = false;
    const c = continuity(() => state, vi.fn(), vi.fn());
    await c.restore({
      authority: 'pass-authority/1',
      skipped: [],
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
    expect(c.message).toContain('Rafi');
  },
  30000,
);

it('skips host-unsupported v1 and an occupied person before one whole-head CAS, then pins only their refusals', async () => {
  const { parent: rafi } = await fixture();
  const person = required(freshCommunity(42).people.find((p) => p.id === 'selim'));
  const transfer = structuredClone(await hf4KitchenTransfer(person));
  const { retained: _retained, ...approximate } = transfer.portable;
  const { revision: _sourceRevision, ...sourceBody } = rafi;
  const selim = await createPersona({
    ...sourceBody,
    castId: 'hf.cast.selim.pass',
    branchId: 'v1-reader',
    transfer: {
      ...transfer,
      castPassport: 'hf-portable-person/1',
      portable: { ...approximate, version: 1 },
      life: initialPersonaLife('hf.cast.selim.pass', 'v1-reader', 0),
    },
  });
  const { revision: _revision, ...occupiedBody } = rafi;
  const occupied = await createPersona({
    ...occupiedBody,
    transfer: { ...rafi.transfer, portableClaim: { game: 'repair' } },
  });
  const originals = structuredClone([selim, occupied]);
  const expectedHeads = Object.fromEntries(
    castForGame('pass').map((cast) => [
      cast.castId,
      originals.find((p) => p.castId === cast.castId)?.revision ?? null,
    ]),
  );
  mocks.shelf.request.mockImplementation(async (request) => {
    if (request.action === 'prepareBatch')
      return { expectedHeads, inputs: originals.map((p) => preparePersonaLife(p, 0)), blocked: [] };
    if (request.action === 'putBatch') {
      expect(request.expectedHeads).toEqual(expectedHeads);
      expect(request.envelopes).toEqual([]);
      return null;
    }
    throw new Error('A skipped identity must not write.');
  });
  let state: ReturnType<typeof newGame> | null = null;
  const c = continuity(() => state, vi.fn(), vi.fn());
  state = await c.fresh(43);
  expect(c.message).toContain('Selim');
  expect(c.message).toContain('Rafi');
  expect(c.message).not.toContain('hf-portable');
  const saved = c.data();
  expect(saved).toMatchObject({
    skipped: [
      { castId: 'hf.cast.rafi.pass', reason: expect.any(String) },
      { castId: 'hf.cast.selim.pass', reason: expect.any(String) },
    ],
    ownedHeads: {},
    recordingGroup: [],
  });
  expect(state.castChapter?.inputs).toEqual([]);
  expect(JSON.stringify(c.run())).not.toContain('v1-reader');
  expect([selim, occupied]).toEqual(originals);
  await c.restore(saved, false, true, state);
  expect(c.message).toContain('Selim');
  expect(c.data().skipped).toEqual(saved.skipped);
  state.phase = 'evening';
  const project = vi.fn(() => {
    throw new Error('Skipped projection was inspected.');
  });
  Object.defineProperty(state, 'releasedCastProjections', { get: project });
  const { queueInput } = await import('../src/sim/kitchen.ts');
  queueInput(state, { kind: 'cast-release', who: 'selim' });
  expect(state.releasedCast).toContain('selim');
  await c.checkpoint();
  expect(project).not.toHaveBeenCalled();
  required(state.people.find((p) => p.id === 'selim')).body.alive = false;
  await c.checkpoint();
  expect(mocks.close).not.toHaveBeenCalled();
  expect(mocks.shelf.request.mock.calls.map(([r]) => r.action)).toEqual(['prepareBatch', 'putBatch']);
  await expect(c.restore({ ...saved, ownedHeads: { [selim.castId]: selim } })).rejects.toThrow('skipped');
  await expect(c.restore({ ...saved, recordingGroup: [selim] })).rejects.toThrow('skipped');
}, 120000);

it('refuses a baseline-shaped skipped notebook before activation even with a future open peer gate', async () => {
  const state = newGame(42, 'pass@20');
  // Actual production unknown999 notebooks used this empty chapter and omitted both denial lists.
  state.castChapter = {
    version: 'pass-cast/2',
    plainNarration: true,
    seed: 42,
    inputs: [],
    actors: {},
    facts: {},
    portable: {},
    claims: [],
  };
  const old = { envelope: null, oneCast: [], ownedHeads: {}, recordingGroup: [] };
  const before = JSON.stringify({ state, old });
  const c = continuity(() => state, vi.fn(), vi.fn());
  expect(portableWriteBlockers('hf.cast.selim.pass', 'pass')).toEqual([]);
  await expect(c.restore(old, false, true, state)).rejects.toThrow(
    'This file cannot continue in this version of The Pass. Keep it and start a fresh game.',
  );
  expect(() => c.assertActive(state)).toThrow(
    'This file cannot continue in this version of The Pass. Keep it and start a fresh game.',
  );
  c.track();
  expect(mocks.lab.trackRun).not.toHaveBeenCalled();
  expect(c.run()).toBeNull();
  await c.checkpoint();
  expect(mocks.shelf.request).not.toHaveBeenCalled();
  expect(JSON.stringify({ state, old })).toBe(before);
  const project = vi.fn(() => {
    throw new Error('Source staged');
  });
  Object.defineProperty(state, 'releasedCastProjections', { get: project });
  state.phase = 'evening';
  const { queueInput } = await import('../src/sim/kitchen.ts');
  queueInput(state, { kind: 'cast-release', who: 'selim' });
  expect(state.releasedCast).toContain('selim');
  expect(project).not.toHaveBeenCalled();
  await c.checkpoint();
  required(state.people.find((p) => p.id === 'selim')).body.alive = false;
  await c.checkpoint();
  expect(mocks.close).not.toHaveBeenCalled();
  expect(mocks.shelf.request).not.toHaveBeenCalled();
}, 30000);

it.each(['save-only', 'disagreement'])(
  'refuses %s denial information before activation',
  async (kind) => {
    const state = newGame(42, 'pass@20');
    const value = {
      authority: 'pass-authority/1' as const,
      envelope: null,
      oneCast: [],
      skipped: [{ castId: 'hf.cast.selim.pass', reason: 'Saved refusal' }],
    };
    if (kind === 'save-only') delete required(state.castChapter).skipped;
    const c = continuity(() => state, vi.fn(), vi.fn());
    await expect(c.restore(value, false, true, state)).rejects.toThrow(
      'This file cannot continue in this version of The Pass. Keep it and start a fresh game.',
    );
    c.track();
    expect(mocks.lab.trackRun).not.toHaveBeenCalled();
    expect(() => c.assertActive(state)).toThrow(
      'This file cannot continue in this version of The Pass. Keep it and start a fresh game.',
    );
    await c.checkpoint();
    expect(c.run()).toBeNull();
    expect(mocks.shelf.request).not.toHaveBeenCalled();
  },
  30000,
);

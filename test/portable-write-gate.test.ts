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
  const state = newGame(42, 'pass@19');
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

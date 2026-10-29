import { createHash } from 'node:crypto';
import {
  type Affordance,
  begin,
  decide,
  finish,
  promise,
  snapshot,
  tick,
} from '@adam0white/human-framework-legacy';
import { canonicalPersona, createPersona } from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import { required } from '../src/required.ts';
import { prepareReturn, replayExport } from '../src/sim/continuation.ts';
import { HIRES, makeHire } from '../src/sim/cooks.ts';
import {
  boardDefaults,
  cloneState,
  exportRun,
  newGame,
  queueInput,
  replay,
  step,
} from '../src/sim/kitchen.ts';
import { projectZeynep, returnedZeynep, ZEYNEP_CAST, zeynepDepartureStatus } from '../src/sim/one-cast.ts';

/** Synthetic API fixture for host mapping tests, never evidence of a played kitchen journey. */
function source() {
  const s = newGame(7, 'pass@12');
  const p = makeHire(required(HIRES.find((h) => h.id === 'zeynep')), 7, 1050, 'pass@12');
  const act = (action: string, at: number, duration: number) => {
    tick(p, at);
    const a: Affordance = {
      id: action,
      action,
      label: action,
      duration,
      effort: 0,
      advertises: {},
      ...(action === 'cold' ? { skill: { id: 'cold', difficulty: 0.3 } } : {}),
    };
    const record = decide(p, [a], { now: at });
    expect(begin(p, a, record)).toBeTruthy();
    tick(p, at + duration);
    finish(p, { affordanceId: action, action, status: 'completed', at: at + duration });
  };
  act('cold', 1060, 5);
  act('home', 1290, 30);
  tick(p, 1390);
  s.people.push(p);
  s.crew.push({ id: 'zeynep', name: 'Zeynep', home: 'cold', founder: false, since: 1, wage: 70 });
  s.phase = 'evening';
  s.minute = 1390;
  return s;
}

describe('Zeynep chapter adapter (synthetic technical fixtures)', () => {
  it('requires the recorded source release and carries only cold, work and the exact family recurrence', async () => {
    const s = source();
    expect(zeynepDepartureStatus(s)).toMatchObject({ canRelease: true, eligible: false });
    await expect(projectZeynep(s)).rejects.toThrow('release');
    queueInput(s, { kind: 'zeynep-release' });
    expect(zeynepDepartureStatus(s)).toMatchObject({ eligible: true, canRelease: false });
    const before = snapshot(required(s.people.find((p) => p.id === 'zeynep')));
    const transfer = await projectZeynep(s);
    expect(Object.keys(transfer.person.skills)).toEqual(['cold']);
    expect(transfer.person.skills.cold).toEqual(before.skills.cold);
    expect(transfer.person.rng).toEqual(before.rng);
    expect(transfer.person.traits).toEqual(before.traits);
    expect(transfer.person.values).toEqual(before.values);
    expect(transfer.person.commitments).toHaveLength(1);
    expect(transfer.person.commitments[0]).toMatchObject({
      actions: ['leave-for-home'],
      toId: 'sons',
      from: 4170,
      until: 4210,
      importance: 0.7,
      recurEvery: 1440,
      status: 'pending',
    });
    expect(transfer.admission.familyHistory.status).toBe('kept');
    expect(transfer.history).toHaveLength(1);
    expect(transfer.checkpoint.checkpointDigest).toBe(
      createHash('sha256').update(canonicalPersona(before)).digest('hex'),
    );
    expect(snapshot(required(s.people.find((p) => p.id === 'zeynep')))).toEqual(before);
    expect(transfer.person.limitations).toEqual(
      expect.arrayContaining(['skill:grill', 'skill:dish', 'skill:oven']),
    );
  });

  it('blocks absent home, active work, unsupported obligations and changed family clock', async () => {
    const s = source();
    const p = required(s.people.find((p) => p.id === 'zeynep'));
    const home = required(p.memory.episodes.find((e) => e.action === 'home'));
    p.memory.episodes = p.memory.episodes.filter((e) => e !== home);
    expect(zeynepDepartureStatus(s).canRelease).toBe(false);
    p.memory.episodes.push(home);
    queueInput(s, { kind: 'zeynep-release' });
    await expect(projectZeynep(s, 570)).rejects.toThrow('local family clock');
    promise(p, {
      kind: 'promise',
      actions: ['call'],
      toId: 'friend',
      from: 1440,
      until: 1500,
      importance: 0.5,
    });
    expect(zeynepDepartureStatus(s).eligible).toBe(false);
    await expect(projectZeynep(s)).rejects.toThrow('unmapped obligation');
  });

  it('admits a detached return with family and cold; no kitchen job is invented', async () => {
    const s = source();
    queueInput(s, { kind: 'zeynep-release' });
    const transfer = await projectZeynep(s);
    const projection = structuredClone(transfer.person);
    projection.mappingVersion = 'goodhands-zeynep/1';
    projection.source.id = 'zeynep-pass';
    required(projection.episodes[0]).id = 'goodhands-encounter';
    required(projection.commitments[0]).actions = ['home'];
    const envelope = await createPersona({
      format: 'hf-persona/1',
      castId: ZEYNEP_CAST,
      castRevision: '1',
      branchId: 'test-branch',
      parentRevision: null,
      source: { game: 'goodhands', build: 'test', engine: '2.14.1', rules: 'goodhands-5' },
      transfer: {
        ...transfer,
        person: projection,
        history: [
          {
            id: 'goodhands-encounter',
            summary: required(projection.episodes[0]).summary,
            at: required(projection.episodes[0]).at,
            sourceGame: 'goodhands',
            sourceEpisodeId: 'e1',
          },
        ],
      },
      limitations: projection.limitations,
    });
    const opening = required(s.people.find((p) => p.id === 'zeynep'));
    const before = snapshot(opening);
    const returned = returnedZeynep(envelope, opening);
    expect(returned).not.toBe(opening);
    expect(returned.agenda.commitments.every((c) => c.actions.join(',') === 'home')).toBe(true);
    expect(returned.skills).toEqual(projection.skills);
    expect(snapshot(opening)).toEqual(before);
    const bad = structuredClone(envelope);
    bad.transfer.person = { ...projection, skills: { cooking: projection.skills.cold } };
    expect(() => returnedZeynep(bad, opening)).toThrow('Unsupported');
  });
});

function ordinarySource() {
  const s = newGame(42, 'pass@12');
  queueInput(s, { kind: 'pace', value: 'nevin' });
  for (let guard = 0; guard < 6000 && s.phase !== 'end'; guard++) {
    if (s.phase === 'board') {
      queueInput(s, { kind: 'board', rows: boardDefaults(s) });
      queueInput(s, { kind: 'open' });
    } else if (s.phase === 'sunday') {
      if (s.sunday?.candidates.includes('zeynep'))
        queueInput(s, { kind: 'choose', key: 'hire', value: 'zeynep' });
      queueInput(s, { kind: 'open' });
    } else if (s.phase === 'evening') {
      if (zeynepDepartureStatus(s).canRelease) {
        queueInput(s, { kind: 'zeynep-release' });
        break;
      }
      if (s.night === 3) queueInput(s, { kind: 'jar', choice: 'talk' });
      queueInput(s, { kind: 'open' });
    } else {
      if (s.request?.state === 'asking') queueInput(s, { kind: 'answer', choice: 'yes' });
      if (s.people.some((p) => p.id === 'zeynep') && s.minute % 1440 === 1290)
        queueInput(s, { kind: 'ask', cook: 'zeynep', verb: 'home' });
      step(s);
    }
  }
  return s;
}

it('replays an ordinary played stint through the actual source departure', async () => {
  const s = ordinarySource();
  expect(s.night).toBe(11);
  expect(zeynepDepartureStatus(s).eligible).toBe(true);
  const transfer = await projectZeynep(s);
  expect(transfer.history[0]?.summary).toContain('completed');
  expect(transfer.admission.familyHistory.status).toBe('kept');
  expect(cloneState(replay(s.seed, s.inputs, s.minute, s.version))).toEqual(cloneState(s));
});

it('pins a new return chapter and rejects changed initial state (synthetic receiving fact)', async () => {
  const source = ordinarySource();
  const transfer = await projectZeynep(source);
  const departureEnvelope = await createPersona({
    format: 'hf-persona/1',
    castId: ZEYNEP_CAST,
    castRevision: '1',
    branchId: 'synthetic-return',
    parentRevision: null,
    source: { game: 'pass', build: 'test', engine: '2.14.1', rules: 'pass-12' },
    transfer,
    limitations: transfer.person.limitations,
  });
  const prefix = { ...exportRun(source, '2.15.0'), continuity: { envelope: departureEnvelope, oneCast: [] } };
  const p = structuredClone(transfer.person);
  const offset = transfer.admission.targetOpening - p.source.now;
  p.life.bornAt += offset;
  p.source.now += offset;
  p.source.id = 'zeynep-pass';
  p.mappingVersion = 'goodhands-zeynep/1';
  for (const skill of Object.values(p.skills)) skill.lastPracticed += offset;
  required(p.skills.cold).level = Math.min(1, required(p.skills.cold).level + 0.02);
  p.health.fitness = Math.min(1, p.health.fitness + 0.01);
  for (const episode of p.episodes) {
    episode.at += offset;
    if (episode.recalledAt !== undefined) episode.recalledAt += offset;
  }
  required(p.episodes[0]).id = 'goodhands-encounter';
  required(p.episodes[0]).summary =
    'Synthetic receiving fixture: the household reported the actual trial answer.';
  required(p.commitments[0]).actions = ['home'];
  const e = required(p.episodes[0]);
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: ZEYNEP_CAST,
    castRevision: '1',
    branchId: 'synthetic-return',
    parentRevision: null,
    source: { game: 'goodhands', build: 'test', engine: '2.14.1', rules: 'goodhands-5' },
    transfer: {
      admission: {
        sourceRevision: departureEnvelope.revision,
        sourceCheckpointDigest: transfer.checkpoint.checkpointDigest,
      },
      person: p,
      history: [{ id: e.id, summary: e.summary, at: e.at, sourceGame: 'goodhands', sourceEpisodeId: 'e1' }],
      checkpoint: { ...transfer.checkpoint, sourceNow: p.source.now, sourceRng: p.rng },
    },
    limitations: p.limitations,
  });
  const returned = await prepareReturn(envelope, prefix);
  expect(returned.phase).toBe('return');
  await expect(prepareReturn({ ...envelope, branchId: 'another-branch' }, prefix)).rejects.toThrow();
  expect(
    required(returned.people.find((p) => p.id === 'zeynep')).agenda.commitments.every(
      (c) => c.toId === 'sons',
    ),
  ).toBe(true);
  const full = JSON.parse(JSON.stringify(exportRun(returned, '2.14.1')));
  expect(cloneState(replayExport(full))).toEqual(cloneState(returned));
  const compact = {
    game: full.game,
    seed: full.seed,
    inputs: full.inputs,
    minute: returned.minute,
    returnChapter: full.returnChapter,
  };
  expect(cloneState(replayExport(compact))).toEqual(cloneState(returned));
  const bad = structuredClone(compact);
  required(required(bad.returnChapter).initial.skills.cold).level = 0;
  expect(() => replayExport(bad)).toThrow('pinned return Person');
});

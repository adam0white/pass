/** Zeynep's explicit chapter boundary. Full kitchen checkpoints stay in local replays. */
import {
  admitPersona,
  type Commitment,
  createAgenda,
  type Episode,
  type Person,
  type PersonaProjection,
  type PersonaProjectionSnapshot,
  projectPersona,
  releaseCommitment,
  restore,
  snapshot,
  validatePersonaProjection,
} from '@adam0white/human-framework-legacy';
import { canonicalPersona, type PersonaEnvelope } from '@adam0white/lab-client';
import { required } from '../required.ts';
import type { GameState } from './kitchen.ts';

export const ZEYNEP_CAST = 'hf.cast.zeynep.pass';
export const ZEYNEP_MAPPING = 'pass-zeynep/1';
export interface ZeynepTransfer extends Record<string, unknown> {
  person: PersonaProjectionSnapshot;
  history: { id: string; summary: string; at: number; sourceGame: string; sourceEpisodeId: string }[];
  checkpoint: {
    sourceSchema: Person['schema'];
    sourceNow: number;
    sourceRng: Person['rng'];
    checkpointDigest: string;
  };
  admission: {
    adapter: 'pass-zeynep/1';
    targetOpening: number;
    familyHistory: { status: 'kept' | 'broken'; from: number; until: number };
  };
}
const family = (c: Commitment, action = 'home') =>
  c.kind === 'promise' &&
  c.toId === 'sons' &&
  c.actions.join(',') === action &&
  c.from % 1440 === 1290 &&
  c.until - c.from === 40 &&
  c.importance === 0.7 &&
  c.recurEvery === 1440 &&
  !c.normId &&
  !c.targetId;
const shift = (c: Commitment) => c.toId === 'chef' && c.label === 'my shift' && c.recurEvery === 1440;
const completed = (p: Person, action: string): Episode | undefined =>
  [...p.memory.episodes]
    .reverse()
    .find(
      (e) =>
        e.kind === 'outcome' &&
        e.actorId === p.id &&
        e.action === action &&
        e.tags.includes('completed') &&
        e.at <= p.now,
    );
const personOf = (s: GameState) => s.people.find((p) => p.id === 'zeynep');

export function zeynepDepartureStatus(s: GameState): {
  canRelease: boolean;
  eligible: boolean;
  reasons: string[];
} {
  if (s.version === 'pass@19')
    return { canRelease: false, eligible: false, reasons: ['Use the current kitchen release control.'] };
  const reasons: string[] = [];
  const p = personOf(s);
  if (s.version !== 'pass@12') reasons.push('This kitchen edition has no guest chapter.');
  if (!p || !s.crew.some((c) => c.id === 'zeynep')) reasons.push('Zeynep has not worked in this kitchen.');
  if (!p) return { canRelease: false, eligible: false, reasons };
  if (!['evening', 'sunday', 'end'].includes(s.phase))
    reasons.push('Finish the service before ending the stint.');
  if (p.activity) reasons.push('Zeynep is still doing something.');
  if (!completed(p, 'cold'))
    reasons.push('No completed, attended cold-station work remains in this chapter.');
  if (!completed(p, 'home')) reasons.push('No completed journey home remains in this chapter.');
  if (!p.agenda.commitments.some((c) => family(c) && ['kept', 'broken'].includes(c.status)))
    reasons.push('The previous family promise result is not established.');
  const released =
    p.agenda.commitments.some((c) => shift(c) && c.status === 'released') &&
    !p.agenda.commitments.some((c) => shift(c) && c.status === 'pending') &&
    s.inputs.some((i) => i.kind === 'zeynep-release');
  const canRelease =
    reasons.length === 0 &&
    !released &&
    p.agenda.commitments.some((c) => shift(c) && ['pending', 'released'].includes(c.status));
  if (!released) reasons.push('Chef must explicitly release the recurring kitchen shift.');
  if (reasons.length === 0) {
    try {
      projection(p, 1440 + (p.now % 1440));
    } catch (error) {
      reasons.push(error instanceof Error ? error.message : 'Unsupported source obligation.');
    }
  }
  return { canRelease, eligible: reasons.length === 0, reasons };
}

/** Called only by the replayed zeynep-release input, after ordinary service/home outcomes. */
export function releaseZeynepStint(s: GameState): boolean {
  if (!zeynepDepartureStatus(s).canRelease) return false;
  const p = required(personOf(s));
  for (const c of p.agenda.commitments) if (shift(c) && c.status === 'pending') releaseCommitment(p, c.id);
  const member = required(s.crew.find((c) => c.id === 'zeynep'));
  member.left = {
    night: s.night,
    words: 'Chef released me from my kitchen shifts. Now I can take a daytime job near my boys.',
  };
  const cook = s.cooks.find((c) => c.id === 'zeynep');
  if (cook) {
    cook.gone = true;
    cook.here = false;
  }
  s.said.push({
    at: s.minute,
    who: 'chef',
    kind: 'journal',
    text: 'Your time in this kitchen is finished, Zeynep. You don’t need to come in for your shifts any more.',
  });
  return true;
}

function projection(p: Person, targetOpening: number): PersonaProjectionSnapshot {
  if ((targetOpening - p.now) % 1440 !== 0)
    throw new Error('The chapter boundary must preserve the local family clock.');
  const work = completed(p, 'cold');
  if (!work) throw new Error('No attended cold-station outcome.');
  const offset = targetOpening - p.now;
  const mapping: PersonaProjection = {
    version: ZEYNEP_MAPPING,
    skills: { cold: 'cold' },
    episodes: {},
    commitments: {},
  };
  required(mapping.episodes)[work.id] = {
    id: `pass-zeynep-${work.id}`,
    action: 'cold',
    actorId: 'zeynep-pass',
    ...(work.targetId ? { targetId: 'pass-work' } : {}),
    ...(work.placeId ? { placeId: 'pass-kitchen' } : {}),
    ...(work.voiceId ? { voiceId: 'pass-chef' } : {}),
    tags: ['work', 'completed'],
  };
  for (const c of p.agenda.commitments) {
    if (c.status !== 'pending' || !family(c)) continue;
    required(mapping.commitments)[c.id] = {
      id: 'pass-family-home',
      actions: ['leave-for-home'],
      toId: 'sons',
      from: c.from + offset,
      until: c.until + offset,
      ...(c.chain ? { chain: 'pass-family-home' } : {}),
    };
  }
  return projectPersona(p, mapping);
}

export async function projectZeynep(s: GameState, targetOpening?: number): Promise<ZeynepTransfer> {
  const status = zeynepDepartureStatus(s);
  if (!status.eligible) throw new Error(status.reasons.join(' '));
  const p = required(personOf(s));
  const initial = snapshot(p);
  const opening = targetOpening ?? 1440 + (p.now % 1440);
  const person = projection(p, opening);
  const work = required(completed(p, 'cold'));
  const previous = required(
    [...p.agenda.commitments].reverse().find((c) => family(c) && ['kept', 'broken'].includes(c.status)),
  );
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(initial)));
  return {
    person,
    history: [
      {
        id: `pass-zeynep-${work.id}`,
        summary: work.summary,
        at: work.at,
        sourceGame: 'pass',
        sourceEpisodeId: work.id,
      },
    ],
    admission: {
      adapter: 'pass-zeynep/1',
      targetOpening: opening,
      familyHistory: {
        status: previous.status as 'kept' | 'broken',
        from: previous.from,
        until: previous.until,
      },
    },
    checkpoint: {
      sourceSchema: initial.schema,
      sourceNow: initial.now,
      sourceRng: structuredClone(initial.rng),
      checkpointDigest: Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(''),
    },
  };
}

/** New chapter only: the caller pins the deterministic local departure prefix and this complete Person. */
export function returnedZeynep(envelope: PersonaEnvelope, opening: Person): Person {
  if (
    envelope.castId !== ZEYNEP_CAST ||
    envelope.castRevision !== '1' ||
    envelope.source.game !== 'goodhands'
  )
    throw new Error('This is not Zeynep returning from Good Hands.');
  const projected = validatePersonaProjection(envelope.transfer.person);
  const checkpoint = envelope.transfer.checkpoint as Record<string, unknown> | undefined;
  if (
    !checkpoint ||
    Object.keys(checkpoint).sort().join(',') !== 'checkpointDigest,sourceNow,sourceRng,sourceSchema' ||
    checkpoint.sourceSchema !== projected.source.schema ||
    checkpoint.sourceNow !== projected.source.now ||
    canonicalPersona(checkpoint.sourceRng) !== canonicalPersona(projected.rng) ||
    typeof checkpoint.checkpointDigest !== 'string' ||
    !/^[a-f0-9]{64}$/.test(checkpoint.checkpointDigest)
  )
    throw new Error('The return checkpoint provenance is missing.');
  if (
    projected.mappingVersion !== 'goodhands-zeynep/1' ||
    projected.source.id !== 'zeynep-pass' ||
    Object.keys(projected.skills).join(',') !== 'cold'
  )
    throw new Error('Unsupported Zeynep return mapping.');
  if (
    !Array.isArray(envelope.transfer.history) ||
    envelope.transfer.history.length < 1 ||
    envelope.transfer.history.length > 8
  )
    throw new Error('A completed household trial answer is required.');
  if (projected.commitments.length !== 1 || projected.commitments.some((c) => !family(c, 'home')))
    throw new Error('The return carries an unsupported agency duty.');
  const answer = envelope.transfer.history.find((fact: unknown) => {
    if (!fact || typeof fact !== 'object') return false;
    const row = fact as Record<string, unknown>;
    return (
      row.id === 'goodhands-encounter' &&
      row.sourceGame === 'goodhands' &&
      typeof row.summary === 'string' &&
      row.summary.length > 0 &&
      row.summary.length <= 1024 &&
      typeof row.sourceEpisodeId === 'string' &&
      Number.isFinite(row.at) &&
      projected.episodes.some(
        (e) => e.id === 'goodhands-encounter' && e.summary === row.summary && e.at === row.at,
      )
    );
  });
  if (!answer) throw new Error('The actual household trial answer is missing.');
  const target = restore(snapshot(opening));
  if (
    target.id !== 'zeynep' ||
    target.activity ||
    target.agenda.commitments.some((c) => c.status === 'pending' && !family(c))
  )
    throw new Error('The source departure prefix is not released.');
  if ((target.now - projected.source.now) % 1440 !== 0)
    throw new Error('The return must preserve the local family clock.');
  // The returning host owns this exact family-only calendar binding. HF does not shift
  // commitments during admission; their windows must already name the target calendar.
  const offset = target.now - projected.source.now;
  for (const c of projected.commitments) {
    c.from += offset;
    c.until += offset;
  }
  // Fitness may change through the attended daytime work; this carries exercise state, not healing.
  target.body.fitness = projected.health.fitness;
  target.agenda = createAgenda({}, target.now);
  target.life.bornAt = projected.life.bornAt + target.now - projected.source.now;
  return admitPersona(projected, target, {
    mappingVersion: 'goodhands-zeynep/1',
    sourceId: 'zeynep-pass',
    targetId: 'zeynep',
  }).person;
}

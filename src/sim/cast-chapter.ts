/** Finite kitchen calendar maps. No source duty settlement, qualification transfer or biography discovery.
 * Good Hands accepts only actual paused baking/cold-food people. Unknown dialects refuse before CAS.
 */
import {
  admitCalendarPersona,
  DEFAULT_NORMS,
  isContinuingCommitment,
  MINUTES_PER_YEAR,
  type Person,
  projectCalendarPersona,
  snapshot,
  tick,
  validateCalendarPersona,
} from '@adam0white/human-framework-legacy';
import {
  canonicalPersona,
  castForGame,
  type LifePreparation,
  lifeAdmission,
  type PersonaEnvelope,
  preparePersonaLife,
  validatePersona,
} from '@adam0white/lab-client';
import { required } from '../required.ts';
import { HIRES, makeCook, makeHire } from './cooks.ts';

export const CAST = castForGame('pass');
export const keyOf = (castId: string) => {
  const c = CAST.find((c) => c.castId === castId);
  if (!c) throw new Error('Person is outside this kitchen cast.');
  return required(c.castId.split('.')[2]);
};
const same = (a: unknown, b: unknown) => canonicalPersona(a) === canonicalPersona(b);
// Portable calendar semantics are shared only by these explicitly supported releases.
const nativeEngine = (engine: string) => engine === '2.17.0' || engine === '2.21.0';
const identity = (xs: string[]) => Object.fromEntries(xs.map((x) => [x, x]));

import type { PortableAdmission } from '@adam0white/human-framework';
export const AUTHORITY = 'pass-authority/1' as const;
export const AUTHORITY_REFUSAL =
  'Keep the original notebook and start a fresh game. This notebook does not establish which saved stories may continue.';
export function requireChapterAuthority(chapter?: KitchenChapter) {
  if (
    chapter?.version !== 'pass-cast/2' ||
    chapter.authority !== AUTHORITY ||
    !Array.isArray(chapter.skipped)
  )
    throw new Error(AUTHORITY_REFUSAL);
  if (chapter.skipped.length > CAST.length || new Set(chapter.skipped).size !== chapter.skipped.length)
    throw new Error(AUTHORITY_REFUSAL);
  for (const id of chapter.skipped) {
    keyOf(id);
    if (chapter.inputs.some((input) => input.parent.castId === id)) throw new Error(AUTHORITY_REFUSAL);
  }
}
export interface KitchenChapter {
  authority?: typeof AUTHORITY;
  /** Refused shelf identities use local substitutes and cannot publish source projections. */
  skipped?: string[];
  portable?: Record<string, PortableAdmission>;
  version: 'pass-cast/1' | 'pass-cast/2';
  /** Absent in historical chapters; validation must retain their original narration. */
  plainNarration?: boolean;
  seed: number;
  claims?: PersonaEnvelope[];
  inputs: LifePreparation[];
  actors: Record<string, Person>;
  facts: Record<string, ReturnType<typeof lifeAdmission>>;
}
export function freshActor(id: string, seed: number, now = 1045, plainNarration = true) {
  const hire = HIRES.find((h) => h.id === id);
  return hire
    ? makeHire(hire, seed, now, 'pass@13', plainNarration)
    : makeCook(id, seed, now, 'pass@13', plainNarration);
}
export async function digest(value: unknown) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(value))),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export async function prepareKitchenChapter(
  inputs: LifePreparation[],
  seed: number,
  plainNarration = true,
): Promise<KitchenChapter> {
  if (inputs.length > 7 || new Set(inputs.map((x) => x.parent.castId)).size !== inputs.length)
    throw new Error('Invalid kitchen cast batch.');
  const chapter: KitchenChapter = {
    version: 'pass-cast/1',
    ...(plainNarration ? { plainNarration: true } : {}),
    seed,
    inputs: structuredClone(inputs),
    actors: {},
    facts: {},
  };
  for (const input of inputs) {
    const parent = await validatePersona(input.parent),
      id = keyOf(parent.castId),
      cast = required(CAST.find((c) => c.castId === parent.castId));
    if (parent.terminal || parent.castRevision !== cast.revision)
      throw new Error('Closed or older cast edition. Export it or choose an explicit fresh local story.');
    if (!same(preparePersonaLife(parent, input.clockMs).life, input.life))
      throw new Error('Pinned life clock mismatch.');
    const native =
      parent.source.game === 'pass' &&
      parent.source.rules === 'pass-13' &&
      nativeEngine(parent.source.engine) &&
      parent.transfer.castPassport === 'pass-kitchen/1' &&
      parent.transfer.sourceRole === id;
    const agency =
      ((parent.source.game === 'goodhands' && parent.source.rules === 'goodhands-6') ||
        (parent.source.game === 'pass' && parent.source.rules === 'pass-13')) &&
      (nativeEngine(parent.source.engine) || (id === 'zeynep' && parent.source.engine === '2.23.0')) &&
      parent.transfer.castPassport === 'goodhands-agency/1' &&
      ((id === 'hulya' && parent.transfer.sourceRole === 'hulya') ||
        (id === 'zeynep' && parent.transfer.sourceRole === 'zeynep-pass'));
    const town =
      (id === 'rafi' || id === 'sam') &&
      ((parent.source.game === 'neighbours' && parent.source.rules === 'neighbours-cast-1') ||
        (parent.source.game === 'pass' && parent.source.rules === 'pass-13')) &&
      (nativeEngine(parent.source.engine) || parent.source.engine === '2.23.0') &&
      parent.transfer.castPassport === 'neighbours-cast/1' &&
      parent.transfer.sourceRole === (id === 'rafi' ? 'ravi' : 'sam');
    if (!native && !agency && !town)
      throw new Error(
        `${cast.name}: no supported native kitchen map for ${parent.source.game}. Keep the source or choose fresh local play.`,
      );
    const portable = validateCalendarPersona(
        native ? parent.transfer.kitchenPerson : town ? parent.transfer.person : parent.transfer.agencyPerson,
      ),
      p = portable.person;
    const mapping = native
      ? 'pass-kitchen-calendar/1'
      : town
        ? 'neighbours-calendar/1'
        : 'goodhands-agency-calendar/1';
    const sourceId = native
      ? id
      : town
        ? id === 'rafi'
          ? 'ravi'
          : 'sam'
        : id === 'zeynep'
          ? 'zeynep-pass'
          : 'hulya';
    const receipt = parent.transfer.checkpoint as Record<string, unknown> | undefined;
    if (
      p.mappingVersion !== mapping ||
      p.source.id !== sourceId ||
      p.name !== cast.name ||
      !receipt ||
      (town ? receipt.schema : receipt.sourceSchema) !== p.source.schema ||
      (town ? receipt.sourceMinute : receipt.sourceNow) !== p.source.now ||
      !same(town ? receipt.rng : receipt.sourceRng, p.rng) ||
      typeof (town ? receipt.sha256 : receipt.checkpointDigest) !== 'string' ||
      !/^[a-f0-9]{64}$/.test(String(town ? receipt.sha256 : receipt.checkpointDigest))
    )
      throw new Error('Native source identity or checkpoint mismatch.');
    if (portable.calendar.norms.some((n) => !DEFAULT_NORMS.some((k) => same(k, n))))
      throw new Error('Unknown norm meaning.');
    const hour = ((p.source.now % 1440) + 1440) % 1440;
    if (!town && hour > 1045)
      throw new Error(
        'This chapter needs a quiet native daytime boundary before 17:25. Existing family and work duties remain at source.',
      );
    // These two duty-free workshop boundaries changes only chapter clock labels, not body age/time.
    // Other maps retain wall-clock duties and their explicit whole-day map.
    if (town && portable.calendar.commitments.length)
      throw new Error('An unresolved source duty has no kitchen map.');
    const arrival = town ? 1045 : hour;
    const offset = arrival - p.source.now;
    const shifted = structuredClone(portable);
    shifted.calendar.offset = offset;
    const known = new Set([
      'pray',
      'home',
      'leave-for-home',
      'grill',
      'cold',
      'dish',
      'oven',
      'smoke',
      'skim',
    ]);
    for (const c of shifted.calendar.commitments) {
      const family =
        id === 'zeynep' &&
        c.kind === 'promise' &&
        c.toId === 'sons' &&
        c.from % 1440 === 1290 &&
        c.until - c.from === 40 &&
        c.importance === 0.7 &&
        c.recurEvery === 1440 &&
        c.actions.length === 1 &&
        ['home', 'leave-for-home'].includes(required(c.actions[0]));
      if (
        !family &&
        !(
          native &&
          c.kind === 'abstain' &&
          c.toId === 'self' &&
          ['my rule about the plates', 'my rule about smoking', 'my rule about the jar'].includes(
            c.label ?? '',
          )
        ) &&
        !(c.kind === 'worship' && c.normId === 'salah' && c.actions.every((a) => a === 'pray'))
      )
        throw new Error('An unresolved source work/family duty has no kitchen map.');
      if ([...c.actions, ...(c.violatedBy ?? [])].some((a) => !known.has(a)))
        throw new Error('Unsupported source action.');
      c.from += offset;
      c.until += offset;
      if (c.recurUntil !== undefined) c.recurUntil += offset;
      if (c.exempt) c.exempt.at += offset;
      if (family) c.actions = ['home'];
      if (c.until <= 1045 && c.status === 'pending')
        throw new Error('A source duty would fall inside the unplayed opening interval.');
    }
    if (shifted.calendar.owed.length || shifted.calendar.lapse)
      throw new Error('Keep actual unresolved debt at source; this kitchen has no repayment map.');
    const opening = freshActor(id, seed, arrival, plainNarration);
    opening.body.health = p.health.health;
    opening.body.fitness = p.health.fitness;
    opening.body.circadianPeak = p.health.circadianPeak;
    opening.life.bornAt = p.life.bornAt + offset;
    if (p.source.now - p.life.bornAt < cast.age * MINUTES_PER_YEAR)
      throw new Error('Canonical age mismatch.');
    opening.agenda.commitments = [];
    delete opening.agenda.owed;
    delete opening.agenda.lapse;
    // Foreign trade skills stay source-side. Only explicitly compatible kitchen practice is mapped.
    const skills = new Set(
      town
        ? []
        : agency && id === 'zeynep'
          ? ['cold']
          : agency
            ? ['oven']
            : ['grill', 'cold', 'dish', 'oven'],
    );
    shifted.person.skills = Object.fromEntries(Object.entries(p.skills).filter(([k]) => skills.has(k)));
    shifted.person.episodes = p.episodes.filter((e) => !!e.action && skills.has(e.action));
    const admitted = admitCalendarPersona(shifted, opening, {
      mappingVersion: mapping,
      sourceId,
      targetId: id,
      targetNorms: DEFAULT_NORMS,
    }).person;
    tick(admitted, 1045);
    chapter.actors[id] = snapshot(admitted);
    chapter.facts[id] = lifeAdmission(input, 'pass');
  }
  return chapter;
}
export async function validateKitchenChapter(chapter: KitchenChapter) {
  const { claims, skipped, authority, ...content } = chapter;
  if (chapter.version === 'pass-cast/2') requireChapterAuthority(chapter);
  if (skipped !== undefined) {
    if (!Array.isArray(skipped) || skipped.length > CAST.length || new Set(skipped).size !== skipped.length)
      throw new Error('Invalid skipped kitchen people.');
    for (const id of skipped) {
      keyOf(id);
      if (chapter.inputs.some((input) => input.parent.castId === id))
        throw new Error('A skipped person cannot have an admitted kitchen source.');
    }
  }
  if (claims) {
    if (claims.length !== chapter.inputs.length) throw new Error('Incomplete initial claim group.');
    for (const value of claims) {
      const claim = await validatePersona(value);
      const parent = chapter.inputs.find((i) => i.parent.castId === claim.castId)?.parent;
      if (
        !parent ||
        claim.parentRevision !== parent.revision ||
        claim.branchId !== parent.branchId ||
        claim.source.game !== 'pass'
      )
        throw new Error('Initial claim does not belong to this pinned source.');
    }
  }
  if (chapter.version === 'pass-cast/2') {
    const { prepareHF4KitchenChapter } = await import('./hf4-cast.ts');
    const {
      authority: _authority,
      skipped: _skipped,
      ...expected
    } = await prepareHF4KitchenChapter(chapter.inputs, chapter.seed);
    if (!same(expected, content))
      throw new Error('Pinned retained kitchen chapter does not match its sources.');
    return;
  }
  if (
    chapter.version !== 'pass-cast/1' ||
    !same(await prepareKitchenChapter(chapter.inputs, chapter.seed, chapter.plainNarration === true), content)
  )
    throw new Error('Pinned kitchen chapter does not match its native sources.');
}
/** Requires an explicit played release and natural idle boundary. No work duty is dropped by projection. */
export async function kitchenTransfer(person: Person) {
  const cs = person.agenda.commitments.filter((c) => isContinuingCommitment(person.agenda, c));
  const owed = person.agenda.owed ?? [];
  const raw = snapshot(person);
  const kitchenPerson = projectCalendarPersona(person, {
    version: 'pass-kitchen-calendar/1',
    skills: identity(Object.keys(person.skills)),
    episodes: Object.fromEntries(
      person.memory.episodes.slice(-8).map((e) => [
        e.id,
        {
          id: e.id,
          action: e.action,
          actorId: e.actorId,
          targetId: e.targetId,
          placeId: e.placeId,
          voiceId: e.voiceId,
          tags: e.tags,
        },
      ]),
    ),
    calendar: {
      version: 'hf-persona-calendar-map/1',
      offset: 0,
      sourceNorms: DEFAULT_NORMS,
      references: {
        commitments: identity([
          ...cs.flatMap((c) => [c.id, ...(c.makeUpOf ? [c.makeUpOf] : [])]),
          ...owed.flatMap((d) => [d.ofId, ...(d.scheduledAs ? [d.scheduledAs] : [])]),
        ]),
        chains: identity(cs.flatMap((c) => (c.chain ? [c.chain] : []))),
        actions: identity([
          ...cs.flatMap((c) => [...c.actions, ...(c.violatedBy ?? [])]),
          ...owed.flatMap((d) => [...d.actions, ...(d.violatedBy ?? [])]),
        ]),
        entities: identity(cs.flatMap((c) => [c.toId, c.targetId].filter((x): x is string => !!x))),
        norms: identity(DEFAULT_NORMS.map((n) => n.id)),
      },
    },
  });
  return {
    castPassport: 'pass-kitchen/1',
    sourceRole: person.id,
    kitchenPerson,
    checkpoint: {
      sourceSchema: person.schema,
      sourceNow: person.now,
      sourceRng: structuredClone(person.rng),
      checkpointDigest: await digest(raw),
    },
    limitations: [
      ...kitchenPerson.person.limitations,
      'Other work skills, detailed memories and relationships from this kitchen stay in the full kitchen notebook on this device.',
    ],
  };
}

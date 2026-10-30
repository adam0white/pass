/** The current public retained-person route. Refuse omitted history before a shelf claim. */
import { DEFAULT_NORMS, type PortableAdmission, validatePortablePerson } from '@adam0white/human-framework';
import {
  canonicalPersona,
  type LifePreparation,
  lifeAdmission,
  portablePersonRole,
  preparePersonaLife,
  validatePersona,
} from '@adam0white/lab-client';
import { AUTHORITY, CAST, digest, type KitchenChapter, keyOf } from './cast-chapter.ts';
import { HF4_ACTIONS, HF4_OPENING } from './hf4-authoring.ts';
import {
  checkpoint,
  communityRun,
  freshCommunity,
  isHF4,
  type Person,
  stageRetainedVisitor,
} from './hf4-person.ts';

const same = (a: unknown, b: unknown) => canonicalPersona(a) === canonicalPersona(b);
export async function prepareHF4KitchenChapter(
  inputs: LifePreparation[],
  seed: number,
): Promise<KitchenChapter> {
  if (inputs.length > 7 || new Set(inputs.map((i) => i.parent.castId)).size !== inputs.length)
    throw new Error('Invalid kitchen cast batch.');
  const portable: Record<string, PortableAdmission> = {},
    facts: KitchenChapter['facts'] = {};
  for (const input of inputs) {
    const parent = await validatePersona(input.parent),
      id = keyOf(parent.castId),
      cast = CAST.find((c) => c.castId === parent.castId);
    if (
      !cast ||
      parent.terminal ||
      parent.castRevision !== cast.revision ||
      !same(preparePersonaLife(parent, input.clockMs).life, input.life)
    )
      throw new Error('The saved person does not match this kitchen opening. Keep the source file.');
    if (!cast.games.includes(parent.source.game) || parent.transfer.castPassport !== 'hf-portable-person/2')
      throw new Error(
        `${cast.name}: this saved copy omits the full retained history this kitchen needs. Keep it. Start a separate local story or use a complete current kitchen source.`,
      );
    if (portablePersonRole(parent, 'pass') !== id)
      throw new Error('This person has no matching kitchen role.');
    const person = validatePortablePerson(parent.transfer.portable);
    if (
      person.version !== 2 ||
      person.castId !== cast.castId ||
      person.castRevision !== cast.revision ||
      person.source.game !== parent.source.game ||
      person.source.engine !== parent.source.engine
    )
      throw new Error('The retained person does not match the source identity.');
    const offsetMs = HF4_OPENING - person.retained.at;
    if (offsetMs % 86_400_000 !== 0 && person.retained.agenda.commitments.some((c) => c.status === 'pending'))
      throw new Error(
        `${cast.name}: their duties need the same time of day. Keep the source chapter until a matching opening.`,
      );
    const entities = [
      'line',
      'pass',
      'sons',
      'mother',
      'chef',
      ...CAST.map((c) => c.castId.split('.')[2] as string),
      ...Array.from({ length: 1024 }, (_, i) => `table:${i + 1}`),
    ];
    const sources = [
      'pass',
      'chef',
      ...CAST.map((c) => c.castId.split('.')[2] as string),
      ...Array.from({ length: 1024 }, (_, i) => `table:${i + 1}`),
    ];
    const references = [
      ...HF4_ACTIONS.map((source) => ({ kind: 'action' as const, source, target: source })),
      ...DEFAULT_NORMS.map((n) => ({ kind: 'norm' as const, source: n.id, target: n.id })),
      ...[...new Set(entities)].map((source) => ({ kind: 'entity' as const, source, target: source })),
      ...[...new Set(sources)].map((source) => ({ kind: 'source' as const, source, target: source })),
    ];
    portable[id] = { person, mapping: { offsetMs, references } };
    facts[id] = lifeAdmission(input, 'pass');
  }
  // Admission is validated before the shelf changes ownership. No actor replacement or private archive edit.
  freshCommunity(seed, portable);
  for (const [id, admission] of Object.entries(portable))
    if (!['selim', 'dilek', 'rafi'].includes(id)) stageRetainedVisitor(seed, id, admission, 1045 * 60_000);
  return {
    version: 'pass-cast/2',
    authority: AUTHORITY,
    skipped: [],
    plainNarration: true,
    seed,
    inputs: structuredClone(inputs),
    actors: {},
    facts,
    portable,
  };
}
export function hf4ReleaseProjection(p: Person) {
  if (!isHF4(p)) throw new Error('This person belongs to a historical chapter.');
  const cast = CAST.find((c) => c.castId.split('.')[2] === p.id);
  if (!cast) throw new Error('Unallocated kitchen person.');
  const run = communityRun(p),
    saved = checkpoint(p);
  if (
    run.active.some((a) => a.person === p.id) ||
    (saved.pending?.boundary.type === 'world-required' &&
      saved.pending.boundary.requests.some((r) =>
        r.kind === 'action' ? r.person === p.id : r.speaker === p.id || r.recipients.includes(p.id),
      ))
  )
    throw new Error('Wait until this person has finished their work and all pending requests.');
  const view = run.inspect({
    perspective: { kind: 'host' },
    people: [p.id],
    select: ['persona', 'calendar'],
    portable: { person: p.id, castId: cast.castId, castRevision: cast.revision },
  }).people[0];
  const person = view?.parts.find((x) => x.select === 'persona')?.value;
  if (!person || !('format' in person) || person.version !== 2)
    throw new Error('HF could not project this retained person.');
  return { person, sourceAt: run.now };
}

export async function hf4KitchenTransfer(p: Person, saved?: ReturnType<typeof hf4ReleaseProjection>) {
  const { person, sourceAt } = saved ?? hf4ReleaseProjection(p);
  const checkpointDigest = await digest(person);
  return {
    castPassport: 'hf-portable-person/2',
    portable: person,
    portableLimitations:
      'Supported history and responsibilities continue with explicit calendar and reference mapping. The source runtime and RNG stay archived.',
    checkpoint: { checkpointDigest, sourceAt },
    limitations: [
      'This copy retains the body, traits, values, memories, held norms and duties supported by the framework passport. The full kitchen notebook keeps the source run.',
    ],
  };
}

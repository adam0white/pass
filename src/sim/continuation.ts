/** Return visits start after a locally replayed departure. The shelf is never read during replay. */
import { type Person, restore, snapshot, validatePersonaProjection } from '@adam0white/human-framework';
import { canonicalPersona, type PersonaEnvelope, validatePersona } from '@adam0white/lab-client';
import { validateKitchenChapter } from './cast-chapter.ts';
import { canReplay, cloneState, type Export, type GameState, personOf, replay } from './kitchen.ts';
import { returnedZeynep, zeynepDepartureStatus } from './one-cast.ts';

export interface ReturnChapter {
  v: 1;
  prefix: Export;
  initial: Person;
  envelope: PersonaEnvelope;
}

type ReplayFile = Pick<Export, 'game' | 'seed' | 'inputs'> &
  Partial<Pick<Export, 'state' | 'returnChapter' | 'castChapter' | 'plainNarration'>> & { minute?: number };

const canonicalJson = (value: unknown) => canonicalPersona(JSON.parse(JSON.stringify(value)));

function departure(prefix: Export): GameState {
  if (!prefix || prefix.returnChapter || prefix.state?.returnChapter || prefix.game !== 'pass@12')
    throw new Error('The original local departure notebook is required. Start a fresh kitchen instead.');
  const source = replay(
    prefix.seed,
    prefix.inputs,
    prefix.state?.minute,
    prefix.game,
    undefined,
    prefix.plainNarration ?? prefix.state?.plainNarration ?? false,
  );
  if (!zeynepDepartureStatus(source).eligible)
    throw new Error('The local notebook does not establish Zeynep’s released stint and home result.');
  if (prefix.state && canonicalJson(source) !== canonicalJson(prefix.state))
    throw new Error('The local departure notebook did not replay exactly.');
  return source;
}

function sourceEnvelope(prefix: Export): PersonaEnvelope {
  const meta = prefix as Export & {
    continuity?: { envelope?: PersonaEnvelope | null };
    departureEnvelope?: PersonaEnvelope;
  };
  const pinned = meta.departureEnvelope ?? meta.continuity?.envelope;
  if (pinned?.source.game !== 'pass' || pinned.castId !== 'hf.cast.zeynep.pass')
    throw new Error('The local departure has no pinned person envelope. Start a fresh kitchen instead.');
  return pinned;
}

function checkLineage(prefix: Export, envelope: PersonaEnvelope) {
  const pinned = sourceEnvelope(prefix);
  const admission = envelope.transfer.admission as
    | { sourceRevision?: string; sourceCheckpointDigest?: string }
    | undefined;
  const checkpoint = pinned.transfer.checkpoint as { checkpointDigest?: string } | undefined;
  if (
    envelope.branchId !== pinned.branchId ||
    admission?.sourceRevision !== pinned.revision ||
    admission?.sourceCheckpointDigest !== checkpoint?.checkpointDigest
  )
    throw new Error(
      'This return belongs to another departure notebook or branch. Start a fresh kitchen instead.',
    );
}

function opening(source: GameState, envelope: PersonaEnvelope): Person {
  const p = restore(snapshot(personOf(source, 'zeynep')));
  const projection = validatePersonaProjection(envelope.transfer.person);
  // A new visit is later than departure. A whole-day offset preserves the family clock.
  const clock = ((projection.source.now % 1440) + 1440) % 1440;
  const next = Math.floor(p.now / 1440) * 1440 + clock;
  p.now = next <= p.now ? next + 1440 : next;
  return returnedZeynep(envelope, p);
}

function returnState(header: ReturnChapter): GameState {
  if (header.v !== 1) throw new Error('Unsupported return chapter.');
  const source = departure(header.prefix);
  checkLineage(header.prefix, header.envelope);
  const expected = opening(source, header.envelope);
  const initial = restore(snapshot(header.initial));
  if (canonicalJson(initial) !== canonicalJson(expected))
    throw new Error('The pinned return Person does not match this departure and arrival.');
  const state = cloneState(source);
  state.phase = 'return';
  state.minute = initial.now;
  state.people = state.people.map((p) => (p.id === 'zeynep' ? initial : p));
  state.returnChapter = structuredClone(header);
  state.said.push({
    at: state.minute,
    who: 'zeynep',
    kind: 'journal',
    text: 'I came back to tell you about the job making cold suppers. I haven’t agreed to take another kitchen job.',
  });
  return state;
}

export async function prepareReturn(envelope: PersonaEnvelope, prefix: Export): Promise<GameState> {
  const accepted = await validatePersona(envelope);
  const pinned = await validatePersona(sourceEnvelope(prefix));
  checkLineage(prefix, accepted);
  const source = departure(prefix);
  const bytes = new TextEncoder().encode(canonicalPersona(snapshot(personOf(source, 'zeynep'))));
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  if ((pinned.transfer.checkpoint as { checkpointDigest?: string })?.checkpointDigest !== digest)
    throw new Error('The local departure Person does not match its pinned envelope.');
  const initial = opening(source, accepted);
  return returnState({ v: 1, prefix: structuredClone(prefix), initial, envelope: accepted });
}

export function replayExport(ex: ReplayFile): GameState {
  if (!canReplay(ex.game) || !Number.isSafeInteger(ex.seed) || !Array.isArray(ex.inputs))
    throw new Error('That is not a supported Pass notebook.');
  const header = ex.returnChapter ?? ex.state?.returnChapter;
  if (header) {
    if (ex.game !== 'pass@12') throw new Error('This edition has no return chapter.');
    const state = returnState(header);
    if (ex.seed !== state.seed || canonicalJson(ex.inputs) !== canonicalJson(state.inputs))
      throw new Error('The return chapter has an unexpected input suffix.');
    if (ex.state && canonicalJson(ex.state) !== canonicalJson(state))
      throw new Error('The return chapter does not match its pinned replay.');
    return state;
  }
  return replay(
    ex.seed,
    ex.inputs,
    ex.state?.minute ?? ex.minute,
    ex.game,
    ex.castChapter ?? ex.state?.castChapter,
    ex.plainNarration ?? ex.state?.plainNarration ?? false,
  );
}

/** Validate portable checksums before a file or saved chapter can affect upload consent or a loaded run. */
export async function validateReplayFile(ex: ReplayFile): Promise<GameState> {
  const chapter = ex.castChapter ?? ex.state?.castChapter;
  if (chapter) await validateKitchenChapter(chapter);
  const header = ex.returnChapter ?? ex.state?.returnChapter;
  if (header) {
    await prepareReturn(header.envelope, header.prefix);
  }
  return replayExport(ex);
}

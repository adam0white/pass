/** Whole kitchen ownership and pinned exports. Title entry is read-only; files never acquire ownership. */
import { FRAMEWORK_VERSION, snapshot } from '@adam0white/human-framework-legacy';
import {
  anchorPersonaLife,
  canonicalCast,
  canonicalPersona,
  claimCastChapterBatch,
  closePersonaBranch,
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  type PersonaLife,
  personaChannel,
  portablePassport,
  portableWriteBlockers,
  validatePersona,
  watchPersonaCheckpoint,
} from '@adam0white/lab-client';
import { personaControls } from '@adam0white/lab-kit';
import {
  AUTHORITY,
  AUTHORITY_REFUSAL,
  CAST,
  digest,
  keyOf,
  kitchenTransfer,
  requireChapterAuthority,
  validateKitchenChapter,
} from '../sim/cast-chapter.ts';
import { hf4KitchenTransfer, prepareHF4KitchenChapter } from '../sim/hf4-cast.ts';
import { isHF4 } from '../sim/hf4-person.ts';
import { type Export, exportRun, type GameState, newGame } from '../sim/kitchen.ts';
import { kitchenEdition } from '../sim/kitchen-edition.ts';
import { lab } from './lab.ts';

export interface OneCastRow {
  v: 1;
  probe: 'zeynep';
  arm: 'continuing';
  scope: 'shared' | 'file' | 'local';
  castId: string;
  branchId: string;
  revision: string;
  parentRevision: string | null;
  stage: 'checkpoint' | 'admitted';
  outcome: 'accepted';
}
export interface SkippedCast {
  castId: string;
  reason: string;
}
const skippedReason = 'They start fresh here. Their stories from other games stay as they were.';
export interface ContinuitySave {
  authority?: typeof AUTHORITY;
  skipped?: SkippedCast[];
  envelope: PersonaEnvelope | null;
  oneCast: OneCastRow[];
  ownedHeads?: Record<string, PersonaEnvelope>;
  recordingGroup?: PersonaEnvelope[];
  fileUnlinked?: boolean;
  fileOrigin?: boolean;
  localOnly?: boolean;
  recordingKey?: string;
  importedHistory?: boolean;
  scope?: 'shared' | 'file' | 'local';
}
export type ContinuityExport = Export & { continuity?: ContinuitySave; oneCast?: OneCastRow[] };
export function guardedContinuity(state: GameState, value?: ContinuitySave) {
  if (state.castChapter && !value)
    return {
      envelope: null,
      oneCast: [],
      fileUnlinked: true,
      fileOrigin: true,
      importedHistory: true,
    } satisfies ContinuitySave;
  return value;
}
export function continuity(
  getState: () => GameState | null,
  save: () => unknown,
  _load: (s: GameState) => void,
) {
  const shelf = personaChannel();
  const ready = shelf.ready.then(() => shelf.setEnabled(true));
  let heads: Record<string, PersonaEnvelope> = {},
    group: PersonaEnvelope[] = [],
    rows: OneCastRow[] = [];
  let active = false;
  let skipped: SkippedCast[] = [];
  const assertActive = (state: GameState) => {
    if (state.version !== 'pass@19') return;
    requireChapterAuthority(state.castChapter);
    if (
      !active ||
      canonicalPersona(state.castChapter?.skipped?.slice().sort()) !==
        canonicalPersona(skipped.map((item) => item.castId).sort())
    )
      throw new Error(AUTHORITY_REFUSAL);
  };
  const isSkipped = (castId: string) => skipped.some((item) => item.castId === castId);
  const skippedMessage = () => {
    const names = skipped.map((item) => canonicalCast(item.castId).name);
    if (!names.length) return '';
    const joined = names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
    return names.length === 1
      ? `${joined} could not bring their saved story into this kitchen. They start fresh here. Their story from the other game stays as it was.`
      : `${joined} could not bring their saved stories into this kitchen. They start fresh here. Their stories from other games stay as they were.`;
  };
  let labDetails = '';
  const labStatus = () =>
    message +
    (new URLSearchParams(window.location.search).get('lab') === '1' && labDetails
      ? ` Details: ${labDetails}`
      : '');
  let localOnly = false;
  let fileOrigin = false,
    fileUnlinked = false,
    importedHistory = false,
    recordingKey: string | undefined;
  let generation = 0,
    message = '',
    stopTracking: (() => void) | undefined;
  let pending: PersonaEnvelope | null = null;
  let chain = Promise.resolve();
  const source = () => ({
    game: 'pass',
    build: lab.build().c ?? 'local',
    engine: '4.12.0',
    rules: 'pass-19',
  });
  const emit = () => window.dispatchEvent(new Event('pass-continuity'));
  const report = (s: string) => {
    message = s;
    emit();
  };
  const data = (): ContinuitySave => ({
    authority: AUTHORITY,
    envelope: heads['hf.cast.zeynep.pass'] ?? null,
    skipped: structuredClone(skipped),
    oneCast: structuredClone(rows),
    ownedHeads: structuredClone(heads),
    recordingGroup: structuredClone(group),
    fileOrigin,
    localOnly,
    fileUnlinked,
    recordingKey,
    importedHistory,
    scope: fileOrigin ? 'file' : 'shared',
  });
  const run = (): ContinuityExport | null => {
    const s = getState();
    if (s?.version === 'pass@19') {
      try {
        assertActive(s);
      } catch {
        return null;
      }
    }
    return s
      ? {
          ...exportRun(s, s.version === 'pass@19' ? '4.12.0' : FRAMEWORK_VERSION),
          continuity: data(),
          oneCast: structuredClone(rows),
        }
      : null;
  };
  const releaseProjection = (s: GameState, id: string) => {
    const saved = s.releasedCastProjections?.[id];
    if (!saved) throw new Error('The release checkpoint is missing. Keep the original notebook.');
    if ('unavailable' in saved)
      throw new Error('The release source cannot be saved. Keep the original notebook.');
    return saved;
  };
  const track = () => {
    const state = getState();
    if (state?.version === 'pass@19') {
      try {
        assertActive(state);
      } catch {
        return;
      }
    }
    stopTracking?.();
    stopTracking = lab.trackRun(run, {
      runKey: () => getState()?.seed ?? 'title',
      getLogs: () =>
        getState()
          ?.said.slice(-40)
          .map((l) => l.text) ?? [],
    });
  };
  // Recording and automatic linkage belong to the SDK's single recording switch.
  // They must never delay or cancel fictional admission/checkpoint ownership.
  const gate = async () => {
    lab.setPersonaRecording(null);
  };
  async function restore(
    value?: ContinuitySave,
    fromFile = false,
    savedRun = false,
    incomingState?: GameState,
  ) {
    await ready;
    const epoch = ++generation;
    stopTracking?.();
    active = false;
    const loadingState = incomingState ?? getState();
    if (loadingState?.version === 'pass@19') {
      requireChapterAuthority(loadingState.castChapter);
      if (
        value?.authority !== AUTHORITY ||
        !Array.isArray(value.skipped) ||
        canonicalPersona(value.skipped.map((item) => item.castId).sort()) !==
          canonicalPersona(loadingState.castChapter?.skipped?.slice().sort())
      )
        throw new Error(AUTHORITY_REFUSAL);
    }
    const nextSkipped = (value?.skipped ?? []).map((item) => {
      keyOf(item.castId);
      return { castId: item.castId, reason: skippedReason };
    });
    if (new Set(nextSkipped.map((item) => item.castId)).size !== nextSkipped.length)
      throw new Error(AUTHORITY_REFUSAL);
    const refused = new Set(nextSkipped.map((item) => item.castId));
    const incoming: Record<string, PersonaEnvelope> = {};
    for (const [id, p] of Object.entries(value?.ownedHeads ?? {})) {
      keyOf(id);
      if (refused.has(id)) throw new Error('A skipped person cannot own a kitchen story.');
      const checked = await validatePersona(p);
      if (checked.castId !== id || checked.source.game !== 'pass')
        throw new Error('Invalid local ownership receipt.');
      incoming[id] = checked;
    }
    let restoredGroup = await Promise.all(
      (value?.recordingGroup ?? Object.values(incoming)).map(validatePersona),
    );
    if (restoredGroup.some((person) => refused.has(person.castId)))
      throw new Error('A skipped person cannot join the recording group.');
    if (epoch !== generation) throw new Error('Notebook replaced during load.');
    const state = incomingState;
    if (
      state?.castChapter?.inputs.some((input) => refused.has(input.parent.castId)) ||
      state?.castChapter?.claims?.some((person) => refused.has(person.castId))
    )
      throw new Error('A skipped person cannot have an admitted kitchen source.');
    if (state?.castChapter) await validateKitchenChapter(state.castChapter);
    if (state && !fromFile && !value?.fileOrigin) {
      const expected = Object.values(incoming);
      if (
        expected.length &&
        canonicalPersona(expected.map((p) => p.revision).sort()) !==
          canonicalPersona(restoredGroup.map((p) => p.revision).sort())
      )
        throw new Error('Recording group differs from the owned kitchen group.');
      for (const head of expected) {
        const initial = state.castChapter?.claims?.find((p) => p.castId === head.castId);
        if (initial && initial.branchId !== head.branchId)
          throw new Error('Saved ownership belongs to a different branch.');
        if (initial?.revision === head.revision) continue;
        const person = state.people.find((p) => p.id === keyOf(head.castId));
        const receipt = head.transfer.checkpoint as { checkpointDigest?: string } | undefined;
        if (
          !person ||
          (head.terminal
            ? person.body.alive
            : !state.releasedCast?.includes(person.id) ||
              receipt?.checkpointDigest !==
                (isHF4(person)
                  ? (await hf4KitchenTransfer(person, releaseProjection(state, person.id))).checkpoint
                      .checkpointDigest
                  : await digest(snapshot(person))))
        )
          throw new Error('Saved receipt does not match the played kitchen checkpoint.');
      }
      for (const initial of state.castChapter?.claims ?? [])
        if (!incoming[initial.castId] && !fromFile && !value?.fileOrigin)
          throw new Error('Loaded chapter is missing an accepted owned head.');
    }
    if (epoch !== generation) throw new Error('Notebook replaced during load.');
    if (!restoredGroup.length && state?.castChapter)
      restoredGroup = structuredClone(
        state.castChapter.claims ?? state.castChapter.inputs.map((i) => i.parent),
      );
    skipped = nextSkipped;
    localOnly = value?.localOnly === true;
    heads = fromFile || value?.fileOrigin ? {} : incoming;
    group = restoredGroup;
    fileOrigin = fromFile || value?.fileOrigin === true;
    fileUnlinked = fileOrigin || value?.fileUnlinked === true;
    importedHistory =
      fromFile || value?.importedHistory === true || !!state?.castChapter || (savedRun && !value);
    recordingKey = fileOrigin
      ? `pass-file-${crypto.randomUUID()}`
      : (value?.recordingKey ?? `pass-group-${crypto.randomUUID()}`);
    rows = structuredClone(value?.oneCast ?? []);
    pending = null;
    active = loadingState?.version === 'pass@19';
    await gate();
    report(skippedMessage());
  }
  async function fresh(seed: number): Promise<GameState> {
    await ready;
    const epoch = ++generation;
    // Stage admission before replacing the current notebook's ownership receipts.
    const reset = () => {
      stopTracking?.();
      active = true;
      heads = {};
      skipped = [];
      message = '';
      group = [];
      rows = [];
      localOnly = false;
      fileOrigin = false;
      fileUnlinked = false;
      importedHistory = false;
      pending = null;
      recordingKey = `pass-group-${crypto.randomUUID()}`;
      lab.setPersonaRecording(null);
      lab.allowPersonaRecording(false);
    };
    if (
      !shelf.enabled ||
      (typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname))
    ) {
      const next = newGame(seed, 'pass@19');
      reset();
      localOnly = true;
      await gate();
      return next;
    }
    const chapter = await claimCastChapterBatch(
      shelf,
      CAST.map((c) => c.castId),
      source(),
      (inputs) => prepareHF4KitchenChapter(inputs, seed),
      {
        isCurrent: () => epoch === generation,
        admitPerson: async (input) => {
          await prepareHF4KitchenChapter([input], seed);
        },
      },
    );
    if (epoch !== generation) throw new Error('Notebook replaced during admission.');
    if (chapter) {
      chapter.initial.claims = structuredClone(chapter.claims);
      if (chapter.blocked.length) chapter.initial.skipped = chapter.blocked.map((item) => item.castId);
    }
    const next = chapter ? newGame(seed, 'pass@19', chapter.initial) : newGame(seed, 'pass@19');
    reset();
    if (!chapter) {
      await gate();
      return next;
    }
    skipped = chapter.blocked.map((item) => ({ castId: item.castId, reason: skippedReason }));
    heads = Object.fromEntries(chapter.claims.map((p) => [p.castId, p]));
    group = chapter.claims;
    importedHistory = chapter.inputs.length > 0;
    await gate();
    if (epoch !== generation) throw new Error('Notebook replaced during admission.');
    if (chapter.blocked.length) {
      report(skippedMessage());
    } else if (chapter.inputs.length) {
      report('The cooks remember their earlier experiences. Their other jobs and family duties still apply.');
    }
    return next;
  }
  async function chooseRecording(_value: boolean) {
    // Compatibility callback; current personaControls exposes continuity only.
  }
  async function checkpointNow() {
    await ready;
    const s = getState(),
      epoch = generation;
    if (!s || (s.version !== 'pass@13' && !kitchenEdition(s)) || !shelf.enabled || fileOrigin || localOnly)
      return;
    if (s.version === 'pass@19') {
      try {
        assertActive(s);
      } catch {
        return;
      }
    }
    const minute = s.minute;
    const blockedWrites: string[] = [];
    const canWritePortable = (cast: (typeof CAST)[number]) => {
      const blockers = portableWriteBlockers(cast.castId, 'pass');
      if (!blockers.length) return true;
      labDetails = `${cast.name}: ${blockers.join(', ')}`;
      const notice = `${cast.name}'s story could not be saved for another game yet. Their saved story stays as it was.`;
      blockedWrites.push(notice);
      report(blockedWrites.join(' '));
      return false;
    };
    for (const cast of CAST) {
      // Local substitutes never publish for a refused shelf identity, including after reload.
      if (isSkipped(cast.castId)) continue;
      const id = keyOf(cast.castId),
        p = s.people.find((p) => p.id === id),
        parent = heads[cast.castId];
      if (!p) continue;
      if (!p.body.alive && !(isHF4(p) && s.releasedCast?.includes(id))) {
        if (parent && !parent.terminal) {
          if (isHF4(p) && portablePassport(parent) && !canWritePortable(cast)) continue;
          const terminal = await closePersonaBranch(parent, source(), p.now);
          if (epoch !== generation || getState() !== s) return;
          await shelf.request({ action: 'put', envelope: terminal });
          if (epoch === generation) {
            heads[cast.castId] = terminal;
            group = Object.values(heads);
            save();
            await gate();
          }
        }
        continue;
      }
      if (
        !s.releasedCast?.includes(id) ||
        (!isHF4(p) && (!['evening', 'sunday', 'end'].includes(s.phase) || p.activity))
      )
        continue;
      try {
        if (isHF4(p) && !canWritePortable(cast)) continue;
        const transfer = isHF4(p)
          ? await hf4KitchenTransfer(p, releaseProjection(s, id))
          : await kitchenTransfer(snapshot(p));
        if (
          epoch !== generation ||
          getState() !== s ||
          s.minute !== minute ||
          (isHF4(p)
            ? (await hf4KitchenTransfer(p, releaseProjection(s, id))).checkpoint.checkpointDigest
            : await digest(snapshot(p))) !== transfer.checkpoint.checkpointDigest
        )
          return;
        const old = parent?.transfer.checkpoint as { checkpointDigest?: string } | undefined;
        if (old?.checkpointDigest === transfer.checkpoint.checkpointDigest) continue;
        const branchId = parent?.branchId ?? crypto.randomUUID(),
          life = parent?.transfer.life as PersonaLife | undefined;
        const envelope = await createPersona({
          format: 'hf-persona/1',
          castId: cast.castId,
          castRevision: canonicalCast(cast.castId).revision,
          branchId,
          parentRevision: parent?.revision ?? null,
          source: source(),
          transfer: {
            ...transfer,
            life: life
              ? anchorPersonaLife(life, cast.castId, Date.now())
              : initialPersonaLife(cast.castId, branchId, Date.now()),
          },
          limitations: transfer.limitations,
        });
        if (epoch !== generation || s.minute !== minute) return;
        try {
          await shelf.request({ action: 'put', envelope });
        } catch {
          pending = envelope;
          report(
            `${cast.name}: this browser already has a newer saved copy of ${cast.name}. Download this copy, or start a separate story from it. The game will not replace the newer copy.`,
          );
          continue;
        }
        if (epoch !== generation) return;
        heads[cast.castId] = envelope;
        group = Object.values(heads);
        importedHistory = true;
        save();
        await gate();
        track();
        report(`${cast.name}: progress from this kitchen is saved. Their family duties still apply.`);
      } catch (error) {
        labDetails = String(error);
        report(`${cast.name}'s progress could not be saved this time. Your game continues.`);
      }
    }
    if (blockedWrites.length) report(blockedWrites.join(' '));
  }
  const checkpoint = () => {
    chain = chain
      .then(checkpointNow)
      .catch(() => report('This progress could not be saved this time. Your game continues.'));
    return chain;
  };
  const download = (value: unknown, name: string) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  function controls() {
    const section = personaControls({
      enabled: shelf.enabled,
      setEnabled: (value) => {
        shelf.setEnabled(value);
        emit();
      },
      recordingAllowed: lab.personaRecordingAllowed,
      allowRecording: (value) => {
        void chooseRecording(value);
      },
    });
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = labStatus();
    section.append(status);
    const update = () => {
      if (section.isConnected) status.textContent = labStatus();
      else window.removeEventListener('pass-continuity', update);
    };
    window.addEventListener('pass-continuity', update);
    for (const cast of CAST) {
      const p = getState()?.people.find((p) => p.id === keyOf(cast.castId));
      if (!p) continue;
      const b = document.createElement('button');
      b.textContent = `Download ${cast.name}’s saved record`;
      b.disabled = !heads[cast.castId];
      b.onclick = () => download(heads[cast.castId], `pass-${p.id}-person.json`);
      section.append(b);
    }
    if (pending) {
      const b = document.createElement('button');
      b.textContent = 'Download the unsaved progress';
      b.onclick = () => download(pending, 'pass-refused-person.json');
      section.append(b);
      const fork = document.createElement('button');
      fork.textContent = 'Start a separate story from this point';
      fork.onclick = () => {
        chain = chain
          .then(async () => {
            const candidate = pending,
              epoch = generation;
            const state = getState();
            if (state?.version === 'pass@19') {
              try {
                assertActive(state);
              } catch {
                return;
              }
            }
            if (!candidate || isSkipped(candidate.castId) || fileOrigin || localOnly) return;
            if (portablePassport(candidate) && portableWriteBlockers(candidate.castId, 'pass').length) return;
            const { revision: _revision, ...body } = candidate;
            const alternative = await createPersona({
              ...body,
              branchId: crypto.randomUUID(),
              parentRevision: null,
            });
            if (epoch !== generation || candidate !== pending || isSkipped(candidate.castId)) return;
            await shelf.request({ action: 'put', envelope: alternative, fork: true });
            if (epoch !== generation) return;
            heads[alternative.castId] = alternative;
            group = Object.values(heads);
            pending = null;
            await gate();
            save();
            report('A separate story is now active. The earlier story is still kept.');
          })
          .catch(() => report('The separate story could not be saved. Keep its file.'));
      };
      section.append(fork);
    }
    return section;
  }
  return {
    local: async () => {
      await ready;
      ++generation;
      stopTracking?.();
      heads = {};
      group = [];
      rows = [];
      skipped = [];
      pending = null;
      message = '';
      fileOrigin = false;
      fileUnlinked = false;
      importedHistory = false;
      recordingKey = `pass-local-${crypto.randomUUID()}`;
      localOnly = true;
      active = true;
      await gate();
    },
    ready,
    assertActive,
    data,
    run,
    restore,
    fresh,
    controls,
    chooseRecording,
    checkpoint,
    track,
    get skippedMessage() {
      return skippedMessage();
    },
    get message() {
      return message;
    },
    startWatching: () => watchPersonaCheckpoint(checkpoint),
  };
}

import { ENGINE_VERSION, FRAMEWORK_VERSION } from '@adam0white/human-framework';
import {
  createPersona,
  type PersonaEnvelope,
  personaChannel,
  validatePersona,
  watchPersonaCheckpoint,
} from '@adam0white/lab-client';
import { personaControls } from '@adam0white/lab-kit';
import { type Export, exportRun, GAME_VERSION, type GameState } from '../sim/kitchen.ts';
import { projectZeynep, ZEYNEP_CAST, zeynepDepartureStatus } from '../sim/one-cast.ts';
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
export interface ContinuitySave {
  envelope: PersonaEnvelope | null;
  oneCast: OneCastRow[];
  fileUnlinked?: boolean;
  recordingKey?: string;
  importedHistory?: boolean;
  scope?: OneCastRow['scope'];
}
export type ContinuityExport = Export & { continuity?: ContinuitySave; oneCast?: OneCastRow[] };
/** A return chapter is imported history even if a file strips its optional UI metadata. */
export function guardedContinuity(state: GameState, value?: ContinuitySave): ContinuitySave | undefined {
  if (
    state.returnChapter &&
    (!value?.envelope ||
      value.envelope.castId !== 'hf.cast.zeynep.pass' ||
      value.envelope.source.game !== 'pass')
  )
    throw new Error('This return chapter is missing its last accepted person envelope.');
  return value;
}

const DEPARTURE = 'pass-zeynep-departure-v1';

// Same generic opaque epoch protocol as the central bridge. Neither identity nor
// acknowledgement is persisted in persona data, saves, replays or telemetry.
async function epochFor(player: string | null): Promise<string | null> {
  if (!player) return null;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`hf-recording-epoch/1:${player}`),
  );
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Browser continuity owns CAS and consent; simulation owns projection and replay. */
export function continuity(
  getState: () => GameState | null,
  save: () => unknown,
  loadReturn: (state: GameState) => void,
) {
  const shelf = personaChannel();
  let pinned: PersonaEnvelope | null = null;
  let rows: OneCastRow[] = [];
  let pending: PersonaEnvelope | null = null;
  let pendingAdmission: {
    state: GameState;
    arrival: PersonaEnvelope;
    history: OneCastRow[];
    fromFile: boolean;
  } | null = null;
  let imported: PersonaEnvelope | null = null;
  let fileUnlinked = false;
  let recordingKey: string | null = null;
  let importedHistory = false;
  let message = '';
  let chain: Promise<void> = Promise.resolve();
  let stopTracking: (() => void) | undefined;
  let generation = 0;
  let gateGeneration = 0;
  let recordingAck: { token: string; revision: string; choice: number } | null = null;
  const invalidateGate = () => {
    gateGeneration++;
    recordingAck = null;
  };
  window.addEventListener('hf-lab-preference', invalidateGate);
  window.addEventListener('storage', invalidateGate);
  let scope: OneCastRow['scope'] = 'shared';
  const emit = () => window.dispatchEvent(new Event('pass-continuity'));
  const report = (text: string) => {
    message = text;
    emit();
  };
  const data = (): ContinuitySave => ({
    envelope: pinned,
    oneCast: [...rows],
    fileUnlinked,
    recordingKey: recordingKey ?? undefined,
    importedHistory,
    scope,
  });
  const run = (): ContinuityExport | null => {
    const s = getState();
    return s ? { ...exportRun(s, FRAMEWORK_VERSION), continuity: data(), oneCast: [...rows] } : null;
  };
  const track = () => {
    stopTracking?.();
    stopTracking = lab.trackRun(run, {
      runKey: () => getState()?.seed ?? 'title',
      getLogs: () =>
        getState()
          ?.said.slice(-40)
          .map((line) => line.text) ?? [],
    });
  };
  function authoredGate() {
    recordingKey = `pass-run-${crypto.randomUUID()}`;
    lab.setPersonaRecording(recordingKey);
    lab.allowPersonaRecording(true);
  }
  async function gate(envelope: PersonaEnvelope | null, fromFile = false) {
    const gateEpoch = ++gateGeneration;
    recordingAck = null;
    stopTracking?.();
    stopTracking = undefined;
    const localPlayer = lab.playerId;
    const key = envelope?.branchId ?? recordingKey;
    lab.setPersonaRecording(key);
    const locallyAllowed = lab.personaRecordingAllowed;
    if (key && (fromFile || !locallyAllowed)) lab.allowPersonaRecording(false);
    if (envelope && shelf.enabled) {
      try {
        const expectedEpoch = await epochFor(localPlayer);
        if (gateEpoch !== gateGeneration) return;
        const association = await shelf.request<{
          sameEpoch: boolean;
          branchId?: string;
          revision?: string;
          recordingEpoch?: string;
        }>({
          action: 'recording',
          castId: envelope.castId,
          envelope,
        });
        const selected =
          association.branchId === envelope.branchId && association.revision === envelope.revision;
        if (
          selected &&
          gateEpoch === gateGeneration &&
          typeof association.recordingEpoch === 'string' &&
          association.recordingEpoch !== expectedEpoch
        )
          lab.allowPersonaRecording(false);
        if (
          selected &&
          gateEpoch === gateGeneration &&
          expectedEpoch !== null &&
          association.recordingEpoch === expectedEpoch &&
          typeof association.recordingEpoch === 'string' &&
          /^[a-f0-9]{64}$/.test(association.recordingEpoch)
        )
          recordingAck = {
            token: association.recordingEpoch,
            revision: envelope.revision,
            choice: gateEpoch,
          };
        if (
          selected &&
          recordingAck?.choice === gateEpoch &&
          association.sameEpoch &&
          expectedEpoch !== null &&
          association.recordingEpoch === expectedEpoch &&
          !fromFile &&
          gateEpoch === gateGeneration
        )
          lab.allowPersonaRecording(true);
      } catch {
        /* Missing bridge keeps imported history local. */
      }
    } else if (key && !fromFile && locallyAllowed) lab.allowPersonaRecording(true);
  }
  function row(envelope: PersonaEnvelope, stage: OneCastRow['stage']) {
    if (!rows.some((r) => r.revision === envelope.revision && r.stage === stage))
      rows.push({
        v: 1,
        probe: 'zeynep',
        arm: 'continuing',
        scope,
        castId: envelope.castId,
        branchId: envelope.branchId,
        revision: envelope.revision,
        parentRevision: envelope.parentRevision,
        stage,
        outcome: 'accepted',
      });
  }
  async function retainRecording(
    envelope: PersonaEnvelope,
    allowRecording: boolean,
    ack: { token: string; choice: number } | null,
  ) {
    if (!ack || ack.choice !== gateGeneration || (allowRecording && !lab.personaRecordingAllowed)) return;
    const choice = gateGeneration;
    const expectedEpoch = allowRecording ? await epochFor(lab.playerId) : ack.token;
    if (
      choice !== gateGeneration ||
      ack.token !== expectedEpoch ||
      (allowRecording && !lab.personaRecordingAllowed)
    )
      return;
    const request = {
      action: 'recording' as const,
      castId: envelope.castId,
      envelope,
      allowRecording,
      recordingEpoch: ack.token,
    };
    try {
      await shelf.request(request);
    } catch {
      /* A stale epoch cannot be refreshed under an earlier choice. */
    }
  }
  async function retainChoice(envelope: PersonaEnvelope, allowRecording: boolean) {
    const epoch = generation;
    const choice = gateGeneration;
    // This identity is observed at the explicit choice, after local approval opens
    // the gate. It cannot be substituted by a later central query's identity.
    const approvedPlayer = allowRecording ? lab.playerId : null;
    const expectedEpoch = allowRecording ? await epochFor(approvedPlayer) : null;
    const current = () =>
      epoch === generation &&
      choice === gateGeneration &&
      (!allowRecording ||
        (expectedEpoch !== null && lab.personaRecordingAllowed && lab.playerId === approvedPlayer));
    if (!current()) return;
    try {
      const association = await shelf.request<{
        branchId?: string;
        revision?: string;
        recordingEpoch?: string;
      }>({ action: 'recording', castId: envelope.castId, envelope });
      if (
        !current() ||
        association.branchId !== envelope.branchId ||
        association.revision !== envelope.revision ||
        typeof association.recordingEpoch !== 'string' ||
        !/^[a-f0-9]{64}$/.test(association.recordingEpoch) ||
        (allowRecording && association.recordingEpoch !== expectedEpoch)
      )
        return;
      await retainRecording(envelope, allowRecording, { token: association.recordingEpoch, choice });
    } catch {
      /* Local choice remains available when the shared bridge is absent. */
    }
  }
  async function accepted(
    envelope: PersonaEnvelope,
    epoch = generation,
    sourceAck?: { token: string; choice: number },
  ) {
    const migrate =
      !!sourceAck && sourceAck.choice === gateGeneration && lab.personaRecordingAllowed && !fileUnlinked;
    const gateEpoch = gateGeneration + 1;
    await gate(envelope, fileUnlinked);
    if (epoch !== generation) return;
    if (
      migrate &&
      sourceAck &&
      gateEpoch === gateGeneration &&
      recordingAck?.choice === gateEpoch &&
      recordingAck.token === sourceAck.token
    ) {
      lab.allowPersonaRecording(true);
      await retainRecording(envelope, true, { token: sourceAck.token, choice: gateEpoch });
      if (epoch !== generation) return;
    }
    pinned = envelope;
    pending = null;
    row(envelope, 'checkpoint');
    const current = run();
    if (current && !current.returnChapter) {
      try {
        localStorage.setItem(DEPARTURE, JSON.stringify(current));
      } catch {
        report('Keep a downloaded copy: this browser could not retain Zeynep’s departure.');
      }
    }
    save();
    lab.milestone('zeynep source checkpoint accepted');
    track();
    emit();
  }
  async function checkpointNow() {
    await shelf.ready;
    const epoch = generation;
    const s = getState();
    if (!s || !shelf.enabled || !zeynepDepartureStatus(s).eligible) return;
    const choice = gateGeneration;
    let recordingEpoch: string | undefined;
    const approvedPlayer = lab.playerId;
    const expectedEpoch = await epochFor(approvedPlayer);
    if (!fileUnlinked && lab.personaRecordingAllowed) {
      try {
        const association = await shelf.request<{ recordingEpoch?: string }>({ action: 'recording' });
        if (
          expectedEpoch !== null &&
          association.recordingEpoch === expectedEpoch &&
          typeof association.recordingEpoch === 'string' &&
          /^[a-f0-9]{64}$/.test(association.recordingEpoch)
        )
          recordingEpoch = association.recordingEpoch;
      } catch {
        /* Continuity still works without a recording association. */
      }
    }
    if (epoch !== generation) return;
    const transfer = await projectZeynep(s);
    if (epoch !== generation) return;
    const previousCheckpoint = pinned?.transfer.checkpoint as
      | { checkpointDigest?: string; sourceNow?: number }
      | undefined;
    if (
      previousCheckpoint?.checkpointDigest === transfer.checkpoint.checkpointDigest &&
      previousCheckpoint?.sourceNow === transfer.checkpoint.sourceNow
    )
      return;
    const envelope = await createPersona({
      format: 'hf-persona/1',
      castId: ZEYNEP_CAST,
      castRevision: '1',
      branchId: pinned?.branchId ?? crypto.randomUUID(),
      parentRevision: pinned?.revision ?? null,
      source: {
        game: 'pass',
        build: lab.build().c ?? 'local',
        engine: ENGINE_VERSION,
        rules: GAME_VERSION.replace('@', '-'),
      },
      transfer,
      limitations: transfer.person.limitations,
    });
    if (epoch !== generation) return;
    const authored =
      !pinned &&
      !importedHistory &&
      !fileUnlinked &&
      lab.personaRecordingAllowed &&
      choice === gateGeneration &&
      !!recordingEpoch;
    // A blocked shelf must still leave the deterministic departure prefix for file return.
    try {
      const prefix = run();
      if (prefix && !prefix.returnChapter)
        localStorage.setItem(DEPARTURE, JSON.stringify({ ...prefix, departureEnvelope: envelope }));
    } catch {}
    try {
      const request = {
        action: 'put' as const,
        envelope,
        authored,
        recordingEpoch: authored ? recordingEpoch : undefined,
      };
      await shelf.request(request);
      if (epoch !== generation) return;
      await accepted(envelope, epoch, recordingEpoch ? { token: recordingEpoch, choice } : undefined);
    } catch {
      if (epoch !== generation) return;
      pending = envelope;
      report(
        'Zeynep’s checkpoint could not replace the browser head. Keep a file, or explicitly start a new branch.',
      );
      lab.milestone('zeynep bridgefail');
    }
  }
  const checkpoint = () => {
    chain = chain
      .then(checkpointNow)
      .catch(() => report('Zeynep cannot leave from this checkpoint. Keep a copy of the run.'));
    return chain;
  };
  async function restore(value?: ContinuitySave, fromFile = false, savedRun = false) {
    await shelf.ready;
    const epoch = ++generation;
    const envelope = value?.envelope ? await validatePersona(value.envelope) : null;
    if (envelope && envelope.castId !== ZEYNEP_CAST) throw new Error('Wrong person');
    const restoredRows = value?.oneCast ?? [];
    const token = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
    const hash = /^[a-f0-9]{64}$/;
    if (
      !Array.isArray(restoredRows) ||
      restoredRows.length > 512 ||
      restoredRows.some(
        (r) =>
          !r ||
          r.v !== 1 ||
          r.probe !== 'zeynep' ||
          r.arm !== 'continuing' ||
          !['shared', 'local', 'file'].includes(r.scope) ||
          r.castId !== ZEYNEP_CAST ||
          typeof r.branchId !== 'string' ||
          !token.test(r.branchId) ||
          !hash.test(r.revision) ||
          !(r.parentRevision === null || hash.test(r.parentRevision)) ||
          !['checkpoint', 'admitted'].includes(r.stage) ||
          r.outcome !== 'accepted',
      )
    )
      throw new Error('Invalid continuity evidence');
    if (epoch !== generation) throw new Error('Another notebook replaced this load.');
    importedHistory = fromFile || (value?.importedHistory ?? savedRun);
    recordingKey = fromFile
      ? `pass-file-${crypto.randomUUID()}`
      : (value?.recordingKey ?? (importedHistory && !envelope ? `pass-saved-${crypto.randomUUID()}` : null));
    fileUnlinked =
      fromFile || value?.fileUnlinked === true || (savedRun && !value?.recordingKey && !envelope);
    if (!value && !fromFile && !savedRun) authoredGate();
    await gate(envelope, fileUnlinked);
    if (epoch !== generation) throw new Error('Another notebook replaced this load.');
    if (savedRun && !lab.personaRecordingAllowed) importedHistory = true;
    pinned = envelope;
    rows = structuredClone(restoredRows);
    pending = null;
    pendingAdmission = null;
    scope = fromFile ? 'file' : (value?.scope ?? 'shared');
  }
  async function fresh(
    prepare: (envelope: PersonaEnvelope, prefix: Export) => GameState | Promise<GameState>,
  ): Promise<GameState | null> {
    await shelf.ready;
    const epoch = ++generation;
    const current = () => {
      if (epoch !== generation) throw new Error('Another notebook replaced this arrival.');
    };
    authoredGate();
    importedHistory = false;
    await gate(null);
    current();
    fileUnlinked = false;
    scope = 'shared';
    pinned = null;
    rows = [];
    pending = null;
    pendingAdmission = null;
    if (!shelf.enabled && !imported) return null;
    try {
      const fromFile = !!imported;
      const arrival =
        imported ?? (await shelf.request<PersonaEnvelope | null>({ action: 'get', castId: ZEYNEP_CAST }));
      current();
      imported = null;
      if (arrival?.source.game !== 'goodhands') return null;
      await validatePersona(arrival);
      current();
      const raw = localStorage.getItem(DEPARTURE);
      if (!raw) {
        report('Zeynep’s return needs her departure notebook on this device. A fresh kitchen is available.');
        return null;
      }
      const prefix = JSON.parse(raw) as ContinuityExport;
      const prepared = await prepare(arrival, prefix);
      current();
      importedHistory = true;
      await gate(arrival, fromFile);
      current();
      const { revision, ...body } = arrival;
      const claim = await createPersona({
        ...body,
        parentRevision: revision,
        transfer: {
          ...body.transfer,
          admission: {
            ...((body.transfer.admission as Record<string, unknown>) ?? {}),
            claimId: crypto.randomUUID(),
          },
        },
        source: {
          game: 'pass',
          build: lab.build().c ?? 'local',
          engine: ENGINE_VERSION,
          rules: GAME_VERSION.replace('@', '-'),
        },
      });
      current();
      try {
        if (!shelf.enabled) throw new Error('Choose local file play explicitly.');
        await shelf.request({ action: 'put', envelope: claim });
        current();
        await gate(claim, fromFile);
        current();
      } catch {
        current();
        pending = claim;
        pendingAdmission = {
          state: prepared,
          arrival,
          fromFile,
          history: structuredClone(prefix.oneCast ?? prefix.continuity?.oneCast ?? []),
        };
        importedHistory = false;
        await gate(null);
        current();
        report(
          'Zeynep’s return could not claim the browser head. The game menu offers an explicit new branch or local return.',
        );
        return null;
      }
      scope = fromFile ? 'file' : 'shared';
      fileUnlinked = fromFile;
      pinned = claim;
      rows = structuredClone(prefix.oneCast ?? prefix.continuity?.oneCast ?? []);
      // The target claim points directly to the accepted source checkpoint.
      row(claim, 'admitted');
      lab.milestone('zeynep return admitted');
      report(
        'Zeynep has returned from the cold-food trial. This chapter does not give her another kitchen job.',
      );
      return prepared;
    } catch {
      current();
      importedHistory = false;
      await gate(null);
      report(
        'Zeynep’s return could not be admitted. Her existing notebook remains available; a fresh kitchen can begin.',
      );
      return null;
    }
  }
  function download(envelope = pending ?? pinned) {
    if (!envelope) return;
    if (envelope === pending && !pendingAdmission) {
      const previousScope = scope;
      scope = 'file';
      row(envelope, 'checkpoint');
      scope = previousScope;
      save();
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(envelope)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pass-zeynep-persona.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function controls() {
    const section = personaControls({
      enabled: shelf.enabled,
      setEnabled: (value) => {
        shelf.setEnabled(value);
        emit();
        if (value) void checkpoint();
      },
      recordingAllowed: lab.personaRecordingAllowed,
      allowRecording: (value) => {
        const choice = ++gateGeneration;
        recordingAck = null;
        const epoch = generation;
        const key = pinned?.branchId ?? recordingKey;
        const player = lab.playerId;
        const current = () =>
          choice === gateGeneration &&
          epoch === generation &&
          key === (pinned?.branchId ?? recordingKey) &&
          player === lab.playerId;
        if (!value) {
          fileUnlinked = true;
          lab.allowPersonaRecording(false);
          if (pinned) void retainChoice(pinned, false);
          save();
          return;
        }
        if (!key) return;
        // Local approval is synchronous. Its exact recording identity binds the
        // subsequent central query and grant; older bridges stay local.
        if (current()) {
          fileUnlinked = false;
          lab.allowPersonaRecording(true);
          if (pinned) void retainChoice(pinned, true);
          save();
          emit();
        }
      },
    });
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = message;
    section.append(status);
    const update = () => {
      if (section.isConnected) status.textContent = message;
      else window.removeEventListener('pass-continuity', update);
    };
    window.addEventListener('pass-continuity', update);
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'application/json';
    file.hidden = true;
    const load = document.createElement('button');
    load.textContent = 'Import a person file for the next new notebook';
    load.onclick = () => file.click();
    file.onchange = () => {
      const selected = file.files?.[0];
      if (!selected) return;
      void selected
        .text()
        .then(JSON.parse)
        .then(validatePersona)
        .then((envelope) => {
          if (envelope.castId !== ZEYNEP_CAST || envelope.source.game !== 'goodhands')
            throw new Error('Unsupported person');
          imported = envelope;
          report('Person file checked. Start a new notebook to attempt Zeynep’s return.');
        })
        .catch(() => report('That file does not contain a supported Zeynep return.'));
    };
    section.append(load, file);
    if (pinned || pending) {
      const backup = document.createElement('button');
      backup.textContent = 'Download Zeynep’s person file';
      backup.onclick = () => download();
      section.append(backup);
    }
    if (pending) {
      const fork = document.createElement('button');
      fork.textContent = 'Start a new branch for this Zeynep';
      fork.onclick = () => {
        chain = chain
          .then(async () => {
            if (!pending) return;
            const epoch = generation;
            const candidate = pending;
            const { revision: _revision, ...body } = candidate;
            const envelope = await createPersona({
              ...body,
              branchId: crypto.randomUUID(),
              parentRevision: null,
            });
            if (epoch !== generation || pending !== candidate) return;
            await shelf.request({ action: 'put', envelope, fork: true });
            if (epoch !== generation || pending !== candidate) return;
            if (pendingAdmission) {
              const admission = pendingAdmission;
              fileUnlinked = admission.fromFile;
              await gate(envelope, fileUnlinked);
              if (epoch !== generation || pending !== candidate) return;
              pinned = envelope;
              pending = null;
              pendingAdmission = null;
              scope = admission.fromFile ? 'file' : 'shared';
              rows = admission.history;
              row(envelope, 'admitted');
              loadReturn(admission.state);
              save();
              track();
            } else await accepted(envelope);
            report('A new Zeynep branch is now active.');
          })
          .catch(() => report('The new branch could not be stored. Keep the person file.'));
      };
      section.append(fork);
      if (pendingAdmission) {
        const local = document.createElement('button');
        local.textContent = 'Play this return locally';
        local.onclick = () => {
          void (async () => {
            if (!pendingAdmission || !pending) return;
            const epoch = generation;
            const admission = pendingAdmission;
            const claim = pending;
            fileUnlinked = true;
            await gate(claim, true);
            if (epoch !== generation || pending !== claim) return;
            pinned = claim;
            pending = null;
            pendingAdmission = null;
            scope = 'local';
            rows = admission.history;
            row(claim, 'admitted');
            loadReturn(admission.state);
            save();
            track();
            report('This return stays local. File export is available.');
          })();
        };
        section.append(local);
      }
    }
    return section;
  }
  return {
    ready: shelf.ready,
    data,
    run,
    restore,
    fresh,
    controls,
    checkpoint,
    track,
    get message() {
      return message;
    },
    startWatching: () => watchPersonaCheckpoint(checkpoint),
  };
}

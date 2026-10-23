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
  let pendingAdmission: { state: GameState; arrival: PersonaEnvelope; history: OneCastRow[] } | null = null;
  let imported: PersonaEnvelope | null = null;
  let message = '';
  let chain: Promise<void> = Promise.resolve();
  let stopTracking: (() => void) | undefined;
  let generation = 0;
  let gateGeneration = 0;
  let scope: OneCastRow['scope'] = 'shared';
  const emit = () => window.dispatchEvent(new Event('pass-continuity'));
  const report = (text: string) => {
    message = text;
    emit();
  };
  const data = (): ContinuitySave => ({ envelope: pinned, oneCast: [...rows] });
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
  async function gate(envelope: PersonaEnvelope | null, fromFile = false) {
    const gateEpoch = ++gateGeneration;
    stopTracking?.();
    stopTracking = undefined;
    lab.setPersonaRecording(envelope?.branchId ?? null);
    if (envelope) lab.allowPersonaRecording(false);
    if (envelope && !fromFile && shelf.enabled) {
      try {
        const association = await shelf.request<{ sameEpoch: boolean }>({
          action: 'recording',
          castId: envelope.castId,
        });
        if (association.sameEpoch && gateEpoch === gateGeneration) lab.allowPersonaRecording(true);
      } catch {
        /* Missing bridge keeps imported history local. */
      }
    }
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
  async function accepted(envelope: PersonaEnvelope, authored: boolean, epoch = generation) {
    if (authored) await gate(envelope);
    if (epoch !== generation) return;
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
    const authored = !pinned;
    // A blocked shelf must still leave the deterministic departure prefix for file return.
    try {
      const prefix = run();
      if (prefix && !prefix.returnChapter)
        localStorage.setItem(DEPARTURE, JSON.stringify({ ...prefix, departureEnvelope: envelope }));
    } catch {}
    try {
      await shelf.request({ action: 'put', envelope, authored });
      if (epoch !== generation) return;
      await accepted(envelope, authored, epoch);
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
  async function restore(value?: ContinuitySave, fromFile = false) {
    await shelf.ready;
    generation++;
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
    await gate(envelope, fromFile);
    pinned = envelope;
    rows = structuredClone(restoredRows);
    pending = null;
    pendingAdmission = null;
    scope = fromFile ? 'file' : 'shared';
  }
  async function fresh(
    prepare: (envelope: PersonaEnvelope, prefix: Export) => GameState | Promise<GameState>,
  ): Promise<GameState | null> {
    await shelf.ready;
    generation++;
    await gate(null);
    pinned = null;
    rows = [];
    pending = null;
    pendingAdmission = null;
    if (!shelf.enabled && !imported) return null;
    try {
      const fromFile = !!imported;
      const arrival =
        imported ?? (await shelf.request<PersonaEnvelope | null>({ action: 'get', castId: ZEYNEP_CAST }));
      imported = null;
      if (arrival?.source.game !== 'goodhands') return null;
      await validatePersona(arrival);
      const raw = localStorage.getItem(DEPARTURE);
      if (!raw) {
        report('Zeynep’s return needs her departure notebook on this device. A fresh kitchen is available.');
        return null;
      }
      const prefix = JSON.parse(raw) as ContinuityExport;
      const prepared = await prepare(arrival, prefix);
      await gate(arrival, fromFile);
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
      try {
        if (!shelf.enabled) throw new Error('Choose local file play explicitly.');
        await shelf.request({ action: 'put', envelope: claim });
      } catch {
        pending = claim;
        pendingAdmission = {
          state: prepared,
          arrival,
          history: structuredClone(prefix.oneCast ?? prefix.continuity?.oneCast ?? []),
        };
        await gate(null);
        report(
          'Zeynep’s return could not claim the browser head. The game menu offers an explicit new branch or local return.',
        );
        return null;
      }
      scope = fromFile ? 'file' : 'shared';
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
        if (!value) {
          lab.allowPersonaRecording(false);
          return;
        }
        if (!pinned) return;
        void shelf
          .request({ action: 'recording', castId: pinned.castId, allowRecording: true })
          .then(() => {
            lab.allowPersonaRecording(true);
            emit();
          })
          .catch(() => {
            lab.allowPersonaRecording(true);
            report('Recording allowed for this visit. The browser shelf could not retain the choice.');
          });
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
            const { revision: _revision, ...body } = pending;
            const envelope = await createPersona({
              ...body,
              branchId: crypto.randomUUID(),
              parentRevision: null,
            });
            await shelf.request({ action: 'put', envelope, fork: true });
            if (pendingAdmission) {
              const admission = pendingAdmission;
              await gate(admission.arrival);
              pinned = envelope;
              pending = null;
              pendingAdmission = null;
              scope = 'shared';
              rows = admission.history;
              row(envelope, 'admitted');
              loadReturn(admission.state);
              save();
              track();
            } else await accepted(envelope, false);
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
            const admission = pendingAdmission;
            const claim = pending;
            await gate(admission.arrival, true);
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

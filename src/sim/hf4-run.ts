/** HF4's sole simulation boundary. The kitchen owns availability and actual outcomes. */
import {
  type ActionResolution,
  createPerson,
  createRun,
  type DeepReadonly,
  exportRun,
  type HostRequest,
  type Input,
  type InspectQuery,
  inspect,
  type Offer,
  type PersonAuthoring,
  type PreviewQuery,
  preview,
  type Result,
  type Run,
  type RunArchive,
  type RunSpec,
  replay,
  restoreRun,
  type StepResult,
  step,
} from '@adam0white/human-framework';

export const MINUTE_MS = 60_000;
export const HF4_HOST = { id: 'pass', edition: 'pass@19', schema: 'pass-hf4/1' } as const;
export function admitted<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`${result.error.code} ${result.error.path}: ${result.error.message}`);
  return result.value;
}
export interface KitchenActivity {
  id: string;
  person: string;
  offer: Offer;
  start: number;
}
export interface KitchenRunState {
  revision: number;
  active: KitchenActivity[];
  completedCount: number;
  completed: {
    sequence: number;
    activity: string;
    person: string;
    action: string;
    at: number;
    status: string;
  }[];
}
export interface KitchenCheckpoint {
  schema: 'pass-hf4/1';
  archive: DeepReadonly<RunArchive>;
  ingress: { minute: number; phase: number; serial: number };
  offers: [string, Offer[]][];
  pending?: DeepReadonly<StepResult>;
}
export type ActualOutcome = NonNullable<ActionResolution['outcome']>['actual'];
/** A callback reports world facts. It must not mutate the live kitchen during staging. */
export interface KitchenWorld {
  available: (person: string, offer: Offer) => boolean;
  outcome: (activity: KitchenActivity, request: DeepReadonly<HostRequest>) => ActualOutcome;
}
const defaultWorld: KitchenWorld = {
  available: () => true,
  outcome: () => ({ exposures: [], observedProgress: [] }),
};
const freshState = (): KitchenRunState => ({ revision: 0, active: [], completed: [], completedCount: 0 });
// Pass uses one consistent numerical resolution for every HF4 batch, including receipts.
const FIDELITY = { mode: 'daily', dayMs: 86_400_000, anchor: 0 } as const;
const worldData = (s: KitchenRunState) =>
  JSON.parse(JSON.stringify({ active: s.active, completedCount: s.completedCount }));

/** One community Run. Actor state is read through inspect, never through archive internals. */
export class KitchenRun {
  private readonly run: Run;
  private state: KitchenRunState;
  private engineStamp: DeepReadonly<RunArchive>['engine'];
  private ingress = { minute: -1, phase: 0, serial: 0 };
  private offers = new Map<string, Offer[]>();
  private at: number;
  private pending?: DeepReadonly<StepResult>;

  constructor(spec: RunSpec, people: readonly PersonAuthoring[]) {
    if (JSON.stringify(spec.host) !== JSON.stringify(HF4_HOST)) throw new Error('Wrong Pass host schema.');
    this.run = admitted(createRun(spec));
    for (const p of people) admitted(createPerson(this.run, p));
    this.engineStamp = exportRun(this.run).engine;
    this.at = spec.start;
    this.state = freshState();
  }

  static restore(value: KitchenCheckpoint): KitchenRun {
    if (
      value.schema !== 'pass-hf4/1' ||
      value.archive.host.id !== HF4_HOST.id ||
      value.archive.host.edition !== HF4_HOST.edition ||
      value.archive.host.schema !== HF4_HOST.schema
    )
      throw new Error('Keep this file. This kitchen needs a new game.');
    const run = admitted(restoreRun(value.archive));
    const data = value.archive.current.world.hostState as unknown as Omit<KitchenRunState, 'revision'>;
    if (
      !data ||
      !Array.isArray(data.active) ||
      !Number.isSafeInteger(data.completedCount) ||
      data.completedCount < 0 ||
      !Number.isSafeInteger(value.ingress.minute) ||
      !Number.isSafeInteger(value.ingress.phase) ||
      value.ingress.phase < 0 ||
      value.ingress.phase >= MINUTE_MS ||
      !Number.isSafeInteger(value.ingress.serial) ||
      value.ingress.serial < 0
    )
      throw new Error('Invalid kitchen checkpoint. Keep this file and start a new game.');
    for (const a of data.active) {
      if (
        !a ||
        typeof a.id !== 'string' ||
        typeof a.person !== 'string' ||
        !Number.isSafeInteger(a.start) ||
        !a.offer ||
        a.offer.person !== a.person
      )
        throw new Error('Invalid active kitchen work.');
    }
    const restored = Object.create(KitchenRun.prototype) as KitchenRun;
    Object.assign(restored, {
      run,
      engineStamp: value.archive.engine,
      at: value.archive.current.at,
      state: { ...structuredClone(data), completed: [], revision: value.archive.current.world.revision },
      pending: value.pending,
      ingress: structuredClone(value.ingress),
      offers: new Map(structuredClone(value.offers)),
    });
    return restored;
  }

  get engine() {
    return this.engineStamp;
  }
  get now() {
    return this.at;
  }
  get active(): readonly KitchenActivity[] {
    return structuredClone(this.state.active);
  }
  get completed() {
    return structuredClone(this.state.completed);
  }
  get completedCount() {
    return this.state.completedCount;
  }
  clearCompleted() {
    this.state.completed = [];
  }
  checkpoint(): KitchenCheckpoint {
    return {
      schema: 'pass-hf4/1',
      archive: exportRun(this.run),
      ...(this.pending ? { pending: this.pending } : {}),
      ingress: { ...this.ingress },
      offers: [...this.offers].map(([id, offers]) => [id, structuredClone(offers)]),
    };
  }
  verify() {
    return admitted(replay(exportRun(this.run)));
  }
  inspect(query: InspectQuery) {
    return admitted(inspect(this.run, query));
  }
  preview(query: PreviewQuery) {
    return admitted(preview(this.run, query));
  }

  /** Persist the exact ingress phase. Never reopen a timestamp already closed by HF. */
  nextInputTime(minute: number): number {
    if (!Number.isSafeInteger(minute) || minute < 0) throw new Error('Invalid kitchen minute.');
    const start = minute * MINUTE_MS;
    const at = Math.max(start, this.at + 1);
    if (at >= start + MINUTE_MS) throw new Error('Too many inputs in this kitchen minute.');
    this.ingress.minute = minute;
    this.ingress.phase = at - start;
    return at;
  }
  input<K extends Input['kind']>(
    kind: K,
    payload: Extract<Input, { kind: K }>['payload'],
    at: number,
  ): Extract<Input, { kind: K }> {
    return {
      id: `pass:${++this.ingress.serial}:${kind}`,
      at,
      source: { type: 'host', id: 'pass' },
      kind,
      payload,
    } as Extract<Input, { kind: K }>;
  }
  decide(
    person: string,
    offers: readonly Offer[],
    minute: number,
    suggestion?: Extract<Input, { kind: 'suggestion.received' }>['payload']['received'],
    world = defaultWorld,
  ) {
    const at = this.nextInputTime(minute);
    const revision = ++this.ingress.serial;
    const inputs: Input[] = [this.input('offers.received', { person, revision, offers }, at)];
    if (suggestion) inputs.push(this.input('suggestion.received', { person, received: suggestion }, at));
    inputs.push(
      this.input(
        'decision.requested',
        { person, reason: 'kitchen choice', treatment: 'ordinary', offerRevision: revision },
        at,
      ),
    );
    const prior = this.offers;
    this.offers = new Map(prior).set(person, structuredClone([...offers]));
    try {
      const result = this.advance(at, inputs, world);
      // Offers are one choice's world facts. Withdraw them before HF's next autonomous decision.
      const clearAt = this.nextInputTime(minute);
      const cleared = this.advance(
        clearAt,
        [this.input('offers.received', { person, revision: ++this.ingress.serial, offers: [] }, clearAt)],
        world,
      );
      return { ...cleared, events: [...result.events, ...cleared.events] };
    } catch (error) {
      this.offers = prior;
      throw error;
    }
  }

  /** Stop after admission when a caller needs to save an unresolved boundary. */
  boundary(until: number, inputs: readonly Input[] = []): DeepReadonly<StepResult> {
    const result = admitted(step(this.run, { until, inputs, fidelity: FIDELITY }));
    this.at = result.at;
    this.pending = result.boundary.type === 'world-required' ? result : undefined;
    return result;
  }
  advance(
    until: number,
    inputs: readonly Input[] = [],
    world = defaultWorld,
    pending?: DeepReadonly<StepResult>,
  ): DeepReadonly<StepResult> {
    pending ??= this.pending;
    if (pending && inputs.length) throw new Error('A pending frame cannot resubmit inputs.');
    let batch = inputs;
    const events: DeepReadonly<StepResult>['events'][number][] = [];
    for (let count = 0; count < 10000; count++) {
      const result = pending ?? admitted(step(this.run, { until, inputs: batch, fidelity: FIDELITY }));
      pending = undefined;
      this.at = result.at;
      events.push(...result.events);
      if (result.boundary.type === 'until') {
        this.pending = undefined;
        return { ...result, events };
      }
      this.pending = result;
      const candidate = structuredClone(this.state);
      const receipts = [...result.boundary.requests]
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
        .map((request) => this.receipt(request, candidate, world));
      // HF validates all receipts atomically. Publish host state only after that admission.
      const accepted = admitted(step(this.run, { until, inputs: receipts, fidelity: FIDELITY }));
      this.state = candidate;
      pending = accepted;
      batch = [];
    }
    throw new Error('Kitchen host did not reach its target.');
  }
  private receipt(
    request: DeepReadonly<HostRequest>,
    candidate: KitchenRunState,
    world: KitchenWorld,
  ): Input {
    const base = {
      requestId: request.id,
      requestHash: request.requestHash,
      worldRevision: candidate.revision,
    };
    const envelope = {
      id: `pass:receipt:${request.id}`,
      at: request.boundaryAt,
      source: { type: 'host' as const, id: 'pass' },
    };
    if (request.kind === 'communication') {
      // The kitchen has no transport here. Game dialogue supplies a separate received-evidence route.
      return {
        ...envelope,
        kind: 'communication.resolved',
        payload: { ...base, speaker: request.speaker, emittedItemIds: [], received: [] },
      };
    }
    const action = { ...base, person: request.person, activityId: request.activityId, stage: request.stage };
    let payload: ActionResolution;
    if (request.stage === 'start') {
      const offer = this.offers.get(request.person)?.find((o) => o.id === request.offerId);
      if (!offer || !world.available(request.person, offer))
        return {
          ...envelope,
          kind: 'action.resolved',
          payload: { ...action, disposition: 'rejected', observations: [] },
        };
      candidate.active.push({
        id: request.activityId,
        person: request.person,
        offer: structuredClone(offer),
        start: request.boundaryAt,
      });
      payload = { ...action, disposition: 'accepted', observations: [] };
    } else {
      const index = candidate.active.findIndex(
        (a) => a.id === request.activityId && a.person === request.person,
      );
      const active = candidate.active[index];
      if (!active) throw new Error('Kitchen has no accepted activity for this receipt.');
      const status = request.stage === 'interrupt' ? ('interrupted' as const) : ('completed' as const);
      candidate.active.splice(index, 1);
      candidate.completed.push({
        sequence: ++candidate.completedCount,
        activity: active.id,
        person: active.person,
        action: active.offer.actionId,
        at: request.boundaryAt,
        status,
      });
      payload = {
        ...action,
        disposition: status,
        observations: [],
        outcome: {
          activityId: active.id,
          offerId: active.offer.id,
          actionId: active.offer.actionId,
          start: active.start,
          end: request.boundaryAt,
          status,
          evidenceId: `pass:outcome:${request.id}`,
          summary: 'The kitchen recorded the actual work.',
          actual: world.outcome(active, request),
          fulfills: [],
          advances: [],
        },
      };
    }
    const expectedRevision = candidate.revision++;
    payload.worldChange = {
      expectedRevision,
      revision: candidate.revision,
      put: [],
      remove: [],
      hostState: worldData(candidate),
    };
    return { ...envelope, kind: 'action.resolved', payload };
  }
}

/** Historical HF3 dispatch plus public HF4 views for the current kitchen. No HF kernels live here. */

import type {
  DeepReadonly,
  Input,
  Offer,
  PersonView,
  PortableAdmission,
  StepResult,
} from '@adam0white/human-framework';
import type {
  Affordance,
  DecisionRecord,
  Person,
  Suggestion,
  SuggestionResolution,
} from '@adam0white/human-framework-legacy';
import * as historical from '@adam0white/human-framework-legacy';
import { type KitchenOffer, kitchenOffer, kitchenPeople, kitchenSpec } from './hf4-authoring.ts';
import { type KitchenCheckpoint, KitchenRun, type KitchenWorld, MINUTE_MS } from './hf4-run.ts';

export * from '@adam0white/human-framework-legacy';

type Community = {
  run: KitchenRun;
  people: Person[];
  last: Map<string, DecisionRecord>;
  world: KitchenWorld;
  settled?: () => void;
};
const communities = new WeakMap<Person, Community>();
export const isHF4 = (p: Person) => communities.has(p);
const needCommunity = (p: Person) => {
  const c = communities.get(p);
  if (!c) throw new Error('Missing kitchen Run.');
  return c;
};
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const legacyOffer = (o: Offer): Affordance =>
  ({
    id: o.id,
    action: o.actionId,
    label: o.label,
    duration: o.durationMs / MINUTE_MS,
    effort: o.demands.effort,
    focus: o.demands.focus,
    mode: o.demands.mode,
    advertises: clone(o.expected.needs),
    material: o.expected.material,
    placeId: o.place,
  }) as Affordance;
const parts = (view: DeepReadonly<PersonView>) =>
  Object.fromEntries(view.parts.map((p) => [p.select, p.value])) as Record<string, any>;
function refresh(c: Community) {
  const views = c.run.inspect({
    perspective: { kind: 'host' },
    people: c.people.map((p) => p.id),
    select: ['summary', 'body', 'skills', 'traits', 'relationships', 'agenda', 'promptings', 'review'],
  });
  for (const v of views.people) {
    const p = c.people.find((p) => p.id === v.id);
    if (!p) continue;
    const x = parts(v),
      activity = c.run.active.find((a) => a.person === p.id);
    const promptings = clone(x.promptings) as NonNullable<Person['promptings']>;
    // Kitchen captions and retained readings use whole kitchen minutes.
    for (const record of promptings.recent) record.at = Math.floor(record.at / MINUTE_MS);
    for (const response of promptings.responses)
      response.lastUsedAt = Math.floor(response.lastUsedAt / MINUTE_MS);
    for (const echo of Object.values(promptings.echo)) echo.at = Math.floor(echo.at / MINUTE_MS);
    Object.assign(p, {
      name: x.summary.name,
      now: Math.floor(c.run.now / MINUTE_MS),
      traits: clone(x.traits),
      body: clone(x.body.state),
      skills: Object.fromEntries(
        x.skills.map((s: any) => [
          s.id,
          { level: s.competence, practiced: s.practicedMs / MINUTE_MS, lastAt: s.lastPracticed / MINUTE_MS },
        ]),
      ),
      will: { voices: clone(x.relationships.voices) },
      agenda: clone(x.agenda),
      promptings,
      review: clone(x.review),
      activity: activity
        ? {
            affordanceId: activity.offer.id,
            action: activity.offer.actionId,
            startedAt: activity.start / MINUTE_MS,
            endsAt: (activity.start + activity.offer.durationMs) / MINUTE_MS,
            reviewAt: (Math.floor(c.run.now / (5 * MINUTE_MS)) + 1) * 5,
            effort: activity.offer.demands.effort,
            affordance: legacyOffer(activity.offer),
            suggestion: c.last.get(p.id)?.suggestion,
          }
        : null,
    });
    for (const k of p.agenda.commitments) {
      k.from /= MINUTE_MS;
      k.until /= MINUTE_MS;
    }
    Object.defineProperty(p, 'hf4Readout', { configurable: true, value: clone(x.body.readout) });
  }
  c.settled?.();
  if (c.settled) c.run.clearCompleted();
}
export function freshCommunity(seed: number, portable: Record<string, PortableAdmission> = {}) {
  const authored = kitchenPeople();
  for (const a of authored)
    if (portable[a.id]) {
      a.state.heldNorms = [];
      a.state.agenda.commitments = [];
      a.portable = portable[a.id];
    }
  const people = authored.map(
    (a) =>
      ({
        id: a.id,
        name: a.identity.name,
        now: 540,
        traits: clone(a.state.traits),
        lexicon: { plainEnglish: true },
      }) as unknown as Person,
  );
  const c: Community = {
    run: new KitchenRun(kitchenSpec(seed), authored),
    people,
    last: new Map(),
    world: { available: () => true, outcome: () => ({ exposures: [], observedProgress: [] }) },
  };
  for (const p of people) communities.set(p, c);
  refresh(c);
  return c;
}
export function checkpoint(p: Person): KitchenCheckpoint {
  return needCommunity(p).run.checkpoint();
}
export function restoreCommunity(saved: KitchenCheckpoint, readings: readonly Person[] = []) {
  const c = freshCommunity(saved.archive.initial.spec.seed);
  c.run = KitchenRun.restore(saved);
  for (const p of readings)
    if (p.activity?.suggestion)
      c.last.set(p.id, { suggestion: clone(p.activity.suggestion) } as DecisionRecord);
  refresh(c);
  return c;
}
export function setKitchenWorld(p: Person, world: KitchenWorld, settled?: () => void) {
  const c = needCommunity(p);
  c.world = world;
  c.settled = settled;
}
export function verifyCommunity(p: Person) {
  return needCommunity(p).run.verify();
}
export function communityRun(p: Person) {
  return needCommunity(p).run;
}
function submit(p: Person, kind: Input['kind'], payload: any, minute = p.now) {
  const c = needCommunity(p),
    at = c.run.nextInputTime(Math.max(minute, Math.floor(c.run.now / MINUTE_MS)));
  const result = c.run.advance(at, [c.run.input(kind, payload, at)], c.world);
  refresh(c);
  return result;
}
const rendered = (result: DeepReadonly<StepResult>) =>
  result.events.flatMap((e) => e.narration.map((n) => n.text)).join(' ');
function decision(result: DeepReadonly<StepResult>, p: Person): DecisionRecord {
  const event = [...result.events].reverse().find((e) => e.person === p.id && e.data.kind === 'decision');
  if (!event || event.data.kind !== 'decision')
    throw new Error('HF did not return the requested kitchen decision.');
  const d = clone(event.data.decision) as unknown as DecisionRecord;
  d.at /= MINUTE_MS;
  if (d.suggestion) d.suggestion.says = rendered(result) || d.suggestion.reason;
  return d;
}
export function decide(
  p: Person,
  offers: readonly Affordance[],
  options: Parameters<typeof historical.decide>[2] = {},
): DecisionRecord {
  if (!isHF4(p)) return historical.decide(p, offers, options);
  const c = needCommunity(p),
    received = options.suggestion
      ? {
          kind: 'ordinary' as const,
          suggestion: { ...clone(options.suggestion), adviceId: `pass:chef:${c.run.now}` },
        }
      : undefined;
  const result = c.run.decide(
    p.id,
    offers.map((a) => kitchenOffer(p.id, a as KitchenOffer)),
    Math.max(Math.floor(c.run.now / MINUTE_MS), Math.floor(options.now ?? p.now)),
    received,
    c.world,
  );
  const d = decision(result, p);
  c.last.set(p.id, d);
  refresh(c);
  return d;
}
export function begin(p: Person, a: Affordance, d: DecisionRecord) {
  if (!isHF4(p)) return historical.begin(p, a, d);
  return p.activity?.affordanceId === a.id && d.chosenAffordanceId === a.id;
}
export function tick(p: Person, at: number) {
  if (!isHF4(p)) return historical.tick(p, at);
  const c = needCommunity(p),
    until = Math.round(at * MINUTE_MS);
  if (until > c.run.now) c.run.advance(until, [], c.world);
  refresh(c);
}
export function interrupt(p: Person, at: number, reason: string) {
  if (!isHF4(p)) return historical.interrupt(p, at, reason);
  const c = needCommunity(p),
    a = c.run.active.find((a) => a.person === p.id);
  if (a) submit(p, 'activity.interrupted', { person: p.id, activityId: a.id, reason }, at);
}
export function finish(p: Person, out: Parameters<typeof historical.finish>[1]) {
  if (!isHF4(p)) return historical.finish(p, out);
  // HF owns natural completion. Ending an earlier span is an actual host interruption.
  const c = needCommunity(p),
    a = c.run.active.find((a) => a.person === p.id && a.offer.id === out.affordanceId);
  if (a) interrupt(p, out.at, 'kitchen ended this work span');
}
export function readPerson(p: Person) {
  if (!isHF4(p)) return historical.readPerson(p);
  return { body: (p as any).hf4Readout } as ReturnType<typeof historical.readPerson>;
}
export function reviewed(p: Person) {
  if (isHF4(p)) throw new Error('HF4 reviews through its public decision input.');
  return historical.reviewed(p);
}
export function promise(p: Person, value: Parameters<typeof historical.promise>[1]) {
  if (!isHF4(p)) return historical.promise(p, value);
  const c = needCommunity(p),
    { recurEvery, ...rest } = value;
  submit(p, 'agenda.requested', {
    person: p.id,
    request: {
      type: 'commit',
      commitment: {
        ...rest,
        id: `pass:${p.id}:commitment:${c.run.now}`,
        from: Math.round(value.from * MINUTE_MS),
        until: Math.round(value.until * MINUTE_MS),
        ...(recurEvery ? { recurEveryMs: recurEvery * MINUTE_MS } : {}),
      },
    },
  });
}
export function releaseCommitment(p: Person, id: string) {
  if (!isHF4(p)) return historical.releaseCommitment(p, id);
  submit(p, 'agenda.requested', {
    person: p.id,
    request: { type: 'release', commitmentId: id, authority: 'chef' },
  });
}
export function socialEvent(p: Person, e: Parameters<typeof historical.socialEvent>[1]) {
  if (!isHF4(p)) return historical.socialEvent(p, e);
  submit(
    p,
    'social.received',
    {
      person: p.id,
      evidenceId: `pass:social:${needCommunity(p).run.now}`,
      other: e.otherId,
      event: { kind: e.kind, byMe: e.byMe, magnitude: e.magnitude },
    },
    e.at,
  );
}
export function acquaintPerson(observer: Person, target: Person, familiarity: number, at: number) {
  if (!isHF4(observer)) return historical.acquaintPerson(observer, target, familiarity, at);
  submit(
    observer,
    'acquaintance.received',
    {
      person: observer.id,
      target: target.id,
      familiarity,
      known: [],
      evidenceId: `pass:met:${target.id}:${at}`,
    },
    at,
  );
}
export function glimpsePerson(observer: Person, target: Person, at: number, clarity: number) {
  if (!isHF4(observer)) return historical.glimpsePerson(observer, target, at, clarity);
  const c = needCommunity(observer),
    view = c.run.inspect({ perspective: { kind: 'host' }, people: [target.id], select: ['condition'] })
      .people[0];
  if (!view) throw new Error('Missing observed cook.');
  const condition = parts(view).condition;
  submit(
    observer,
    'person.glimpsed',
    {
      person: observer.id,
      target: target.id,
      clarity,
      signs: condition.outwardSigns,
      evidenceId: `pass:seen:${target.id}:${at}`,
    },
    at,
  );
}
function predicted(
  observer: Person,
  target: Person,
  offers: readonly Affordance[],
  suggestion: Suggestion,
): { resolution: SuggestionResolution; confidence: number } {
  const c = needCommunity(observer),
    at = c.run.now,
    revision = 1;
  const inputs: Input[] = [
    {
      id: 'pass:hypothetical:offers',
      at,
      source: { type: 'host', id: 'pass' },
      kind: 'offers.received',
      payload: {
        person: target.id,
        revision,
        offers: offers.map((a) => kitchenOffer(target.id, a as KitchenOffer)),
      },
    },
    {
      id: 'pass:hypothetical:suggestion',
      at,
      source: { type: 'host', id: 'pass' },
      kind: 'suggestion.received',
      payload: {
        person: target.id,
        received: { kind: 'ordinary', suggestion: { ...suggestion, adviceId: 'pass:hypothetical:advice' } },
      },
    },
    {
      id: 'pass:hypothetical:decision',
      at,
      source: { type: 'host', id: 'pass' },
      kind: 'decision.requested',
      payload: {
        person: target.id,
        reason: 'hypothetical kitchen request',
        treatment: 'ordinary',
        offerRevision: revision,
      },
    },
  ];
  const result = c.run.preview({
    perspective: { kind: 'person', observer: observer.id },
    person: target.id,
    until: at,
    inputs,
  });
  const event = result.possibilities.find((e) => e.data.kind === 'decision');
  if (!event || event.data.kind !== 'decision' || !event.data.decision.suggestion)
    throw new Error('HF did not return a hypothetical kitchen answer.');
  const resolution = {
    ...clone(event.data.decision.suggestion),
    says: event.narration.map((n) => n.text).join(' ') || event.data.decision.suggestion.reason,
  } as SuggestionResolution;
  const confidence = result.impression?.cues.length
    ? Math.min(...result.impression.cues.map((c) => c.confidence))
    : 0;
  return { resolution, confidence };
}
export function predictAs(
  observer: Person,
  target: Person,
  offers: Affordance[],
  suggestion: Suggestion,
  options?: Parameters<typeof historical.predictAs>[4],
) {
  if (!isHF4(observer)) return historical.predictAs(observer, target, offers, suggestion, options);
  return predicted(observer, target, offers, suggestion);
}
export function predict(p: Person, offers: Affordance[], suggestion: Suggestion) {
  if (!isHF4(p)) return historical.predict(p, offers, suggestion);
  return predicted(p, p, offers, suggestion).resolution;
}
export function reviewLine(p: Person, options?: Parameters<typeof historical.reviewLine>[1]) {
  if (!isHF4(p)) return historical.reviewLine(p, options);
  return narration(p, 'review').at(-1) ?? '';
}
export function perceive(p: Person, percepts: Parameters<typeof historical.perceive>[1]) {
  if (!isHF4(p)) return historical.perceive(p, percepts);
  submit(p, 'observation.received', {
    person: p.id,
    evidenceId: `pass:observation:${needCommunity(p).run.now}`,
    percepts: percepts.map(({ at, ...x }, index) => ({
      ...x,
      id: `pass:percept:${needCommunity(p).run.now}:${index}`,
      occurredAt: Math.round(at * MINUTE_MS),
      claims: [],
      norms: [],
      advice: [],
      consequences: [],
      withdrawConsequences: [],
      witnesses: [],
      reports: [],
      provenance: ['pass:world'],
    })),
  });
}
export function learnPromptingResponse(
  p: Person,
  response: Extract<Input, { kind: 'prompting.response-learned' }>['payload']['response'],
) {
  submit(p, 'prompting.response-learned', { person: p.id, response });
}

export function livedHours(
  p: Person,
  tasks: readonly { person: Person; affordance: Affordance; at: number }[],
  until: number,
) {
  const c = needCommunity(p);
  const scheduled = new Set(tasks.map((t) => t.person.id)),
    outside = c.people.filter((p) => !scheduled.has(p.id));
  const homeTasks = tasks
    .filter((t) => t.person.id === 'chef')
    .flatMap((t) => outside.map((person) => ({ ...t, person })));
  const allTasks = [...tasks, ...homeTasks];
  const bathroom = allTasks
    .filter((t) => ['meal', 'sleep'].includes(t.affordance.action))
    .map((t) => ({
      ...t,
      at: t.at - 4,
      affordance: {
        id: 'toilet',
        action: 'toilet',
        label: 'use the bathroom',
        duration: 3,
        effort: 0,
        advertises: { relief: 0.4 },
      },
    }));
  for (const task of [...allTasks, ...bathroom].sort(
    (a, b) => a.at - b.at || a.person.id.localeCompare(b.person.id),
  )) {
    tick(task.person, task.at);
    if (task.person.activity) interrupt(task.person, task.at, 'next authored home activity');
    decide(task.person, [task.affordance], { now: task.at });
  }
  const finish = Math.max(until * MINUTE_MS, ...c.run.active.map((a) => a.start + a.offer.durationMs));
  if (finish > c.run.now) c.run.advance(finish, [], c.world);
  refresh(c);
}
export function personFromCommunity(p: Person, id: string) {
  const result = needCommunity(p).people.find((p) => p.id === id);
  if (!result) throw new Error('Person is outside this kitchen.');
  return result;
}
export function observeNarrationLine(p: Person) {
  const c = needCommunity(p),
    v = c.run.inspect({
      perspective: { kind: 'person', observer: p.id },
      people: [p.id],
      select: ['events'],
    });
  return v.events.flatMap((e) => e.narration.map((n) => n.text));
}

export function narration(p: Person, kind: 'review' | 'prompting' | 'day-closed') {
  const c = needCommunity(p),
    v = c.run.inspect({
      perspective: { kind: 'person', observer: p.id },
      people: [p.id],
      select: ['events'],
    });
  return v.events.filter((e) => e.data.kind === kind).flatMap((e) => e.narration.map((n) => n.text));
}

export function visibleFatigue(observer: Person, target: Person) {
  if (!isHF4(observer)) return historical.readPerson(target).body.perceived.fatigue;
  const view = needCommunity(observer).run.inspect({
    perspective: { kind: 'person', observer: observer.id },
    people: [target.id],
    select: ['condition'],
  }).people[0];
  if (!view) throw new Error('Missing observed cook.');
  return parts(view).condition.cues.find((c: { key: string }) => c.key === 'fatigue')?.value ?? 0;
}

let currentStamp: ReturnType<typeof frameworkEngine> | undefined;
export function frameworkEngine(): KitchenCheckpoint['archive']['engine'] {
  currentStamp ??= new KitchenRun(kitchenSpec(0), []).engine;
  return currentStamp;
}

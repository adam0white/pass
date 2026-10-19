/**
 * The Pass: the kitchen host. Pure and deterministic: state is plain JSON, world draws come from `rng.ts` keyed
 * by night and ticket index, and every player input is stamped with the sim minute it applies at. Replaying the
 * same seed and input log rebuilds the same state (`replay`).
 *
 * Covers: tickets, stations, plates, the pass, walkouts, the till and the jar; the cooks' decisions through HF
 * (decide/begin/finish, predict for the telegraph, answerNow-free: a player ask interrupts and is resolved at the
 * cook's next decision in the same minute); the hours between services lived through HF (meals, sleep, the
 * evening review at 22:30). Does not cover: front of house, customers as people, spatial movement.
 */
import {
  type Activity,
  type Affordance,
  begin,
  bodyForecast,
  type DecisionRecord,
  decide,
  enablePromptings,
  finish,
  interrupt,
  type Outcome,
  type Person,
  perceive,
  predict,
  promise,
  promptingLine,
  readPerson,
  restore,
  reviewed,
  reviewLine,
  type Suggestion,
  type SuggestionResolution,
  snapshot,
  tick,
} from '@adam0white/human-framework';
import {
  CHEF,
  CLOSE,
  COOKS,
  type CookId,
  dayStart,
  HOME_STATION,
  makeCook,
  NAMES,
  OPEN,
  RUSH_TO,
  STATIONS,
  type Station,
} from './cooks.ts';
import { hashUnit } from './rng.ts';

export const GAME_VERSION = 'pass@1';
export const NIGHTS = 6;
export const BANK_TARGET = 5200;
export const PRICE = 40;
const PATIENCE = 38;
const GRILL_WORK = 5;
const COLD_WORK = 3.5;
const WASH_WORK = 1.4;
const PLATES = 12;
const WAGE = 6;

export type Verb = Station | 'break' | 'eat' | 'home';
export type Input =
  | { at: number; kind: 'ask'; cook: CookId; verb: Verb; insist?: boolean }
  | { at: number; kind: 'jar'; choice: 'move' | 'talk' | 'leave' }
  | { at: number; kind: 'call'; choice: 'go' | 'stay' }
  | { at: number; kind: 'open' };

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewInput = DistOmit<Input, 'at'>;

export interface Ticket {
  id: number;
  table: number;
  at: number;
  grill: number;
  cold: number;
  doneGrill: number;
  doneCold: number;
  critic?: boolean;
  status: 'waiting' | 'open' | 'served' | 'walked';
  servedAt?: number;
}

export interface Said {
  at: number;
  who: CookId | 'narrator';
  text: string;
  kind: 'answer' | 'journal' | 'prompt' | 'call';
}

export interface CookState {
  id: CookId;
  here: boolean;
  /** Left for the night (walked out or let go). */
  gone: boolean;
  pending: { s: Suggestion; verb: Verb } | null;
  deferred: { s: Suggestion; verb: Verb; until: number } | null;
  idleUntil: number;
  progress: number;
  night: { asked: number; insisted: number; refused: number; complied: number; assented: number };
  trustAtOpen: number;
}

export interface NightReport {
  night: number;
  served: number;
  walked: number;
  takings: number;
  tips: number;
  skimmed: number;
  critic?: 'pleased' | 'walked' | 'cold';
  reviews: { id: CookId; line: string; aboutYou: string }[];
}

export interface GameState {
  version: string;
  seed: number;
  night: number;
  phase: 'service' | 'evening' | 'end';
  minute: number;
  people: Person[];
  cooks: CookState[];
  tickets: Ticket[];
  plates: { clean: number; pile: number; dirty: { at: number }[] };
  lastPromptAt: Record<string, number>;
  work: { grill: number; cold: number };
  till: number;
  jar: number;
  jarSkimmed: number;
  jarPlace: 'counter' | 'pass';
  talkedToRafi: boolean;
  call: 'none' | 'asking' | 'went' | 'stayed' | 'refused';
  said: Said[];
  reports: NightReport[];
  inputs: Input[];
  applied: number;
}

// ---------- the nights ----------

export interface NightPlan {
  tables: number;
  cooks: CookId[];
  title: string;
  intro: string[];
}

export const PLANS: NightPlan[] = [
  {
    tables: 15,
    cooks: ['selim', 'dilek'],
    title: 'Monday',
    intro: [
      'Nevin left me the lokanta, its debts, and two cooks who still call it hers.',
      'The bank wants the arrears by Saturday close.',
      'Doors open. Tap a cook, then a job. Hold to insist.',
    ],
  },
  {
    tables: 20,
    cooks: ['selim', 'dilek', 'rafi'],
    title: 'Tuesday',
    intro: ['Rafi is back on the dish pit. Without clean plates nothing leaves the pass.'],
  },
  {
    tables: 23,
    cooks: ['selim', 'dilek', 'rafi'],
    title: 'Wednesday',
    intro: ['The tip jar sits by the back door, where Nevin always kept it.'],
  },
  {
    tables: 31,
    cooks: ['selim', 'dilek', 'rafi'],
    title: 'Thursday',
    intro: ['The derby is on at eight. The whole street will want feeding after.'],
  },
  {
    tables: 27,
    cooks: ['selim', 'dilek', 'rafi'],
    title: 'Friday',
    intro: ['Word is a food writer is coming tonight. Nobody knows which table.'],
  },
  {
    tables: 33,
    cooks: ['selim', 'dilek', 'rafi'],
    title: 'Saturday',
    intro: ['Last night before the bank. Whatever is in the till at close is what we have.'],
  },
];

const nightStart = (night: number) => (night - 1) * 1440;
export const openAt = (night: number) => nightStart(night) + OPEN;
export const closeAt = (night: number) => nightStart(night) + CLOSE;

/** Pre-roll a night's tables from the seed alone: no input can move a later table. */
export function rollTickets(seed: number, night: number, firstId: number): Ticket[] {
  const plan = PLANS[night - 1] as NightPlan;
  const out: Ticket[] = [];
  const span = CLOSE - 45 - OPEN;
  for (let k = 0; k < plan.tables; k++) {
    // Arrivals bunch toward the middle of the evening (a triangular draw), Thursday later (the derby).
    const u = (hashUnit(seed, 11, night, k) + hashUnit(seed, 12, night, k)) / 2;
    const shift = night === 4 ? 0.12 : 0;
    let off = Math.round(Math.min(1, u + shift) * span);
    if (k === 0) off = 1;
    const g = hashUnit(seed, 13, night, k);
    const c = hashUnit(seed, 14, night, k);
    out.push({
      id: firstId + k,
      table: 1 + Math.floor(hashUnit(seed, 15, night, k) * 9),
      at: openAt(night) + off,
      grill: g < 0.25 ? 0 : g < 0.8 ? 1 : 2,
      cold: c < 0.3 ? 0 : c < 0.85 ? 1 : 2,
      doneGrill: 0,
      doneCold: 0,
      status: 'waiting',
    });
    const t = out.at(-1) as Ticket;
    if (t.grill + t.cold === 0) t.cold = 1;
  }
  if (night === 5) {
    const k = Math.floor(hashUnit(seed, 16, night) * plan.tables * 0.6) + 2;
    const t = out[Math.min(k, out.length - 1)];
    if (t) {
      t.critic = true;
      t.grill = Math.max(1, t.grill);
    }
  }
  return out.sort((a, b) => a.at - b.at || a.id - b.id);
}

// ---------- setup ----------

export function newGame(seed: number): GameState {
  const now = 9 * 60;
  const people = COOKS.map((id) => makeCook(id, seed, now));
  const s: GameState = {
    version: GAME_VERSION,
    seed,
    night: 1,
    phase: 'service',
    minute: now,
    people,
    cooks: COOKS.map((id) => ({
      id,
      here: false,
      gone: false,
      pending: null,
      deferred: null,
      idleUntil: 0,
      progress: 0,
      night: blankNight(),
      trustAtOpen: 0,
    })),
    tickets: [],
    plates: { clean: PLATES, pile: 0, dirty: [] },
    lastPromptAt: {},
    work: { grill: 0, cold: 0 },
    till: 0,
    jar: 0,
    jarSkimmed: 0,
    jarPlace: 'counter',
    talkedToRafi: false,
    call: 'none',
    said: [],
    reports: [],
    inputs: [],
    applied: 0,
  };
  dayHours(s, 1);
  startNight(s, 1);
  return s;
}

const blankNight = () => ({ asked: 0, insisted: 0, refused: 0, complied: 0, assented: 0 });

export const personOf = (s: GameState, id: CookId): Person => s.people.find((p) => p.id === id) as Person;
export const cookOf = (s: GameState, id: CookId): CookState => s.cooks.find((c) => c.id === id) as CookState;
const trustOf = (p: Person) => p.will.voices.find((v) => v.voiceId === CHEF)?.trust ?? 0.5;

/** Live the day before a service: meals, an afternoon, arriving at 17:00. */
function dayHours(s: GameState, night: number) {
  const d = nightStart(night);
  for (const p of s.people) {
    if (p.activity) endActivity(p, 'interrupted', Math.max(p.now, p.activity.startedAt));
    hostAct(p, offer('meal', { duration: 30, advertises: { food: 0.6, water: 0.6 } }), d + 10 * 60);
    hostAct(p, offer('meal', { duration: 30, advertises: { food: 0.6, water: 0.6 } }), d + 14 * 60);
    hostAct(p, offer('wait', { duration: 20 }), d + 17 * 60);
  }
  s.minute = d + 17 * 60 + 20;
}

/** Live the hours after a service: home, a late meal, the evening review, sleep. */
function nightHours(s: GameState, night: number) {
  const d = nightStart(night);
  for (const p of s.people) {
    if (p.activity) endActivity(p, 'interrupted', Math.max(p.now, p.activity.startedAt));
    const at = Math.max(p.now, d + CLOSE + 5);
    hostAct(p, offer('meal', { duration: 30, advertises: { food: 0.5, water: 0.5 } }), at);
    hostAct(p, offer('rest', { duration: 30, advertises: { rest: 0.3 } }), Math.max(p.now, d + 22 * 60 + 40));
    tick(p, Math.max(p.now, d + 23 * 60 + 5));
  }
}

function sleepHours(s: GameState, night: number) {
  const d = nightStart(night);
  for (const p of s.people) {
    hostAct(
      p,
      offer('sleep', { mode: 'sleep', duration: 9 * 60, effort: 0, advertises: { sleep: 1, rest: 0.5 } }),
      Math.max(p.now, d + 23 * 60 + 30),
    );
  }
}

function startNight(s: GameState, night: number) {
  const plan = PLANS[night - 1] as NightPlan;
  s.night = night;
  s.phase = 'service';
  s.minute = openAt(night) - 5;
  const firstId = (s.tickets.at(-1)?.id ?? 0) + 1;
  s.tickets = rollTickets(s.seed, night, firstId);
  s.plates = { clean: PLATES, pile: 0, dirty: [] };
  s.work = { grill: 0, cold: 0 };
  s.call = 'none';
  for (const c of s.cooks) {
    const p = personOf(s, c.id);
    c.here = plan.cooks.includes(c.id);
    c.gone = false;
    c.pending = null;
    c.deferred = null;
    c.idleUntil = s.minute;
    c.progress = 0;
    c.night = blankNight();
    c.trustAtOpen = trustOf(p);
    tick(p, Math.max(p.now, s.minute));
  }
  for (const line of night === 1 ? plan.intro.slice(2) : plan.intro) say(s, 'narrator', line, 'journal');
  if (night === 5) {
    const dilek = personOf(s, 'dilek');
    // Dilek's mother lives alone; tonight she will call.
    promise(dilek, {
      kind: 'promise',
      toId: 'mother',
      label: 'going to my mother',
      actions: ['home'],
      from: nightStart(5) + 19 * 60 + 45,
      until: nightStart(5) + 21 * 60,
      importance: 0.75,
    });
  }
}

// ---------- offers ----------

function offer(id: string, over: Partial<Affordance> = {}): Affordance {
  return { id, action: id, label: id, duration: 20, effort: 0.05, advertises: {}, ...over };
}

function remainingRush(s: GameState): number {
  // Until the rush ends (or the hour after it), capped at two hours: what a cook can see ahead.
  const rushEnd = nightStart(s.night) + RUSH_TO + 30;
  return Math.min(120, Math.max(0, rushEnd - s.minute));
}

const LABEL: Record<Verb, string> = {
  grill: 'work the grill',
  cold: 'work the cold side',
  dish: 'wash plates',
  break: 'take ten out back',
  eat: 'eat something',
  home: 'go home',
};

export function offersFor(s: GameState, id: CookId): Affordance[] {
  const p = personOf(s, id);
  const left = remainingRush(s);
  const list: Affordance[] = [];
  for (const st of STATIONS) {
    if (st === 'dish' && s.night === 1) continue;
    const effort = st === 'grill' ? 0.75 : st === 'cold' ? 0.58 : 0.62;
    const a = offer(st, {
      label: LABEL[st],
      duration: 25,
      effort,
      focus: 0.5,
      placeId: 'line',
      skill: { id: st, difficulty: st === 'grill' ? 0.5 : 0.35 },
      // Honest per person: a station you are good at feels like competence; your own station, like standing.
      advertises: {
        competence: 0.1 + 0.35 * (p.skills[st]?.level ?? 0.3),
        esteem: st === HOME_STATION[id] ? 0.2 : 0.05,
        belonging: 0.05,
      },
      tags: ['work'],
      // Paid by the hour: a stretch on the line is a stretch of wages.
      material: WAGE,
    });
    if (left > 45)
      a.followedBy = [{ label: 'the rest of the rush', duration: left - 25, effort: effort * 0.9 }];
    list.push(a);
  }
  list.push(
    offer('break', {
      action: 'rest',
      label: LABEL.break,
      duration: 10,
      effort: 0,
      advertises: { rest: 0.35, leisure: 0.1 },
    }),
  );
  list.push(
    offer('eat', {
      label: LABEL.eat,
      duration: 12,
      effort: 0,
      advertises: { food: 0.5, water: 0.4 },
    }),
  );
  list.push(offer('wait', { label: 'catch my breath', duration: 5, effort: 0, advertises: {} }));
  list.push(
    offer('home', {
      label: LABEL.home,
      duration: 30,
      effort: 0.1,
      advertises: { rest: 0.5, sleep: 0.2 },
    }),
  );
  if (id === 'dilek')
    list.push(
      offer('smoke', {
        label: 'have a cigarette in the yard',
        duration: 7,
        effort: 0,
        placeId: 'line',
        advertises: { leisure: 0.25, relief: 0.1 },
      }),
    );
  if (id === 'rafi' && s.night >= 3 && s.jarPlace === 'counter' && s.jar >= 10)
    list.push(
      offer('skim', {
        label: 'take a few notes from the jar',
        duration: 2,
        effort: 0,
        placeId: 'line',
        material: 3,
        advertises: {},
        norms: [{ normId: 'theft', relation: 'violates' }],
      }),
    );
  const m = s.minute - nightStart(s.night);
  if (id === 'selim' && m >= 18 * 60 + 35 && m <= 19 * 60 + 15)
    list.push(
      offer('pray', {
        label: 'pray maghrib',
        duration: 8,
        effort: 0,
        advertises: { meaning: 0.3 },
        norms: [{ normId: 'salah', relation: 'fulfills' }],
      }),
    );
  return list;
}

const verbAffordance = (verb: Verb) => verb;

// ---------- the telegraph ----------

export interface Hint {
  verb: Verb;
  verdict: SuggestionResolution['verdict'];
  says: string;
  short: string;
}

/** What each cook would likely say to each verb, right now. Pure: no state change, no randomness. */
export function hints(s: GameState, id: CookId, insist = false): Hint[] {
  const p = personOf(s, id);
  const offers = offersFor(s, id);
  const verbs: Verb[] = [...STATIONS.filter((x) => !(x === 'dish' && s.night === 1)), 'break', 'eat', 'home'];
  return verbs.map((verb) => {
    const r = predict(p, offers, suggestion(verb, insist));
    return { verb, verdict: r.verdict, says: r.says, short: shortOf(r) };
  });
}

export function forecastLine(s: GameState, id: CookId): string | null {
  const p = personOf(s, id);
  const st = HOME_STATION[id];
  const aff = offersFor(s, id).find((a) => a.id === st);
  if (!aff?.followedBy) return null;
  return bodyForecast(p, aff).line;
}

function shortOf(r: SuggestionResolution): string {
  switch (r.verdict) {
    case 'assented':
      return 'yes';
    case 'complied':
      return 'if I must';
    case 'deferred':
      return r.counterOffer?.label ? r.counterOffer.label : 'not now';
    case 'modified':
      return r.counterOffer?.label ? `rather ${r.counterOffer.label}` : 'something else';
    case 'refused':
      return r.kind === 'cannot' ? "can't" : 'no';
    default:
      return '';
  }
}

const suggestion = (verb: Verb, insist = false): Suggestion => ({
  voiceId: CHEF,
  affordanceId: verbAffordance(verb),
  strength: insist ? 0.85 : 0.6,
  insist,
});

// ---------- inputs ----------

export function queueInput(s: GameState, input: NewInput): void {
  s.inputs.push({ ...input, at: s.minute } as Input);
  if (s.phase !== 'service') applyPending(s);
}

function applyPending(s: GameState) {
  while (s.applied < s.inputs.length) {
    const inp = s.inputs[s.applied] as Input;
    if (inp.at > s.minute) break;
    s.applied += 1;
    apply(s, inp);
  }
}

function apply(s: GameState, inp: Input) {
  switch (inp.kind) {
    case 'ask': {
      if (s.phase !== 'service') return;
      const c = cookOf(s, inp.cook);
      if (!c.here || c.gone) return;
      const p = personOf(s, inp.cook);
      c.night.asked += 1;
      if (inp.insist) c.night.insisted += 1;
      c.pending = { s: suggestion(inp.verb, inp.insist), verb: inp.verb };
      c.deferred = null;
      if (p.activity) interrupt(p, s.minute, 'voice:chef');
      return;
    }
    case 'jar': {
      if (s.phase !== 'evening') return;
      if (inp.choice === 'move') {
        s.jarPlace = 'pass';
        say(
          s,
          'narrator',
          'I moved the jar to the pass, where I can see it. Rafi watched me carry it and said nothing.',
          'journal',
        );
      } else if (inp.choice === 'talk') {
        s.talkedToRafi = true;
        const rafi = personOf(s, 'rafi');
        perceive(rafi, [
          {
            at: rafi.now,
            channel: 'told',
            kind: 'advice',
            actorId: CHEF,
            targetId: 'rafi',
            salience: 0.9,
            valence: 0.2,
            summary: 'the chef said: when the jar calls you, go scrub the trays, and we split it on Saturday',
          },
        ]);
        enablePromptings(rafi, {
          reading: 'inclination',
          readingSource: 'host:rafi',
          responses: [{ id: 'trays', kind: 'redirect', practice: 0.2 }],
        });
        say(s, 'narrator', 'I sat with Rafi on the back step. I did not say the word thief.', 'journal');
        say(s, 'rafi', 'When I look at the jar, I go scrub the trays. Okay, Chef.', 'answer');
      } else say(s, 'narrator', 'I left the jar where it was.', 'journal');
      return;
    }
    case 'call': {
      if (s.phase !== 'service' || s.call !== 'asking') return;
      const c = cookOf(s, 'dilek');
      const p = personOf(s, 'dilek');
      if (inp.choice === 'go') {
        s.call = 'went';
        c.pending = { s: { voiceId: CHEF, affordanceId: 'home', strength: 0.8 }, verb: 'home' };
      } else {
        s.call = 'stayed';
        c.night.asked += 1;
        c.pending = { s: { voiceId: CHEF, affordanceId: 'cold', strength: 0.7 }, verb: 'cold' };
      }
      if (p.activity) interrupt(p, s.minute, 'voice:chef');
      return;
    }
    case 'open': {
      if (s.phase !== 'evening') return;
      sleepHours(s, s.night);
      dayHours(s, s.night + 1);
      startNight(s, s.night + 1);
      return;
    }
  }
}

// ---------- the minute ----------

/** Advance one sim minute of service. */
export function step(s: GameState): void {
  if (s.phase !== 'service') return;
  applyPending(s);
  const m = s.minute;
  for (const t of s.tickets) if (t.status === 'waiting' && t.at <= m) t.status = 'open';
  scripted(s, m);
  for (const c of s.cooks) if (c.here && !c.gone) cookMinute(s, c);
  produce(s);
  pass(s);
  for (const t of s.tickets)
    if (t.status === 'open' && m - t.at > PATIENCE) {
      t.status = 'walked';
      say(
        s,
        'narrator',
        `Table ${t.table} gave up and left${t.critic ? '. One of them had a notebook' : ''}.`,
        'journal',
      );
    }
  s.plates.dirty = s.plates.dirty.filter((d) => {
    if (d.at > m) return true;
    if (s.night === 1)
      s.plates.clean += 1; // Monday I wash them myself between plates
    else dirtyWaiting(s, 1);
    return false;
  });
  s.minute += 1;
  if (s.minute >= closeAt(s.night)) closeNight(s);
}

function dirtyWaiting(s: GameState, n: number) {
  s.plates.pile += n;
}

export const pileOf = (s: GameState): number => s.plates.pile;

function scripted(s: GameState, m: number) {
  const d = nightStart(s.night);
  if (s.night === 5 && m === d + 19 * 60 + 40 && cookOf(s, 'dilek').here && !cookOf(s, 'dilek').gone) {
    s.call = 'asking';
    say(s, 'dilek', "That was my neighbour. Mum's had a fall. Chef, can I go?", 'call');
  }
}

function cookMinute(s: GameState, c: CookState) {
  const p = personOf(s, c.id);
  tick(p, s.minute);
  let a = p.activity;
  if (a && s.minute >= a.endsAt) {
    endActivity(p, 'completed', s.minute, s);
    a = null;
  }
  const due = c.pending !== null || (a ? s.minute >= a.reviewAt : s.minute >= c.idleUntil);
  if (!due) return;
  const offers = offersFor(s, c.id).filter((o) => !a || o.id !== a.affordanceId);
  const voice = c.pending ?? (!a && c.deferred && s.minute <= c.deferred.until ? c.deferred : null);
  const rec: DecisionRecord = decide(p, offers, voice ? { suggestion: voice.s } : {});
  if (voice) {
    const wasDeferred = voice === c.deferred;
    c.pending = null;
    c.deferred = null;
    const r = rec.suggestion;
    if (r) {
      if (r.verdict === 'refused') c.night.refused += 1;
      if (r.verdict === 'complied') c.night.complied += 1;
      if (r.verdict === 'assented') c.night.assented += 1;
      if (!wasDeferred || r.verdict !== 'deferred') say(s, c.id, r.says, 'answer');
      if (r.verdict === 'deferred' && !wasDeferred)
        c.deferred = { s: voice.s, verb: voice.verb, until: s.minute + 30 };
      if (s.call === 'stayed' && voice.verb === 'cold' && r.verdict === 'refused') s.call = 'refused';
    }
  }
  notePrompt(s, c.id, p);
  if (a && rec.chosenAffordanceId === a.affordanceId) {
    reviewed(p);
    return;
  }
  const aff = offers.find((o) => o.id === rec.chosenAffordanceId);
  if (!aff) {
    if (a) reviewed(p);
    else c.idleUntil = s.minute + 3;
    return;
  }
  if (a) endActivity(p, 'interrupted', s.minute, s);
  if (!begin(p, aff, rec)) {
    c.idleUntil = s.minute + 3;
    return;
  }
  if (aff.id === 'home') {
    c.gone = true;
    say(
      s,
      'narrator',
      s.call === 'went' && c.id === 'dilek'
        ? 'Dilek took her coat and ran.'
        : `${NAMES[c.id]} hung up the apron and went home.`,
      'journal',
    );
  }
  if (aff.id === 'pray' && !s.said.some((x) => x.at >= openAt(s.night) && x.text.includes('maghrib')))
    say(s, 'narrator', 'Selim stepped into the storeroom for maghrib.', 'journal');
}

function notePrompt(s: GameState, id: CookId, p: Person) {
  const r = p.promptings?.recent.at(-1);
  if (!r || r.at !== s.minute || s.lastPromptAt[id] === r.at) return;
  s.lastPromptAt[id] = r.at;
  if (r.outcome === 'assented') return;
  const line = promptingLine(p.promptings?.reading ?? 'none', r.outcome, p.promptings?.responses[0]?.kind);
  say(s, 'narrator', `Rafi glanced at the jar. ${capital(line)}.`, 'prompt');
}

const capital = (x: string) => x.charAt(0).toUpperCase() + x.slice(1).replace(/\.$/, '');

function endActivity(p: Person, status: Outcome['status'], at: number, s?: GameState) {
  const a = p.activity as Activity;
  const out: Outcome = { affordanceId: a.affordanceId, action: a.action, status, at };
  const done = Math.min(1, (at - a.startedAt) / Math.max(1, a.endsAt - a.startedAt));
  if (a.action === 'eat' || a.action === 'meal') out.needs = { food: 0.5 * done, water: 0.4 * done };
  if (a.affordanceId === 'skim' && s) {
    const took = Math.min(s.jar, 12);
    s.jar -= took;
    s.jarSkimmed += took;
    out.material = took > 0 ? 3 : 0;
  }
  finish(p, out);
}

/** The host does `aff` at `at` (no choice offered). */
function hostAct(p: Person, aff: Affordance, at: number) {
  const rec = decide(p, [aff], { now: Math.max(p.now, at) });
  if (rec.chosenAffordanceId !== aff.id) return;
  if (!begin(p, aff, rec)) return;
  const a = p.activity as Activity;
  tick(p, a.endsAt);
  const out: Outcome = { affordanceId: aff.id, action: aff.action, status: 'completed', at: a.endsAt };
  if (aff.id === 'meal') out.needs = { food: 0.6, water: 0.6 };
  finish(p, out);
}

// ---------- the line ----------

/** How fast a cook works their station right now: skill, body capacity, protest. */
export function pace(s: GameState, id: CookId, st: Station): number {
  const p = personOf(s, id);
  const skill = p.skills[st]?.level ?? 0.3;
  const cap = readPerson(p).body.capacity;
  const protest = p.activity?.protest ? 0.65 : 1;
  return (0.55 + 0.75 * skill) * (0.4 + 0.6 * cap) * protest;
}

export function stationOf(s: GameState, id: CookId): Station | null {
  const c = cookOf(s, id);
  if (!c.here || c.gone) return null;
  const a = personOf(s, id).activity;
  if (!a) return null;
  return (STATIONS as readonly string[]).includes(a.affordanceId) ? (a.affordanceId as Station) : null;
}

function produce(s: GameState) {
  for (const c of s.cooks) {
    const st = stationOf(s, c.id);
    if (!st) continue;
    const r = pace(s, c.id, st);
    if (st === 'grill') s.work.grill += r;
    else if (st === 'cold') s.work.cold += r;
    else {
      const pile = pileOf(s);
      if (pile <= 0) continue;
      c.progress += r;
      while (c.progress >= WASH_WORK && pileOf(s) > 0) {
        c.progress -= WASH_WORK;
        dirtyWaiting(s, -1);
        s.plates.clean += 1;
      }
      if (pileOf(s) <= 0) c.progress = 0;
    }
  }
  const open = s.tickets.filter((t) => t.status === 'open');
  // Portions go to the oldest table first.
  for (const t of open) {
    while (t.doneGrill < t.grill && s.work.grill >= GRILL_WORK) {
      s.work.grill -= GRILL_WORK;
      t.doneGrill += 1;
    }
    while (t.doneCold < t.cold && s.work.cold >= COLD_WORK) {
      s.work.cold -= COLD_WORK;
      t.doneCold += 1;
    }
  }
  // Nothing to cook: the effort is not banked beyond one portion's worth.
  s.work.grill = Math.min(s.work.grill, GRILL_WORK);
  s.work.cold = Math.min(s.work.cold, COLD_WORK);
}

function pass(s: GameState) {
  for (const t of s.tickets) {
    if (t.status !== 'open' || t.doneGrill < t.grill || t.doneCold < t.cold) continue;
    if (s.plates.clean <= 0) return;
    s.plates.clean -= 1;
    s.plates.dirty.push({ at: s.minute + 18 });
    t.status = 'served';
    t.servedAt = s.minute;
    const wait = s.minute - t.at;
    s.till += PRICE;
    const tip = wait < 15 ? 6 : wait < 25 ? 3 : 1;
    s.jar += tip;
    if (t.critic)
      say(
        s,
        'narrator',
        wait < 22
          ? `Table ${t.table} ate slowly and wrote a lot. The one with the notebook smiled.`
          : `Table ${t.table} ate without a word. The one with the notebook did not look up.`,
        'journal',
      );
  }
}

function say(s: GameState, who: Said['who'], text: string, kind: Said['kind']) {
  s.said.push({ at: s.minute, who, text, kind });
  if (s.said.length > 200) s.said.splice(0, s.said.length - 200);
}

// ---------- the evening ----------

function aboutYou(s: GameState, c: CookState): string {
  const p = personOf(s, c.id);
  const dt = trustOf(p) - c.trustAtOpen;
  const n = c.night;
  if (!s.cooks.find((x) => x.id === c.id)?.here) return '';
  if (c.id === 'dilek' && s.call === 'went') return 'You let me go to her. I won’t forget it.';
  if (c.id === 'dilek' && (s.call === 'stayed' || s.call === 'refused'))
    return s.call === 'refused'
      ? 'You asked me to stay while she lay on the floor.'
      : 'I stayed. Don’t ask me that again.';
  if (n.complied >= 2)
    return `You made me do it ${n.complied === 2 ? 'twice' : `${n.complied} times`}. I counted.`;
  if (n.complied === 1) return 'You pushed me once tonight. I’ll remember it.';
  if (n.refused >= 2 && dt < 0) return 'You kept asking for what I couldn’t give.';
  const pick = (xs: string[]) => xs[(s.night + COOKS.indexOf(c.id)) % xs.length] as string;
  if (n.asked === 0)
    return pick(
      {
        selim: [
          'You left me to it. Nevin did that too.',
          'You stood at the pass all night and let me cook. Fine.',
        ],
        dilek: [
          'You never once asked me anything. Do you even know my station?',
          'Quiet night from you. I liked it, mostly.',
        ],
        rafi: ['Nobody told me anything all night. I just washed.', 'You didn’t look at me once, Chef.'],
      }[c.id],
    );
  if (dt > 0.01) return 'You asked, and you listened. That’s new.';
  if (n.refused >= 1) return 'I said no once. You took it. Good.';
  return pick(
    {
      selim: ['A long night. You were there for it.', 'Nevin used to call it the same way. Almost.'],
      dilek: [
        'You called it right tonight. Don’t let it go to your head.',
        'My feet are gone. Good service, though.',
      ],
      rafi: ['Is it always like this? Don’t answer.', 'I kept up tonight. Did you see?'],
    }[c.id],
  );
}

function closeNight(s: GameState) {
  const night = s.night;
  for (const t of s.tickets)
    if (t.status === 'open' || t.status === 'waiting') {
      if (t.status === 'open') t.status = 'walked';
      else t.status = 'walked';
    }
  for (const c of s.cooks) {
    const p = personOf(s, c.id);
    if (c.here && !c.gone && p.activity) endActivity(p, 'completed', s.minute, s);
  }
  nightHours(s, night);
  const tonight = s.tickets;
  const served = tonight.filter((t) => t.status === 'served');
  const critic = tonight.find((t) => t.critic);
  const report: NightReport = {
    night,
    served: served.length,
    walked: tonight.filter((t) => t.status === 'walked').length,
    takings: served.length * PRICE,
    tips: s.jar,
    skimmed: s.jarSkimmed,
    reviews: s.cooks
      .filter((c) => c.here)
      .map((c) => ({
        id: c.id,
        line: reviewLine(personOf(s, c.id)) ?? '',
        aboutYou: aboutYou(s, c),
      })),
  };
  if (critic)
    report.critic =
      critic.status === 'walked' ? 'walked' : (critic.servedAt ?? 0) - critic.at < 22 ? 'pleased' : 'cold';
  s.reports.push(report);
  s.minute = Math.max(...s.people.map((p) => p.now));
  s.phase = night >= NIGHTS ? 'end' : 'evening';
}

export function bankMet(s: GameState): boolean {
  return s.till >= BANK_TARGET;
}

// ---------- save, export, replay ----------

export interface Export {
  game: string;
  framework: string;
  seed: number;
  inputs: Input[];
  state: GameState;
}

export function exportRun(s: GameState, framework: string): Export {
  return { game: GAME_VERSION, framework, seed: s.seed, inputs: s.inputs, state: cloneState(s) };
}

export function cloneState(s: GameState): GameState {
  return { ...structuredClone({ ...s, people: [] }), people: s.people.map((p) => snapshot(p)) };
}

export function restoreState(json: GameState): GameState {
  return { ...structuredClone({ ...json, people: [] }), people: json.people.map((p) => restore(p)) };
}

/** Rebuild a run from its seed and input log, stepping service minutes until `until` (or the last input). */
export function replay(seed: number, inputs: readonly Input[], until?: number): GameState {
  const s = newGame(seed);
  for (const inp of inputs) {
    while (s.phase === 'service' && s.minute < inp.at) step(s);
    s.inputs.push(inp);
    if (s.phase !== 'service') applyPending(s);
  }
  if (until !== undefined) while (s.phase === 'service' && s.minute < until) step(s);
  return s;
}

/** A compact fingerprint of everything that matters, for replay checks. */
export function fingerprint(s: GameState): string {
  return JSON.stringify({
    night: s.night,
    phase: s.phase,
    minute: s.minute,
    till: s.till,
    jar: s.jar,
    skim: s.jarSkimmed,
    tickets: s.tickets.map((t) => [t.id, t.status, t.servedAt ?? -1]),
    reports: s.reports,
    people: s.people.map((p) => [p.id, p.trace.length, p.now, p.will.voices[0]?.trust]),
  });
}

export const RUSH_END = RUSH_TO;

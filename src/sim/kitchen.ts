/**
 * The Pass: the kitchen host. Pure and deterministic: state is plain JSON, world draws come from `rng.ts` keyed
 * by night and ticket index, and every player input is stamped with the sim minute it applies at. Replaying the
 * same seed and input log rebuilds the same state (`replay`).
 *
 * Covers: tickets, stations (grill, cold, dish, and from week 2 the oven, which must be heated before it bakes),
 * plates, the pass, walkouts, the till, the jar, the regulars and their tabs, cooks' requests of the chef, the
 * weekly bill, hiring and leaving on Sundays; the cooks' decisions through HF (decide/begin/finish; predict, or
 * the chef's impression via `predictAs` for a new hire, for the telegraph); the hours between services lived
 * through HF (meals, sleep, the evening review). A host rule keeps somebody on the line: the last cook in the
 * kitchen is not offered a break (HF has no shared duty; docs/hf-requests.md). Does not cover: front of house,
 * customers as people, spatial movement.
 */
import {
  type Activity,
  type Affordance,
  acquaintWith,
  adoptVoiceTrust,
  begin,
  bodyForecast,
  type DecisionRecord,
  decide,
  diffChronicle,
  enablePromptings,
  finish,
  glimpseOf,
  interrupt,
  type Outcome,
  type Person,
  perceive,
  predict,
  predictAs,
  promise,
  readPerson,
  releaseCommitment,
  restore,
  reviewed,
  reviewLine,
  type Suggestion,
  type SuggestionResolution,
  snapshot,
  socialEvent,
  tick,
} from '@adam0white/human-framework';
import {
  isLastOfWeek,
  LAST_NIGHT,
  NIGHT_PLANS,
  type NightPlan,
  nightStart,
  PARTIES,
  PROMISE_WORDS,
  partyOf,
  planOf,
  REGULARS,
  type RequestPlan,
  regularOf,
  type TabChoice,
  weekOf,
} from './campaign.ts';
import {
  CHEF,
  CLOSE,
  type CookId,
  type CrewMember,
  dayStart,
  FOUNDERS,
  HIRES,
  hireTemplate,
  makeChef,
  makeCook,
  makeHire,
  OPEN,
  RUSH_FROM,
  RUSH_TO,
  STATIONS,
  type Station,
} from './cooks.ts';
import {
  aboutYou,
  changeLine,
  lapseLine,
  type NightEvent,
  REQUEST_LINES,
  resolveSeen,
  suggestionWords,
  VERB_WORD,
} from './lines.ts';
import { hashUnit } from './rng.ts';

export const GAME_VERSION = 'pass@10';
const portionEdition = (s: GameState) => s.version === 'pass@8' || promisesOn(s);
const handsOn = (s: GameState) => s.version === 'pass@7' || portionEdition(s);
const chefEdition = (s: GameState) => s.version === 'pass@6' || handsOn(s);
const hasBoard = (s: GameState) => s.version === 'pass@5' || chefEdition(s);
const hasCover = (s: GameState) => s.version === 'pass@4' || hasBoard(s);
export const PRICE = 40;
export const PIDE_PRICE = 15;
const ASK = 0.5;
const INSIST = 0.85;
const GRILL_WORK = 5;
const COLD_WORK = 3.5;
const OVEN_WORK = 6;
const WASH_WORK = 1.4;
const PLATES = 12;
const HF_WAGE = 6;
/** Oven heat (0..1) at which pide bakes. */
export const OVEN_HOT = 0.7;
const OFF_LINE = ['break', 'smoke', 'eat', 'phone'];
const REST_WORD: Record<string, string> = {
  break: 'ten',
  smoke: 'cigarette',
  eat: 'plate',
  phone: 'phone call',
};

export type Verb = Station | 'break' | 'eat' | 'home';
export const VERBS: readonly Verb[] = ['grill', 'cold', 'dish', 'oven', 'break', 'eat', 'home'];
export interface BoardRow {
  cook: CookId;
  station: Station;
  /** Local kitchen minute, carried unchanged between nights. */
  breakAt: number;
  cover: CookId | null;
  accepted?: boolean;
  answer?: string;
  coverAccepted?: boolean;
}
export interface StaffingDecision {
  id: number;
  who: CookId;
  station: Station;
  until: number;
  reason: string;
  state: 'asking' | 'covered' | 'left';
  cover?: CookId;
}
export type Input =
  | { at: number; kind: 'board'; rows: BoardRow[] }
  | { at: number; kind: 'staff'; id: number; cover: CookId | null }
  | { at: number; kind: 'ask'; cook: CookId; verb: Verb; insist?: boolean; counter?: boolean }
  | { at: number; kind: 'help'; ticket: number; station: FoodStation }
  | { at: number; kind: 'cook-step'; ticket: number; instinct?: boolean }
  | { at: number; kind: 'call-plate'; ticket: number }
  | { at: number; kind: 'cook-choice'; ticket: number; choice: 'now' | 'careful' }
  | { at: number; kind: 'finish-portion'; ticket: number }
  | { at: number; kind: 'pass-priority'; ticket: number }
  | { at: number; kind: 'jar'; choice: 'move' | 'talk' | 'leave' }
  | { at: number; kind: 'answer'; choice: 'yes' | 'no' }
  | { at: number; kind: 'choose'; key: string; value: string }
  | { at: number; kind: 'pace'; value: 'nevin' }
  | { at: number; kind: 'open' };

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewInput = DistOmit<Input, 'at'>;

export type FoodStation = 'grill' | 'cold' | 'oven';
export interface PassDecision {
  at: number;
  state: 'asking' | 'chosen' | 'passed';
  tickets: number[];
  ticket?: number;
}

export interface Ticket {
  id: number;
  table: number;
  at: number;
  grill: number;
  cold: number;
  oven: number;
  doneGrill: number;
  doneCold: number;
  doneOven: number;
  patience: number;
  price: number;
  critic?: boolean;
  regular?: string;
  friend?: boolean;
  /** pass@9: a returning party's id (see `PARTIES`). */
  party?: string;
  /** Actual party payment, including any kept-promise premium. */
  partyPay?: number;
  /** The wedding order: trays due by this minute; no plates. */
  due?: number;
  status: 'waiting' | 'open' | 'served' | 'walked';
  servedAt?: number;
  platedAt?: number;
  quality?: 'careful' | 'plain' | 'mixed';
  /** pass@8 keeps the result of each chef portion, even when a table has both kinds. */
  chefPortions?: { station: FoodStation; quality: 'careful' | 'plain' }[];
  freshness?: 'hot' | 'cooling';
  called?: boolean;
}

export interface Said {
  at: number;
  who: CookId | 'narrator';
  text: string;
  kind: 'answer' | 'journal' | 'prompt' | 'call';
}

/** The last answer given at the pass, for the caption. */
export interface PassAnswer {
  at: number;
  who: CookId;
  verb: Verb;
  verdict: SuggestionResolution['verdict'] | 'countered';
  text: string;
  /** A counter-offer the chef can take with one tap. */
  counter?: Verb;
  insisted?: boolean;
}

export interface CookState {
  id: CookId;
  here: boolean;
  /** Left for the night (walked out, sent home, or went to someone). */
  gone: boolean;
  pending: { s: Suggestion; verb: Verb; counter?: boolean; quiet?: boolean } | null;
  deferred: { s: Suggestion; verb: Verb; until: number } | null;
  /** A station turned down because of a break in progress: kept for the rest of that break. */
  breakDeferred: { verb: Verb; endsAt: number; rest: string; reason?: string; short?: string } | null;
  cover?: { station: Station; until: number } | null;
  idleUntil: number;
  progress: number;
  /** Portions made in the current stretch (an honest world effect at its end). */
  made: number;
  night: {
    asked: number;
    insisted: number;
    refused: number;
    complied: number;
    assented: number;
    events: NightEvent[];
    /** Stations the cook worked tonight, asked or not. */
    worked: string[];
  };
  week: { complied: number; insisted: number; nights: number };
  /** Times made to comply in earlier weeks, halved each week: old pushing fades but is not forgotten. */
  pushedBefore: number;
  trustAtOpen: number;
  remembered: boolean;
}

export interface RegularState {
  regard: number;
  tab: 'open' | 'asked' | 'forgiven' | 'paying';
  visits: number;
  friendNext: boolean;
}

export interface Request {
  kind: string;
  who: CookId;
  state: 'asking' | 'yes' | 'no';
  at: number;
  /** Nobody answered in time, so the cook decided for themselves. */
  ignored?: boolean;
  /** The granted call has been made (it is offered once). */
  rang?: boolean;
}

export interface BillResult {
  week: number;
  owed: string;
  amount: number;
  paid: boolean;
  short: number;
  /** pass@9: a promise was broken this week (one strike with any shortfall). */
  promiseBroken?: boolean;
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
  request?: { kind: string; who: CookId; answer: 'yes' | 'no' | 'none' };
  wedding?: 'on time' | 'late' | 'lost';
  gas?: boolean;
  apron?: CookId;
  bill?: BillResult;
  stamps: string[];
  regulars: { id: string; came: boolean; pleased: boolean }[];
  /** pass@9: tonight's returning parties. */
  parties?: {
    party: string;
    promised: boolean;
    outcome: Booking['outcome'];
    waited?: number;
    walked?: boolean;
  }[];
}

export interface SundayPage {
  week: number;
  changes: { id: CookId; line: string }[];
  quits: { id: CookId; words: string }[];
  candidates: string[];
  offday: boolean;
  tabs: string[];
  price: boolean;
  letgo: boolean;
  sell: boolean;
  /** pass@9: party ids offered for next week; chosen keys are `promise:<id>` = 'promise' | 'plain'. */
  parties?: string[];
  chosen: Record<string, string>;
  stamps: string[];
}

/** pass@9: a returning party booked for a night of next week. */
export interface Booking {
  party: string;
  week: number;
  night: number;
  /** Absolute minutes. */
  at: number;
  servedBy: number;
  order: { grill: number; cold: number; oven: number };
  signature: FoodStation;
  promised: boolean;
  ticket?: number;
  outcome?: 'kept' | 'broken' | 'served' | 'walked';
  /** The table number that waited longest while the chef cooked the signature. */
  waited?: number;
  /** Result of the reserved signature alone, independent of other chef portions. */
  signatureQuality?: 'careful' | 'plain';
  signatureStartedAt?: number;
  waitedMinutes?: number;
}

/** What the Sunday card shows for one offered party (pass@9). */
export interface PartyCard {
  party: string;
  host: string;
  /** e.g. 'Thursday'. */
  night: string;
  at: number;
  servedBy: number;
  /** e.g. 'two grill, two cold, one pide'. */
  order: string;
  signature: string;
  /** The signature station's cook, by trust; null when nobody holds that station. */
  cook: { who: CookId; text: string } | null;
}

export interface GameState {
  version: string;
  seed: number;
  night: number;
  phase: 'board' | 'service' | 'evening' | 'sunday' | 'end';
  board?: { rows: BoardRow[]; agreed: boolean };
  previousBoard?: BoardRow[];
  staffing?: StaffingDecision[];
  minute: number;
  people: Person[];
  chef: Person;
  crew: CrewMember[];
  cooks: CookState[];
  tickets: Ticket[];
  plates: { clean: number; pile: number; dirty: { at: number }[] };
  oven: { heat: number };
  help?: {
    ticket: number;
    station: FoodStation;
    until: number;
    progress?: number;
    work?: number;
    act?: number;
    readyAt?: number;
    announced?: boolean;
    instinct?: boolean;
    plain?: boolean;
    signature?: boolean;
    careChosen?: boolean;
  } | null;
  chefNext?: { ticket: number; station: FoodStation } | null;
  chefGrace?: { ticket: number; station: FoodStation; until: number; done?: number }[];
  passDecision?: PassDecision | null;
  acceptedGaps?: { who: CookId; station: Station; until: number }[];
  lastPromptAt: Record<string, number>;
  work: { grill: number; cold: number; oven: number };
  till: number;
  jar: number;
  jarSkimmed: number;
  jarPlace: 'counter' | 'pass';
  /** The chef has decided about the jar (once, on Wednesday of week 1). */
  jarDecided: boolean;
  talkedToRafi: boolean;
  request: Request | null;
  regulars: Record<string, RegularState>;
  price: number;
  raises: number;
  carry: number;
  strikes: number;
  lost: boolean;
  sold: boolean | null;
  wagesDue: number;
  apron: CookId | null;
  myWay: CookId | null;
  stamps: { id: string; night: number }[];
  lastAnswer: PassAnswer | null;
  usedLines: string[];
  sunday: SundayPage | null;
  /** pass@9: returning parties, booked on Sunday pages. */
  bookings?: Booking[];
  /** pass@9: added to next week's bill because whoever is owed saw the kitchen doing well. */
  seen?: number;
  /** pass@9: Nevin's pace (week-1 patience all month), set by the first input. */
  pace?: 'nevin';
  said: Said[];
  reports: NightReport[];
  inputs: Input[];
  applied: number;
}

// ---------- tickets ----------

/** Pre-roll a night's walk-in tables from the seed alone: no input can move a later table. */
export function rollTickets(
  seed: number,
  n: number,
  firstId: number,
  count?: number,
  price = PRICE,
): Ticket[] {
  const plan = planOf(n);
  const tables = count ?? plan.tables;
  const patience = weekOf(plan.week).patience;
  const out: Ticket[] = [];
  const span = CLOSE - 45 - OPEN;
  const open = nightStart(n) + OPEN;
  for (let k = 0; k < tables; k++) {
    // Arrivals bunch toward the middle of the evening (a triangular draw), later on a match night.
    const u = (hashUnit(seed, 11, n, k) + hashUnit(seed, 12, n, k)) / 2;
    let off = Math.round(Math.min(1, u + (plan.late ?? 0)) * span);
    if (k === 0) off = 1;
    const g = hashUnit(seed, 13, n, k);
    const c = hashUnit(seed, 14, n, k);
    const o = plan.oven ? hashUnit(seed, 17, n, k) : 0;
    const t: Ticket = {
      id: firstId + k,
      table: 1 + Math.floor(hashUnit(seed, 15, n, k) * 9),
      at: open + off,
      grill: g < 0.25 ? 0 : g < 0.8 ? 1 : 2,
      cold: c < 0.3 ? 0 : c < 0.85 ? 1 : 2,
      oven: o < 0.62 ? 0 : o < 0.92 ? 1 : 2,
      doneGrill: 0,
      doneCold: 0,
      doneOven: 0,
      patience,
      price,
      status: 'waiting',
    };
    if (t.grill + t.cold + t.oven === 0) t.cold = 1;
    t.price = price + PIDE_PRICE * t.oven;
    out.push(t);
  }
  if (plan.critic) {
    const k = Math.floor(hashUnit(seed, 16, n) * tables * 0.6) + 2;
    const t = out[Math.min(k, out.length - 1)];
    if (t) {
      t.critic = true;
      t.grill = Math.max(1, t.grill);
    }
  }
  return out.sort((a, b) => a.at - b.at || a.id - b.id);
}

// ---------- setup ----------

export function newGame(seed: number, edition: string = GAME_VERSION): GameState {
  const now = 9 * 60;
  const people = FOUNDERS.map((m) => makeCook(m.id, seed, now, edition));
  const chef = makeChef(seed, now);
  for (const p of people) acquaintWith(chef, p, 0.5, now);
  const regulars: Record<string, RegularState> = {};
  for (const r of REGULARS)
    regulars[r.id] = { regard: 0.6, tab: r.tab ? 'open' : 'paying', visits: 0, friendNext: false };
  const s: GameState = {
    version: edition,
    seed,
    night: 1,
    phase: 'service',
    minute: now,
    people,
    chef,
    crew: FOUNDERS.map((m) => ({ ...m })),
    cooks: FOUNDERS.map((m) => blankCook(m.id)),
    tickets: [],
    plates: { clean: PLATES, pile: 0, dirty: [] },
    oven: { heat: 0 },
    lastPromptAt: {},
    work: { grill: 0, cold: 0, oven: 0 },
    till: 0,
    jar: 0,
    jarSkimmed: 0,
    jarPlace: 'counter',
    jarDecided: false,
    talkedToRafi: false,
    request: null,
    regulars,
    price: PRICE,
    raises: 0,
    carry: 0,
    strikes: 0,
    lost: false,
    sold: null,
    wagesDue: 0,
    apron: null,
    myWay: null,
    stamps: [],
    lastAnswer: null,
    usedLines: [],
    sunday: null,
    said: [],
    reports: [],
    inputs: [],
    applied: 0,
  };
  dayHours(s, planOf(1).day);
  startNight(s, 1);
  return s;
}

function blankCook(id: CookId): CookState {
  return {
    id,
    here: false,
    gone: false,
    pending: null,
    deferred: null,
    breakDeferred: null,
    idleUntil: 0,
    progress: 0,
    made: 0,
    night: blankNight(),
    week: { complied: 0, insisted: 0, nights: 0 },
    pushedBefore: 0,
    trustAtOpen: 0,
    remembered: false,
  };
}

const blankNight = () => ({
  asked: 0,
  insisted: 0,
  refused: 0,
  complied: 0,
  assented: 0,
  events: [],
  worked: [] as string[],
});

export const personOf = (s: GameState, id: CookId): Person => s.people.find((p) => p.id === id) as Person;
export const cookOf = (s: GameState, id: CookId): CookState => s.cooks.find((c) => c.id === id) as CookState;
export const memberOf = (s: GameState, id: CookId): CrewMember =>
  s.crew.find((c) => c.id === id) as CrewMember;
export const nameOf = (s: GameState, id: CookId): string => s.crew.find((c) => c.id === id)?.name ?? id;
/** Crew still on the books (not left). */
export const activeCrew = (s: GameState): CrewMember[] => s.crew.filter((m) => !m.left);
/** Crew working tonight and not gone home. */
export const onShift = (s: GameState): CookId[] =>
  s.crew.filter((m) => !m.left && cookOf(s, m.id).here && !cookOf(s, m.id).gone).map((m) => m.id);
export const trustOf = (p: Person) => p.will.voices.find((v) => v.voiceId === CHEF)?.trust ?? 0.5;
export const plan = (s: GameState): NightPlan => planOf(s.night);
export const openAt = (n: number) => nightStart(n) + OPEN;
export const closeAt = (n: number) => nightStart(n) + CLOSE;

/** Live the day before a service: meals, an afternoon, arriving at 17:00. */
function dayHours(s: GameState, day: number) {
  const d = day * 1440;
  for (const p of chefEdition(s) ? [...livePeople(s), s.chef] : livePeople(s)) {
    if (p.activity) endActivity(p, 'interrupted', Math.max(p.now, p.activity.startedAt));
    hostAct(p, offer('meal', { duration: 30, advertises: { food: 0.6, water: 0.6 } }), d + 10 * 60);
    hostAct(p, offer('meal', { duration: 30, advertises: { food: 0.6, water: 0.6 } }), d + 14 * 60);
    hostAct(p, offer('wait', { duration: 20 }), d + 17 * 60);
  }
  s.minute = d + 17 * 60 + 20;
}

/** A day without a service: meals, rest and sleep. */
function offDay(s: GameState, day: number) {
  const d = day * 1440;
  for (const p of chefEdition(s) ? [...livePeople(s), s.chef] : livePeople(s)) {
    if (p.activity) endActivity(p, 'interrupted', Math.max(p.now, p.activity.startedAt));
    hostAct(p, offer('meal', { duration: 30, advertises: { food: 0.6, water: 0.6 } }), d + 10 * 60);
    hostAct(
      p,
      offer('rest', { duration: 120, effort: 0, advertises: { rest: 0.4, leisure: 0.3 } }),
      d + 11 * 60,
    );
    hostAct(p, offer('meal', { duration: 30, advertises: { food: 0.6, water: 0.6 } }), d + 14 * 60);
    prayAtHome(p, d);
    hostAct(p, offer('meal', { duration: 30, advertises: { food: 0.6, water: 0.6 } }), d + 19 * 60);
    hostAct(
      p,
      offer('sleep', { mode: 'sleep', duration: 9 * 60, effort: 0, advertises: { sleep: 1, rest: 0.5 } }),
      Math.max(p.now, d + 23 * 60),
    );
  }
}

/** On a day without service, whoever keeps maghrib keeps it at home (so the evening review does not count it missed). */
function prayAtHome(p: Person, d: number) {
  if (!p.agenda.commitments.some((c) => c.label === 'maghrib')) return;
  hostAct(
    p,
    offer('pray', {
      label: 'pray maghrib',
      duration: 8,
      effort: 0,
      advertises: { meaning: 0.3 },
      norms: [{ normId: 'salah', relation: 'fulfills' }],
    }),
    Math.max(p.now, d + 18 * 60 + 45),
  );
}

/** The people still with the lokanta (a cook who left is no longer lived). */
function livePeople(s: GameState): Person[] {
  return s.people.filter((p) => !s.crew.find((m) => m.id === p.id)?.left);
}

/** Live the hours after a service: home, a late meal, the evening review. */
function nightHours(s: GameState, n: number) {
  const d = nightStart(n);
  for (const p of chefEdition(s) ? [...livePeople(s), s.chef] : livePeople(s)) {
    if (p.activity) endActivity(p, 'interrupted', Math.max(p.now, p.activity.startedAt));
    const at = Math.max(p.now, d + CLOSE + 5);
    hostAct(p, offer('meal', { duration: 30, advertises: { food: 0.5, water: 0.5 } }), at);
    hostAct(p, offer('rest', { duration: 30, advertises: { rest: 0.3 } }), Math.max(p.now, d + 22 * 60 + 40));
    tick(p, Math.max(p.now, d + 23 * 60 + 5));
  }
}

function sleepHours(s: GameState, n: number) {
  const d = nightStart(n);
  for (const p of chefEdition(s) ? [...livePeople(s), s.chef] : livePeople(s))
    hostAct(
      p,
      offer('sleep', { mode: 'sleep', duration: 9 * 60, effort: 0, advertises: { sleep: 1, rest: 0.5 } }),
      Math.max(p.now, d + 23 * 60 + 30),
    );
}

function startNight(s: GameState, n: number) {
  const pl = planOf(n);
  s.night = n;
  s.phase = 'service';
  s.minute = openAt(n) - 5;
  s.request = null;
  s.apron = null;
  s.myWay = null;
  s.lastAnswer = null;
  s.sunday = null;
  if (hasBoard(s)) {
    if (s.board?.agreed) s.previousBoard = structuredClone(s.board.rows);
    s.board = { rows: [], agreed: false };
    s.staffing = [];
    s.phase = 'board';
  }
  if (chefEdition(s)) {
    s.passDecision = null;
    s.acceptedGaps = [];
  }
  if (portionEdition(s)) {
    s.chefNext = null;
    s.chefGrace = [];
  }
  const firstId = (s.tickets.at(-1)?.id ?? 0) + 1;
  const count = Math.max(8, pl.tables - s.raises) + (pl.anniversary ? anniversaryGuests(s) : 0);
  s.tickets = rollTickets(s.seed, n, firstId, count, s.price);
  if (hasCover(s)) {
    s.help = null;
    if (n === 1 || chefEdition(s)) {
      for (const [i, t] of s.tickets.slice(0, 3).entries())
        t.at = openAt(n) + 1 + i * (chefEdition(s) ? 2 : 8);
      s.tickets.sort((a, b) => a.at - b.at || a.id - b.id);
    }
  }
  s.plates = { clean: PLATES, pile: 0, dirty: [] };
  s.work = { grill: 0, cold: 0, oven: 0 };
  s.oven = { heat: 0 };
  for (const line of pl.intro) say(s, 'narrator', line, 'journal');
  if (promisesOn(s) && s.pace === 'nevin') for (const t of s.tickets) t.patience = 38;
  if (pl.week >= 2) addRegulars(s, pl);
  if (promisesOn(s)) addParties(s);
  if (pl.wedding) {
    const w = pl.wedding;
    s.tickets.unshift({
      id:
        (promisesOn(s)
          ? Math.max(firstId, ...s.tickets.map((t) => t.id))
          : (s.tickets.at(-1)?.id ?? firstId)) + 1,
      table: 0,
      at: openAt(n),
      grill: w.grill,
      cold: w.cold,
      oven: w.oven,
      doneGrill: 0,
      doneCold: 0,
      doneOven: 0,
      patience: 9999,
      price: w.pay,
      due: nightStart(n) + w.due,
      status: 'waiting',
    });
  }
  for (const m of s.crew) {
    if (!s.cooks.find((c) => c.id === m.id)) s.cooks.push(blankCook(m.id));
    const c = cookOf(s, m.id);
    const p = personOf(s, m.id);
    c.here = !m.left && m.since <= pl.week && m.offDay !== pl.weekday && !(pl.n === 1 && m.id === 'rafi');
    c.gone = false;
    c.pending = null;
    if (hasCover(s)) c.cover = null;
    c.deferred = null;
    c.breakDeferred = null;
    c.idleUntil = s.minute;
    c.progress = 0;
    c.made = 0;
    c.remembered = false;
    c.night = blankNight();
    if (isFirstOfWeek(n)) {
      c.pushedBefore = (c.pushedBefore ?? 0) / 2 + c.week.complied;
      c.week = { complied: 0, insisted: 0, nights: 0 };
    }
    if (!c.here) continue;
    c.trustAtOpen = trustOf(p);
    tick(p, Math.max(p.now, s.minute));
  }
  if (pl.n === 5 || pl.call) {
    const dilek = s.crew.find((m) => m.id === 'dilek' && !m.left) ? personOf(s, 'dilek') : null;
    // Dilek's mother lives alone; tonight she will call.
    if (dilek && cookOf(s, 'dilek').here)
      promise(dilek, {
        kind: 'promise',
        toId: 'mother',
        label: 'going to my mother',
        actions: ['home'],
        from: nightStart(n) + 19 * 60 + 45,
        until: nightStart(n) + 21 * 60,
        importance: 0.75,
      });
  }
}

const isFirstOfWeek = (n: number) => n === 1 || planOf(n - 1).week !== planOf(n).week;

function anniversaryGuests(s: GameState): number {
  let extra = 2;
  for (const r of REGULARS) {
    const st = s.regulars[r.id];
    if (!st) continue;
    if (st.tab === 'forgiven') extra += 2;
    if (st.regard > 0.75) extra += 1;
  }
  return extra;
}

function addRegulars(s: GameState, pl: NightPlan) {
  const d = nightStart(pl.n);
  let id = Math.max(0, ...s.tickets.map((t) => t.id)) + 1;
  for (const r of REGULARS) {
    if (!r.weekdays.includes(pl.weekday)) continue;
    if (partiesTonight(s).some((b) => partyOf(b.party)?.regular === r.id)) continue;
    const st = s.regulars[r.id] as RegularState;
    if (st.regard < 0.3) {
      if (st.visits > 0) say(s, 'narrator', `${r.name} didn’t come tonight.`, 'journal');
      continue;
    }
    const mk = (at: number, friend: boolean): Ticket => ({
      id: id++,
      table: 1 + Math.floor(hashUnit(s.seed, 18, pl.n, r.id.length) * 9),
      at,
      grill: r.order.grill ?? 0,
      cold: r.order.cold ?? 0,
      oven: pl.oven ? (r.order.oven ?? 0) : 0,
      doneGrill: 0,
      doneCold: 0,
      doneOven: 0,
      patience: promisesOn(s) && s.pace === 'nevin' ? 38 : (r.patience ?? weekOf(pl.week).patience),
      price: s.price + PIDE_PRICE * (pl.oven ? (r.order.oven ?? 0) : 0),
      regular: r.id,
      friend,
      status: 'waiting',
    });
    s.tickets.push(mk(d + r.at, false));
    if (st.friendNext) {
      s.tickets.push(mk(d + r.at + 4, true));
      st.friendNext = false;
    }
  }
  s.tickets.sort((a, b) => a.at - b.at || a.id - b.id);
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
  oven: 'mind the oven',
  break: 'take ten out back',
  eat: 'eat something',
  home: 'go home',
};

/** Whether a cook counts as in the kitchen: on a station, at the pass, or between jobs. */
export function inKitchen(s: GameState, id: CookId): boolean {
  const c = cookOf(s, id);
  if (!c.here || c.gone) return false;
  const a = personOf(s, id).activity;
  return !a || (!OFF_LINE.includes(a.affordanceId) && a.affordanceId !== 'pray' && a.affordanceId !== 'skim');
}

/** Who else is in the kitchen right now. */
export function othersIn(s: GameState, id: CookId): CookId[] {
  return onShift(s).filter((x) => x !== id && inKitchen(s, x));
}

/** Stations on tonight's menu. */
export function stationsTonight(s: GameState): Station[] {
  const pl = plan(s);
  return STATIONS.filter((st) => (st === 'dish' ? pl.dish : st === 'oven' ? pl.oven : true));
}

export function offersFor(s: GameState, id: CookId, requested?: Verb): Affordance[] {
  const p = personOf(s, id);
  const m = memberOf(s, id);
  const left = remainingRush(s);
  const list: Affordance[] = [];
  for (const st of stationsTonight(s)) {
    const effort = st === 'grill' ? 0.75 : st === 'cold' ? 0.58 : st === 'oven' ? 0.66 : 0.62;
    const a = offer(st, {
      label: LABEL[st],
      duration:
        hasCover(s) && (requested ?? cookOf(s, id).pending?.verb) === st ? coverUntil(s) - s.minute : 25,
      effort,
      focus: 0.5,
      placeId: 'line',
      skill: { id: st, difficulty: st === 'grill' ? 0.5 : st === 'oven' ? 0.45 : 0.35 },
      // Honest per person: a station you are good at feels like competence; your own station, like standing.
      // Work waiting on the rail pulls a cook to it (they can all see the tickets); an idle station pulls less.
      advertises: {
        competence: 0.1 + 0.35 * (p.skills[st]?.level ?? 0.3),
        esteem: st === m.home ? 0.2 : 0.05,
        belonging: 0.05,
        meaning: 0.2 * Math.min(1, waitingAt(s, st) / (st === 'dish' ? 6 : 3)),
      },
      tags: ['work'],
      // Paid by the hour: a stretch on the line is a stretch of wages.
      material: HF_WAGE,
    });
    if (left > 45 && (!hasCover(s) || a.duration === 25))
      a.followedBy = [{ label: 'the rest of the rush', duration: left - 25, effort: effort * 0.9 }];
    list.push(a);
  }
  // Somebody stays on the line: the last cook in the kitchen is not offered a way off it.
  const canLeave = othersIn(s, id).length > 0;
  if (canLeave) {
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
      offer('eat', { label: LABEL.eat, duration: 12, effort: 0, advertises: { food: 0.5, water: 0.4 } }),
    );
  }
  list.push(offer('wait', { label: 'catch my breath', duration: 5, effort: 0, advertises: {} }));
  // The crew rule holds for going home too: the last cook in leaves only with leave given, or once the rail is empty.
  const released = s.request?.who === id && s.request.state === 'yes';
  const railEmpty = !s.tickets.some((t) => t.status === 'open' || t.status === 'waiting');
  if (canLeave || released || railEmpty)
    list.push(
      offer('home', { label: LABEL.home, duration: 30, effort: 0.1, advertises: { rest: 0.5, sleep: 0.2 } }),
    );
  if (canLeave && id === 'dilek')
    list.push(
      offer('smoke', {
        label: 'have a cigarette in the yard',
        duration: 7,
        effort: 0,
        placeId: 'line',
        advertises: { leisure: 0.25, relief: 0.1 },
      }),
    );
  if (canLeave && id === 'murat')
    list.push(
      offer('phone', {
        label: 'check the score out back',
        duration: 6,
        effort: 0,
        placeId: 'line',
        advertises: { leisure: 0.3 },
      }),
    );
  if (
    canLeave &&
    s.request?.state === 'yes' &&
    s.request.who === id &&
    s.request.kind === 'phone' &&
    !s.request.rang
  )
    list.push(
      offer('phone', {
        label: 'ring my mother',
        duration: 5,
        effort: 0,
        advertises: { belonging: 0.3, relief: 0.2 },
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
  const mm = s.minute - nightStart(s.night);
  if (id === 'selim' && mm >= 18 * 60 + 35 && mm <= 19 * 60 + 15)
    list.push(
      offer('pray', {
        label: 'pray maghrib',
        duration: 8,
        effort: 0,
        advertises: { meaning: 0.3 },
        norms: [{ normId: 'salah', relation: 'fulfills' }],
      }),
    );
  // Nevin's apron, on the anniversary: offered to Selim, never asked for. What it means to him rises with what
  // he has come to think of the chef (an honest, per-person advertisement).
  if (id === 'selim' && plan(s).anniversary && mm >= 19 * 60 + 10 && mm <= 21 * 60 && !s.apron) {
    const warmth = Math.max(0, trustOf(p) - 0.45);
    list.push(
      offer('apron', {
        label: 'tie on Nevin’s apron and call the pass',
        duration: 90,
        effort: 0.35,
        placeId: 'line',
        advertises: { meaning: 0.15 + 1.6 * warmth, belonging: 0.1 + 1.2 * warmth, esteem: 0.2 },
      }),
    );
  }
  return list;
}

// ---------- the telegraph ----------

export interface Hint {
  verb: Verb;
  verdict: SuggestionResolution['verdict'];
  says: string;
  short: string;
  /** The chef's guess about a cook they do not know yet (pencil). */
  guess: boolean;
}

/** Jobs the chef can ask for tonight. */
export function verbsTonight(s: GameState): Verb[] {
  return [...stationsTonight(s), 'break', 'eat', 'home'];
}

/** What each cook would likely say to each verb, right now. Pure: no state change, no randomness. */
export function hints(s: GameState, id: CookId, insist = false): Hint[] {
  const p = personOf(s, id);
  const m = memberOf(s, id);
  return verbsTonight(s).map((verb) => {
    const offers = offersFor(s, id, verb);
    const sug = suggestion(verb, insist);
    if (!m.founder) {
      const g = predictAs(s.chef, p, offers, sug, { now: s.minute });
      return {
        verb,
        verdict: g.resolution.verdict,
        says: (s.version === 'pass@10' && answerWords(s, p, g.resolution, verb)?.text) || g.resolution.says,
        short: crewShort(s, id, verb, offers) ?? shortOf(g.resolution, s, p, verb),
        guess: g.confidence < 0.6,
      };
    }
    const r = predict(p, offers, sug);
    return {
      verb,
      verdict: r.verdict,
      says: (s.version === 'pass@10' && answerWords(s, p, r, verb)?.text) || r.says,
      short: crewShort(s, id, verb, offers) ?? shortOf(r, s, p, verb),
      guess: false,
    };
  });
}

export function forecastLine(s: GameState, id: CookId): string | null {
  const p = personOf(s, id);
  const st = memberOf(s, id).home;
  const aff = offersFor(s, id).find((a) => a.id === st);
  if (!aff?.followedBy) return null;
  // Said only when it is news: "I'll still have enough" on every tap is noise.
  const line = bodyForecast(p, aff).line;
  return /still have enough/.test(line) ? null : line;
}

/** The crew rule, as the cook would put it: who is already out back. */
function crewShort(s: GameState, id: CookId, verb: Verb, offers: Affordance[]): string | null {
  if ((verb !== 'break' && verb !== 'eat' && verb !== 'home') || offers.some((o) => o.id === verb))
    return null;
  const out = onShift(s)
    .filter((x) => x !== id && !inKitchen(s, x))
    .map((x) => nameOf(s, x));
  return out.length ? `not with ${listOf(out)} out` : 'someone must stay';
}

const afterless = (label: string) => label.replace(/^after I /, '');

/** A remembered break deferral keeps the reason HF originally gave until that break ends. */
function answerWords(s: GameState, p: Person, r: SuggestionResolution, verb: Verb) {
  const remembered = cookOf(s, p.id).breakDeferred;
  if (
    ['deferred', 'modified'].includes(r.verdict) &&
    remembered?.verb === verb &&
    s.minute < remembered.endsAt &&
    remembered.reason
  )
    return { text: remembered.reason, short: remembered.short ?? 'not now' };
  return suggestionWords(p, r, verb);
}

function shortOf(r: SuggestionResolution, s: GameState, p: Person, verb: Verb): string {
  if (s.version === 'pass@10') {
    const words = answerWords(s, p, r, verb);
    if (words) return words.short;
  }
  switch (r.verdict) {
    case 'assented':
      return 'yes';
    case 'complied':
      return 'if I must';
    case 'deferred':
      return r.counterOffer?.label ? `after I ${afterless(r.counterOffer.label)}` : 'not now';
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
  affordanceId: verb,
  strength: insist ? INSIST : ASK,
  insist,
});

// ---------- inputs ----------

export function queueInput(s: GameState, input: NewInput): void {
  s.inputs.push({ ...input, at: s.minute } as Input);
  if (
    s.phase !== 'service' ||
    (chefEdition(s) &&
      ['help', 'pass-priority', 'cook-step', 'call-plate', 'cook-choice', 'finish-portion'].includes(
        input.kind,
      ))
  )
    applyPending(s);
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
    case 'pace':
      if (promisesOn(s) && s.applied === 1 && inp.value === 'nevin') s.pace = 'nevin';
      return;
    case 'board':
      if (hasBoard(s) && s.phase === 'board') agreeBoard(s, inp.rows);
      return;
    case 'staff': {
      if (!hasBoard(s) || s.phase !== 'service') return;
      const decision = s.staffing?.find((d) => d.id === inp.id && d.state === 'asking');
      if (!decision) return;
      if (inp.cover === null) decision.state = 'left';
      else if (staffingOptions(s, decision).includes(inp.cover)) {
        const cover = cookOf(s, inp.cover);
        const accepted = takeStation(s, cover, decision.station, decision.until, false);
        if (accepted.accepted) {
          decision.state = 'covered';
          decision.cover = inp.cover;
          if (chefEdition(s)) {
            const own = s.board?.rows.find((row) => row.cook === inp.cover && row.accepted);
            if (own && own.station !== decision.station) {
              s.acceptedGaps ??= [];
              s.acceptedGaps.push({ who: inp.cover, station: own.station, until: decision.until });
              say(
                s,
                inp.cover,
                `My ${VERB_WORD[own.station]} waits while I cover ${VERB_WORD[decision.station]} until ${clock(decision.until)}.`,
                'answer',
              );
            }
          }
        } else say(s, inp.cover, 'I cannot cover that. You will need another arrangement.', 'answer');
      }
      return;
    }
    case 'ask': {
      if (s.phase !== 'service') return;
      const c = s.cooks.find((x) => x.id === inp.cook);
      if (!c?.here || c.gone) return;
      const p = personOf(s, inp.cook);
      if (
        !hasCover(s) &&
        !inp.insist &&
        !c.pending &&
        p.activity?.affordanceId === inp.verb &&
        isStation(inp.verb)
      ) {
        say(s, c.id, 'I’m on it, Chef.', 'answer');
        return;
      }
      c.night.asked += 1;
      if (inp.insist) {
        c.night.insisted += 1;
        c.week.insisted += 1;
      }
      c.pending = { s: suggestion(inp.verb, inp.insist), verb: inp.verb, counter: inp.counter };
      c.deferred = null;
      if (p.activity) interrupt(p, s.minute, 'voice:chef');
      return;
    }
    case 'pass-priority': {
      if (!chefEdition(s) || s.phase !== 'service' || s.passDecision?.state !== 'asking' || s.help) return;
      if (!priorityOptions(s).some((o) => o.ticket === inp.ticket)) return;
      s.passDecision.state = 'chosen';
      s.passDecision.ticket = inp.ticket;
      const t = s.tickets.find((t) => t.id === inp.ticket);
      if (!t) return;
      say(
        s,
        'narrator',
        `I called table ${t.table} first. Their next portions and the next clean plate go ahead of the others.`,
        'journal',
      );
      const cook = onShift(s).find((id) => stationOf(s, id) && stationOf(s, id) !== 'dish');
      if (cook)
        say(s, cook, `Table ${t.table} first, Chef. The others will wait for those portions.`, 'answer');
      return;
    }
    case 'cook-choice': {
      if (!portionEdition(s) || s.phase !== 'service') return;
      const choice = cookingChoice(s);
      if (!choice || choice.ticket !== inp.ticket) {
        stalePortion(s, inp.ticket);
        return;
      }
      chooseCooking(s, inp.choice);
      return;
    }
    case 'finish-portion': {
      if (!portionEdition(s) || s.phase !== 'service') return;
      if (!s.help || s.help.ticket !== inp.ticket) {
        stalePortion(s, inp.ticket);
        return;
      }
      if (delegateSignature(s)) return;
      s.help.instinct = true;
      s.help.plain = true;
      say(
        s,
        'narrator',
        'I will finish this whole portion on instinct. A plain portion; the room keeps its pace.',
        'answer',
      );
      return;
    }
    case 'cook-step': {
      if (!handsOn(s) || s.phase !== 'service') return;
      if (!s.help || s.help.ticket !== inp.ticket) {
        stalePortion(s, inp.ticket);
        return;
      }
      if (inp.instinct && delegateSignature(s)) return;
      if (inp.instinct) {
        s.help.instinct = true;
        s.help.plain = true;
      }
      const action = cookingStep(s);
      if (portionEdition(s) && cookingChoice(s)) {
        if (inp.instinct) chooseCooking(s, 'now');
        else say(s, 'narrator', 'I can finish it now, or spend three more minutes taking care.', 'answer');
        return;
      }
      if (action?.ready) performCookingStep(s, !!inp.instinct);
      else if (!inp.instinct) say(s, 'narrator', action?.text ?? 'That portion has moved.', 'answer');
      return;
    }
    case 'call-plate': {
      if (!handsOn(s) || s.phase !== 'service') return;
      const t = s.tickets.find((t) => t.id === inp.ticket);
      if (t?.status !== 'open' || t.platedAt === undefined) {
        stalePortion(s, inp.ticket);
        return;
      }
      t.called = true;
      pass(s);
      return;
    }
    case 'help': {
      if (portionEdition(s) && s.help && s.phase === 'service') {
        if (!helpOptions(s).some((o) => o.ticket === inp.ticket && o.station === inp.station)) {
          stalePortion(s, inp.ticket);
          return;
        }
        if (
          promisesOn(s) &&
          signaturePending(s, s.chefNext?.ticket) &&
          (s.chefNext?.ticket !== inp.ticket || s.chefNext.station !== inp.station)
        ) {
          say(
            s,
            'narrator',
            'The promised signature is Chef’s next. It stays behind my current portion.',
            'answer',
          );
          return;
        }
        s.chefNext = { ticket: inp.ticket, station: inp.station };
        const t = s.tickets.find((t) => t.id === inp.ticket);
        say(
          s,
          'narrator',
          `Table ${t?.table}'s ${foodWords(inp.station)} is Chef’s next. The crew leaves that portion for me.`,
          'answer',
        );
        return;
      }
      if (handsOn(s) && !helpOptions(s).some((o) => o.ticket === inp.ticket && o.station === inp.station)) {
        stalePortion(s, inp.ticket);
        return;
      }
      if (!hasCover(s) || s.phase !== 'service' || s.help) return;
      if (!helpOptions(s).some((o) => o.ticket === inp.ticket && o.station === inp.station)) return;
      if (portionEdition(s)) s.chefGrace = [];
      if (chefEdition(s)) {
        const work = foodWork(inp.station);
        const minutes = Math.ceil(work / chefPace(s, inp.station));
        s.help = { ticket: inp.ticket, station: inp.station, until: s.minute + minutes, progress: 0, work };
        if (handsOn(s)) {
          s.help.act = 0;
          s.help.readyAt = s.minute + 3 + (s.chef.body.exertion > 0.65 ? 2 : 0);
          s.help.until = s.help.readyAt;
        }
        tick(s.chef, s.minute);
        const aff = offer('chef-food', {
          duration: minutes + 60,
          effort: inp.station === 'cold' ? 0.5 : 0.7,
          focus: 0.5,
        });
        begin(s.chef, aff, decide(s.chef, [aff]));
        const t = s.tickets.find((t) => t.id === inp.ticket);
        if (!t) return;
        const booking = signaturePending(s, t.id);
        if (booking && booking.signature === inp.station) {
          s.help.signature = true;
          booking.signatureStartedAt = s.minute;
        }
        say(
          s,
          'narrator',
          handsOn(s)
            ? `I took ${foodWords(inp.station)} for table ${t.table}. The crew leaves that portion to me. I will ${COOK_ACTS[inp.station].join(', then ')}; the work tires my arms.`
            : `I took ${foodWords(inp.station)} for table ${t.table}. The crew leaves that portion to me; about ${minutes} minutes.`,
          'journal',
        );
        return;
      }
      s.help = { ticket: inp.ticket, station: inp.station, until: s.minute + 5 };
      say(
        s,
        'narrator',
        `I started ${inp.station === 'grill' ? 'a grill portion' : 'a cold plate'} for table ${s.tickets.find((t) => t.id === inp.ticket)?.table}. Five minutes at the pass.`,
        'journal',
      );
      return;
    }
    case 'jar': {
      if (s.phase !== 'evening' || s.night !== 3 || s.jarDecided) return;
      s.jarDecided = true;
      jarChoice(s, inp.choice);
      return;
    }
    case 'answer': {
      if (s.phase !== 'service' || s.request?.state !== 'asking') return;
      answerRequest(s, inp.choice);
      return;
    }
    case 'choose': {
      if (s.phase !== 'sunday' || !s.sunday) return;
      choose(s, inp.key, inp.value);
      return;
    }
    case 'open': {
      if (s.phase === 'board' && s.board?.agreed) {
        s.phase = 'service';
        return;
      }
      if (s.phase === 'evening') {
        if (s.lost) {
          s.phase = 'end';
          return;
        }
        if (isLastOfWeek(s.night)) enterSunday(s);
        else nextNight(s);
      } else if (s.phase === 'sunday') {
        if (s.night >= LAST_NIGHT) {
          s.phase = 'end';
          return;
        }
        leaveSunday(s);
      }
      return;
    }
  }
}

function jarChoice(s: GameState, choice: 'move' | 'talk' | 'leave') {
  if (choice === 'move') {
    s.jarPlace = 'pass';
    say(
      s,
      'narrator',
      'I moved the jar to the pass, where I can see it. Rafi watched me carry it and said nothing.',
      'journal',
    );
  } else if (choice === 'talk') {
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
}

// ---------- requests ----------

function requestKind(s: GameState, r: RequestPlan): { kind: string; who: CookId } | null {
  if (r.who !== 'hire') return { kind: r.kind, who: r.who };
  const hire = [...s.crew].reverse().find((m) => !m.founder && !m.left && cookOf(s, m.id).here);
  if (!hire) return null;
  const kind = hire.template === 'can' ? 'eat-first' : hire.template === 'hulya' ? 'my-way' : 'leave-early';
  return { kind, who: hire.id };
}

export function requestText(s: GameState, rq: Request): string {
  const lines = REQUEST_LINES[rq.kind];
  if (lines?.ask) return lines.ask;
  return hireTemplate(memberOf(s, rq.who).template ?? '')?.asks ?? '';
}

function releaseShift(p: Person, now: number) {
  for (const c of p.agenda.commitments)
    if (c.status === 'pending' && c.label === 'my shift' && c.from <= now + 60 && now < c.until)
      releaseCommitment(p, c.id);
}

/** Minutes a cook waits for an answer before deciding for themselves. */
const REQUEST_WAIT: Record<string, number> = { mother: 6, phone: 10 };

/** Nobody answered: Dilek goes to her mother anyway; anyone else lets it drop. Both cost more trust than a no. */
function ignoreRequest(s: GameState) {
  const rq = s.request as Request;
  rq.ignored = true;
  answerRequest(s, rq.kind === 'mother' ? 'yes' : 'no', true);
}

function answerRequest(s: GameState, choice: 'yes' | 'no', ignored = false) {
  const rq = s.request as Request;
  rq.state = choice;
  const p = personOf(s, rq.who);
  const c = cookOf(s, rq.who);
  const lines = REQUEST_LINES[rq.kind];
  if (ignored) adoptVoiceTrust(p, CHEF, 0, 0.07);
  else if (choice === 'yes') {
    adoptVoiceTrust(p, CHEF, 1, 0.06);
    socialEvent(p, { at: s.minute, kind: 'help', otherId: CHEF, byMe: false, magnitude: 0.6 });
  } else adoptVoiceTrust(p, CHEF, 0, 0.05);
  if (lines)
    say(
      s,
      rq.who,
      ignored
        ? rq.kind === 'mother'
          ? 'I can’t wait for you, Chef. I’m going.'
          : 'Never mind. Forget I asked.'
        : choice === 'yes'
          ? lines.yes
          : lines.no,
      'answer',
    );
  const d = nightStart(s.night);
  switch (rq.kind) {
    case 'mother':
      if (choice === 'yes') {
        releaseShift(p, s.minute);
        c.pending = { s: { voiceId: CHEF, affordanceId: 'home', strength: 0.8 }, verb: 'home', quiet: true };
      } else {
        c.night.asked += 1;
        c.pending = { s: { voiceId: CHEF, affordanceId: 'cold', strength: 0.7 }, verb: 'cold', quiet: true };
      }
      break;
    case 'advance':
      if (choice === 'yes') s.till -= 50;
      break;
    case 'phone':
      if (choice === 'yes')
        c.pending = {
          s: { voiceId: CHEF, affordanceId: 'phone', strength: 0.8 },
          verb: 'break',
          quiet: true,
        };
      break;
    case 'leave-early':
      if (choice === 'yes') {
        releaseShift(p, s.minute);
        promise(p, {
          kind: 'promise',
          toId: 'self',
          label: 'going at nine',
          actions: ['home'],
          from: d + 21 * 60,
          until: d + 21 * 60 + 40,
          importance: 0.6,
        });
      }
      break;
    case 'eat-first':
      if (choice === 'yes')
        c.pending = { s: { voiceId: CHEF, affordanceId: 'eat', strength: 0.8 }, verb: 'eat', quiet: true };
      break;
    case 'my-way':
      if (choice === 'yes') s.myWay = rq.who;
      break;
  }
  if (p.activity && c.pending) interrupt(p, s.minute, 'voice:chef');
}

// ---------- the minute ----------

/** Advance one sim minute of service. */
export function step(s: GameState): void {
  if (s.phase !== 'service') return;
  applyPending(s);
  const m = s.minute;
  const pl = plan(s);
  for (const t of s.tickets) if (t.status === 'waiting' && t.at <= m) arrive(s, t);
  scripted(s, m, pl);
  if (s.request?.state === 'asking' && m - s.request.at >= (REQUEST_WAIT[s.request.kind] ?? 12))
    ignoreRequest(s);
  for (const c of s.cooks) {
    if (!c.here) continue;
    if (c.gone) {
      // A cook who went home finishes going home (so a promise kept by leaving is kept).
      const p = personOf(s, c.id);
      if (p.activity && m >= p.activity.endsAt) endActivity(p, 'completed', m, s, c);
      continue;
    }
    cookMinute(s, c);
  }
  if (chefEdition(s)) detectPassOverload(s);
  if (portionEdition(s)) prepareChefClaims(s);
  produce(s);
  if (hasCover(s)) chefMinute(s);
  if (hasBoard(s)) detectBoardGaps(s);
  pass(s);
  if (
    chefEdition(s) &&
    s.passDecision?.state === 'asking' &&
    s.passDecision.tickets.filter((id) => s.tickets.some((t) => t.id === id && t.status === 'open')).length <
      2
  )
    s.passDecision.state = 'passed';
  for (const t of s.tickets) {
    if (t.status !== 'open' || (handsOn(s) && t.platedAt !== undefined)) continue;
    if (t.due !== undefined) {
      if (m > t.due + 60) {
        t.status = 'walked';
        say(s, 'narrator', 'The hall sent someone to the place on the corner for the trays.', 'journal');
      }
      continue;
    }
    const patience = t.patience + (bookingOf(s, t.id)?.promised ? 0 : s.apron ? 12 : 0);
    if (m - t.at > patience) walk(s, t);
  }
  s.plates.dirty = s.plates.dirty.filter((d) => {
    if (d.at > m) return true;
    if (!pl.dish)
      s.plates.clean += 1; // Monday I wash them myself between plates
    else s.plates.pile += 1;
    return false;
  });
  if (m % 15 === 0) for (const id of onShift(s)) glimpseOf(s.chef, personOf(s, id), m, 0.8);
  s.minute += 1;
  if (s.minute >= closeAt(s.night)) closeNight(s);
}

function arrive(s: GameState, t: Ticket) {
  if (chefEdition(s) && t.due === undefined) {
    const occupied = new Set(
      s.tickets.filter((other) => other.status === 'open').map((other) => other.table),
    );
    if (occupied.has(t.table)) {
      let table = 1;
      while (occupied.has(table)) table++;
      t.table = table;
    }
  }
  t.status = 'open';
  const booking = bookingOf(s, t.id);
  if (booking) {
    const p = partyOf(booking.party);
    const regular = p?.regular ? s.regulars[p.regular] : undefined;
    if (regular) regular.visits += 1;
    if (p) say(s, 'narrator', p.sits, 'journal');
    if (booking.promised) {
      s.chefNext = { ticket: t.id, station: booking.signature };
      say(
        s,
        'narrator',
        `Table ${t.table}'s ${p?.signature.words} is promised. Chef’s next, by ${clock(booking.servedBy)}.`,
        'call',
      );
    }
    return;
  }
  if (t.regular) {
    const r = regularOf(t.regular);
    const st = s.regulars[t.regular];
    if (r && st && !t.friend) {
      st.visits += 1;
      say(s, 'narrator', r.sits, 'journal');
    } else if (r && t.friend) say(s, 'narrator', `${capital(r.name)} brought a friend tonight.`, 'journal');
  }
  if (t.due !== undefined)
    say(s, 'narrator', 'The wedding order is on the rail: twenty trays, by eight.', 'journal');
}

function walk(s: GameState, t: Ticket) {
  if (bookingOf(s, t.id) && t.platedAt !== undefined) s.plates.dirty.push({ at: s.minute + 18 });
  t.status = 'walked';
  if (bookingOf(s, t.id)) {
    finishParty(s, t);
    return;
  }
  const r = t.regular ? regularOf(t.regular) : undefined;
  if (r && !t.friend) {
    const st = s.regulars[r.id] as RegularState;
    st.regard = clamp(st.regard - 0.2);
    say(s, 'narrator', r.cross, 'journal');
    return;
  }
  say(
    s,
    'narrator',
    `Table ${t.table} gave up and left${t.critic ? '. One of them had a notebook' : ''}.`,
    'journal',
  );
}

function scripted(s: GameState, m: number, pl: NightPlan) {
  const d = nightStart(s.night);
  if (pl.call && m === d + 19 * 60 + 40) startRequest(s, { kind: 'mother', who: 'dilek' });
  if (pl.request && m === d + pl.request.at) {
    const k = requestKind(s, pl.request);
    if (k) startRequest(s, k);
  }
  if (pl.gasOut) {
    if (m === d + pl.gasOut.from)
      say(s, 'narrator', 'The gas went with a sigh. The grill and the oven are dark.', 'journal');
    if (m === d + pl.gasOut.until)
      say(s, 'narrator', 'The gas came back. Selim swore at it, fondly.', 'journal');
  }
}

function startRequest(s: GameState, k: { kind: string; who: CookId }) {
  const c = s.cooks.find((x) => x.id === k.who);
  if (!c?.here || c.gone || s.crew.find((x) => x.id === k.who)?.left) return;
  s.request = { kind: k.kind, who: k.who, state: 'asking', at: s.minute };
  say(s, k.who, requestText(s, s.request), 'call');
}

export const gasOut = (s: GameState): boolean => {
  const g = plan(s).gasOut;
  const mm = s.minute - nightStart(s.night);
  return !!g && mm >= g.from && mm < g.until;
};

function cookMinute(s: GameState, c: CookState) {
  const p = personOf(s, c.id);
  if (chefEdition(s) && p.activity && isStation(p.activity.affordanceId)) {
    const st = p.activity.affordanceId;
    p.activity.effort = waitingAt(s, st) > 0 || st === 'oven' ? p.activity.affordance.effort : 0.08;
  }
  tick(p, s.minute);
  if (hasBoard(s) && rotaMinute(s, c)) return;
  let a = p.activity;
  if (hasCover(s) && c.cover) {
    if (s.minute >= c.cover.until || a?.affordanceId !== c.cover.station) c.cover = null;
    else if (!c.pending) return;
  }
  let ended: string | undefined;
  if (a && s.minute >= a.endsAt) {
    ended = a.affordanceId;
    endActivity(p, 'completed', s.minute, s, c);
    a = null;
  }
  const due = c.pending !== null || (a ? s.minute >= a.reviewAt : s.minute >= c.idleUntil);
  if (!due) return;
  const offers = offersFor(s, c.id).filter(
    (o) => !a || o.id !== a.affordanceId || (hasCover(s) && c.pending?.verb === o.id),
  );
  const voice = c.pending ?? (!a && c.deferred && s.minute <= c.deferred.until ? c.deferred : null);
  // Before deciding: which other stations this cook would take now (pure), in case a break turns one down.
  const onBreak = a && OFF_LINE.includes(a.affordanceId) ? a : null;
  const station = voice && (STATIONS as readonly string[]).includes(voice.verb);
  const would =
    voice && c.pending && onBreak && station && !voice.s.insist
      ? stationsTonight(s).filter(
          (st) =>
            st !== voice.verb && predict(p, offersFor(s, c.id, st), suggestion(st)).verdict === 'assented',
        )
      : [];
  const rec: DecisionRecord = decide(p, offers, voice ? { suggestion: voice.s } : {});
  if (voice) {
    const wasDeferred = voice === c.deferred;
    c.pending = null;
    c.deferred = null;
    const r = rec.suggestion;
    if (r) answered(s, c, p, voice, r, rec, onBreak, would, wasDeferred);
  }
  notePrompt(s, c.id, p);
  noteResolve(s, c, p, rec);
  if (a && rec.chosenAffordanceId === a.affordanceId) {
    if (
      hasCover(s) &&
      voice &&
      isStation(voice.verb) &&
      ['assented', 'complied'].includes(rec.suggestion?.verdict ?? '')
    ) {
      c.cover = { station: voice.verb, until: coverUntil(s) };
      a.endsAt = c.cover.until;
    }
    reviewed(p);
    return;
  }
  const aff = offers.find((o) => o.id === rec.chosenAffordanceId);
  if (!aff) {
    if (a) reviewed(p);
    else c.idleUntil = s.minute + 3;
    return;
  }
  const from = a?.affordanceId ?? ended;
  if (a) endActivity(p, 'interrupted', s.minute, s, c);
  // Sent home by the chef: the chef has released the shift, so going is not a broken promise.
  if (aff.id === 'home' && voice?.verb === 'home') releaseShift(p, s.minute);
  if (!begin(p, aff, rec)) {
    c.idleUntil = s.minute + 3;
    return;
  }
  c.made = 0;
  if (hasCover(s)) {
    c.cover =
      voice &&
      isStation(aff.id) &&
      voice.verb === aff.id &&
      ['assented', 'complied'].includes(rec.suggestion?.verdict ?? '')
        ? { station: aff.id, until: coverUntil(s) }
        : null;
    if (c.cover && p.activity) p.activity.endsAt = c.cover.until;
  }
  if (isStation(aff.id) && !c.night.worked.includes(aff.id)) c.night.worked.push(aff.id);
  // A cook who moves station on their own says so in the journal, with what a watcher would see as the reason.
  if (!voice && from && from !== aff.id && isStation(from) && isStation(aff.id)) {
    const w = waitingAt(s, from);
    say(
      s,
      'narrator',
      `${nameOf(s, c.id)} left ${VERB_WORD[from]} for ${VERB_WORD[aff.id]}${w === 0 ? `; ${CLEAR[from]}` : waitingAt(s, aff.id) > w ? ', where more was waiting' : ''}.`,
      'journal',
    );
  }
  if (aff.id === 'phone' && s.request?.kind === 'phone' && s.request.who === c.id) s.request.rang = true;
  if (aff.id === 'home') {
    c.gone = true;
    const went = s.request?.who === c.id && s.request.state === 'yes';
    say(
      s,
      'narrator',
      went && s.request?.kind === 'mother'
        ? 'Dilek took her coat and ran.'
        : went
          ? `${nameOf(s, c.id)} said goodnight and went.`
          : `${nameOf(s, c.id)} hung up the apron and went home.`,
      'journal',
    );
  }
  if (aff.id === 'pray' && !s.said.some((x) => x.at >= openAt(s.night) && x.text.includes('maghrib')))
    say(s, 'narrator', 'Selim stepped into the storeroom for maghrib.', 'journal');
  if (aff.id === 'apron') {
    s.apron = c.id;
    say(
      s,
      'narrator',
      'Selim came out of the storeroom and tied on Nevin’s apron. He said nothing. He called the next ticket.',
      'journal',
    );
    stamp(s, 'apron');
  }
}

/** Book a cook's answer: the caption at the pass, the night's events, and the line they say. */
function answered(
  s: GameState,
  c: CookState,
  p: Person,
  voice: { s: Suggestion; verb: Verb; counter?: boolean; quiet?: boolean },
  r: SuggestionResolution,
  rec: DecisionRecord,
  onBreak: Activity | null,
  would: Station[],
  wasDeferred: boolean,
) {
  if (r.verdict === 'refused') c.night.refused += 1;
  if (r.verdict === 'complied') {
    c.night.complied += 1;
    c.week.complied += 1;
  }
  if (r.verdict === 'assented') c.night.assented += 1;
  const verb = voice.verb;
  const previousBreak = c.breakDeferred;
  const reason = s.version === 'pass@10' ? answerWords(s, p, r, voice.verb) : null;
  let text = reason?.text ?? r.says;
  let counter: Verb | undefined;
  const crewRule =
    r.verdict === 'refused' && r.reason === 'unavailable' && (OFF_LINE.includes(verb) || verb === 'home');
  if (crewRule) {
    const out = onShift(s)
      .filter((x) => x !== c.id && !inKitchen(s, x))
      .map((x) => nameOf(s, x));
    text =
      out.length > 0 ? `Not with ${listOf(out)} already out there.` : 'Somebody has to stay on the line.';
  }
  // A break turns down one station but not another: say what is different about this one.
  if (
    onBreak &&
    (r.verdict === 'deferred' || r.verdict === 'modified') &&
    rec.chosenAffordanceId === onBreak.affordanceId &&
    (STATIONS as readonly string[]).includes(verb)
  ) {
    const job = VERB_WORD[verb] ?? verb;
    const why =
      onBreak.affordanceId === 'eat'
        ? `Leave my plate for ${job}? Let me eat first.`
        : onBreak.affordanceId === 'smoke'
          ? `Off my cigarette for ${job}? Let me finish it.`
          : onBreak.affordanceId === 'phone'
            ? `Off the phone for ${job}? One minute.`
            : `Off my ten for ${job}? Let me have my ten.`;
    text = reason?.text ?? `${why}${would[0] ? ` ${capital(VERB_WORD[would[0]] ?? '')} I’d do.` : ''}`;
    c.breakDeferred = {
      verb,
      endsAt: onBreak.endsAt,
      rest: REST_WORD[onBreak.affordanceId] ?? 'ten',
      ...(reason ? { reason: reason.text, short: reason.short } : {}),
    };
    if (s.version === 'pass@10' && previousBreak?.verb === verb && s.minute < previousBreak.endsAt)
      c.breakDeferred = previousBreak;
    if (would[0]) counter = would[0];
  } else if (
    !onBreak &&
    (r.verdict === 'deferred' || r.verdict === 'modified') &&
    c.breakDeferred?.verb === verb &&
    s.minute < c.breakDeferred.endsAt
  ) {
    // Still the same no as on the break: say so, rather than a new reason that doesn't fit.
    const on = p.activity?.affordanceId;
    const came = on && on in VERB_WORD ? ` for ${VERB_WORD[on]}` : '';
    text =
      s.version === 'pass@10'
        ? (c.breakDeferred.reason ?? reason?.text ?? 'Not now, Chef.')
        : `I came off my ${c.breakDeferred.rest}${came}. ${capital(VERB_WORD[verb] ?? verb)}, not yet.`;
  } else if (
    onBreak &&
    (r.verdict === 'assented' || r.verdict === 'complied') &&
    rec.chosenAffordanceId === verb &&
    (STATIONS as readonly string[]).includes(verb)
  ) {
    // Off a break for the job: a person says what they are giving up.
    const cut: Record<string, string> = {
      eat: 'Leaving my plate, then.',
      smoke: 'Out with the cigarette.',
      phone: 'I’ll ring back.',
      break: 'There goes my ten.',
    };
    text = `${cut[onBreak.affordanceId] ?? cut.break} ${text}`;
    if (c.breakDeferred?.verb === verb) c.breakDeferred = null;
  } else if (r.verdict === 'assented' && c.breakDeferred?.verb === verb) {
    if (s.minute < c.breakDeferred.endsAt && !onBreak)
      text = `I’m up now anyway. ${capital(VERB_WORD[verb] ?? verb)}, fine.`;
    c.breakDeferred = null;
  }
  if (
    r.verdict === 'modified' &&
    r.counterOffer &&
    (VERBS as readonly string[]).includes(r.counterOffer.affordanceId ?? '')
  )
    counter = r.counterOffer.affordanceId as Verb;
  if (
    hasCover(s) &&
    isStation(verb) &&
    rec.chosenAffordanceId === verb &&
    ['assented', 'complied'].includes(r.verdict)
  )
    text = `${text} ${stationPromise(s, verb)}`;
  if (hasBoard(s) && isStation(verb) && ['deferred', 'modified'].includes(r.verdict))
    text += ' That is not promised cover. Please arrange someone else, or ask again later.';
  const verdict = voice.counter && r.verdict === 'assented' ? 'countered' : r.verdict;
  c.night.events.push({ at: s.minute, verb, verdict, insisted: !!voice.s.insist, crewRule });
  if (voice.quiet) return;
  if (!wasDeferred || r.verdict !== 'deferred') {
    say(s, c.id, text, 'answer');
    s.lastAnswer = { at: s.minute, who: c.id, verb, verdict, text, counter, insisted: !!voice.s.insist };
  }
  if (!hasBoard(s) && r.verdict === 'deferred' && !wasDeferred)
    c.deferred = { s: voice.s, verb, until: s.minute + 30 };
}

const listOf = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;

function notePrompt(s: GameState, id: CookId, p: Person) {
  const r = p.promptings?.recent.at(-1);
  if (!r || r.at !== s.minute || s.lastPromptAt[id] === r.at) return;
  s.lastPromptAt[id] = r.at;
  if (r.outcome === 'assented') return;
  if (
    s.said.some(
      (x) => x.at >= openAt(s.night) && x.kind === 'prompt' && x.text.startsWith('Rafi looked at the jar'),
    )
  )
    return;
  // HF's lens vocabulary is not a caption (docs/hf-requests.md); the game says what a watcher would see.
  const line =
    r.outcome === 'turned'
      ? 'Rafi looked at the jar, then went and scrubbed the trays.'
      : 'Rafi looked at the jar a long moment, and left it.';
  say(s, 'narrator', line, 'prompt');
}

/** HF muhasaba: a resolve formed last night weighed in a choice tonight. Said once a night. */
function noteResolve(s: GameState, c: CookState, p: Person, rec: DecisionRecord) {
  if (c.remembered) return;
  const chosen = rec.considered.find((x) => x.affordanceId === rec.chosenAffordanceId);
  if (!chosen?.terms.some((t) => t.source.startsWith('review:') && t.value > 0.02)) return;
  c.remembered = true;
  // HF's term does not name its resolve; the chosen act and the person's resolves say which it was.
  const keys = (p.review?.resolves ?? []).map((r) => r.label ?? r.key);
  const key = chosen.affordanceId === 'pray' ? 'maghrib' : keys.find((k) => k !== 'maghrib');
  const line = key ? resolveSeen(nameOf(s, c.id), key) : null;
  if (line) say(s, 'narrator', line, 'journal');
}

const capital = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const clamp = (x: number) => Math.max(0, Math.min(1, x));

function endActivity(p: Person, status: Outcome['status'], at: number, s?: GameState, c?: CookState) {
  const a = p.activity as Activity;
  const out: Outcome = { affordanceId: a.affordanceId, action: a.action, status, at };
  const done = Math.min(1, (at - a.startedAt) / Math.max(1, a.endsAt - a.startedAt));
  if (a.action === 'eat' || a.action === 'meal') out.needs = { food: 0.5 * done, water: 0.4 * done };
  // Plates that went out from your station: an honest world effect on competence and standing.
  if (c && c.made > 0 && (STATIONS as readonly string[]).includes(a.affordanceId))
    out.needs = { competence: Math.min(0.2, c.made * 0.03), esteem: Math.min(0.15, c.made * 0.02) };
  if (c) c.made = 0;
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
  const own = s.myWay === id && st === 'oven' ? 1.25 : 1;
  return (0.55 + 0.75 * skill) * (0.4 + 0.6 * cap) * protest * own;
}

export function stationOf(s: GameState, id: CookId): Station | null {
  const c = s.cooks.find((x) => x.id === id);
  if (!c?.here || c.gone) return null;
  const a = personOf(s, id).activity;
  if (!a) return null;
  return (STATIONS as readonly string[]).includes(a.affordanceId) ? (a.affordanceId as Station) : null;
}

export const pileOf = (s: GameState): number => s.plates.pile;

/** What the open tickets still owe each station, in portions. */
const CLEAR: Record<string, string> = {
  grill: 'the grill was clear',
  cold: 'the cold side was clear',
  dish: 'the plates were done',
  oven: 'nothing was in the oven',
};

const isStation = (x: string): x is Station => (STATIONS as readonly string[]).includes(x);

/** Work waiting at a station: portions owed, or dirty plates. */
function waitingAt(s: GameState, st: string): number {
  if (st === 'dish') return s.plates.pile;
  const o = owed(s);
  return st in o ? o[st as keyof typeof o] : 0;
}

export function owed(s: GameState): Record<'grill' | 'cold' | 'oven', number> {
  const o = { grill: 0, cold: 0, oven: 0 };
  for (const t of s.tickets)
    if (t.status === 'open') {
      o.grill += t.grill - t.doneGrill;
      o.cold += t.cold - t.doneCold;
      o.oven += t.oven - t.doneOven;
    }
  if (chefEdition(s) && s.help && s.tickets.some((t) => t.id === s.help?.ticket && t.status === 'open'))
    o[s.help.station] = Math.max(0, o[s.help.station] - 1);
  return o;
}

function produce(s: GameState) {
  const dark = gasOut(s);
  let tended = false;
  for (const c of s.cooks) {
    const st = stationOf(s, c.id);
    if (!st) continue;
    if (chefEdition(s) && st !== 'dish' && st !== 'oven' && waitingAt(s, st) <= 0) continue;
    const r = pace(s, c.id, st);
    if (st === 'grill') {
      if (!dark) {
        s.work.grill += r;
        c.made += r / GRILL_WORK;
      }
    } else if (st === 'cold') {
      s.work.cold += r;
      c.made += r / COLD_WORK;
    } else if (st === 'oven') {
      tended = true;
      if (!dark) {
        s.oven.heat = Math.min(1, s.oven.heat + 0.04 * r);
        if (s.oven.heat >= OVEN_HOT) {
          s.work.oven += r;
          c.made += r / OVEN_WORK;
        }
      }
    } else {
      if (s.plates.pile <= 0) continue;
      c.progress += r;
      while (c.progress >= WASH_WORK && s.plates.pile > 0) {
        c.progress -= WASH_WORK;
        s.plates.pile -= 1;
        s.plates.clean += 1;
        c.made += 0.3;
      }
      if (s.plates.pile <= 0) c.progress = 0;
    }
  }
  if (!tended || dark) s.oven.heat = Math.max(0, s.oven.heat - (dark ? 0.03 : 0.008));
  if (s.minute - nightStart(s.night) === RUSH_FROM && s.oven.heat >= OVEN_HOT) stamp(s, 'oven');
  // Portions go to the oldest table first.
  for (const t of allocationOrder(s)) {
    if (t.status !== 'open') continue;
    const reserved = (st: FoodStation) => {
      const held =
        (chefEdition(s) && s.help?.ticket === t.id && s.help.station === st ? 1 : 0) +
        (portionEdition(s) && s.chefNext?.ticket === t.id && s.chefNext.station === st ? 1 : 0) +
        (portionEdition(s) &&
        s.chefGrace?.some((g) => g.ticket === t.id && g.station === st && g.until > s.minute)
          ? 1
          : 0);
      return signaturePending(s, t.id)?.signature === st ? Math.max(1, held) : held;
    };
    while (t.doneGrill < t.grill - reserved('grill') && s.work.grill >= GRILL_WORK) {
      s.work.grill -= GRILL_WORK;
      t.doneGrill += 1;
    }
    while (t.doneCold < t.cold - reserved('cold') && s.work.cold >= COLD_WORK) {
      s.work.cold -= COLD_WORK;
      t.doneCold += 1;
    }
    while (t.doneOven < t.oven - reserved('oven') && s.work.oven >= OVEN_WORK) {
      s.work.oven -= OVEN_WORK;
      t.doneOven += 1;
    }
  }
  // Nothing to cook: the effort is not banked beyond one portion's worth.
  s.work.grill = Math.min(s.work.grill, GRILL_WORK);
  s.work.cold = Math.min(s.work.cold, COLD_WORK);
  s.work.oven = Math.min(s.work.oven, OVEN_WORK);
}

const ready = (t: Ticket) => t.doneGrill >= t.grill && t.doneCold >= t.cold && t.doneOven >= t.oven;

function pass(s: GameState) {
  // Older notebooks retain the exact once-per-dispatch priority object, including legacy ticket IDs.
  const legacyPriority =
    !promisesOn(s) && chefEdition(s) && s.passDecision?.state === 'chosen'
      ? s.tickets.find((t) => t.id === s.passDecision?.ticket && t.status === 'open')
      : undefined;
  for (const t of allocationOrder(s)) {
    if (t.status === 'open' && bookingOf(s, t.id)?.promised && s.minute - t.at > 35) {
      walk(s, t);
      continue;
    }
    const priority = promisesOn(s)
      ? (promisedPriority(s) ??
        (s.passDecision?.state === 'chosen'
          ? s.tickets.find((t) => t.id === s.passDecision?.ticket && t.status === 'open')
          : undefined))
      : legacyPriority;
    if (
      priority?.status === 'open' &&
      t.id !== priority.id &&
      s.plates.clean <= 1 &&
      !(handsOn(s) && t.platedAt !== undefined)
    )
      continue;
    if (t.status !== 'open' || !ready(t)) continue;
    if (t.due !== undefined) {
      if (priority?.id === t.id)
        say(
          s,
          'narrator',
          `Table ${t.table} got the first portions and plate I called for. The other tables move again.`,
          'journal',
        );
      t.status = 'served';
      t.servedAt = s.minute;
      const onTime = s.minute <= t.due;
      const pay = onTime ? t.price : Math.round(t.price * 0.55);
      s.till += pay;
      say(
        s,
        'narrator',
        onTime
          ? 'Twenty trays across the road, on time. The bride’s father paid in an envelope and kissed Selim on both cheeks.'
          : 'The trays went over late. The bride’s father paid, less, and did not look at me.',
        'journal',
      );
      if (onTime) stamp(s, 'wedding');
      continue;
    }
    if (handsOn(s)) {
      if (t.platedAt === undefined) {
        if (s.plates.clean <= 0) continue;
        s.plates.clean -= 1;
        t.platedAt = s.minute;
        t.quality ??= 'plain';
        t.freshness = 'hot';
        say(s, 'narrator', `Table ${t.table}'s plate waits at the pass. Call it while it is hot.`, 'call');
      }
      const age = s.minute - t.platedAt;
      if (!t.called && age < (s.help ? 8 : 12)) continue;
      t.freshness = age <= 4 ? 'hot' : 'cooling';
      say(
        s,
        'narrator',
        t.called
          ? `Service, table ${t.table}! ${t.freshness === 'hot' ? 'Out hot.' : 'The plate has cooled while it waited.'}`
          : `The runner called table ${t.table}. A little colder after waiting at the pass.`,
        'call',
      );
      if (portionEdition(s)) {
        const guest = t.regular ? (regularOf(t.regular)?.name ?? `Table ${t.table}`) : `Table ${t.table}`;
        say(
          s,
          'narrator',
          t.quality === 'mixed'
            ? `${guest}: “Some of this had extra care. The rest was plain and filling.”`
            : t.quality === 'careful'
              ? `${guest}: “You took time with this. I can taste it.”`
              : `${guest}: “Plain and filling. We were hungry.”`,
          'journal',
        );
      } else if (t.quality === 'careful')
        say(s, 'narrator', `Table ${t.table} noticed the care in their food.`, 'journal');
    } else {
      if (s.plates.clean <= 0) return;
      s.plates.clean -= 1;
    }
    s.plates.dirty.push({ at: s.minute + 18 });
    if (priority?.id === t.id)
      say(
        s,
        'narrator',
        `Table ${t.table} got the first portions and plate I called for. The other tables move again.`,
        'journal',
      );
    t.status = 'served';
    t.servedAt = s.minute;
    const wait = s.minute - t.at;
    let pay = t.price;
    const r = t.regular ? regularOf(t.regular) : undefined;
    const st = t.regular ? s.regulars[t.regular] : undefined;
    if (bookingOf(s, t.id)) pay = finishParty(s, t);
    else if (r && st && !t.friend) {
      if (st.tab === 'open') pay = 0;
      if (st.tab === 'asked') {
        const part = Math.min(r.owes, 300);
        pay += part;
        st.tab = 'paying';
        say(
          s,
          'narrator',
          `${capital(r.name)} put ₺${part} on the pass without a word. Then the price of supper.`,
          'journal',
        );
      }
      st.regard = clamp(st.regard + (wait < 15 ? 0.1 : wait > 25 ? -0.05 : 0.03));
      if (st.regard > 0.8 && !st.friendNext) {
        st.friendNext = true;
        stamp(s, 'friend');
      }
      if (wait <= 25) say(s, 'narrator', r.pleased, 'journal');
    }
    s.till += pay;
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
  if (!text) return;
  s.said.push({ at: s.minute, who, text, kind });
  if (s.said.length > 200) s.said.splice(0, s.said.length - 200);
}

function stamp(s: GameState, id: string) {
  if (s.stamps.some((x) => x.id === id && (id !== 'friend' || x.night === s.night))) return;
  if (s.stamps.some((x) => x.id === id) && !['bill-1', 'bill-2', 'bill-3', 'bill-4'].includes(id)) return;
  s.stamps.push({ id, night: s.night });
}

// ---------- the evening ----------

const clock = (m: number) => {
  const d = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
};

function evening(s: GameState, c: CookState): string {
  const rq = s.request;
  if (rq && rq.who === c.id && rq.state !== 'asking') {
    const l = REQUEST_LINES[rq.kind];
    if (l) {
      if (rq.ignored)
        return rq.kind === 'mother'
          ? 'I asked you and you didn’t even look up. I went anyway.'
          : 'I asked you something tonight. You never answered.';
      if (rq.kind === 'mother' && rq.state === 'no' && c.night.refused > 0)
        return 'You asked me to stay while she lay on the floor.';
      return rq.state === 'yes' ? l.eveYes : l.eveNo;
    }
  }
  const used = new Set(s.usedLines);
  const line = aboutYou({
    seed: s.seed,
    night: s.night,
    id: c.id,
    founder: memberOf(s, c.id).founder,
    events: c.night.events,
    worked: c.night.worked,
    asked: c.night.asked + (hasBoard(s) && s.board?.rows.some((row) => row.cook === c.id) ? 1 : 0),
    trustDelta: trustOf(personOf(s, c.id)) - c.trustAtOpen,
    used,
    clock,
  });
  s.usedLines = [...used].slice(-400);
  return line;
}

/** Tonight's named lapse, if the evening review found one the cook would talk about. */
function lapseOf(s: GameState, id: CookId): string {
  const p = personOf(s, id);
  const said = reviewLine(p);
  if (!said || said.startsWith('Today I kept') || !p.review?.last) return '';
  return lapseLine(memberOf(s, id).template ?? id, p.review.last.missed);
}

function closeNight(s: GameState) {
  const n = s.night;
  const pl = plan(s);
  const skimBefore = s.jarSkimmed;
  for (const t of s.tickets)
    if (t.status === 'open' || t.status === 'waiting') {
      t.status = 'walked';
      if (bookingOf(s, t.id)) finishParty(s, t);
    }
  for (const c of s.cooks) {
    const p = personOf(s, c.id);
    if (c.here && p.activity) endActivity(p, 'completed', s.minute, s, c);
  }
  const unanswered = s.request?.state === 'asking';
  if (s.request && unanswered) s.request.state = 'no';
  nightHours(s, n);
  const tonight = s.tickets;
  const served = tonight.filter((t) => t.status === 'served');
  const walked = tonight.filter((t) => t.status === 'walked' && t.due === undefined).length;
  const critic = tonight.find((t) => t.critic);
  const wedding = tonight.find((t) => t.due !== undefined);
  const prevSkim = s.reports.reduce((a, r) => a + r.skimmed, 0);
  const report: NightReport = {
    night: n,
    served: served.filter((t) => t.due === undefined).length,
    walked,
    takings: served.reduce(
      (a, t) =>
        a + (t.partyPay ?? (t.regular && s.regulars[t.regular]?.tab === 'open' && !t.friend ? 0 : t.price)),
      0,
    ),
    tips: s.jar,
    skimmed: s.jarSkimmed - prevSkim,
    reviews: s.cooks
      .filter((c) => c.here)
      .map((c) => ({ id: c.id, line: lapseOf(s, c.id), aboutYou: evening(s, c) })),
    stamps: [],
    regulars: tonight
      .filter((t) => t.regular && !t.friend)
      .map((t) => ({
        id: t.regular as string,
        came: true,
        pleased: t.status === 'served' && (t.servedAt ?? 0) - t.at <= 25,
      })),
  };
  if (promisesOn(s) && pl.week >= 2)
    report.parties = partiesTonight(s).map((b) => ({
      party: b.party,
      promised: b.promised,
      outcome: b.outcome,
      ...(b.waited === undefined ? {} : { waited: b.waited }),
      ...(b.ticket !== undefined && s.tickets.find((x) => x.id === b.ticket)?.status === 'walked'
        ? { walked: true }
        : {}),
    }));
  void skimBefore;
  if (critic)
    report.critic =
      critic.status === 'walked' ? 'walked' : (critic.servedAt ?? 0) - critic.at < 22 ? 'pleased' : 'cold';
  if (report.critic === 'pleased') stamp(s, 'critic');
  if (wedding)
    report.wedding =
      wedding.status === 'walked'
        ? 'lost'
        : (wedding.servedAt ?? 0) <= (wedding.due ?? 0)
          ? 'on time'
          : 'late';
  if (s.request)
    report.request = {
      kind: s.request.kind,
      who: s.request.who,
      answer: unanswered || s.request.ignored ? 'none' : s.request.state === 'yes' ? 'yes' : 'no',
    };
  if (pl.gasOut) {
    report.gas = true;
    if (report.walked <= 3) stamp(s, 'dark');
  }
  if (s.apron) report.apron = s.apron;
  if (report.walked === 0 && report.served >= 20) stamp(s, 'full-house');
  for (const c of s.cooks) {
    if (!c.here) continue;
    c.week.nights += 1;
    const m = memberOf(s, c.id);
    if (!m.founder) {
      s.wagesDue += m.wage;
      acquaintWith(
        s.chef,
        personOf(s, c.id),
        Math.min(0.85, 0.2 * c.week.nights + 0.15 * (pl.week - m.since)),
        s.minute,
      );
    }
  }
  if (isLastOfWeek(n)) report.bill = settle(s, pl.week);
  report.stamps = s.stamps.filter((x) => x.night === n).map((x) => x.id);
  s.reports.push(report);
  s.minute = Math.max(...livePeople(s).map((p) => p.now));
  s.phase = 'evening';
}

/** Saturday close: the week's bill comes out of the till. */
function settle(s: GameState, week: number): BillResult {
  const w = weekOf(week);
  const amount = w.bill + s.wagesDue + s.carry + (promisesOn(s) ? (s.seen ?? 0) : 0);
  s.wagesDue = 0;
  if (s.seen) s.seen = 0;
  const weekReports = [...s.reports.filter((r) => planOf(r.night).week === week)];
  const walks =
    weekReports.reduce((a, r) => a + r.walked, 0) +
    s.tickets.filter((t) => t.status === 'walked' && t.due === undefined).length;
  if (walks === 0) stamp(s, 'clean-week');
  if (s.cooks.every((c) => c.week.insisted === 0)) stamp(s, 'no-push');
  const promiseBroken =
    promisesOn(s) && (s.bookings ?? []).some((b) => b.week === week && b.promised && b.outcome === 'broken');
  const promiseField = promisesOn(s) && week >= 2 ? { promiseBroken } : {};
  if (s.till >= amount) {
    if (promiseBroken) {
      s.strikes += 1;
      if (s.strikes >= 2) s.lost = true;
    }
    s.till -= amount;
    s.carry = 0;
    stamp(s, `bill-${week}`);
    return { week, owed: w.owed, amount, paid: true, short: 0, ...promiseField };
  }
  const short = amount - s.till;
  s.till = 0;
  s.strikes += 1;
  s.carry = Math.round((short * 1.1) / 10) * 10;
  if (s.strikes >= 2 || week === 4) s.lost = true;
  return { week, owed: w.owed, amount, paid: false, short, ...promiseField };
}

function nextNight(s: GameState) {
  const n = s.night;
  sleepHours(s, n);
  const next = planOf(n + 1);
  for (let d = planOf(n).day + 1; d < next.day; d++) offDay(s, d);
  dayHours(s, next.day);
  startNight(s, n + 1);
}

// ---------- Sunday ----------

function enterSunday(s: GameState) {
  const n = s.night;
  const pl = planOf(n);
  sleepHours(s, n);
  const sunday = (pl.week - 1) * 7 + 6;
  for (const p of livePeople(s)) {
    if (p.activity) endActivity(p, 'interrupted', Math.max(p.now, p.activity.startedAt));
    hostAct(
      p,
      offer('meal', { duration: 30, advertises: { food: 0.6, water: 0.6 } }),
      sunday * 1440 + 10 * 60,
    );
  }
  s.minute = sunday * 1440 + 12 * 60;
  s.phase = 'sunday';
  // pass@9: word gets around. Whoever is owed next week saw the queue, and asks half of what was left over.
  if (promisesOn(s) && s.pace !== 'nevin' && pl.week < 4 && s.carry === 0 && !s.lost)
    s.seen = Math.round((s.till * SEEN_SHARE) / 10) * 10;
  const week = pl.week;
  const quits = week < 4 ? decideQuits(s, week) : [];
  const page: SundayPage = {
    week,
    changes: changesThisWeek(s, week),
    quits,
    // Hiring opens in week 2; a cook who walks after week 1 opens it early.
    candidates: week === 2 || week === 3 || (week === 1 && quits.length > 0) ? candidates(s, week) : [],
    offday: week === 2 && !!activeCrew(s).find((m) => m.id === 'dilek'),
    tabs:
      week === 3
        ? REGULARS.filter(
            (r) => r.tab && (s.regulars[r.id]?.visits ?? 0) > 0 && s.regulars[r.id]?.tab === 'open',
          ).map((r) => r.id)
        : [],
    price: week === 2 || week === 3,
    letgo: week === 3,
    sell: week === 4,
    chosen: {},
    stamps: weekStamps(s, week),
  };
  if (
    s.reports.filter((r) => planOf(r.night).week === week).every((r) => r.skimmed === 0) &&
    s.crew.find((m) => m.id === 'rafi' && !m.left)
  )
    if (week >= 1 && s.night >= 3) {
      stamp(s, 'jar-week');
      if (!page.stamps.includes('jar-week')) page.stamps.push('jar-week');
    }
  if (page.changes.length > 0) {
    stamp(s, 'unprompted');
    if (!page.stamps.includes('unprompted')) page.stamps.push('unprompted');
  }
  s.sunday = page;
  if (promisesOn(s) && week < 4) bookParties(s, page);
}

function weekStamps(s: GameState, week: number): string[] {
  const nights = new Set(s.reports.filter((r) => planOf(r.night).week === week).map((r) => r.night));
  return s.stamps.filter((x) => nights.has(x.night)).map((x) => x.id);
}

/** HF chronicle: what each cook now does unprompted, or has started doing, compared with before. */
function changesThisWeek(s: GameState, week: number): { id: CookId; line: string }[] {
  const out: { id: CookId; line: string }[] = [];
  const from = (week - 1) * 7;
  for (const m of activeCrew(s)) {
    const p = personOf(s, m.id);
    const ch = p.chronicle ?? [];
    const thisWeek = ch.filter((d) => d.day >= from && d.day < from + 7);
    const before = week === 1 ? thisWeek.slice(0, 2) : ch.filter((d) => d.day < from);
    const after = week === 1 ? thisWeek.slice(-3) : thisWeek;
    if (before.length === 0 || after.length === 0) continue;
    const { changes } = diffChronicle(before, after, { voices: [CHEF] });
    for (const x of changes) {
      const line = changeLine(m.name, x.kind, x.subject);
      if (line && x.kind === 'unprompted') {
        out.push({ id: m.id, line });
        break;
      }
    }
  }
  return out;
}

/** Each cook decides whether to come back next week. The chef asks them to; HF decides. */
function decideQuits(s: GameState, _week: number): { id: CookId; words: string }[] {
  const out: { id: CookId; words: string }[] = [];
  for (const m of activeCrew(s)) {
    const c = cookOf(s, m.id);
    const p = personOf(s, m.id);
    const pushed = c.week.complied + (c.pushedBefore ?? 0) / 2;
    const trust = trustOf(p);
    // Honest per person: a kitchen that has worn your trust away feels less like belonging and more like a cage.
    const stay = offer('stay', {
      label: 'come back on Wednesday',
      duration: 60,
      effort: 0,
      advertises: {
        belonging: (0.1 + (m.founder ? 0.15 : 0)) * (0.4 + trust),
        competence: 0.1,
        esteem: 0.05,
      },
      material: m.founder ? 4 : Math.round(m.wage / 15),
    });
    const leave = offer('leave', {
      label: 'find other work',
      duration: 60,
      effort: 0,
      advertises: {
        rest: 0.1 + 0.04 * pushed,
        autonomy: 0.05 + 0.05 * pushed + 0.8 * Math.max(0, 0.45 - trust),
        leisure: 0.05,
      },
      material: 3,
    });
    const rec = decide(p, [stay, leave], {
      suggestion: { voiceId: CHEF, affordanceId: 'stay', strength: 0.5 },
    });
    if (rec.chosenAffordanceId !== 'leave') continue;
    const words =
      pushed >= 3
        ? 'You push too hard, Chef. I’ve found a kitchen that asks.'
        : trust < 0.35
          ? 'I don’t trust this kitchen any more. Nevin’s gone, and so am I.'
          : 'I’m tired, Chef. I’ve found something closer to home.';
    m.left = { night: s.night, words };
    out.push({ id: m.id, words });
  }
  return out;
}

function candidates(s: GameState, week: number): string[] {
  const taken = new Set(s.crew.map((m) => m.template).filter(Boolean));
  const pool = HIRES.filter((h) => !taken.has(h.id));
  const order = [...pool].sort(
    (a, b) => hashUnit(s.seed, 41, week, HIRES.indexOf(a)) - hashUnit(s.seed, 41, week, HIRES.indexOf(b)),
  );
  return order.slice(0, 2).map((h) => h.id);
}

function choose(s: GameState, key: string, value: string) {
  const page = s.sunday as SundayPage;
  if (page.chosen[key] !== undefined) return;
  if (promisesOn(s) && key.startsWith('promise:')) {
    const id = key.slice(8);
    if (!page.parties?.includes(id) || !['promise', 'plain'].includes(value)) return;
    const b = s.bookings?.find((b) => b.party === id && b.week === page.week + 1);
    if (!b) return;
    b.promised = value === 'promise';
    page.chosen[key] = value;
    return;
  }
  page.chosen[key] = value;
  if (key === 'hire' && value !== 'none') {
    const t = hireTemplate(value);
    if (!t || !page.candidates.includes(value)) return;
    const p = makeHire(t, s.seed, s.minute, s.version);
    s.people.push(p);
    s.crew.push({
      id: t.id,
      name: t.name,
      home: t.home,
      founder: false,
      since: page.week + 1,
      wage: t.wage,
      template: t.id,
    });
    s.cooks.push(blankCook(t.id));
    // First impressions: what the chef sees and is told at the back door.
    glimpseOf(s.chef, p, s.minute, 1);
  } else if (key === 'offday') {
    const p = personOf(s, 'dilek');
    if (value === 'yes') {
      memberOf(s, 'dilek').offDay = 2;
      adoptVoiceTrust(p, CHEF, 1, 0.08);
      socialEvent(p, { at: s.minute, kind: 'help', otherId: CHEF, byMe: false, magnitude: 0.7 });
    } else adoptVoiceTrust(p, CHEF, 0, 0.08);
  } else if (key.startsWith('tab:')) {
    const st = s.regulars[key.slice(4)];
    if (!st) return;
    const choice = value as TabChoice;
    if (choice === 'ask') st.tab = 'asked';
    if (choice === 'forgive') {
      st.tab = 'forgiven';
      st.regard = clamp(st.regard + 0.25);
    }
  } else if (key === 'price' && value === 'raise') {
    s.price += 5;
    s.raises += 1;
    for (const r of Object.values(s.regulars)) r.regard = clamp(r.regard - 0.08);
  } else if (key === 'letgo' && value !== 'none') {
    const m = s.crew.find((x) => x.id === value && !x.left);
    if (m)
      m.left = {
        night: s.night,
        words: m.founder ? 'Twenty years, and a niece lets me go. Fine.' : 'Fine. Pay me for the week.',
      };
  } else if (key === 'sell') s.sold = value === 'sell';
}

function leaveSunday(s: GameState) {
  const n = s.night;
  const pl = planOf(n);
  const sunday = (pl.week - 1) * 7 + 6;
  for (const p of livePeople(s)) prayAtHome(p, sunday * 1440);
  for (const p of livePeople(s))
    hostAct(
      p,
      offer('sleep', { mode: 'sleep', duration: 9 * 60, effort: 0, advertises: { sleep: 1, rest: 0.5 } }),
      Math.max(p.now, sunday * 1440 + 23 * 60),
    );
  const next = planOf(n + 1);
  for (let d = sunday + 1; d < next.day; d++) offDay(s, d);
  dayHours(s, next.day);
  startNight(s, n + 1);
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
  return { game: s.version, framework, seed: s.seed, inputs: s.inputs, state: cloneState(s) };
}

export function cloneState(s: GameState): GameState {
  return {
    ...structuredClone({ ...s, people: [], chef: null as unknown as Person }),
    people: s.people.map((p) => snapshot(p)),
    chef: snapshot(s.chef),
  };
}

export function restoreState(json: GameState): GameState {
  return {
    ...structuredClone({ ...json, people: [], chef: null as unknown as Person }),
    people: json.people.map((p) => restore(p)),
    chef: restore(json.chef),
  };
}

/** Rebuild a run from its seed and input log, stepping service minutes until `until` (or the last input). */
export function replay(
  seed: number,
  inputs: readonly Input[],
  until?: number,
  edition: string = GAME_VERSION,
): GameState {
  const s = newGame(seed, edition);
  for (const inp of inputs) {
    while (s.phase === 'service' && s.minute < inp.at) step(s);
    s.inputs.push(inp);
    if (
      s.phase !== 'service' ||
      (chefEdition(s) &&
        ['help', 'pass-priority', 'cook-step', 'call-plate', 'cook-choice', 'finish-portion'].includes(
          inp.kind,
        ))
    )
      applyPending(s);
  }
  if (until !== undefined) while (s.phase === 'service' && s.minute < until) step(s);
  return s;
}

/** Whether an export or save can be replayed by this edition of the game. */
export const canReplay = (game: string | undefined): boolean =>
  game === 'pass@10' ||
  game === 'pass@9' ||
  game === 'pass@8' ||
  game === 'pass@7' ||
  game === 'pass@6' ||
  game === 'pass@5' ||
  game === 'pass@4' ||
  game === 'pass@3';

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
    crew: s.crew,
    people: s.people.map((p) => [p.id, p.trace.length, p.now, p.will.voices[0]?.trust]),
  });
}

export { CLOSE, dayStart, OPEN, RUSH_FROM, RUSH_TO };

function coverUntil(s: GameState): number {
  if (hasBoard(s)) return closeAt(s.night);
  return Math.min(closeAt(s.night), Math.max(s.minute + 45, nightStart(s.night) + RUSH_TO));
}

function stationPromise(s: GameState, station: Station): string {
  const until = coverUntil(s);
  const end = clock(until);
  return until === nightStart(s.night) + RUSH_TO
    ? `I’ll hold ${VERB_WORD[station]} till the rush eases at ${end}.`
    : `I’ll hold ${VERB_WORD[station]} until ${end}.`;
}

export function stationRequestLine(s: GameState, _id: CookId): string | null {
  return hasCover(s)
    ? `Ask for station cover until ${clock(coverUntil(s))}. Another request can change it.`
    : 'A station request covers one 25-minute stretch. Then the cook chooses again.';
}

export function coverLine(s: GameState, id: CookId): string | null {
  const cover = cookOf(s, id).cover;
  return hasCover(s) && cover && s.minute < cover.until
    ? `I’m holding ${VERB_WORD[cover.station]} until ${clock(cover.until)}.`
    : null;
}

const foodWork = (station: FoodStation) =>
  station === 'grill' ? GRILL_WORK : station === 'cold' ? COLD_WORK : OVEN_WORK;
const foodWords = (station: FoodStation) =>
  station === 'grill' ? 'a grill portion' : station === 'cold' ? 'a cold plate' : 'a pide';
const chefPace = (s: GameState, station: FoodStation) =>
  (0.55 + 0.75 * (s.chef.skills[station]?.level ?? 0.3)) * (0.4 + 0.6 * readPerson(s.chef).body.capacity);

export function chefLine(s: GameState): string {
  if (portionEdition(s) && s.help?.instinct) {
    const t = s.tickets.find((t) => t.id === s.help?.ticket);
    return `I’m finishing table ${t?.table}'s ${foodWords(s.help.station)} on instinct. A plain portion.${s.chefNext ? ' Chef’s next is reserved.' : ''}`;
  }
  if (portionEdition(s) && !s.help && s.chefNext) {
    const t = s.tickets.find((t) => t.id === s.chefNext?.ticket);
    return `Chef’s next: table ${t?.table}'s ${foodWords(s.chefNext.station)}. I’m waiting for the station; the crew leaves it for me.`;
  }
  if (handsOn(s) && s.help)
    return `${cookingStep(s)?.text ?? 'My portion is on the station.'}${s.chef.body.exertion > 0.45 ? ' My arms are tired.' : ''}`;
  if (s.help) {
    const t = s.tickets.find((t) => t.id === s.help?.ticket);
    return `Table ${t?.table}: ${foodWords(s.help.station)}, about ${Math.max(1, s.help.until - s.minute)} min left.${s.chef.body.exertion > 0.45 ? ' My arms are tired.' : ''}`;
  }
  return s.chef.body.exertion > 0.45
    ? 'My arms are tired. I can take a portion, but I’ll be slower.'
    : 'I can take a waiting portion. The crew keeps the rest moving.';
}

export function helpOptions(s: GameState): { ticket: number; station: FoodStation; text: string }[] {
  if (!hasCover(s) || s.phase !== 'service' || (s.help && !portionEdition(s))) return [];
  const stations: FoodStation[] = chefEdition(s) ? ['grill', 'cold', 'oven'] : ['grill', 'cold'];
  return allocationOrder(s)
    .filter((t) => t.status === 'open')
    .flatMap((t) =>
      stations
        .filter(
          (st) =>
            (portionEdition(s)
              ? remainingPortions(t, st) > (s.help?.ticket === t.id && s.help.station === st ? 1 : 0)
              : st === 'grill'
                ? t.doneGrill < t.grill
                : st === 'cold'
                  ? t.doneCold < t.cold
                  : t.doneOven < t.oven) &&
            ((st !== 'grill' && st !== 'oven') || !gasOut(s)) &&
            (st !== 'oven' || s.oven.heat >= OVEN_HOT),
        )
        .map((station) => ({
          ticket: t.id,
          station,
          text:
            portionEdition(s) && s.help
              ? `Chef’s next: table ${t.table}, ${foodWords(station)}.`
              : handsOn(s)
                ? `Take table ${t.table}: ${COOK_ACTS[station].join(', ')}. My hands tire as I work.`
                : chefEdition(s)
                  ? `Take table ${t.table}: ${foodWords(station)} · about ${Math.ceil(foodWork(station) / chefPace(s, station))} min`
                  : `Help table ${t.table}: ${station === 'grill' ? 'grill one portion' : 'make one cold plate'} · 5 min`,
        })),
    );
}

function chefMinute(s: GameState) {
  if (handsOn(s)) {
    handsOnMinute(s);
    return;
  }
  if (chefEdition(s)) tick(s.chef, s.minute);
  const h = s.help;
  if (!h) return;
  const t = s.tickets.find((t) => t.id === h.ticket);
  if (t?.status !== 'open') {
    if (chefEdition(s)) {
      if (s.chef.activity) endActivity(s.chef, 'interrupted', s.minute);
      say(s, 'narrator', 'That table left. I stopped their portion; nothing was banked.', 'journal');
    }
    s.help = null;
    return;
  }
  if (chefEdition(s)) {
    if ((h.station === 'grill' || h.station === 'oven') && gasOut(s)) return;
    if (h.station === 'oven' && s.oven.heat < OVEN_HOT) return;
    h.progress = (h.progress ?? 0) + chefPace(s, h.station);
    h.until =
      s.minute +
      Math.ceil(Math.max(0, (h.work ?? foodWork(h.station)) - h.progress) / chefPace(s, h.station));
    if (h.progress < (h.work ?? foodWork(h.station))) return;
    if (s.chef.activity) endActivity(s.chef, 'completed', s.minute);
  } else {
    if (h.station === 'grill' ? t.doneGrill >= t.grill : t.doneCold >= t.cold) {
      say(
        s,
        'narrator',
        `The crew finished table ${t.table}’s ${h.station === 'grill' ? 'grill portions' : 'cold plates'} before me. I put my ingredients back.`,
        'journal',
      );
      s.help = null;
      return;
    }
    if (s.minute < h.until) return;
    if (h.station === 'grill' && gasOut(s)) return;
  }
  if (h.station === 'grill') t.doneGrill = Math.min(t.grill, t.doneGrill + 1);
  else if (h.station === 'cold') t.doneCold = Math.min(t.cold, t.doneCold + 1);
  else t.doneOven = Math.min(t.oven, t.doneOven + 1);
  say(s, 'narrator', `I finished ${foodWords(h.station)} for table ${t.table}.`, 'journal');
  s.help = null;
}

/** The seated promise takes precedence over the chef's separate pass-priority call. */
function promisedPriority(s: GameState): Ticket | undefined {
  if (!promisesOn(s)) return undefined;
  return s.tickets.find((t) => t.status === 'open' && bookingOf(s, t.id)?.promised);
}

/** A promised party comes first, followed by the selected table and then the ordinary rail. */
function allocationOrder(s: GameState): Ticket[] {
  const promised = promisedPriority(s)?.id;
  const chosen = chefEdition(s) && s.passDecision?.state === 'chosen' ? s.passDecision.ticket : undefined;
  if (promised === undefined && chosen === undefined) return s.tickets;
  const rank = (t: Ticket) => (t.id === promised ? 2 : t.id === chosen ? 1 : 0);
  return [...s.tickets].sort((a, b) => rank(b) - rank(a));
}

export function priorityOptions(s: GameState): { ticket: number; text: string }[] {
  if (!chefEdition(s) || s.passDecision?.state !== 'asking' || s.help) return [];
  const candidates = s.tickets.filter((t) => t.status === 'open' && s.passDecision?.tickets.includes(t.id));
  const oldest = [...candidates].sort((a, b) => a.at - b.at || a.id - b.id)[0]?.id;
  return candidates.map((t) => {
    const who = t.critic
      ? 'the critic'
      : t.regular
        ? (regularOf(t.regular)?.name ?? 'a regular')
        : t.grill + t.cold + t.oven >= 3
          ? 'the big order'
          : t.id === oldest
            ? 'waiting longest'
            : 'small order';
    return { ticket: t.id, text: `Table ${t.table} · ${who} · waiting ${s.minute - t.at} min` };
  });
}

/** One call when queued work exceeds four minutes of the station's current capacity. */
function detectPassOverload(s: GameState) {
  if (s.passDecision) return;
  const open = s.tickets.filter((t) => t.status === 'open' && !ready(t));
  if (open.length < 2) return;
  const demand = owed(s);
  const overloaded = (['grill', 'cold', 'oven'] as const).some((station) => {
    const capacity = onShift(s).reduce(
      (rate, id) => rate + (stationOf(s, id) === station ? pace(s, id, station) : 0),
      0,
    );
    return demand[station] > 0 && demand[station] * foodWork(station) - s.work[station] > capacity * 4;
  });
  if (!overloaded) return;
  s.passDecision = { at: s.minute, state: 'asking', tickets: open.map((t) => t.id) };
  const cook = onShift(s).find((id) => stationOf(s, id) && stationOf(s, id) !== 'dish');
  say(
    s,
    cook ?? 'narrator',
    'The orders are ahead of the line. Which table goes first, Chef? The others will wait for its portions and plate.',
    'call',
  );
}

// ---------- pass@5: agreed board over the station-cover machinery ----------

export function boardDefaults(s: GameState): BoardRow[] {
  const ids = onShift(s);
  const previous = s.previousBoard ?? [];
  return ids.map((id, i) => {
    const old = previous.find((r) => r.cook === id);
    const home = memberOf(s, id).home;
    const fallback = stationsTonight(s)[i % stationsTonight(s).length] ?? 'cold';
    return {
      cook: id,
      station:
        old && stationsTonight(s).includes(old.station)
          ? old.station
          : stationsTonight(s).includes(home)
            ? home
            : fallback,
      breakAt: old?.breakAt ?? 18 * 60 + 10 + (chefEdition(s) && i < 2 ? 1 - i : i) * 25,
      cover: old
        ? old.cover && ids.includes(old.cover)
          ? old.cover
          : null
        : (ids.find((x) => x !== id && memberOf(s, x).home === 'dish') ?? null),
    };
  });
}

/** Match ad-hoc requests: a request to change jobs reviews the current activity rather than offering it anew. */
function coverOffers(s: GameState, id: CookId, station: Station, duration: number): Affordance[] {
  const current = personOf(s, id).activity?.affordanceId;
  return offersFor(s, id, station)
    .filter((a) => !current || a.id !== current || a.id === station)
    .map((a) => (a.id === station ? { ...a, duration, followedBy: undefined } : a));
}

/** HF decides the requested station for the agreed interval; cover is the existing cover state. */
function takeStation(
  s: GameState,
  c: CookState,
  station: Station,
  until: number,
  quiet: boolean,
): { accepted: boolean; says: string } {
  const p = personOf(s, c.id);
  if (p.activity) interrupt(p, s.minute, 'voice:chef');
  const offers = coverOffers(
    s,
    c.id,
    station,
    Math.max(1, s.phase === 'board' ? closeAt(s.night) - s.minute - 20 : until - s.minute),
  ).map((a) =>
    a.id === station
      ? {
          ...a,
          // HF weighs the whole night's work. Execution ends the first span at the agreed meal break.
          duration: Math.max(1, s.phase === 'board' ? closeAt(s.night) - s.minute - 20 : until - s.minute),
          followedBy: undefined,
        }
      : a,
  );
  const rec = decide(p, offers, { suggestion: suggestion(station) });
  const r = rec.suggestion;
  const says = r
    ? ((s.version === 'pass@10' ? suggestionWords(p, r, station)?.text : undefined) ?? r.says)
    : 'No, Chef.';
  const aff = offers.find((a) => a.id === station);
  const accepted = !!aff && rec.chosenAffordanceId === station && r?.verdict === 'assented';
  if (!quiet)
    say(
      s,
      c.id,
      accepted
        ? `${says} I’ll hold ${VERB_WORD[station]} until ${clock(until)}.`
        : `${says} That part is not agreed.`,
      'answer',
    );
  if (!accepted || !aff) return { accepted: false, says };
  if (p.activity) endActivity(p, 'interrupted', s.minute, s, c);
  if (!begin(p, aff, rec)) return { accepted: false, says: 'I cannot start that stretch.' };
  c.cover = { station, until };
  if (p.activity) p.activity.endsAt = until;
  if (!c.night.worked.includes(station)) c.night.worked.push(station);
  return { accepted: true, says };
}

function agreeBoard(s: GameState, rows: BoardRow[]) {
  const result: BoardRow[] = [];
  // A revision replaces the proposal. A refused revision must not leave an invisible old yes running.
  for (const id of onShift(s)) {
    const c = cookOf(s, id);
    const p = personOf(s, id);
    if (c.cover && p.activity) endActivity(p, 'interrupted', s.minute, s, c);
    c.cover = null;
  }
  // One row per present cook; malformed or absent rows cannot create commitments.
  for (const id of onShift(s)) {
    const raw = rows.find((r) => r.cook === id);
    if (!raw || !stationsTonight(s).includes(raw.station) || !Number.isFinite(raw.breakAt)) continue;
    const breakAt = Math.round(Math.max(17 * 60 + 30, Math.min(CLOSE - 25, raw.breakAt)));
    const row: BoardRow = {
      cook: id,
      station: raw.station,
      breakAt,
      cover: raw.cover !== id && onShift(s).includes(raw.cover ?? '') ? raw.cover : null,
    };
    const c = cookOf(s, id);
    const until = nightStart(s.night) + breakAt;
    const reply = takeStation(s, c, row.station, until, true);
    row.accepted = reply.accepted;
    row.answer = row.accepted
      ? `${reply.says} ${capital(VERB_WORD[row.station] ?? row.station)} until ${clock(until)}. Then twenty minutes for a plate; back on ${VERB_WORD[row.station]} until close.`
      : `${reply.says} That station is not agreed. Try another station, or open with this gap.`;
    // Keep the actual HF answer rather than replacing a no with a generic yes.
    say(s, id, row.answer, 'answer');

    result.push(row);
  }
  // A named relief cook gets their own HF answer, separately from their home station.
  for (const row of result) {
    if (!row.accepted || !row.cover) continue;
    const p = personOf(s, row.cover);
    const own = result.find((r) => r.cook === row.cover);
    const collision = result.some(
      (other) =>
        other !== row &&
        other.cover === row.cover &&
        other.coverAccepted &&
        Math.abs(other.breakAt - row.breakAt) < 20,
    );
    if ((own && Math.abs(own.breakAt - row.breakAt) < 20) || collision) {
      row.coverAccepted = false;
      const line = 'That overlaps my other break or cover. I cannot promise both.';
      row.answer += ` ${nameOf(s, row.cover)}: “${line}”`;
      say(s, row.cover, line, 'answer');
      continue;
    }
    const affs = coverOffers(s, row.cover, row.station, 20);
    if (p.activity) interrupt(p, s.minute, 'voice:chef');
    const rec = decide(p, affs, { suggestion: suggestion(row.station) });
    reviewed(p);
    row.coverAccepted = rec.chosenAffordanceId === row.station && rec.suggestion?.verdict === 'assented';
    const answer = rec.suggestion;
    const says = answer
      ? ((s.version === 'pass@10' ? suggestionWords(p, answer, row.station)?.text : undefined) ?? answer.says)
      : 'No.';
    const line = row.coverAccepted
      ? `${says} I’ll cover ${nameOf(s, row.cook)} on ${VERB_WORD[row.station]} at ${clock(row.breakAt)}, for twenty minutes.`
      : `${says} I haven’t agreed to that cover.`;
    row.answer += ` ${nameOf(s, row.cover)}: “${line}”`;
    say(s, row.cover, line, 'answer');
  }
  s.board = { rows: result, agreed: true };
}

/** A deferred answer is deliberately a no in this edition, never an invisible queue. */
export function pendingCoverLine(s: GameState, id: CookId): string | null {
  if (!hasBoard(s)) return null;
  const a = s.lastAnswer;
  return a?.who === id && ['deferred', 'modified'].includes(a.verdict)
    ? 'No cover is promised. Arrange another cook, or ask again later.'
    : null;
}

export function staffingOptions(s: GameState, d: StaffingDecision): CookId[] {
  return onShift(s).filter((id) => {
    if (id === d.who || !inKitchen(s, id) || cookOf(s, id).pending || stationOf(s, id) === d.station)
      return false;
    const offers = coverOffers(s, id, d.station, Math.max(1, d.until - s.minute));
    const preview = restore(snapshot(personOf(s, id)));
    if (preview.activity) interrupt(preview, s.minute, 'voice:chef');
    return predict(preview, offers, suggestion(d.station)).verdict === 'assented';
  });
}

function raiseStaffing(s: GameState, who: CookId, station: Station, until: number, reason: string) {
  s.staffing ??= [];
  const list = s.staffing;
  if (list.some((d) => d.who === who && d.station === station && d.until > s.minute)) return;
  const d: StaffingDecision = { id: list.length, who, station, until, reason, state: 'asking' };
  list.push(d);
  say(
    s,
    who,
    `${reason} ${capital(VERB_WORD[station] ?? station)} needs cover until ${clock(until)}.`,
    'call',
  );
}

/** Schedule only agreed parts. Ordinary autonomous decisions still handle refusals and emergencies. */
function rotaMinute(s: GameState, c: CookState): boolean {
  if (c.pending) return false;
  const row = s.board?.rows.find((r) => r.cook === c.id && r.accepted);
  if (!row) return false;
  const p = personOf(s, c.id);
  const start = nightStart(s.night) + row.breakAt;
  const end = start + 20;
  const activity = p.activity;
  // Complete planned meals and relief, then restore the agreed home stations without another ask.
  if (s.minute === end) {
    if (activity) endActivity(p, 'completed', s.minute, s, c);
    resumeBoardStation(s, c, row.station);
    if (row.cover && row.coverAccepted) {
      const relief = cookOf(s, row.cover);
      const own = s.board?.rows.find((r) => r.cook === row.cover && r.accepted);
      if (!relief.gone && own && relief.cover?.station === row.station)
        resumeBoardStation(s, relief, own.station);
    }
    return true;
  }
  if (s.minute === start) {
    if (activity) endActivity(p, 'completed', s.minute, s, c);
    beginBoardBreak(s, c, end);
    c.cover = null;
    say(s, c.id, `My board break. Back on ${VERB_WORD[row.station]} at ${clock(end)}.`, 'journal');
    if (row.cover && row.coverAccepted && inKitchen(s, row.cover)) {
      const relief = cookOf(s, row.cover);
      resumeBoardStation(s, relief, row.station, end);
    }
    return true;
  }
  if (s.minute > start && s.minute < end) {
    // A private moment can happen during the agreed break, then the cook eats before returning.
    if (activity && s.minute >= activity.endsAt) {
      endActivity(p, 'completed', s.minute, s, c);
      beginBoardBreak(s, c, end, false);
    }
    return true;
  }
  if (c.cover && c.cover.until <= s.minute) {
    resumeBoardStation(s, c, row.station);
    return true;
  }
  // Bodies can break the agreement. Let HF choose a rest/meal; the visible gap gets one decision.
  if (c.cover && (p.body.satiety < 0.12 || p.body.hydration < 0.12 || p.body.exertion > 0.92)) {
    const st = c.cover.station;
    if (activity) endActivity(p, 'interrupted', s.minute, s, c);
    const meal = offer('eat', {
      label: 'eat and catch my breath',
      duration: 20,
      effort: 0,
      advertises: { food: 0.6, water: 0.6, rest: 0.5 },
    });
    begin(p, meal, decide(p, [meal]));
    c.cover = null;
    raiseStaffing(s, c.id, st, s.minute + 20, 'I need a plate and a sit down, Chef.');
    return true;
  }
  // A bodily/emergency break ends: return to the agreed station, unless sent home.
  if (!c.cover && activity && s.minute >= activity.endsAt && OFF_LINE.includes(activity.affordanceId)) {
    endActivity(p, 'completed', s.minute, s, c);
    resumeBoardStation(s, c, row.station);
    return true;
  }
  return false;
}

/** The break stays twenty minutes; the cook still has their own quiet life inside it. */
function beginBoardBreak(s: GameState, c: CookState, end: number, personal = true) {
  const p = personOf(s, c.id);
  const meal = offer('eat', {
    label: 'take my agreed meal break',
    duration: Math.max(1, end - s.minute),
    effort: 0,
    advertises: { food: 0.5, water: 0.5, rest: 0.35 },
  });
  const quiet = personal
    ? offersFor(s, c.id).filter((a) => ['skim', 'pray', 'smoke', 'phone'].includes(a.id))
    : [];
  const rec = decide(p, [meal, ...quiet]);
  const chosen = [meal, ...quiet].find((a) => a.id === rec.chosenAffordanceId);
  if (chosen) begin(p, chosen, rec);
  notePrompt(s, c.id, p);
  noteResolve(s, c, p, rec);
  // Quiet acts have no staffing alert, objective, or reward. Return time is unchanged.
  if (chosen?.id === 'pray') say(s, 'narrator', 'Selim stepped into the storeroom for maghrib.', 'journal');
  if (chosen?.id === 'phone' && s.request?.kind === 'phone' && s.request.who === c.id) s.request.rang = true;
}

/** Execute an agreement already accepted through HF, using the same cover and activity as an ad-hoc yes. */
function resumeBoardStation(s: GameState, c: CookState, station: Station, until = closeAt(s.night)) {
  const p = personOf(s, c.id);
  if (p.activity) endActivity(p, 'interrupted', s.minute, s, c);
  const aff = offersFor(s, c.id, station).find((a) => a.id === station);
  if (!aff) return;
  const agreed = { ...aff, duration: Math.max(1, until - s.minute), followedBy: undefined };
  // No new suggestion: this is carrying out the prior agreement, not asking again.
  const rec = decide(p, [agreed]);
  if (begin(p, agreed, rec)) {
    c.cover = { station, until };
    if (p.activity) p.activity.endsAt = until;
  }
}

function detectBoardGaps(s: GameState) {
  for (const decision of s.staffing ?? [])
    if (
      decision.state === 'asking' &&
      (s.minute >= decision.until || onShift(s).some((id) => stationOf(s, id) === decision.station))
    )
      decision.state = 'covered';
  for (const row of s.board?.rows ?? []) {
    if (!row.accepted) continue;
    const c = cookOf(s, row.cook);
    const local = s.minute - nightStart(s.night);
    if (local >= row.breakAt && local < row.breakAt + 20) continue;
    if (
      s.board?.rows.some(
        (other) =>
          other.cover === row.cook &&
          other.coverAccepted &&
          local >= other.breakAt &&
          local < other.breakAt + 20,
      )
    )
      continue;
    if (c.cover && c.cover.station !== row.station && c.cover.until < closeAt(s.night)) continue;
    if (stationOf(s, row.cook) === row.station || onShift(s).some((id) => stationOf(s, id) === row.station))
      continue;
    if (
      chefEdition(s) &&
      s.acceptedGaps?.some(
        (gap) => gap.who === row.cook && gap.station === row.station && gap.until > s.minute,
      )
    )
      continue;
    const a = personOf(s, row.cook).activity;
    const until = c.gone ? closeAt(s.night) : Math.min(closeAt(s.night), a?.endsAt ?? s.minute + 20);
    raiseStaffing(
      s,
      row.cook,
      row.station,
      Math.max(s.minute + 1, until),
      c.gone ? 'I have to leave the kitchen.' : 'I’m off my agreed station, Chef.',
    );
  }
}

const COOK_ACTS: Record<FoodStation, string[]> = {
  grill: ['sear the lamb', 'turn the lamb', 'rest the lamb', 'plate the lamb'],
  cold: ['cut the vegetables', 'dress the salad', 'plate the salad'],
  oven: ['shape the pide', 'bake the pide', 'plate the pide'],
};

export function cookingStep(s: GameState): {
  ticket: number;
  station: FoodStation;
  text: string;
  readyAt: number;
  deadline: number;
  ready: boolean;
} | null {
  const h = s.help;
  if (!handsOn(s) || !h) return null;
  const t = s.tickets.find((t) => t.id === h.ticket);
  if (t?.status !== 'open') return null;
  const readyAt = h.readyAt ?? h.until;
  const act = COOK_ACTS[h.station][h.act ?? 0];
  const equipmentWait =
    (h.station === 'grill' || h.station === 'oven') && gasOut(s)
      ? 'Waiting for gas.'
      : h.station === 'oven' && s.oven.heat < OVEN_HOT
        ? 'Waiting for the oven to warm.'
        : null;
  return {
    ticket: h.ticket,
    station: h.station,
    readyAt,
    deadline: readyAt + 8,
    ready: !equipmentWait && s.minute >= readyAt,
    text:
      equipmentWait ??
      (s.minute >= readyAt
        ? `Table ${t.table}: ready to ${act}.`
        : `Table ${t.table}: ${act} at ${clock(readyAt)}.`),
  };
}

export function plateOptions(s: GameState): { ticket: number; text: string }[] {
  if (!handsOn(s) || s.phase !== 'service') return [];
  return allocationOrder(s)
    .filter((t) => t.status === 'open' && t.platedAt !== undefined)
    .map((t) => ({
      ticket: t.id,
      text: `Service, table ${t.table}!${s.minute - (t.platedAt ?? s.minute) > 4 ? ' The plate is cooling.' : ' Out hot.'}`,
    }));
}

function stalePortion(s: GameState, id: number) {
  const t = s.tickets.find((t) => t.id === id);
  const h = s.help;
  if (h) {
    const current = s.tickets.find((t) => t.id === h.ticket);
    say(
      s,
      'narrator',
      `My hands are on table ${current?.table}'s ${foodWords(h.station)}. ${t ? `I did not start another portion for table ${t.table}.` : 'I did not start another portion.'}`,
      'answer',
    );
    return;
  }
  say(
    s,
    'narrator',
    !t
      ? 'That portion is no longer on the rail.'
      : t.status === 'walked'
        ? `Table ${t.table} already left. I did not start their portion.`
        : t.status === 'served'
          ? `Table ${t.table} has already been served.`
          : t.platedAt !== undefined
            ? `Table ${t.table} is already plated at the pass.`
            : ready(t)
              ? `The crew already finished table ${t.table}'s portions; I did not start one.`
              : `That portion for table ${t.table} is no longer available here; I did not start it.`,
    'answer',
  );
}

function performCookingStep(s: GameState, instinct: boolean, skipped = false) {
  if (promisesOn(s)) trackSignatureWait(s);
  const h = s.help;
  const action = cookingStep(s);
  if (!h || !action?.ready) return;
  const t = s.tickets.find((t) => t.id === h.ticket);
  if (!t) return;
  if (!h.announced) {
    say(s, 'narrator', action.text, 'call');
    h.announced = true;
  }
  if (portionEdition(s) && cookingChoice(s)) {
    chooseCooking(s, 'now');
    return;
  }
  const plain = instinct || skipped || (!portionEdition(s) && s.minute > action.deadline);
  h.plain ||= plain;
  say(
    s,
    'narrator',
    skipped
      ? `I left table ${t.table}'s ${COOK_ACTS[h.station][h.act ?? 0]} late. It will be plainer and slower.`
      : `I ${COOK_ACTS[h.station][h.act ?? 0]} for table ${t.table}.${instinct ? ' On instinct; a plain plate.' : plain ? ' Late; a plain plate.' : ' At its moment; taking care.'}${s.chef.body.exertion > 0.45 ? ' My arms are tired.' : ''}`,
    'journal',
  );
  h.act = (h.act ?? 0) + 1;
  if (!portionEdition(s)) h.instinct = false;
  if (h.act < COOK_ACTS[h.station].length) {
    h.readyAt = s.minute + (skipped ? 5 : 3) + (s.chef.body.exertion > 0.65 ? 2 : 0);
    h.until = h.readyAt;
    h.announced = false;
    return;
  }
  if (h.station === 'grill') t.doneGrill = Math.min(t.grill, t.doneGrill + 1);
  else if (h.station === 'cold') t.doneCold = Math.min(t.cold, t.doneCold + 1);
  else t.doneOven = Math.min(t.oven, t.doneOven + 1);
  if (promisesOn(s) && h.signature) {
    const b = bookingOf(s, t.id);
    if (b) b.signatureQuality = h.careChosen && !h.plain ? 'careful' : 'plain';
  }
  if (portionEdition(s)) {
    t.chefPortions ??= [];
    t.chefPortions.push({ station: h.station, quality: h.plain ? 'plain' : 'careful' });
    const careful = t.chefPortions.some((portion) => portion.quality === 'careful');
    const plain = t.chefPortions.some((portion) => portion.quality === 'plain');
    t.quality = careful && plain ? 'mixed' : careful ? 'careful' : 'plain';
  } else t.quality = t.quality === 'plain' || h.plain ? 'plain' : 'careful';
  if (s.chef.activity) endActivity(s.chef, 'completed', s.minute);
  say(
    s,
    'narrator',
    `I finished ${foodWords(h.station)} for table ${t.table}.${h.plain ? ' A plain portion.' : ' Carefully cooked.'}`,
    'journal',
  );
  s.help = null;
  if (portionEdition(s)) startNextPortion(s);
}

function handsOnMinute(s: GameState) {
  tick(s.chef, s.minute);
  const h = s.help;
  if (!h) return;
  const t = s.tickets.find((t) => t.id === h.ticket);
  if (t?.status !== 'open') {
    if (s.chef.activity) endActivity(s.chef, 'interrupted', s.minute);
    say(s, 'narrator', 'That table left. I stopped their portion; nothing was banked.', 'journal');
    s.help = null;
    if (portionEdition(s)) startNextPortion(s);
    return;
  }
  if (
    ((h.station === 'grill' || h.station === 'oven') && gasOut(s)) ||
    (h.station === 'oven' && s.oven.heat < OVEN_HOT)
  ) {
    h.readyAt = (h.readyAt ?? s.minute) + 1;
    h.until = h.readyAt;
    return;
  }
  const action = cookingStep(s);
  if (!action?.ready) return;
  if (!h.announced) {
    say(s, 'narrator', action.text, 'call');
    h.announced = true;
  }
  if (h.instinct) performCookingStep(s, true);
  else if (s.minute > action.deadline + 3) performCookingStep(s, false, true);
}

const FOOD_CHOICES: Record<FoodStation, { plain: string; careful: string }> = {
  cold: { plain: 'Plate it now', careful: 'Dress it carefully' },
  grill: { plain: 'Pull it now', careful: 'Rest it properly' },
  oven: { plain: 'Out now', careful: 'Another minute for the crust' },
};

/** One time-versus-food decision per portion, at the step where care changes the food. */
export function cookingChoice(s: GameState): {
  ticket: number;
  station: FoodStation;
  plain: string;
  careful: string;
  minutes: number;
} | null {
  if (!portionEdition(s) || !s.help || !cookingStep(s)?.ready) return null;
  const h = s.help;
  const choiceAct = h.station === 'grill' ? 2 : 1;
  if (h.act !== choiceAct) return null;
  return { ticket: h.ticket, station: h.station, ...FOOD_CHOICES[h.station], minutes: 3 };
}

function chooseCooking(s: GameState, choice: 'now' | 'careful') {
  const h = s.help;
  const option = cookingChoice(s);
  if (!h || !option) return;
  const t = s.tickets.find((t) => t.id === h.ticket);
  if (promisesOn(s) && h.signature) h.careChosen = choice === 'careful';
  h.plain ||= choice === 'now';
  h.act = COOK_ACTS[h.station].length - 1;
  h.readyAt = s.minute + (choice === 'careful' ? 3 : 0);
  h.until = h.readyAt;
  h.announced = false;
  say(
    s,
    'narrator',
    `Table ${t?.table}: ${choice === 'careful' ? option.careful : option.plain}. ${choice === 'careful' ? 'Three more kitchen minutes for the food; the other tables keep waiting.' : 'A plain portion, sooner for the table.'}`,
    'journal',
  );
  if (choice === 'now' && h.station === 'cold') performCookingStep(s, !!h.instinct);
}

function remainingPortions(t: Ticket, station: FoodStation): number {
  return station === 'grill'
    ? t.grill - t.doneGrill
    : station === 'cold'
      ? t.cold - t.doneCold
      : t.oven - t.doneOven;
}

/** Start the already reserved next portion without a second reach or a second recorded input. */
function startNextPortion(s: GameState) {
  const next = s.chefNext;
  if (!next || s.help) return;
  s.chefNext = null;
  const t = s.tickets.find((t) => t.id === next.ticket);
  if (t?.status !== 'open' || remainingPortions(t, next.station) <= 0) {
    stalePortion(s, next.ticket);
    return;
  }
  // Equipment may be cold or out of gas now. Keep the claim until cooking can resume.
  if (!helpOptions(s).some((o) => o.ticket === next.ticket && o.station === next.station)) {
    s.chefNext = next;
    return;
  }
  apply(s, { at: s.minute, kind: 'help', ...next });
}

function prepareChefClaims(s: GameState) {
  if (promisesOn(s)) {
    trackSignatureWait(s);
    const pending = partiesTonight(s).find(
      (b) =>
        b.promised &&
        b.signatureQuality === undefined &&
        s.tickets.some((t) => t.id === b.ticket && t.status === 'open') &&
        !(s.help?.signature && s.help.ticket === b.ticket),
    );
    if (pending?.ticket !== undefined) s.chefNext = { ticket: pending.ticket, station: pending.signature };
  }
  if (s.chefNext) {
    const t = s.tickets.find((t) => t.id === s.chefNext?.ticket);
    if (t?.status !== 'open') {
      say(
        s,
        'narrator',
        `Table ${t?.table ?? ''} left before I reached Chef’s next. I released that portion.`,
        'answer',
      );
      s.chefNext = null;
    }
  }
  startNextPortion(s);
  if (s.help || s.chefNext) {
    s.chefGrace = [];
    return;
  }
  const old = s.chefGrace ?? [];
  s.chefGrace = [];
  for (const station of ['grill', 'cold', 'oven'] as const) {
    const t = allocationOrder(s).find((t) => t.status === 'open' && remainingPortions(t, station) > 0);
    if (!t) continue;
    // Retain the invitation after expiry; it cannot renew before this portion has moved.
    const done = t[station] - remainingPortions(t, station);
    const previous = old.find((g) => g.ticket === t.id && g.station === station && g.done === done);
    const grace = previous ?? { ticket: t.id, station, until: s.minute + 4, done };
    s.chefGrace.push(grace);
    if (!previous) {
      const cook = onShift(s).find((id) => stationOf(s, id) === station);
      say(
        s,
        cook ?? 'narrator',
        `Yours, Chef? Table ${t.table}'s ${foodWords(station)}. I’ll leave it for you a moment.`,
        'call',
      );
    }
  }
}

// ---------- pass@9: returning parties and promises ----------

export const PROMISE_EDITION = 'pass@9';
/** pass@9: share of the till left after a paid bill that next week's creditor adds, having seen the queue. */
export const SEEN_SHARE = 0.5;
export const promisesOn = (s: Pick<GameState, 'version'>): boolean =>
  s.version === PROMISE_EDITION || s.version === 'pass@10';

/** The Sunday card for one offered party. */
export function partyCard(s: GameState, party: string): PartyCard | null {
  if (!promisesOn(s)) return null;
  const b = [...(s.bookings ?? [])].reverse().find((b) => b.party === party);
  const p = partyOf(party);
  if (!b || !p) return null;
  const cook = activeCrew(s).find(
    (m) => (s.board?.rows.find((r) => r.cook === m.id && r.accepted)?.station ?? m.home) === b.signature,
  );
  const trust = cook ? trustOf(personOf(s, cook.id)) : 0.5;
  const band = trust > 0.55 ? 'warm' : trust < 0.42 ? 'cool' : 'even';
  const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return {
    party,
    host: p.host,
    night: planOf(b.night).title,
    at: b.at,
    servedBy: b.servedBy,
    order: (['grill', 'cold', 'oven'] as const)
      .filter((st) => b.order[st] > 0)
      .map((st) => `${words[b.order[st]] ?? b.order[st]} ${st === 'oven' ? 'pide' : st}`)
      .join(', '),
    signature: p.signature.words,
    cook: cook
      ? {
          who: cook.id,
          text: (PROMISE_WORDS[cook.founder ? cook.id : 'hire']?.[band] ?? '')
            .replaceAll('{host}', p.host)
            .replaceAll('{signature}', p.signature.words),
        }
      : null,
  };
}

/** Tonight's returning parties, booked earlier. */
export function partiesTonight(s: GameState): Booking[] {
  return promisesOn(s) ? (s.bookings ?? []).filter((b) => b.night === s.night) : [];
}

/** The booking a ticket belongs to, if any. */
export function bookingOf(s: GameState, ticket: number): Booking | undefined {
  return promisesOn(s) ? s.bookings?.find((b) => b.ticket === ticket && b.night === s.night) : undefined;
}

/** Stable Sunday guests; only the food writer's earned invitation is conditional. */
export function partyChoices(seed: number, week: number, criticSmiled = false): string[] {
  if (week < 1 || week > 3) return [];
  const pool = PARTIES.filter((p) => !p.critic).sort(
    (a, b) => hashUnit(seed, 51, week, PARTIES.indexOf(a)) - hashUnit(seed, 51, week, PARTIES.indexOf(b)),
  );
  const first = week === 1 && criticSmiled ? partyOf('writer') : pool[0];
  const second = pool.find((p) => p.id !== first?.id && p.weekday !== first?.weekday);
  return [first, second].flatMap((p) => (p ? [p.id] : []));
}

function bookParties(s: GameState, page: SundayPage) {
  const smiled = s.reports.some((r) => r.night === 5 && r.critic === 'pleased');
  page.parties = partyChoices(s.seed, page.week, smiled);
  s.bookings ??= [];
  const clean = s.reports.filter((r) => planOf(r.night).week === page.week).every((r) => r.walked === 0);
  const bonus = Number(clean) + Math.min(2, s.bookings.filter((b) => b.outcome === 'kept').length);
  for (const id of page.parties) {
    const p = partyOf(id);
    const night = NIGHT_PLANS.find((n) => n.week === page.week + 1 && n.weekday === p?.weekday);
    if (!p || !night) continue;
    const order = { grill: p.order.grill ?? 0, cold: p.order.cold ?? 0, oven: p.order.oven ?? 0 };
    order[p.grows] += bonus;
    const at = nightStart(night.n) + p.at;
    s.bookings.push({
      party: id,
      week: page.week + 1,
      night: night.n,
      at,
      servedBy: at + 25,
      order,
      signature: p.signature.station,
      promised: false,
    });
  }
}

/** Only the promised signature is reserved, rather than all food at its station. */
function signaturePending(s: GameState, ticket: number | undefined): Booking | undefined {
  const b = ticket === undefined ? undefined : bookingOf(s, ticket);
  return b?.promised && b.signatureQuality === undefined ? b : undefined;
}

function addParties(s: GameState) {
  let id = Math.max(0, ...s.tickets.map((t) => t.id)) + 1;
  for (const b of partiesTonight(s)) {
    const p = partyOf(b.party);
    if (!p) continue;
    const t: Ticket = {
      id: id++,
      table: 1 + Math.floor(hashUnit(s.seed, 52, b.night, PARTIES.indexOf(p)) * 9),
      at: b.at,
      ...b.order,
      doneGrill: 0,
      doneCold: 0,
      doneOven: 0,
      patience: b.promised ? 35 : s.pace === 'nevin' ? 38 : weekOf(b.week).patience,
      price: s.price + PIDE_PRICE * b.order.oven,
      party: b.party,
      status: 'waiting',
    };
    if (p.regular) t.regular = p.regular;
    b.ticket = t.id;
    s.tickets.push(t);
  }
  s.tickets.sort((a, b) => a.at - b.at || a.id - b.id);
}

/** Instinct releases this signature to the ordinary crew allocation at plain quality. */
function delegateSignature(s: GameState): boolean {
  const h = s.help;
  if (!promisesOn(s) || !h?.signature) return false;
  const b = bookingOf(s, h.ticket);
  if (!b) return false;
  b.signatureQuality = 'plain';
  if (s.chef.activity) endActivity(s.chef, 'interrupted', s.minute);
  s.help = null;
  say(
    s,
    'narrator',
    'I handed the promised signature to the crew on instinct. Plain food; the promise is broken.',
    'journal',
  );
  startNextPortion(s);
  return true;
}

function trackSignatureWait(s: GameState) {
  if (!s.help?.signature) return;
  const b = bookingOf(s, s.help.ticket);
  if (!b) return;
  for (const t of s.tickets)
    if (t.status === 'open' && t.id !== b.ticket && t.due === undefined) {
      const wait = s.minute - Math.max(t.at, b.signatureStartedAt ?? s.minute);
      if (b.waited === undefined || wait > (b.waitedMinutes ?? -1)) {
        b.waited = t.table;
        b.waitedMinutes = wait;
      }
    }
}

export const PROMISE_PREMIUM = 650;

function finishParty(s: GameState, t: Ticket): number {
  const b = bookingOf(s, t.id);
  const p = b ? partyOf(b.party) : undefined;
  if (!b || !p) return t.price;
  if (b.outcome) return t.partyPay ?? t.price;
  const kept =
    b.promised &&
    t.status === 'served' &&
    (t.servedAt ?? Infinity) <= b.servedBy &&
    b.signatureQuality === 'careful';
  b.outcome = b.promised ? (kept ? 'kept' : 'broken') : t.status === 'served' ? 'served' : 'walked';
  const st = p.regular ? s.regulars[p.regular] : undefined;
  if (st) {
    if (b.promised || t.status === 'walked') st.regard = clamp(st.regard + (kept ? 0.15 : -0.2));
    if (kept) st.friendNext = true;
  }
  say(
    s,
    'narrator',
    t.status === 'walked' ? p.walked : b.promised ? (kept ? p.kept : p.broken) : p.served,
    'journal',
  );
  if (b.promised && t.status === 'walked') say(s, 'narrator', 'I had promised them.', 'journal');
  if (kept)
    say(
      s,
      'narrator',
      b.waited === undefined
        ? `Nobody else was waiting while I ${p.doing}.`
        : `Table ${b.waited} waited longest while I ${p.doing}.`,
      'journal',
    );
  t.partyPay = t.status === 'served' ? partyBasePay(s, t, b) + (kept ? PROMISE_PREMIUM : 0) : 0;
  return t.partyPay;
}

/** A returning regular still has their tab; an ordinary party keeps their usual response to the wait. */
function partyBasePay(s: GameState, t: Ticket, b: Booking): number {
  let pay = t.price;
  const r = t.regular ? regularOf(t.regular) : undefined;
  const st = t.regular ? s.regulars[t.regular] : undefined;
  if (!r || !st) return pay;
  if (st.tab === 'open') pay = 0;
  if (st.tab === 'asked') {
    const part = Math.min(r.owes, 300);
    pay += part;
    st.tab = 'paying';
    say(
      s,
      'narrator',
      `${capital(r.name)} put ₺${part} on the pass without a word. Then the price of supper.`,
      'journal',
    );
  }
  if (!b.promised) {
    const wait = (t.servedAt ?? s.minute) - t.at;
    st.regard = clamp(st.regard + (wait < 15 ? 0.1 : wait > 25 ? -0.05 : 0.03));
    if (st.regard > 0.8 && !st.friendNext) {
      st.friendNext = true;
      stamp(s, 'friend');
    }
  }
  return pay;
}

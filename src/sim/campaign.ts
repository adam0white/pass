/**
 * The campaign: four weeks at Nevin's. Week 1 is the six-night week the owner played (Monday to Saturday); weeks
 * 2 to 4 are four services each (Wednesday to Saturday), with a Sunday page between weeks. Each week brings one new
 * thing, introduced by a person: the oven and the regulars (week 2), the ledger, hiring and quitting (week 3), the
 * anniversary, the night the gas fails and the wedding (week 4). Each week ends with a bill paid from the till.
 *
 * Pure data and small pure helpers: the kitchen reads it, nothing here holds state.
 */
import type { Station } from './cooks.ts';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface Week {
  week: number;
  title: string;
  /** Who the week's bill is owed to, and how much (before any hire's wages). */
  owed: string;
  bill: number;
  /** Weekdays (0 = Monday) with a service. */
  weekdays: number[];
  /** How long a table waits before giving up, minutes. */
  patience: number;
  /** The opening lines of the week, said on its first night. */
  intro: string[];
}

export const WEEKS: readonly Week[] = [
  {
    week: 1,
    title: 'The arrears',
    owed: 'the bank',
    bill: 5200,
    weekdays: [0, 1, 2, 3, 4, 5],
    patience: 38,
    intro: [
      'Nevin left me the lokanta, its debts, and two cooks who still call it hers.',
      'The bank wants the arrears by Saturday close.',
    ],
  },
  {
    week: 2,
    title: 'The street',
    owed: 'Ahmet the butcher',
    bill: 3000,
    weekdays: [2, 3, 4, 5],
    patience: 36,
    intro: [
      'Ahmet the butcher came by on Monday with a bill in Nevin’s name. He wants it by Saturday.',
      'Selim had the oven lit before I got in. Pide is back on the board. Somebody has to keep it hot, or the pide waits.',
    ],
  },
  {
    week: 3,
    title: 'The ledger',
    owed: 'the landlord',
    bill: 4200,
    weekdays: [2, 3, 4, 5],
    patience: 32,
    intro: ['The landlord’s letter: the rent goes up this month, and he would like last month’s too.'],
  },
  {
    week: 4,
    title: 'Nevin’s name',
    owed: 'the bank, again',
    bill: 6200,
    weekdays: [2, 3, 4, 5],
    patience: 30,
    intro: [
      'A year on Thursday since Nevin died. The bank wrote again: the last of the arrears, by Saturday.',
    ],
  },
];

export interface NightPlan {
  /** Night number in the campaign, 1-based. */
  n: number;
  week: number;
  weekday: number;
  /** Absolute day index: minute 0 is Monday of week 1, 00:00. */
  day: number;
  title: string;
  tables: number;
  /** One line said at doors-open: the night's new pressure, from a person. */
  intro: string[];
  /** Pide on the menu (week 2 on). */
  oven: boolean;
  /** Arrivals shifted later (a match crowd), as a share of the evening. */
  late?: number;
  critic?: boolean;
  /** Dilek's mother falls (week 1 Friday). */
  call?: boolean;
  /** Nevin's anniversary: the street comes. */
  anniversary?: boolean;
  /** The gas goes out: no grill and no oven between these minutes of the day. */
  gasOut?: { from: number; until: number };
  /** A wedding order: portions due by a minute of the day. */
  wedding?: { grill: number; cold: number; oven: number; due: number; pay: number };
  /** A cook's request of the chef, mid-service. */
  request?: RequestPlan;
  /** Plates become dirty from this night (Rafi's dish pit). */
  dish: boolean;
}

export interface RequestPlan {
  /** Who asks: a crew id, or 'hire' for the newest hire still working. */
  who: string;
  at: number;
  kind: 'advance' | 'phone' | 'leave-early' | 'eat-first' | 'my-way';
}

const W1_TABLES = [15, 20, 23, 31, 27, 33];

/** All nights of the campaign, in order. */
export const NIGHT_PLANS: readonly NightPlan[] = buildNights();

function buildNights(): NightPlan[] {
  const out: NightPlan[] = [];
  let n = 0;
  for (const w of WEEKS) {
    w.weekdays.forEach((wd, i) => {
      n += 1;
      const plan: NightPlan = {
        n,
        week: w.week,
        weekday: wd,
        day: (w.week - 1) * 7 + wd,
        title: WEEKDAYS[wd] as string,
        tables: 0,
        intro: i === 0 ? [...w.intro] : [],
        oven: w.week >= 2,
        dish: !(w.week === 1 && wd === 0),
      };
      if (w.week === 1) {
        plan.tables = W1_TABLES[i] as number;
        const lines = [
          ['Doors open. Tap a cook, then a job. Hold to insist.'],
          ['Rafi is back on the dish pit. Without clean plates nothing leaves the pass.'],
          ['The tip jar sits by the back door, where Nevin always kept it.'],
          ['The derby is on at eight. The whole street will want feeding after.'],
          ['Word is a food writer is coming tonight. Nobody knows which table.'],
          ['Last night before the bank. Whatever is in the till at close is what we have.'],
        ][i] as string[];
        plan.intro = i === 0 ? [...w.intro, ...lines] : lines;
        if (i === 3) plan.late = 0.12;
        if (i === 4) {
          plan.critic = true;
          plan.call = true;
        }
      } else if (w.week === 2) {
        plan.tables = [22, 25, 27, 31][i] as number;
        if (i === 0) plan.intro.push('The regulars are back: Nevin’s people. They know what they want.');
        if (i === 1) {
          plan.intro.push('Rafi has been quiet all afternoon.');
          plan.request = { who: 'rafi', at: 19 * 60 + 50, kind: 'advance' };
        }
        if (i === 2) {
          plan.intro.push('Kemal’s taxi rank is busy tonight. He’ll be in late and in a hurry.');
          plan.request = { who: 'dilek', at: 19 * 60 + 15, kind: 'phone' };
        }
        if (i === 3) {
          plan.intro.push('Saturday. The butcher will be at the door at close.');
          plan.late = 0.05;
        }
      } else if (w.week === 3) {
        plan.tables = [26, 28, 30, 34][i] as number;
        if (i === 0)
          plan.intro.push(
            'Selim put a small book on the pass this afternoon: Nevin’s ledger. He didn’t say a word.',
          );
        if (i === 1) {
          plan.request = { who: 'hire', at: 19 * 60 + 40, kind: 'leave-early' };
        }
        if (i === 2) plan.intro.push('Two tables booked for a birthday, and the derby again.');
        if (i === 2) plan.late = 0.1;
        if (i === 3)
          plan.intro.push('Saturday. The landlord said he would come by for the envelope himself.');
      } else {
        plan.tables = [28, 34, 30, 30][i] as number;
        if (i === 0)
          plan.intro.push('Somebody from a döner chain left a card on the pass: “About the premises.”');
        if (i === 1) {
          plan.anniversary = true;
          plan.intro.push('A year today. People keep stopping at the window. I think the street is coming.');
        }
        if (i === 2) {
          plan.gasOut = { from: 19 * 60 + 25, until: 20 * 60 + 5 };
          plan.intro.push('The gas man was here all afternoon. He said it should hold.');
        }
        if (i === 3) {
          plan.wedding = { grill: 8, cold: 8, oven: 4, due: 20 * 60, pay: 1600 };
          plan.intro.push(
            'The Yıldız wedding: twenty trays for the hall across the road, by eight. Then the usual Saturday.',
          );
        }
      }
      out.push(plan);
    });
  }
  return out;
}

export const LAST_NIGHT = NIGHT_PLANS.length;
export const planOf = (n: number): NightPlan => NIGHT_PLANS[n - 1] as NightPlan;
export const weekOf = (w: number): Week => WEEKS[w - 1] as Week;
export const isLastOfWeek = (n: number): boolean => planOf(n).week !== (NIGHT_PLANS[n]?.week ?? -1);
export const nightStart = (n: number): number => planOf(n).day * 1440;

// ---------- the regulars ----------

/** Nevin's people. Host-side customers, not HF people: a name, a usual order, a night, and a tab. */
export interface Regular {
  id: string;
  name: string;
  weekdays: number[];
  /** Minute of the day they come in. */
  at: number;
  order: Partial<Record<Station, number>>;
  /** Eats on Nevin's tab: no money at the till. */
  tab: boolean;
  /** What the ledger says they owe, ₺. */
  owes: number;
  /** A margin note in Nevin's hand, found with the ledger. */
  margin?: string;
  /** Minutes they will wait (default: the week's patience). */
  patience?: number;
  /** Lines in the journal: when they sit, when they leave pleased, when they leave cross. */
  sits: string;
  pleased: string;
  cross: string;
}

export const REGULARS: readonly Regular[] = [
  {
    id: 'hasan',
    name: 'Hasan Bey',
    weekdays: [2, 5],
    at: 18 * 60 + 5,
    order: { cold: 1, grill: 1 },
    tab: true,
    owes: 1240,
    margin: 'Hasan — the pension comes on the 15th. Don’t ask before.',
    sits: 'Hasan Bey took the table by the window and asked if the lentils were still Nevin’s.',
    pleased: 'Hasan Bey said “on the tab, as Nevin did” and patted Selim’s shoulder on the way out.',
    cross: 'Hasan Bey waited, then put on his cap and left without a word.',
  },
  {
    id: 'arslan',
    name: 'Mrs Arslan',
    weekdays: [3],
    at: 18 * 60 + 20,
    order: { oven: 2, cold: 1 },
    tab: true,
    owes: 860,
    margin: 'Gül Arslan — since the boy’s father. Pide for the grandson, always.',
    sits: 'Mrs Arslan brought her grandson. He wanted pide, “the one with the egg”.',
    pleased:
      'The grandson ate his pide with both hands. Mrs Arslan touched the ledger on the pass as she left.',
    cross: 'Mrs Arslan took the boy home hungry.',
  },
  {
    id: 'aksoy',
    name: 'the Aksoy sisters',
    weekdays: [2],
    at: 19 * 60 + 10,
    order: { cold: 2, oven: 1 },
    tab: false,
    owes: 0,
    sits: 'The Aksoy sisters took table 3 and argued about Nevin’s börek.',
    pleased: 'The Aksoy sisters left a good tip and a long opinion of the börek.',
    cross: 'The Aksoy sisters left, loudly, for the place on the corner.',
  },
  {
    id: 'kemal',
    name: 'Kemal',
    weekdays: [4],
    at: 21 * 60,
    order: { grill: 2 },
    tab: false,
    owes: 0,
    patience: 20,
    sits: 'Kemal the taxi driver came in with the engine still running. “Two köfte, Chef, I have a fare.”',
    pleased: 'Kemal ate standing up, paid, and told me his whole rank would come Saturday.',
    cross: 'Kemal’s horn went twice outside, and then he was gone.',
  },
  {
    id: 'ilyas',
    name: 'Ilyas',
    weekdays: [3, 5],
    at: 21 * 60 + 10,
    order: { grill: 1, cold: 1 },
    tab: true,
    owes: 540,
    margin: 'Ilyas, nights at the depot. He paid it all in ’19. He will again.',
    sits: 'Ilyas the night watchman came in for his supper before the depot.',
    pleased: 'Ilyas said Nevin used to put an extra börek in his bag. Rafi did.',
    cross: 'Ilyas left for the depot hungry.',
  },
];

export const regularOf = (id: string): Regular | undefined => REGULARS.find((r) => r.id === id);

/** What the chef decided about a tab on the third Sunday. */
export type TabChoice = 'keep' | 'ask' | 'forgive';

// ---------- notebook stamps ----------

export const STAMPS: Record<string, string> = {
  'full-house': 'A full house, nobody walked',
  'clean-week': 'A week with no walkouts',
  critic: 'The food writer smiled',
  'jar-week': 'Rafi kept his rule all week',
  'no-push': 'A week without insisting',
  'bill-1': 'The bank paid',
  'bill-2': 'The butcher paid',
  'bill-3': 'The landlord paid',
  'bill-4': 'The arrears cleared',
  friend: 'A regular brought a friend',
  oven: 'Pide before the rush',
  wedding: 'The wedding trays on time',
  apron: 'Nevin’s apron',
  dark: 'Fed them through the dark',
  unprompted: 'Someone did it without being told',
};

// ---------- returning parties (pass@9) ----------

export type FoodStationId = 'grill' | 'cold' | 'oven';

/**
 * A party that comes back because the kitchen fed someone well. Host-side guests, not HF people. Offered on the
 * Sunday page for next week; the chef decides only what to promise them. Weekday 2..5 is Wednesday..Saturday.
 */
export interface Party {
  id: string;
  /** Who booked, as the notebook names them. */
  host: string;
  /** A regular whose own ticket this party replaces on its night. */
  regular?: string;
  weekday: number;
  /** Seating, minute of the day. */
  at: number;
  /** Base order, before word gets around. */
  order: Partial<Record<FoodStationId, number>>;
  /** The station that gets the extra portions when word gets around. */
  grows: FoodStationId;
  /** The portion the chef promises to do with care. */
  signature: { station: FoodStationId; words: string };
  /** Offered only if the food writer smiled in week 1. */
  critic?: boolean;
  /** Sunday card: how the booking came. */
  booked: string;
  /** Journal lines. */
  sits: string;
  kept: string;
  broken: string;
  served: string;
  walked: string;
}

export const PARTIES: readonly Party[] = [
  {
    id: 'writer',
    host: 'the food writer',
    weekday: 3,
    at: 19 * 60 + 50,
    order: { grill: 2, cold: 2 },
    grows: 'grill',
    signature: { station: 'grill', words: 'the lamb, rested properly' },
    critic: true,
    booked:
      'The food writer rang on Saturday. She is bringing her editor on Thursday, “for the lamb I keep describing to him”.',
    sits: 'The food writer and her editor took the corner table. She had her notebook out before the bread.',
    kept: 'The editor asked who rested the lamb. The writer just smiled at him.',
    broken: 'The editor ate the lamb and said it was fine. The writer did not write anything down.',
    served: 'The food writer and her editor ate, paid, and talked about something else.',
    walked: 'The food writer and her editor left before the lamb. She looked back at the pass once.',
  },
  {
    id: 'hasan',
    host: 'Hasan Bey',
    regular: 'hasan',
    weekday: 5,
    at: 19 * 60 + 55,
    order: { grill: 2, cold: 1 },
    grows: 'grill',
    signature: { station: 'grill', words: 'the lamb, rested properly' },
    booked:
      'Hasan Bey stopped at the door after supper. “Saturday, my brother is up from İzmir. He ate here in Nevin’s time. Make it the lamb.”',
    sits: 'Hasan Bey came in with his brother, both in jackets. The brother looked at the photo of Nevin by the till for a long time.',
    kept: 'Hasan Bey’s brother cut the lamb and was quiet. “Like hers,” he said.',
    broken: '“It was good,” Hasan Bey said to his brother, not quite looking at me.',
    served: 'Hasan Bey and his brother ate and talked about İzmir.',
    walked: 'Hasan Bey and his brother put their jackets back on. He did not say anything at the door.',
  },
  {
    id: 'arslan',
    host: 'Mrs Arslan',
    regular: 'arslan',
    weekday: 3,
    at: 18 * 60 + 20,
    order: { oven: 2, cold: 1 },
    grows: 'oven',
    signature: { station: 'oven', words: 'the egg pide, its crust given another minute' },
    booked:
      'Mrs Arslan left a note on the pass: the grandson is seven on Thursday. Early, before his bedtime. “The pide with the egg, the way it was.”',
    sits: 'Mrs Arslan brought the grandson and two school friends. They sat on their hands, nearly.',
    kept: 'The grandson ate the crust first. Mrs Arslan put her hand flat on the ledger as she left.',
    broken: 'The boys ate everything. Mrs Arslan said thank you the way you thank the post office.',
    served: 'The boys ate and were loud. Mrs Arslan took the last slice home in a napkin.',
    walked: 'Mrs Arslan took three hungry boys home past the window.',
  },
  {
    id: 'kemal',
    host: 'Kemal',
    regular: 'kemal',
    weekday: 4,
    at: 20 * 60 + 10,
    order: { grill: 2, cold: 1 },
    grows: 'grill',
    signature: { station: 'cold', words: 'the shepherd’s salad, dressed carefully' },
    booked:
      'Kemal leaned in from the taxi rank: Friday, him and three drivers, between fares. “My wife says Nevin’s salad. Do the salad properly and they’ll all come back.”',
    sits: 'Kemal and three drivers came in together, keys on the table, engines ticking outside.',
    kept: 'The drivers ate the salad first and argued about the dressing. Kemal paid for all of them.',
    broken: 'Kemal looked at the salad, then at me. “My wife makes it better,” he said, kindly.',
    served: 'The drivers ate fast and left one by one as the fares came.',
    walked: 'A horn outside, then another. Kemal’s drivers left one by one, unfed.',
  },
  {
    id: 'aksoy',
    host: 'the Aksoy sisters',
    regular: 'aksoy',
    weekday: 2,
    at: 19 * 60 + 45,
    order: { cold: 2, oven: 1 },
    grows: 'cold',
    signature: { station: 'cold', words: 'the cacık, done Nevin’s way' },
    booked:
      'The Aksoy sisters booked Wednesday for their reading group. “All of us. We will be discussing the cacık as well as the book.”',
    sits: 'The Aksoy sisters arrived with their reading group and a book nobody had finished.',
    kept: 'The reading group discussed the cacık longer than the book. The elder sister asked for the recipe; I said no.',
    broken: 'The sisters agreed the cacık was not Nevin’s. They agreed loudly.',
    served: 'The reading group ate and discussed the book, mostly.',
    walked: 'The reading group left for the place on the corner, still talking about the book.',
  },
  {
    id: 'ilyas',
    host: 'Ilyas',
    regular: 'ilyas',
    weekday: 5,
    at: 20 * 60 + 15,
    order: { grill: 1, cold: 2 },
    grows: 'cold',
    signature: { station: 'grill', words: 'the köfte, rested before the plate' },
    booked:
      'Ilyas asked for Saturday, early, before the depot: the whole night shift, for the foreman who is retiring. “He ate Nevin’s köfte for thirty years.”',
    sits: 'Ilyas brought the night shift in their jackets, and the foreman in a tie.',
    kept: 'The foreman ate his köfte slowly and told a story about Nevin and a broken boiler.',
    broken: 'The foreman said the köfte was good. Ilyas said nothing on the way out.',
    served: 'The night shift ate and went to the depot together.',
    walked: 'The night shift went to the depot hungry, with the foreman in his tie.',
  },
  {
    id: 'demir',
    host: 'the Demirs',
    weekday: 4,
    at: 19 * 60 + 40,
    order: { cold: 2, oven: 1, grill: 1 },
    grows: 'oven',
    signature: { station: 'oven', words: 'the cheese pide, its crust given another minute' },
    booked:
      'A young man came to the back door with his fiancée’s mother: an engagement supper on Friday. “She says this was the place, when she was young.”',
    sits: 'The Demirs came in dressed for photographs. The mother pointed at the table she used to sit at.',
    kept: 'The mother tore the crust and said “yes” to nobody in particular.',
    broken: 'The mother ate politely and told her daughter it had changed.',
    served: 'The Demirs took photographs and ate.',
    walked: 'The Demirs left for somewhere with a reservation book.',
  },
];

export const partyOf = (id: string): Party | undefined => PARTIES.find((p) => p.id === id);

/**
 * The signature station's cook on the Sunday card, by how much they trust the chef (warm above 0.55, cool below
 * 0.42). `{host}` and `{signature}` are filled in. A hire uses the hire pool.
 */
export const PROMISE_WORDS: Record<string, Record<'warm' | 'even' | 'cool', string>> = {
  selim: {
    warm: 'Promise {host}. I’ll keep the grill clear for you.',
    even: 'You want to promise {signature}? Then you’ll be the one resting it, Chef.',
    cool: 'Your promise, Chef. Not mine.',
  },
  dilek: {
    warm: 'Go on, promise {host}. I’ll keep the cold side out of your way.',
    even: '{signature}. Fine. Don’t promise my break away with it.',
    cool: 'You promise things. I do them. We’ll see.',
  },
  rafi: {
    warm: 'I’ll have clean plates ready for {host}. Promise it.',
    even: 'Is that a lot of plates? It sounds like a lot of plates.',
    cool: 'Okay. Whatever you promise.',
  },
  hire: {
    warm: 'I can hold my side for {host}. Promise it.',
    even: 'It’s your name on it, Chef.',
    cool: 'I didn’t promise anybody anything.',
  },
};

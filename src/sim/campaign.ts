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
    title: 'The money we owe',
    owed: 'the bank',
    bill: 5200,
    weekdays: [0, 1, 2, 3, 4, 5],
    patience: 38,
    intro: [
      'Nevin left me her small restaurant, its debts, and two cooks who still call it hers.',
      'The bank wants the money we owe by closing time on Saturday.',
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
      'Ahmet the butcher came by on Monday with a bill in Nevin’s name. He wants the money by Saturday.',
      'Selim had lit the oven before I arrived. Flatbread is back on the menu. Somebody has to keep the oven hot, or the flatbread has to wait.',
    ],
  },
  {
    week: 3,
    title: 'The ledger',
    owed: 'the landlord',
    bill: 4200,
    weekdays: [2, 3, 4, 5],
    patience: 32,
    intro: [
      'The landlord sent a letter. The rent goes up this month, and he would like last month’s rent too.',
    ],
  },
  {
    week: 4,
    title: 'Nevin’s name',
    owed: 'the bank',
    bill: 6200,
    weekdays: [2, 3, 4, 5],
    patience: 30,
    intro: [
      'Nevin died a year ago this Thursday. The bank wrote again. It wants the last of the money we owe by Saturday.',
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
          ['The doors are open. Tap a cook, then tap a job. Hold a job button to insist.'],
          ['Rafi is back washing the dishes. Without clean plates, no food can leave the pass.'],
          ['The tip jar sits by the back door, where Nevin always kept it.'],
          ['The big football match starts at eight. Afterwards, the whole street will want to eat.'],
          ['People say a food writer is coming tonight. Nobody knows which table she will take.'],
          [
            'This is the last night before we pay the bank. The money in the till at closing time is all we will have.',
          ],
        ][i] as string[];
        plan.intro = i === 0 ? [...w.intro, ...lines] : lines;
        if (i === 3) plan.late = 0.12;
        if (i === 4) {
          plan.critic = true;
          plan.call = true;
        }
      } else if (w.week === 2) {
        plan.tables = [22, 25, 27, 31][i] as number;
        if (i === 0)
          plan.intro.push(
            'The regular customers are back. They were Nevin’s people, and they know what they want.',
          );
        if (i === 1) {
          plan.intro.push('Rafi has been quiet all afternoon.');
          plan.request = { who: 'rafi', at: 19 * 60 + 50, kind: 'advance' };
        }
        if (i === 2) {
          plan.intro.push('Kemal’s taxi stand is busy tonight. He will come in late and in a hurry.');
          plan.request = { who: 'dilek', at: 19 * 60 + 15, kind: 'phone' };
        }
        if (i === 3) {
          plan.intro.push('It is Saturday. The butcher will be at the door at closing time.');
          plan.late = 0.05;
        }
      } else if (w.week === 3) {
        plan.tables = [26, 28, 30, 34][i] as number;
        if (i === 0)
          plan.intro.push(
            'This afternoon, Selim put a small book on the pass. It was Nevin’s account book. He didn’t say a word.',
          );
        if (i === 1) {
          plan.request = { who: 'hire', at: 19 * 60 + 40, kind: 'leave-early' };
        }
        if (i === 2)
          plan.intro.push('Two tables are booked for a birthday. The big football match is on again.');
        if (i === 2) plan.late = 0.1;
        if (i === 3)
          plan.intro.push(
            'It is Saturday. The landlord said he would come himself to collect the envelope of rent money.',
          );
      } else {
        plan.tables = [28, 34, 30, 30][i] as number;
        if (i === 0)
          plan.intro.push(
            'Somebody from a roast-meat restaurant chain left a card on the pass. It said: “About the premises.”',
          );
        if (i === 1) {
          plan.anniversary = true;
          plan.intro.push(
            'Nevin died a year ago today. People keep stopping at the window. I think the whole street is coming.',
          );
        }
        if (i === 2) {
          plan.gasOut = { from: 19 * 60 + 25, until: 20 * 60 + 5 };
          plan.intro.push('The gas repairman was here all afternoon. He said the gas should keep working.');
        }
        if (i === 3) {
          plan.wedding = { grill: 8, cold: 8, oven: 4, due: 20 * 60, pay: 1600 };
          plan.intro.push(
            'The Yıldız wedding needs twenty trays of food at the hall across the road by eight. After that, we have our usual Saturday customers.',
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
    name: 'Mr Hasan',
    weekdays: [2, 5],
    at: 18 * 60 + 5,
    order: { cold: 1, grill: 1 },
    tab: true,
    owes: 1240,
    margin: 'Hasan: his pension comes on the 15th. Don’t ask him before then.',
    sits: 'Mr Hasan took the table by the window. He asked if the lentil soup was still made Nevin’s way.',
    pleased:
      'Mr Hasan said, “Put it on my account, as Nevin did.” He patted Selim’s shoulder on the way out.',
    cross: 'Mr Hasan waited. Then he put on his cap and left without a word.',
  },
  {
    id: 'arslan',
    name: 'Mrs Arslan',
    weekdays: [3],
    at: 18 * 60 + 20,
    order: { oven: 2, cold: 1 },
    tab: true,
    owes: 860,
    margin: 'Gül Arslan: her account goes back to the boy’s father. Always flatbread for the grandson.',
    sits: 'Mrs Arslan brought her grandson. He wanted flatbread, “the one with the egg”.',
    pleased:
      'The grandson ate his flatbread with both hands. Mrs Arslan touched the account book on the pass as she left.',
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
    sits: 'The Aksoy sisters took table 3 and argued about Nevin’s filled pastry.',
    pleased: 'The Aksoy sisters left a good tip and a long opinion about the filled pastry.',
    cross: 'The Aksoy sisters left loudly and went to the restaurant on the corner.',
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
    sits: 'Kemal the taxi driver came in and left his engine running. “Two plates of meatballs, Chef. I have a passenger waiting.”',
    pleased:
      'Kemal ate standing up and paid. He told me all the drivers from his taxi stand would come on Saturday.',
    cross: 'Kemal’s car horn sounded twice outside, and then he was gone.',
  },
  {
    id: 'ilyas',
    name: 'Ilyas',
    weekdays: [3, 5],
    at: 21 * 60 + 10,
    order: { grill: 1, cold: 1 },
    tab: true,
    owes: 540,
    margin: 'Ilyas works nights at the depot. He paid it all back in ’19. He will again.',
    sits: 'Ilyas the night watchman came in for his supper before his shift at the depot.',
    pleased: 'Ilyas said Nevin used to put an extra filled pastry in his bag. Tonight Rafi did.',
    cross: 'Ilyas left for the depot hungry.',
  },
];

export const regularOf = (id: string): Regular | undefined => REGULARS.find((r) => r.id === id);

/** What the chef decided about a tab on the third Sunday. */
export type TabChoice = 'keep' | 'ask' | 'forgive';

// ---------- notebook stamps ----------

export const STAMPS: Record<string, string> = {
  'full-house': 'Every table full, and nobody left hungry',
  'clean-week': 'A week when nobody left hungry',
  critic: 'The food writer smiled',
  'jar-week': 'Rafi kept his rule all week',
  'no-push': 'A week without insisting',
  'bill-1': 'The bank was paid',
  'bill-2': 'The butcher was paid',
  'bill-3': 'The landlord was paid',
  'bill-4': 'All the money we owed was paid',
  friend: 'A regular brought a friend',
  oven: 'Flatbread ready before the rush',
  wedding: 'The wedding trays arrived on time',
  apron: 'Nevin’s apron',
  dark: 'We kept serving food while the gas was off',
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
  /** What the chef did, in the waiting-table journal line. */
  doing: string;
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
    doing: 'let the lamb rest',
    host: 'the food writer',
    weekday: 3,
    at: 19 * 60 + 50,
    order: { grill: 1, cold: 1 },
    grows: 'grill',
    signature: { station: 'grill', words: 'the lamb, properly rested after cooking' },
    critic: true,
    booked:
      'The food writer phoned on Saturday. She is bringing her editor on Thursday, “for the lamb I keep describing to him”.',
    sits: 'The food writer and her editor took the corner table. She took out her notebook before the bread arrived.',
    kept: 'The editor asked who had let the lamb rest so well. The writer just smiled at him.',
    broken: 'The editor ate the lamb and said it was fine. The writer did not write anything down.',
    served: 'The food writer and her editor ate, paid, and talked about something else.',
    walked: 'The food writer and her editor left before the lamb arrived. She looked back at the pass once.',
  },
  {
    id: 'hasan',
    doing: 'let the lamb rest',
    host: 'Mr Hasan',
    regular: 'hasan',
    weekday: 5,
    at: 19 * 60 + 55,
    order: { grill: 1, cold: 1 },
    grows: 'grill',
    signature: { station: 'grill', words: 'the lamb, properly rested after cooking' },
    booked:
      'Mr Hasan stopped at the door after supper. “On Saturday my brother is visiting from İzmir. He ate here when Nevin ran the place. Make the lamb.”',
    sits: 'Mr Hasan came in with his brother. Both wore jackets. The brother looked at the photo of Nevin by the till for a long time.',
    kept: 'Mr Hasan’s brother cut the lamb and was quiet. “It is like hers,” he said.',
    broken: '“It was good,” Mr Hasan said to his brother. He did not quite look at me.',
    served: 'Mr Hasan and his brother ate and talked about İzmir.',
    walked: 'Mr Hasan and his brother put their jackets back on. He did not say anything at the door.',
  },
  {
    id: 'arslan',
    doing: 'gave the flatbread an extra minute in the oven',
    host: 'Mrs Arslan',
    regular: 'arslan',
    weekday: 3,
    at: 18 * 60 + 20,
    order: { oven: 1, cold: 1 },
    grows: 'oven',
    signature: { station: 'oven', words: 'the egg flatbread, with its crust baked a minute longer' },
    booked:
      'Mrs Arslan left a note on the pass. Her grandson turns seven on Thursday. They will come early, before his bedtime. “The flatbread with the egg, the way it used to be.”',
    sits: 'Mrs Arslan brought her grandson and two school friends. They almost managed to sit still.',
    kept: 'The grandson ate the crust first. Mrs Arslan put her hand flat on the account book as she left.',
    broken:
      'The boys ate everything. Mrs Arslan said thank you politely, the way you thank a clerk at the post office.',
    served: 'The boys ate and were loud. Mrs Arslan took the last slice home in a napkin.',
    walked: 'Mrs Arslan took three hungry boys home past the window.',
  },
  {
    id: 'kemal',
    doing: 'dressed the salad',
    host: 'Kemal',
    regular: 'kemal',
    weekday: 4,
    at: 20 * 60 + 10,
    order: { grill: 1, cold: 1 },
    grows: 'grill',
    signature: { station: 'cold', words: 'the shepherd’s salad, carefully dressed' },
    booked:
      'Kemal leaned in from the taxi stand. On Friday he will bring three other drivers, between passengers. “My wife says to order Nevin’s salad. Make the salad properly and they’ll all come back.”',
    sits: 'Kemal and three drivers came in together. They put their keys on the table and left their engines running outside.',
    kept: 'The drivers ate the salad first and argued about the dressing. Kemal paid for all of them.',
    broken: 'Kemal looked at the salad, then at me. “My wife makes it better,” he said, kindly.',
    served: 'The drivers ate fast and left one by one as passengers called.',
    walked: 'A car horn sounded outside, then another. Kemal’s drivers left one by one without eating.',
  },
  {
    id: 'aksoy',
    doing: 'made the yogurt and cucumber dish',
    host: 'the Aksoy sisters',
    regular: 'aksoy',
    weekday: 2,
    at: 19 * 60 + 45,
    order: { cold: 1, oven: 1 },
    grows: 'cold',
    signature: { station: 'cold', words: 'the yogurt and cucumber dish, made Nevin’s way' },
    booked:
      'The Aksoy sisters booked Wednesday for their reading group. “All of us are coming. We will discuss the yogurt and cucumber dish as well as the book.”',
    sits: 'The Aksoy sisters arrived with their reading group and a book nobody had finished.',
    kept: 'The reading group discussed the yogurt and cucumber dish for longer than the book. The elder sister asked for the recipe. I said no.',
    broken: 'The sisters agreed that the yogurt and cucumber dish was not like Nevin’s. They agreed loudly.',
    served: 'The reading group ate and discussed the book, mostly.',
    walked: 'The reading group left for the restaurant on the corner, still talking about the book.',
  },
  {
    id: 'ilyas',
    doing: 'let the meatballs rest',
    host: 'Ilyas',
    regular: 'ilyas',
    weekday: 5,
    at: 20 * 60 + 15,
    order: { grill: 1, cold: 1 },
    grows: 'cold',
    signature: { station: 'grill', words: 'the meatballs, rested before serving' },
    booked:
      'Ilyas booked Saturday, early, before work at the depot. The whole night shift is coming for their foreman, who is retiring. “He ate Nevin’s meatballs for thirty years.”',
    sits: 'Ilyas brought the night-shift workers in their jackets. The foreman wore a tie.',
    kept: 'The foreman ate his meatballs slowly and told a story about Nevin and a broken boiler.',
    broken: 'The foreman said the meatballs were good. Ilyas said nothing on the way out.',
    served: 'The night-shift workers ate and went to the depot together.',
    walked: 'The night-shift workers went to the depot hungry, and the foreman went in his tie.',
  },
  {
    id: 'demir',
    doing: 'gave the flatbread an extra minute in the oven',
    host: 'the Demirs',
    weekday: 4,
    at: 19 * 60 + 40,
    order: { cold: 1, oven: 1, grill: 1 },
    grows: 'oven',
    signature: { station: 'oven', words: 'the cheese flatbread, with its crust baked a minute longer' },
    booked:
      'A young man came to the back door with his fiancée’s mother. They want an engagement supper on Friday. “She says this was the place to go when she was young.”',
    sits: 'The Demirs came in dressed up for photographs. The mother pointed at the table where she used to sit.',
    kept: 'The mother tore off a piece of crust and said “yes” to nobody in particular.',
    broken: 'The mother ate politely and told her daughter that the place had changed.',
    served: 'The Demirs took photographs and ate.',
    walked: 'The Demirs left for a restaurant that takes proper bookings.',
  },
];

export const partyOf = (id: string): Party | undefined => PARTIES.find((p) => p.id === id);

/**
 * The signature station's cook on the Sunday card, by how much they trust the chef (warm above 0.55, cool below
 * 0.42). `{host}` and `{signature}` are filled in. A hire uses the hire pool.
 */
export const PROMISE_WORDS: Record<string, Record<'warm' | 'even' | 'cool', string>> = {
  selim: {
    warm: 'Make the promise to {host}. I’ll keep the grill free for you.',
    even: 'You want to promise {signature}? Then you’ll be the one looking after it, Chef.',
    cool: 'It’s your promise, Chef. Not mine.',
  },
  dilek: {
    warm: 'Go on, make the promise to {host}. I’ll keep the cold side out of your way.',
    even: 'You want to promise {signature}? Fine. Just don’t promise away my break with it.',
    cool: 'You promise things. I do them. We’ll see.',
  },
  rafi: {
    warm: 'I’ll have clean plates ready for {host}. Make the promise.',
    even: 'Is that a lot of plates? It sounds like a lot of plates.',
    cool: 'Okay. I’ll go along with whatever you promise.',
  },
  hire: {
    warm: 'I can keep my station ready for {host}. Make the promise.',
    even: 'Your name is on that promise, Chef.',
    cool: 'I didn’t promise anybody anything.',
  },
};

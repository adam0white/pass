/**
 * The game's own words: what a cook says about you after close, the captions at the pass the host composes when
 * HF gives no sentence (the crew rule, a granted request), and the Sunday lines. HF supplies the cooks' answers,
 * reviews and chronicle; these lines are chosen from what actually happened tonight (who refused what, at what
 * time, who was pushed), never at random, and a line is not repeated for the same cook.
 */
import { hashUnit } from './rng.ts';

export const VERB_WORD: Record<string, string> = {
  grill: 'the grill',
  cold: 'the cold side',
  dish: 'the plates',
  oven: 'the oven',
  break: 'a break',
  eat: 'eating',
  home: 'going home',
};

export interface NightEvent {
  at: number;
  verb: string;
  verdict: string;
  insisted: boolean;
  /** The crew rule kept them on the line. */
  crewRule?: boolean;
}

type Pools = Record<string, string[]>;

const COMPLIED: Pools = {
  selim: [
    'You had me on {verb} at {time}. Nevin never did.',
    '{time}. You pushed and I did it. I’m writing that down.',
    'I did your {verb}. Don’t make it a habit.',
    'At {time} I said not now and you didn’t hear me.',
  ],
  dilek: [
    '{time}, {verb}. I did it. I wasn’t happy.',
    'You leaned on me tonight. I can feel it in my back.',
    'Push me like that on a Saturday and see.',
    'At {time} you made me. I’m still thinking about it.',
  ],
  rafi: [
    'You made me do {verb} at {time}. Okay. Okay.',
    'I did it because you said. Not because it was right.',
    'At {time} you didn’t even look at me. Just “do it”.',
  ],
  hire: [
    'At {time} you didn’t listen. I did it anyway.',
    'You pushed me on {verb}. I’ll remember the kitchen I’m in.',
    'Is it always like this here? Shouting at {time}?',
  ],
};

const COMPLIED_MANY: Pools = {
  selim: [
    'You made me do it {n} times tonight. I counted.',
    '{n} times. Nevin asked me twice in twenty years.',
  ],
  dilek: [
    '{n} times you made me tonight. Count them yourself.',
    'I lost count after {n}. That’s not a kitchen.',
  ],
  rafi: ['{n} times, Chef. I’m not a dog.', 'You made me {n} times. My hands are shaking.'],
  hire: [
    '{n} times in one night. I didn’t come here for that.',
    '{n} times. Where I worked before, the chef said it once.',
  ],
};

const LET_BE: Pools = {
  selim: [
    'I said no at {time}. You let it be. Good.',
    'You asked me for {verb} and took my no. That’s how Nevin ran it.',
    'You let me say no tonight. I noticed.',
  ],
  dilek: [
    'You took my no at {time}. I’ll take your yes another night.',
    'I said not now and you let me. Thank you, I suppose.',
  ],
  rafi: ['I said no and you didn’t shout. Huh.', 'You asked about {verb} and let it go. Nobody does that.'],
  hire: [
    'You took no for an answer at {time}. I can work with that.',
    'I said not now. You didn’t push. Good.',
  ],
};

const CREW_RULE: Pools = {
  selim: [
    'Somebody has to be on the line. Tonight it was me.',
    'The line is never empty in this kitchen. Not on my watch.',
  ],
  dilek: ['Somebody has to mind the line. Remember that when they’re all out back.'],
  rafi: ['I wanted a break, but there was nobody else on. Is that the rule?'],
  hire: ['I stayed on because nobody else was in. Next time, ask them.'],
};

const COUNTER: Pools = {
  selim: ['You took my word on {verb}. Thank you.', 'I said I’d rather, and you let me. That’s respect.'],
  dilek: ['You let me pick. More of that, please.'],
  rafi: ['You let me do the plates when I said. That helped.'],
  hire: ['You let me choose. I liked that.'],
};

const SILENT: Pools = {
  selim: [
    'You left me to it. Nevin did that too.',
    'You stood at the pass all night and let me cook. Fine.',
    'Quiet from you tonight. The grill doesn’t need talking to.',
  ],
  dilek: [
    'You never once asked me anything. Do you even know my station?',
    'Quiet night from you. I liked it, mostly.',
    'Not a word from you all night. Were you counting the till?',
  ],
  rafi: [
    'Nobody told me anything all night. I just washed.',
    'You didn’t look at me once, Chef.',
    'Quiet. I kind of liked it.',
  ],
  hire: [
    'You let me find my own way tonight. Thanks for that, I think.',
    'Nobody told me where anything is.',
  ],
};

const WARMER: Pools = {
  selim: [
    'You asked, and you listened. That’s new.',
    'Better tonight. I mean it.',
    'You’re learning the kitchen. Slowly.',
  ],
  dilek: [
    'You asked, and you listened. That’s new.',
    'Tonight felt like a kitchen again.',
    'You’re all right, you know.',
  ],
  rafi: [
    'You asked, and you listened. That’s new.',
    'Tonight was good, Chef. Really.',
    'I think I’m getting it.',
  ],
  hire: ['You asked, and you listened. I like this place.', 'Good night. I’ll be back tomorrow.'],
};

const PLAIN: Pools = {
  selim: [
    'A long night. You were there for it.',
    'Nevin used to call it the same way. Almost.',
    'The lamb was good tonight. Tell Ahmet.',
    'My knees, Chef. My knees.',
    'Twenty years on that grill. It still surprises me.',
    'Go home, Chef. You look worse than me.',
  ],
  dilek: [
    'You called it right tonight. Don’t let it go to your head.',
    'My feet are gone. Good service, though.',
    'I need a cigarette and a bath, in that order.',
    'Mum asked if you’re married. I said I don’t know.',
    'The cold side was clean all night. Did you see?',
    'Same again tomorrow. God help us.',
  ],
  rafi: [
    'Is it always like this? Don’t answer.',
    'I kept up tonight. Did you see?',
    'My hands are prunes, Chef.',
    'Can I take some börek home? For my sister.',
    'I didn’t break anything. Well. One.',
    'Selim smiled at me tonight. I think.',
  ],
  hire: [
    'Long night. Good kitchen, though.',
    'I’m starting to know where things are.',
    'Same time tomorrow?',
    'Selim doesn’t say much, does he.',
  ],
};

export const REQUEST_LINES: Record<
  string,
  { ask: string; yes: string; no: string; eveYes: string; eveNo: string }
> = {
  mother: {
    ask: 'That was my neighbour. Mum’s had a fall. Chef, can I go?',
    yes: 'Thank you. Thank you, Chef.',
    no: 'Till nine. Then I go, whatever you say.',
    eveYes: 'You let me go to her. I won’t forget it.',
    eveNo: 'I stayed. Don’t ask me that again.',
  },
  advance: {
    ask: 'Chef… can I have fifty of Saturday’s money now? My sister’s school trip.',
    yes: 'Thanks, Chef. I’ll make it up.',
    no: 'Okay. Sorry I asked.',
    eveYes: 'My sister’s going on the trip. Because of you.',
    eveNo: 'It’s fine about the money. It’s fine.',
  },
  phone: {
    ask: 'Five minutes, Chef. I need to ring my mother. She’s not answering.',
    yes: 'Five minutes. Thank you.',
    no: 'Fine. After close, then.',
    eveYes: 'She was fine. She’d fallen asleep with the television on. Thank you for the five minutes.',
    eveNo: 'She was fine, as it turns out. You didn’t know that at seven, though.',
  },
  'leave-early': {
    ask: '',
    yes: 'Thank you, Chef. I’ll be in early tomorrow.',
    no: 'Right. Right.',
    eveYes: 'Thank you for tonight. I owe you one.',
    eveNo: 'You said no. I heard you.',
  },
  'eat-first': {
    ask: '',
    yes: 'Thank you, Chef. Two minutes.',
    no: 'Okay. Okay. After.',
    eveYes: 'You fed me first. My mother will hear about that.',
    eveNo: 'I was so hungry I dropped a plate. Sorry.',
  },
  'my-way': {
    ask: '',
    yes: 'Good. Now nobody touch it.',
    no: 'Your kitchen. Your oven.',
    eveYes: 'Did you see that pide? That was my way.',
    eveNo: 'You wouldn’t let me run the oven. So I ran it your way. Badly.',
  },
};

/** What a cook says about you tonight: the most telling thing that happened, in their words. */
export function aboutYou(input: {
  seed: number;
  night: number;
  id: string;
  founder: boolean;
  events: NightEvent[];
  asked: number;
  trustDelta: number;
  used: Set<string>;
  clock: (m: number) => string;
}): string {
  const who = input.founder ? input.id : 'hire';
  const fill = (t: string, e?: NightEvent, n?: number) =>
    t
      .replace('{verb}', e ? (VERB_WORD[e.verb] ?? e.verb) : '')
      .replace('{time}', e ? input.clock(e.at) : '')
      .replace('{n}', String(n ?? 0));
  const choose = (pools: Pools, e?: NightEvent, n?: number): string | null => {
    const list = pools[who] ?? pools.hire ?? [];
    if (list.length === 0) return null;
    const start = Math.floor(hashUnit(input.seed, 31, input.night, input.id.length) * list.length);
    for (let i = 0; i < list.length; i++) {
      const t = list[(start + i) % list.length] as string;
      const key = `${input.id}:${t}`;
      if (input.used.has(key)) continue;
      input.used.add(key);
      return fill(t, e, n);
    }
    // Every line used: say the first one again rather than nothing.
    return fill(list[start % list.length] as string, e, n);
  };
  const complied = input.events.filter((e) => e.verdict === 'complied');
  if (complied.length >= 2) return choose(COMPLIED_MANY, complied[0], complied.length) ?? '';
  if (complied.length === 1) return choose(COMPLIED, complied[0]) ?? '';
  const crew = input.events.find((e) => e.crewRule);
  if (crew) return choose(CREW_RULE, crew) ?? '';
  const counter = input.events.find((e) => e.verdict === 'countered');
  if (counter) return choose(COUNTER, counter) ?? '';
  const letBe = input.events.find(
    (e) => e.verdict === 'refused' || e.verdict === 'deferred' || e.verdict === 'modified',
  );
  if (letBe && input.trustDelta >= -0.01) return choose(LET_BE, letBe) ?? '';
  if (input.asked === 0) return choose(SILENT) ?? '';
  if (input.trustDelta > 0.012) return choose(WARMER) ?? '';
  return choose(PLAIN) ?? '';
}

/** A Sunday line from HF's chronicle change, in the cook's own kitchen words. */
export function changeLine(name: string, kind: string, subject: string): string | null {
  const action = subject.startsWith('action:') ? subject.slice(7) : subject;
  const doing: Record<string, string> = {
    grill: 'goes to the grill',
    cold: 'takes the cold side',
    dish: 'washes up',
    oven: 'minds the oven',
  };
  const began: Record<string, string> = {
    grill: 'has started taking the grill',
    cold: 'has started covering the cold side',
    dish: 'washes plates now, which he or she never used to',
    oven: 'has started minding the oven',
  };
  if (kind === 'unprompted' && doing[action]) return `${name} ${doing[action]} without being told now.`;
  if (kind === 'started' && began[action]) return `${name} ${began[action]}.`;
  if (kind === 'stopped' && doing[action])
    return `${name} hardly ${doing[action].replace(/^goes/, 'goes')} any more.`;
  if (kind === 'mood') return null;
  if (kind === 'trust') return null;
  return null;
}

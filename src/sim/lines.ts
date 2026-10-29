/**
 * The game's own words: what a cook says about you after close, the captions at the pass the host composes when
 * HF gives no sentence (the crew rule, a granted request), and the Sunday lines. HF supplies the cooks' answers,
 * reviews and chronicle; these lines are chosen from what actually happened tonight (who refused what, at what
 * time, who was pushed), never at random, and a line is not repeated for the same cook.
 */
import type { Activity, Person, SuggestionResolution } from '@adam0white/human-framework-legacy';
import { isHF4 } from './hf4-person.ts';
import { hashUnit } from './rng.ts';

export const VERB_WORD: Record<string, string> = {
  grill: 'the grill',
  cold: 'the cold side',
  dish: 'the dishes',
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
    'At {time} you chose {verb} for me, and I did it. Nevin never did that.',
    'At {time} you pushed me, and I did it. I’m writing that down.',
    'I did what you asked about {verb}. Don’t make it a habit.',
    'At {time} you didn’t ask me. You told me.',
  ],
  dilek: [
    'At {time} you chose {verb} for me. I did it, but I wasn’t happy.',
    'You pushed me hard tonight. I can feel it in my back.',
    'Push me like that on a Saturday and see what happens.',
    'At {time} you made me do it. I’m still thinking about it.',
  ],
  rafi: [
    'At {time} you picked {verb} for me, so I did it. Okay. Okay.',
    'I did it because you said so, not because it was right.',
    'At {time} you didn’t even look at me. You just said, “Do it.”',
  ],
  hire: [
    'At {time} you didn’t listen to me. I did it anyway.',
    'You pushed me about {verb}. I’ll remember what kind of kitchen this is.',
    'Is it always like this here? Shouting at me at {time}?',
  ],
};

const COMPLIED_MANY: Pools = {
  selim: [
    'You made me do it {n} times tonight. I counted.',
    'That was {n} times. Nevin asked me twice in twenty years.',
    'All night you gave me orders. I’m too old to take orders like that.',
  ],
  dilek: [
    'Tonight you made me do it {n} times. Count them yourself.',
    'I lost count after {n}. That’s not how a kitchen works.',
    'You don’t ask any more. You just give orders.',
  ],
  rafi: [
    'That was {n} times, Chef. I’m not a dog.',
    'You made me do it {n} times. My hands are shaking.',
    'You kept telling me what to do tonight. I kept doing it. I don’t know why.',
  ],
  hire: [
    'You made me do it {n} times in one night. I didn’t come here for that.',
    'That was {n} times. Where I worked before, the chef said things once.',
  ],
};

const LET_BE: Pools = {
  selim: [
    'I said no at {time}, and you accepted it. Good.',
    'You asked me about {verb} and accepted my no. That’s how Nevin ran the kitchen.',
    'You let me say no tonight. I noticed.',
  ],
  dilek: [
    'You accepted my no tonight. Another night, I’ll say yes to you.',
    'I said “not now”, and you let it go. Thank you, I suppose.',
  ],
  rafi: [
    'I said no and you didn’t shout. Huh.',
    'You asked me about {verb}, and you let it go when I said no. Nobody does that.',
  ],
  hire: [
    'You accepted my no tonight. I can work with that.',
    'I said “not now”, and you didn’t push me. Good.',
  ],
};

const CREW_RULE: Pools = {
  selim: [
    'Somebody has to stay at the stations. Tonight it was me.',
    'This kitchen is never left without a cook. Not while I’m here.',
  ],
  dilek: ['Somebody has to keep cooking. Remember that when everyone else is out the back.'],
  rafi: ['I wanted a break, but nobody else was working. Is that the rule?'],
  hire: ['I kept working because nobody else was there. Next time, ask the others.'],
};

const COUNTER: Pools = {
  selim: [
    'You listened to me about {verb}. Thank you.',
    'I said what I’d rather do, and you let me. That’s respect.',
  ],
  dilek: ['You let me choose. More of that, please.'],
  rafi: ['You let me do the dishes when I asked. That helped.'],
  hire: ['You let me choose. I liked that.'],
};

const SILENT: Pools = {
  selim: [
    'You left me to do my work. Nevin did that too.',
    'You stood at the pass all night and let me cook. Fine.',
    'You were quiet tonight. The grill doesn’t need anyone talking to it.',
  ],
  dilek: [
    'You never once asked me anything. Do you even know my station?',
    'You were quiet tonight. I liked it, mostly.',
    'You didn’t say a word all night. Were you counting the money in the till?',
  ],
  rafi: [
    'Nobody told me anything all night. I just washed the dishes.',
    'You didn’t look at me once, Chef.',
    'You were quiet tonight. I kind of liked it.',
  ],
  hire: [
    'You let me find my own way tonight. Thanks for that, I think.',
    'Nobody told me where anything is.',
  ],
};

const WARMER: Pools = {
  selim: [
    'You asked, and you listened. That’s new.',
    'You were better tonight. I mean it.',
    'You’re learning how this kitchen works. Slowly.',
  ],
  dilek: [
    'You asked, and you listened. That’s new.',
    'Tonight felt like a real kitchen again.',
    'You’re all right, you know.',
  ],
  rafi: [
    'You asked, and you listened. That’s new.',
    'Tonight was good, Chef. Really.',
    'I think I’m getting it.',
  ],
  hire: ['You asked, and you listened. I like this place.', 'It was a good night. I’ll be back tomorrow.'],
};

const PLAIN: Pools = {
  selim: [
    'It was a long night. You were there for all of it.',
    'Nevin used to run the pass the same way you did. Almost.',
    'The lamb was good tonight. Tell Ahmet.',
    'My knees hurt, Chef. My knees.',
    'I’ve worked that grill for twenty years. It still surprises me.',
    'Go home, Chef. You look worse than me.',
    'The meatballs went out right tonight. All of them.',
    'I’ll be in at four. Somebody has to start the stock.',
    'Nevin would have liked a full room. She liked noise.',
    'Everyone worked calmly tonight. Good.',
  ],
  dilek: [
    'You made the right calls tonight. Don’t let it go to your head.',
    'My feet hurt so much. It was a good service, though.',
    'I need a cigarette and a bath, in that order.',
    'Mum asked if you’re married. I said I don’t know.',
    'The cold side was clean all night. Did you see?',
    'We do it all again tomorrow. God help us.',
    'Rafi is getting faster. Don’t tell him I said so.',
    'I burned my wrist on a tray. It’s nothing.',
    'Nevin’s recipe for filled pastry is in my head, not on paper. Remember that.',
    'Now the bus home, then bed, then I do it all again.',
  ],
  rafi: [
    'Is it always like this? Don’t answer.',
    'I kept up tonight. Did you see?',
    'My hands are all wrinkled from the water, Chef.',
    'I took some filled pastry home for my sister. Selim said it was fine.',
    'I didn’t break anything. Well, only one plate.',
    'Selim smiled at me tonight, I think.',
    'I found Nevin’s old scrubbing brush. It’s better than mine.',
    'Dilek showed me how she chops the parsley. So fast.',
    'My sister says the kitchen smell follows me home.',
    'I counted the plates. They’re all there.',
  ],
  hire: [
    'It was a long night. It’s a good kitchen, though.',
    'I’m starting to know where things are.',
    'Do I come in at the same time tomorrow?',
    'Selim doesn’t say much, does he?',
  ],
};

export const REQUEST_LINES: Record<
  string,
  { ask: string; yes: string; no: string; eveYes: string; eveNo: string }
> = {
  mother: {
    ask: 'That was my neighbour on the phone. Mum has had a fall. Chef, can I go?',
    yes: 'Thank you. Thank you, Chef.',
    no: 'I’ll stay until nine. Then I go, whatever you say.',
    eveYes: 'You let me go to her. I won’t forget it.',
    eveNo: 'I stayed. Don’t ask me that again.',
  },
  advance: {
    ask: 'Chef… can I have ₺50 of Saturday’s pay now? It’s for my sister’s school trip.',
    yes: 'Thanks, Chef. I’ll make it up to you.',
    no: 'Okay. Sorry I asked.',
    eveYes: 'My sister’s going on the trip. Because of you.',
    eveNo: 'It’s fine about the money. It’s fine.',
  },
  phone: {
    ask: 'Can I have five minutes, Chef? I need to call my mother. She’s not answering.',
    yes: 'Just five minutes. Thank you.',
    no: 'Fine. I’ll call after closing time, then.',
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
    yes: 'Thank you, Chef. I’ll only need two minutes.',
    no: 'Okay. Okay. I’ll eat after.',
    eveYes: 'You fed me first. My mother will hear about that.',
    eveNo: 'I was so hungry I dropped a plate. Sorry.',
  },
  'my-way': {
    ask: '',
    yes: 'Good. Now nobody touch it.',
    no: 'It’s your kitchen, and your oven.',
    eveYes: 'Did you see that flatbread? That was my way.',
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
  /** Stations they worked tonight: a no is not remembered as "let be" if they did the job anyway. */
  worked?: readonly string[];
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
    // Every line used: start the pool over for this cook, so lines come round in turn rather than one repeating.
    for (const t of list) input.used.delete(`${input.id}:${t}`);
    const t = list[start % list.length] as string;
    input.used.add(`${input.id}:${t}`);
    return fill(t, e, n);
  };
  const complied = input.events.filter((e) => e.verdict === 'complied');
  if (complied.length >= 2) return choose(COMPLIED_MANY, complied[0], complied.length) ?? '';
  if (complied.length === 1) return choose(COMPLIED, complied[0]) ?? '';
  const crew = input.events.find((e) => e.crewRule);
  if (crew) return choose(CREW_RULE, crew) ?? '';
  const counter = input.events.find((e) => e.verdict === 'countered');
  if (counter) return choose(COUNTER, counter) ?? '';
  // A no the chef let stand: not insisted on, not followed by a yes to the same job, and the job not done anyway.
  const letBe = input.events.find(
    (e, i) =>
      (e.verdict === 'refused' || e.verdict === 'deferred') &&
      !e.insisted &&
      !input.events.slice(i + 1).some((x) => x.verb === e.verb) &&
      !(input.worked ?? []).includes(e.verb),
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
    cold: 'works at the cold side',
    dish: 'washes the dishes',
    oven: 'looks after the oven',
  };
  const began: Record<string, string> = {
    grill: 'has started working at the grill',
    cold: 'has started working at the cold side',
    dish: 'has started washing the dishes',
    oven: 'has started looking after the oven',
  };
  if (kind === 'unprompted' && doing[action]) return `${name} now ${doing[action]} without being told.`;
  if (kind === 'started' && began[action]) return `${name} ${began[action]}.`;
  if (kind === 'stopped' && doing[action])
    return `${name} hardly ${doing[action].replace(/^goes/, 'goes')} any more.`;
  if (kind === 'mood') return null;
  if (kind === 'trust') return null;
  return null;
}

/**
 * A lapse the cook names after close (HF muhasaba names it; the game says it in the cook's words). Only commitments
 * the cook would talk about are named; a lapse the chef caused (sent home, let go early) is released before it counts.
 */
const LAPSE: Record<string, Record<string, string>> = {
  maghrib: { selim: 'I missed the sunset prayer tonight. Tomorrow I’ll step away before the rush.' },
  'my rule about the jar': {
    rafi: 'I didn’t keep my rule about the tip jar. Next time I’ll be ready when it comes.',
  },
  'my rule about the plates': {
    selim: 'I washed the dishes in the rush. For twenty years I never did that.',
  },
  'my rule about smoking': { dilek: 'I smoked in the rush. I said I wouldn’t, and I did.' },
  'going to my mother': { dilek: 'I should have gone to my mother. I stayed.' },
  'my shift': {
    selim: 'I walked out before closing time. I don’t do that.',
    dilek: 'I left before the end. I’ll make it up.',
    rafi: 'I left before closing time. Sorry, Chef.',
  },
};

export function lapseLine(id: string, missed: readonly string[]): string {
  for (const m of missed) {
    const l = LAPSE[m]?.[id];
    if (l) return l;
  }
  return '';
}

/** What a watcher sees when last night's resolve weighs in a choice, by the resolve's key. */
export function resolveSeen(name: string, key: string): string | null {
  if (key === 'maghrib') return `${name} went for the sunset prayer before the rush, as he said he would.`;
  if (key === 'my rule about the jar') return `${name} turned away from the tip jar, as he said he would.`;
  if (key === 'my rule about smoking')
    return `${name} left her cigarettes in her coat, as she said she would.`;
  if (key === 'my rule about the plates')
    return `${name} left the dishes to someone else, as he said he would.`;
  if (key === 'my shift') return `${name} stayed at work instead of leaving, as they said they would.`;
  return null;
}

/** pass@10: translate HF's deciding source once for captions, board replies and job buttons.
 * No score, source id or unrecognised commitment label is player-facing.
 */
export function suggestionWords(
  p: Person,
  r: SuggestionResolution,
  verb: string,
  activity: Activity | null = p.activity,
): { text: string; short: string } | null {
  if (isHF4(p)) return { text: r.says, short: r.says };
  if (r.verdict === 'refused' && r.reason === 'rule:my rule about the plates' && p.id === 'selim')
    return {
      text: 'I have worked on Nevin’s grill for twenty years. I don’t wash the dishes in the rush.',
      short: 'no',
    };
  if (r.verdict !== 'deferred' && r.verdict !== 'modified') return null;
  const neutral = { text: 'Not now, Chef.', short: 'not now' };
  const why = r.decidedBy;
  if (!why) return neutral;
  if (why.kind === 'inertia') {
    const job = VERB_WORD[verb] ?? 'that job';
    switch (activity?.affordanceId) {
      case 'eat':
        return { text: `Stop eating for ${job}? Let me finish my meal first.`, short: 'let me eat first' };
      case 'smoke':
        return {
          text: `Put out my cigarette for ${job}? Let me finish it first.`,
          short: 'let me finish my cigarette',
        };
      case 'phone':
        return { text: `End my call for ${job}? Give me one minute.`, short: 'let me finish my call' };
      case 'break':
        return {
          text: `End my break for ${job}? Let me finish my ten-minute break.`,
          short: 'let me finish my break',
        };
      case 'pray':
        return { text: 'Let me finish my prayer, Chef.', short: 'after I pray' };
      default:
        return { text: 'Let me finish what I’m doing first, Chef.', short: 'let me finish this' };
    }
  }
  const source = why.source;
  if (source === 'forecast:body')
    return {
      text: 'That job would leave me too tired for the rest of the service, Chef.',
      short: 'I’d be too tired later',
    };
  if (source === 'effort')
    return { text: 'I’d rather take the lighter job, Chef.', short: 'I prefer the lighter job' };
  if (source === 'material') {
    if (!isHF4(p)) return { text: 'I’d rather keep doing paid work, Chef.', short: 'I prefer paid work' };
    if (verb === 'eat') return { text: 'I’ll eat after this job, Chef.', short: 'after this job' };
    if (verb === 'break')
      return { text: 'Let me finish this job first, Chef.', short: 'let me finish this job' };
    if (verb === 'home')
      return { text: 'I’ll stay and finish the service, Chef.', short: 'I’ll stay for the service' };
    return { text: 'I’d rather stay on this job, Chef.', short: 'let me stay on this job' };
  }
  if (source === 'habit')
    return { text: 'I’d rather keep doing what I’m doing, Chef.', short: 'I prefer my current job' };
  if (source?.startsWith('abstain:') || source?.startsWith('commitment:')) {
    const id = source.slice(source.indexOf(':') + 1);
    const label = p.agenda.commitments.find((c) => c.id === id)?.label;
    const rules: Record<string, { text: string; short: string }> = {
      'my rule about the plates': {
        text: 'I said I wouldn’t wash the dishes in the rush, Chef.',
        short: 'I won’t wash dishes now',
      },
      'my rule about smoking': {
        text: 'I said I wouldn’t smoke in the rush, Chef.',
        short: 'I said I wouldn’t smoke',
      },
      'my rule about the jar': {
        text: 'I said I’d leave the tip jar alone, Chef.',
        short: 'I’ll leave the tip jar alone',
      },
      'my shift': { text: 'I said I’d stay until the service is done, Chef.', short: 'I said I’d stay' },
      'being home for my boys': {
        text: 'I promised my boys I’d be home, Chef.',
        short: 'my boys are waiting',
      },
      'going to my mother': { text: 'I have to get to my mother, Chef.', short: 'my mother needs me' },
      'going at nine': { text: 'You said I could go at nine, Chef.', short: 'we agreed on nine' },
      maghrib: { text: 'Let me pray first, Chef.', short: 'after I pray' },
    };
    return (label && rules[label]) || neutral;
  }
  // Selim's prayer stays a quiet part of his evening: one plain line, no more.
  if (source === 'norm:salah') return { text: 'Let me pray first, Chef.', short: 'after I pray' };
  if (source === 'norm:theft') return { text: 'I won’t take what isn’t mine, Chef.', short: 'it isn’t mine' };
  const needs: Record<string, { text: string; short: string }> = {
    'need:food': { text: 'I need to eat first, Chef.', short: 'I’m hungry' },
    'need:water': { text: 'I need a drink first, Chef.', short: 'I need a drink' },
    'need:rest': { text: 'I need to sit down first, Chef.', short: 'I need to sit down' },
    'need:sleep': { text: 'I’m too tired for that now, Chef.', short: 'I’m tired' },
    'need:leisure': { text: 'I need a little time to myself, Chef.', short: 'I need a minute to myself' },
    'need:relief': { text: 'Let me catch my breath first, Chef.', short: 'let me catch my breath' },
    'need:meaning': {
      text: 'There’s work waiting here, Chef. I’d rather see to it.',
      short: 'there’s work waiting here',
    },
    'need:competence': { text: 'I’d rather do the work I know well, Chef.', short: 'I prefer work I know' },
    'need:esteem': {
      text: 'I know my station, Chef. I’d rather stay with it.',
      short: 'I prefer my own station',
    },
    'need:belonging': {
      text: 'I’d rather stay here with the crew, Chef.',
      short: 'I prefer to stay with the crew',
    },
  };
  return (source && needs[source]) || neutral;
}

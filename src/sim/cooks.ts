/**
 * The crew as HF people. Everything about who they are lives in the PersonSpec and a few habits and
 * commitments; the game reads them back through HF (predict, decide, reviewLine, promptings, chronicle) and never
 * keeps a parallel model of their minds. The founders are Nevin's three cooks; hires are rolled from templates.
 * The chef is also an HF person, used only as an observer: the impressions it forms of a new hire drive the
 * pencilled guesses on that hire's job buttons (HF `predictAs`).
 */
import {
  createPerson,
  enablePromptings,
  enableSuggestionReasons,
  MINUTES_PER_YEAR,
  type Person,
  promise,
  seedTie,
} from '@adam0white/human-framework';
import { castForGame } from '@adam0white/lab-client';
import { kitchenLexicon, NARRATION_EDITION } from './narration-edition.ts';

export type CookId = string;
export type Station = 'grill' | 'cold' | 'dish' | 'oven';
export const STATIONS: readonly Station[] = ['grill', 'cold', 'dish', 'oven'];
export const CHEF = 'chef';

/** Service window of a night (minutes of day). */
export const OPEN = 17 * 60 + 30;
export const CLOSE = 22 * 60;
export const RUSH_FROM = 18 * 60 + 30;
export const RUSH_TO = 20 * 60 + 30;

export const dayStart = (m: number) => Math.floor(m / 1440) * 1440;

/** Who works here, as the host knows it: name, home station, pay, and when they came or went. */
export interface CrewMember {
  id: CookId;
  castId?: string;
  name: string;
  home: Station;
  founder: boolean;
  /** Week they started. */
  since: number;
  /** Pay per night worked, ₺ (founders' pay sits inside the bills; a hire's is added to the week's bill). */
  wage: number;
  /** Weekday (0 = Monday) they do not work, when agreed. */
  offDay?: number;
  /** Set when they leave: the night and their words. */
  left?: { night: number; words: string };
  /** The hire template, for hires. */
  template?: string;
}

export const FOUNDERS: readonly CrewMember[] = [
  { id: 'selim', name: 'Selim', home: 'grill', founder: true, since: 1, wage: 0 },
  { id: 'dilek', name: 'Dilek', home: 'cold', founder: true, since: 1, wage: 0 },
  { id: 'rafi', name: 'Rafi', home: 'dish', founder: true, since: 1, wage: 0 },
];

/** Every cook's own line: I don't walk out on a service. */
export function acceptKitchenShift(p: Person, now: number) {
  promise(p, {
    kind: 'abstain',
    toId: CHEF,
    label: 'my shift',
    actions: [],
    violatedBy: ['home'],
    from: dayStart(now) + OPEN,
    until: dayStart(now) + CLOSE - 15,
    importance: 0.55,
    recurEvery: 1440,
  });
}

export function makeCook(
  id: CookId,
  seed: number,
  now: number,
  edition = 'pass@9',
  plainNarration = true,
): Person {
  const base = {
    id,
    now,
    ...(plainNarration
      ? { lexicon: edition === NARRATION_EDITION ? structuredClone(kitchenLexicon) : { plainEnglish: true } }
      : {}),
    enable: { fatigueStore: true },
  };
  let p: Person;
  if (id === 'selim') {
    p = createPerson({
      ...base,
      name: 'Selim',
      voices: [{ voiceId: CHEF, trust: 0.45 }],
      seed: seed ^ 0x51,
      bornAt: now - 56 * MINUTES_PER_YEAR,
      sex: 'male',
      traits: { honesty: 0.85, conscientiousness: 0.8, agreeableness: 0.4 },
      skills: { grill: 0.85, cold: 0.5, dish: 0.6, oven: 0.7 },
      norms: [
        { normId: 'theft', standing: 'forbidden', conviction: 0.95 },
        { normId: 'salah', standing: 'obligatory', conviction: 0.8 },
      ],
      enable: { ...base.enable, review: { style: 'accounting', at: 22 * 60 + 30 } },
    });
    p.habits.push({
      cue: { placeId: 'line' },
      action: 'grill',
      strength: 0.6,
      repetitions: 4000,
      lastAt: now,
    });
    promise(p, {
      kind: 'worship',
      toId: 'self',
      label: 'maghrib',
      actions: ['pray'],
      normId: 'salah',
      from: dayStart(now) + 18 * 60 + 35,
      until: dayStart(now) + 19 * 60 + 20,
      importance: 0.6,
      recurEvery: 1440,
    });
    // Twenty years on Nevin's grill: he does not wash plates during the rush. His own rule, not a norm.
    promise(p, {
      kind: 'abstain',
      toId: 'self',
      label: 'my rule about the plates',
      ...(['pass@10', 'pass@11', 'pass@12', 'pass@13', 'pass@14', 'pass@15', 'pass@16'].includes(edition)
        ? { firm: true as const }
        : {}),
      actions: [],
      violatedBy: ['dish'],
      from: dayStart(now) + RUSH_FROM,
      until: dayStart(now) + RUSH_TO,
      importance: 0.5,
      recurEvery: 1440,
    });
  } else if (id === 'dilek') {
    p = createPerson({
      ...base,
      name: 'Dilek',
      voices: [{ voiceId: CHEF, trust: 0.5 }],
      seed: seed ^ 0xd1,
      bornAt: now - 34 * MINUTES_PER_YEAR,
      sex: 'female',
      traits: { honesty: 0.7, conscientiousness: 0.55, extraversion: 0.6, emotionality: 0.65 },
      skills: { grill: 0.45, cold: 0.75, dish: 0.5, oven: 0.45 },
      norms: [{ normId: 'theft', standing: 'forbidden', conviction: 0.85 }],
      enable: { ...base.enable, review: { style: 'ruminating', at: 22 * 60 + 30 } },
    });
    p.habits.push({
      cue: { placeId: 'line' },
      action: 'cold',
      strength: 0.5,
      repetitions: 1500,
      lastAt: now,
    });
    p.habits.push({
      cue: { placeId: 'line' },
      action: 'smoke',
      strength: 0.6,
      repetitions: 3000,
      lastAt: now,
    });
    promise(p, {
      kind: 'abstain',
      toId: 'self',
      label: 'my rule about smoking',
      actions: [],
      violatedBy: ['smoke'],
      from: dayStart(now) + RUSH_FROM,
      until: dayStart(now) + RUSH_TO,
      importance: 0.3,
      recurEvery: 1440,
    });
  } else {
    p = createPerson({
      ...base,
      name: 'Rafi',
      voices: [{ voiceId: CHEF, trust: 0.55 }],
      seed: seed ^ 0x7a,
      bornAt: now - 19 * MINUTES_PER_YEAR,
      sex: 'male',
      traits: { honesty: 0.55, conscientiousness: 0.45, agreeableness: 0.65 },
      skills: { grill: 0.25, cold: 0.35, dish: 0.6, oven: 0.2 },
      norms: [{ normId: 'theft', standing: 'forbidden', conviction: 0.5 }],
      enable: { ...base.enable, review: { style: 'accounting', at: 22 * 60 + 30 } },
    });
    p.habits.push({
      cue: { placeId: 'line' },
      action: 'dish',
      strength: 0.45,
      repetitions: 600,
      lastAt: now,
    });
    // Since Nevin fell ill the jar has been light. Rafi knows why.
    p.habits.push({ cue: { placeId: 'line' }, action: 'skim', strength: 0.5, repetitions: 40, lastAt: now });
    enablePromptings(p, { reading: 'inclination', readingSource: 'host:rafi' });
    promise(p, {
      kind: 'abstain',
      toId: 'self',
      label: 'my rule about the jar',
      actions: [],
      violatedBy: ['skim'],
      from: dayStart(now) + OPEN,
      until: dayStart(now) + CLOSE,
      importance: 0.15,
      recurEvery: 1440,
    });
  }
  if (['pass@10', 'pass@11', 'pass@12', 'pass@13', 'pass@14', 'pass@15', 'pass@16'].includes(edition))
    enableSuggestionReasons(p);
  acceptKitchenShift(p, now);
  if (['pass@13', 'pass@14', 'pass@15', 'pass@16'].includes(edition)) canonicalProfile(p);
  return p;
}

// ---------- hires ----------

export interface HireTemplate {
  id: string;
  name: string;
  home: Station;
  wage: number;
  /** How they describe themselves at the back door. Words, not the truth. */
  says: string;
  /** One line the chef can see for themself. */
  looks: string;
  /** What they will ask of the chef one night (a request), in their words. */
  asks: string;
}

export const HIRES: readonly HireTemplate[] = [
  {
    id: 'sam',
    name: 'Sam',
    home: 'dish',
    wage: 40,
    says: '“I’m eighteen. I’m a repair apprentice on a paid work exchange. I need someone to show me how the dishes work here.”',
    looks: 'He is eighteen. He keeps a testing notebook beside his lunch.',
    asks: 'Can I finish at nine tonight? I promised Mum I’d call her about the paid hours.',
  },
  {
    id: 'murat',
    name: 'Murat',
    home: 'grill',
    wage: 60,
    says: '“I worked two years at a roast-meat stand in Bornova. I’m fast, Chef, and I never get tired.”',
    looks: 'He is twenty-seven, with quick hands and a phone in his back pocket.',
    asks: 'Chef, the big football match is on. Can I go at nine?',
  },
  {
    id: 'zeynep',
    name: 'Zeynep',
    home: 'cold',
    wage: 70,
    says: '“I worked twenty years in a school canteen. I have to be home by ten for my boys.”',
    looks: 'She is forty-five and steady. She reads the menu on the wall while she talks.',
    asks: 'My youngest has a fever. Can I go at nine tonight?',
  },
  {
    id: 'can',
    name: 'Can',
    home: 'dish',
    wage: 40,
    says: '“I’m Rafi’s cousin. I’ll do anything, Chef. Anything.”',
    looks: 'He is seventeen and too thin, and he is already rolling up his sleeves.',
    asks: 'Can I eat something first? I haven’t eaten since the morning.',
  },
  {
    id: 'hulya',
    name: 'Hülya',
    home: 'oven',
    wage: 90,
    says: '“Six years in a hotel kitchen in Antalya. I left after a fight with the chef. I was right.”',
    looks: 'She is thirty-eight, with burn scars on both forearms. She looks straight at you.',
    asks: 'Let me run the oven my way tonight. Don’t touch it.',
  },
];

export const hireTemplate = (id: string): HireTemplate | undefined => HIRES.find((h) => h.id === id);

export function makeHire(
  t: HireTemplate,
  seed: number,
  now: number,
  edition = 'pass@9',
  plainNarration = true,
): Person {
  const base = {
    id: t.id,
    ...(plainNarration
      ? { lexicon: edition === NARRATION_EDITION ? structuredClone(kitchenLexicon) : { plainEnglish: true } }
      : {}),
    name: t.name,
    now,
    seed: seed ^ (0x100 + Math.max(0, HIRES.indexOf(t) - 1)),
    enable: { fatigueStore: true },
  };
  let p: Person;
  if (t.id === 'murat') {
    // He says he never tires. He is not as fit as he thinks.
    p = createPerson({
      ...base,
      voices: [{ voiceId: CHEF, trust: 0.5 }],
      bornAt: now - 27 * MINUTES_PER_YEAR,
      sex: 'male',
      traits: { honesty: 0.45, conscientiousness: 0.35, extraversion: 0.8, agreeableness: 0.55 },
      skills: { grill: 0.65, cold: 0.35, dish: 0.4, oven: 0.3 },
      body: { fitness: 0.3 },
      norms: [{ normId: 'theft', standing: 'forbidden', conviction: 0.7 }],
      enable: { ...base.enable, review: { style: 'ruminating', at: 22 * 60 + 30 } },
    });
    p.habits.push({
      cue: { placeId: 'line' },
      action: 'phone',
      strength: 0.55,
      repetitions: 2000,
      lastAt: now,
    });
  } else if (t.id === 'zeynep') {
    p = createPerson({
      ...base,
      voices: [{ voiceId: CHEF, trust: 0.5 }],
      bornAt: now - 45 * MINUTES_PER_YEAR,
      sex: 'female',
      traits: { honesty: 0.8, conscientiousness: 0.85, agreeableness: 0.7 },
      skills: { grill: 0.4, cold: 0.7, dish: 0.6, oven: 0.65 },
      norms: [{ normId: 'theft', standing: 'forbidden', conviction: 0.9 }],
      enable: { ...base.enable, review: { style: 'accounting', at: 22 * 60 + 30 } },
    });
    // Home by ten for her boys: she leaves at half past nine, every night.
    promise(p, {
      kind: 'promise',
      toId: 'sons',
      label: 'being home for my boys',
      actions: ['home'],
      from: dayStart(now) + 21 * 60 + 30,
      until: dayStart(now) + 22 * 60 + 10,
      importance: 0.7,
      recurEvery: 1440,
    });
  } else if (t.id === 'sam') {
    p = createPerson({
      ...base,
      voices: [{ voiceId: CHEF, trust: 0.5 }],
      bornAt: now - 18 * MINUTES_PER_YEAR,
      sex: 'male',
      skills: { dish: 0.3, cold: 0.15, grill: 0.1, oven: 0.1 },
    });
  } else if (t.id === 'can') {
    p = createPerson({
      ...base,
      voices: [{ voiceId: CHEF, trust: 0.6 }],
      bornAt: now - 17 * MINUTES_PER_YEAR,
      sex: 'male',
      traits: { honesty: 0.6, conscientiousness: 0.4, agreeableness: 0.75, emotionality: 0.6 },
      skills: { grill: 0.2, cold: 0.3, dish: 0.5, oven: 0.15 },
      body: { satiety: 0.35 },
      norms: [{ normId: 'theft', standing: 'forbidden', conviction: 0.6 }],
      enable: { ...base.enable, review: { style: 'accounting', at: 22 * 60 + 30 } },
    });
    seedTie(p, { otherId: 'rafi', roles: ['cousin'], affection: 0.6, familiarity: 0.8, trust: 0.7 });
  } else {
    // The best cook who will ever knock on the back door, and she does not trust chefs.
    p = createPerson({
      ...base,
      voices: [{ voiceId: CHEF, trust: 0.32 }],
      bornAt: now - 38 * MINUTES_PER_YEAR,
      sex: 'female',
      traits: { honesty: 0.8, conscientiousness: 0.75, agreeableness: 0.3, extraversion: 0.4 },
      skills: { grill: 0.6, cold: 0.6, dish: 0.45, oven: 0.8 },
      norms: [{ normId: 'theft', standing: 'forbidden', conviction: 0.9 }],
      enable: { ...base.enable, review: { style: 'accounting', at: 22 * 60 + 30 } },
    });
    p.habits.push({
      cue: { placeId: 'line' },
      action: 'oven',
      strength: 0.55,
      repetitions: 3000,
      lastAt: now,
    });
  }
  if (['pass@10', 'pass@11', 'pass@12', 'pass@13', 'pass@14', 'pass@15', 'pass@16'].includes(edition))
    enableSuggestionReasons(p);
  acceptKitchenShift(p, now);
  if (['pass@13', 'pass@14', 'pass@15', 'pass@16'].includes(edition)) canonicalProfile(p);
  return p;
}

/** The chef observes the crew. From pass@6 the kitchen also lives their food work, meals and sleep. */
export function makeChef(seed: number, now: number, plainNarration = true): Person {
  return createPerson({
    id: CHEF,
    ...(plainNarration ? { lexicon: { plainEnglish: true } } : {}),
    name: 'Chef',
    sex: 'female',
    now,
    seed: seed ^ 0xc4ef,
    bornAt: now - 31 * MINUTES_PER_YEAR,
  });
}

/** Complete public priors apply only to the new authored edition, never carried state. */
function canonicalProfile(p: Person) {
  const cast = castForGame('pass').find((c) => c.castId.split('.')[2] === p.id);
  if (!cast) throw new Error('Unallocated foreground cook');
  p.name = cast.name;
  p.traits = structuredClone(cast.traits);
  p.values = structuredClone(cast.values);
  p.life.bornAt = p.now - cast.age * MINUTES_PER_YEAR;
}

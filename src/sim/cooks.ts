/**
 * The three cooks as HF people. Everything about who they are lives in the PersonSpec and a few habits and
 * commitments; the game reads them back through HF (predict, decide, reviewLine, promptings) and never keeps a
 * parallel model of their minds.
 */
import {
  createPerson,
  enablePromptings,
  MINUTES_PER_YEAR,
  type Person,
  promise,
} from '@adam0white/human-framework';

export type CookId = 'selim' | 'dilek' | 'rafi';
export const COOKS: readonly CookId[] = ['selim', 'dilek', 'rafi'];
export const CHEF = 'chef';
export const NAMES: Record<CookId, string> = { selim: 'Selim', dilek: 'Dilek', rafi: 'Rafi' };
/** The station each cook calls home. */
export const HOME_STATION: Record<CookId, Station> = { selim: 'grill', dilek: 'cold', rafi: 'dish' };
export type Station = 'grill' | 'cold' | 'dish';
export const STATIONS: readonly Station[] = ['grill', 'cold', 'dish'];

/** Service window of a night (minutes of day). */
export const OPEN = 17 * 60 + 30;
export const CLOSE = 22 * 60;
export const RUSH_FROM = 18 * 60 + 30;
export const RUSH_TO = 20 * 60 + 30;

export function makeCook(id: CookId, seed: number, now: number): Person {
  const base = {
    id,
    name: NAMES[id],
    now,
    voices: [{ voiceId: CHEF, trust: id === 'selim' ? 0.45 : id === 'dilek' ? 0.5 : 0.55 }],
    enable: { fatigueStore: true },
  };
  let p: Person;
  if (id === 'selim') {
    p = createPerson({
      ...base,
      seed: seed ^ 0x51,
      bornAt: now - 56 * MINUTES_PER_YEAR,
      sex: 'male',
      traits: { honesty: 0.85, conscientiousness: 0.8, agreeableness: 0.4 },
      skills: { grill: 0.85, cold: 0.5, dish: 0.6 },
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
  } else if (id === 'dilek') {
    p = createPerson({
      ...base,
      seed: seed ^ 0xd1,
      bornAt: now - 34 * MINUTES_PER_YEAR,
      sex: 'female',
      traits: { honesty: 0.7, conscientiousness: 0.55, extraversion: 0.6, emotionality: 0.65 },
      skills: { grill: 0.45, cold: 0.75, dish: 0.5 },
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
      seed: seed ^ 0x7a,
      bornAt: now - 19 * MINUTES_PER_YEAR,
      sex: 'male',
      traits: { honesty: 0.55, conscientiousness: 0.45, agreeableness: 0.65 },
      skills: { grill: 0.25, cold: 0.35, dish: 0.6 },
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
  // Everyone's own line: I don't walk out on a service.
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
  return p;
}

export const dayStart = (m: number) => Math.floor(m / 1440) * 1440;

/** Authored Pass opening. These are fictional premises, not inferred actor state. */
import { DEFAULT_NORMS, type Offer, type PersonAuthoring, type RunSpec } from '@adam0white/human-framework';
import { castForGame } from '@adam0white/lab-client';
import { HF4_HOST, MINUTE_MS } from './hf4-run.ts';

const DAY = 86_400_000 as const;
export const HF4_OPENING = 9 * 60 * MINUTE_MS;
export const HF4_ACTIONS = [
  'grill',
  'cold',
  'dish',
  'oven',
  'rest',
  'wait',
  'eat',
  'meal',
  'sleep',
  'home',
  'smoke',
  'phone',
  'skim',
  'pray',
  'apron',
  'room',
  'clear-table',
  'conversation',
  'explain-wait',
  'no-replies',
  'resign',
  'stay',
  'leave',
  'chef-food',
  'kitchen-job',
  'keep-own-plans',
  'toilet',
];
const skills: Record<string, [number, number, number, number]> = {
  selim: [0.85, 0.5, 0.6, 0.7],
  dilek: [0.45, 0.75, 0.5, 0.45],
  rafi: [0.25, 0.35, 0.6, 0.2],
  murat: [0.65, 0.35, 0.4, 0.3],
  zeynep: [0.4, 0.7, 0.6, 0.65],
  sam: [0.1, 0.15, 0.3, 0.1],
  hulya: [0.6, 0.6, 0.45, 0.8],
  chef: [0.3, 0.3, 0.3, 0.3],
};
const trust: Record<string, number> = {
  selim: 0.45,
  dilek: 0.5,
  rafi: 0.55,
  murat: 0.5,
  zeynep: 0.5,
  sam: 0.5,
  hulya: 0.32,
};
const theft: Record<string, number> = {
  selim: 0.95,
  dilek: 0.85,
  rafi: 0.5,
  murat: 0.7,
  zeynep: 0.9,
  hulya: 0.9,
};
const habit: Record<string, [string, number, number][]> = {
  selim: [['grill', 0.6, 4000]],
  dilek: [
    ['cold', 0.5, 1500],
    ['smoke', 0.6, 3000],
  ],
  rafi: [
    ['dish', 0.45, 600],
    ['skim', 0.5, 40],
  ],
  murat: [['phone', 0.55, 2000]],
  hulya: [['oven', 0.55, 3000]],
};
const plainActions = {
  grill: { base: 'work at the grill', past: 'worked at the grill', gerund: 'working at the grill' },
  cold: {
    base: 'work at the cold side',
    past: 'worked at the cold side',
    gerund: 'working at the cold side',
  },
  dish: { base: 'wash the dishes', past: 'washed the dishes', gerund: 'washing the dishes' },
  oven: { base: 'look after the oven', past: 'looked after the oven', gerund: 'looking after the oven' },
  'clear-table': {
    base: 'clear the abandoned meal',
    past: 'cleared the abandoned meal',
    gerund: 'clearing the abandoned meal',
  },
  room: {
    base: 'work in the dining room',
    past: 'worked in the dining room',
    gerund: 'working in the dining room',
  },
};
export function kitchenSpec(seed: number): RunSpec {
  return {
    id: `pass:${seed}`,
    seed,
    start: HF4_OPENING,
    host: HF4_HOST,
    definitions: {
      actions: HF4_ACTIONS.map((id) => ({
        id,
        label: id,
        demands: { effort: 0, focus: 0, mode: id === 'sleep' ? 'sleep' : 'awake', requires: {} },
        tags: [],
        norms: [],
      })),
      norms: structuredClone(DEFAULT_NORMS),
      marriageCustoms: [],
      skills: ['grill', 'cold', 'dish', 'oven'].map((id) => ({ id, label: id, domain: 'motor' })),
      skillTransfers: [],
      methods: [],
      routines: [],
      sources: [
        { type: 'host', id: 'pass' },
        { type: 'voice', id: 'chef' },
        ...Array.from({ length: 1024 }, (_, i) => ({ type: 'voice' as const, id: `table:${i + 1}` })),
      ],
      lexicon: {
        names: Object.fromEntries([
          ...castForGame('pass').map((c) => [c.castId.split('.')[2], c.name]),
          ['chef', 'Chef'],
        ]),
        roles: { chef: 'chef' },
        prefer: 'name',
        actions: plainActions,
      },
      calendar: {
        id: 'pass-calendar',
        epoch: { id: 'pass-opening', simulationAt: 0, dayIndex: 0, msOfDay: 0 },
        dayMs: DAY,
        days: Array.from({ length: 35 }, (_, dayIndex) => ({ dayIndex, start: dayIndex * DAY, windows: [] })),
      },
    },
    lifecycle: { kinPremises: [], kinScopes: [] },
    world: {
      revision: 0,
      facts: [
        'line',
        'pass',
        'sons',
        'mother',
        ...castForGame('pass').map((c) => c.castId.split('.')[2] as string),
        ...Array.from({ length: 1024 }, (_, i) => `table:${i + 1}`),
      ].map((subject) => ({
        id: `pass:entity:${subject}`,
        subject,
        predicate: 'kind',
        value: subject === 'line' ? 'place' : subject === 'sons' ? 'family-group' : 'world-entity',
        at: HF4_OPENING,
        provenance: { source: 'pass', evidenceId: `pass:authored:${subject}` },
      })),
      hostState: { active: [], completedCount: 0 },
    },
  };
}
const commitment = (
  id: string,
  kind: 'abstain' | 'worship' | 'promise',
  label: string,
  from: number,
  until: number,
  actions: string[],
  importance: number,
  extra = {},
) => ({
  id,
  kind,
  label,
  from: from * MINUTE_MS,
  until: until * MINUTE_MS,
  actions,
  importance,
  recurEveryMs: DAY,
  ...extra,
});
export function kitchenPerson(id: string): PersonAuthoring {
  const cast = castForGame('pass').find((c) => c.castId.split('.')[2] === id);
  if (!cast && id !== 'chef') throw new Error('Person is outside this kitchen cast.');
  const at = HF4_OPENING;
  const commitments: PersonAuthoring['state']['agenda']['commitments'][number][] = [];
  if (['selim', 'dilek', 'rafi'].includes(id))
    commitments.push(
      commitment(`${id}:shift`, 'abstain', 'my shift', 1050, 1305, [], 0.55, {
        toId: 'chef',
        violatedBy: ['home'],
      }),
    );
  if (id === 'selim') {
    commitments.push(
      commitment('selim:maghrib', 'worship', 'maghrib', 1115, 1160, ['pray'], 0.6, {
        toId: 'self',
        normId: 'salah',
      }),
    );
    commitments.push(
      commitment('selim:plates', 'abstain', 'my rule about the plates', 1110, 1230, [], 0.5, {
        toId: 'self',
        violatedBy: ['dish'],
        firm: true,
      }),
    );
  }
  if (id === 'dilek')
    commitments.push(
      commitment('dilek:smoking', 'abstain', 'my rule about smoking', 1110, 1230, [], 0.3, {
        toId: 'self',
        violatedBy: ['smoke'],
      }),
    );
  if (id === 'rafi')
    commitments.push(
      commitment('rafi:jar', 'abstain', 'my rule about the jar', 1050, 1320, [], 0.15, {
        toId: 'self',
        violatedBy: ['skim'],
      }),
    );
  if (id === 'zeynep')
    commitments.push(
      commitment('zeynep:sons', 'promise', 'being home for my boys', 1290, 1330, ['home'], 0.7, {
        toId: 'sons',
      }),
    );
  const heldNorms: PersonAuthoring['state']['heldNorms'][number][] = [];
  for (const [normId, conviction] of [
    ['theft', theft[id]],
    ['salah', id === 'selim' ? 0.8 : undefined],
  ] as const) {
    const norm = DEFAULT_NORMS.find((n) => n.id === normId);
    if (conviction !== undefined && norm)
      heldNorms.push({ normId, standing: norm.standing, conviction, provenance: norm.provenance });
  }
  return {
    id,
    identity: {
      name: cast?.name ?? 'Chef',
      birthAt: at - (cast?.age ?? 31) * 365.25 * DAY,
      sex: ['dilek', 'zeynep', 'hulya', 'chef'].includes(id) ? 'female' : 'male',
      ...(cast ? { castId: cast.castId } : {}),
    },
    biography: [],
    origin: {
      kind: 'authored',
      basis: { kind: 'evidence', id: `pass:author:${id}` },
      traits: { kind: 'explicit-authoring', evidence: { kind: 'evidence', id: `pass:traits:${id}` } },
    },
    state: {
      traits: cast?.traits ?? {
        honesty: 0.5,
        emotionality: 0.5,
        extraversion: 0.5,
        agreeableness: 0.5,
        conscientiousness: 0.5,
        openness: 0.5,
      },
      values: cast?.values ?? {
        benevolence: 0.5,
        universalism: 0.5,
        tradition: 0.5,
        conformity: 0.5,
        security: 0.5,
        achievement: 0.5,
        power: 0.5,
        hedonism: 0.5,
        stimulation: 0.5,
        selfDirection: 0.5,
      },
      body: {
        satiety: 0.8,
        hydration: 0.85,
        sleepPressure: 0.2,
        exertion: 0,
        fitness: id === 'murat' ? 0.3 : 0.5,
        health: 1,
        pain: 0,
        sleepDebtHours: 0,
        depletion: 0,
        circadianPeakMs: 16 * 60 * MINUTE_MS,
        asleep: false,
        since: at,
        doze: {
          context: { posture: 'upright', stimulation: 0.5 },
          basis: { kind: 'authored', author: 'pass', at },
        },
        bladder: { fill: 0, pending: 0 },
        injuries: [],
        illnesses: [],
        exposures: [],
      },
      needs: {
        safety: 0.8,
        belonging: 0.7,
        esteem: 0.6,
        autonomy: 0.7,
        competence: 0.6,
        leisure: 0.6,
        meaning: 0.6,
      },
      skills: ['grill', 'cold', 'dish', 'oven'].map((skill, i) => ({
        id: skill,
        level: skills[id]?.[i] ?? 0.3,
        practicedMs: 0,
        lastPracticed: at,
      })),
      heldNorms,
      beliefs: [],
      consequences: [],
      sourceTrust: [],
      context: {
        scarcity: { kind: 'prior', value: 0, basis: 'pass:authored-opening' },
        smoking: { kind: 'unobserved' },
      },
      relationships: [],
      voices: id === 'chef' ? [] : [{ voiceId: 'chef', trust: trust[id] ?? 0.5 }],
      agenda: {
        exemptions: { traveling: { kind: 'unobserved' }, illnessSeverity: { kind: 'unobserved' } },
        commitments,
        goals: [],
        precommitments: [],
        owed: [],
      },
      family: { contactCovered: [], aptitudes: {} },
      groups: [],
      reserve: {},
      retention: { trace: 32, chronicleDays: 120 },
      habits: (habit[id] ?? []).map(([action, strength, repetitions]) => ({
        cue: { placeId: 'line' },
        action,
        strength,
        repetitions,
        lastAt: at,
      })),
      expectations: [],
      affect: { mood: { valence: 0, arousal: 0.3 }, regulation: 0.3, emotions: [] },
      promptings: {
        reading: id === 'rafi' ? 'inclination' : 'none',
        ...(id === 'rafi' ? { readingSource: 'pass' } : {}),
        responses: [],
      },
      review: {
        style: ['dilek', 'murat'].includes(id) ? 'ruminating' : 'accounting',
        atMsOfDay: 1350 * MINUTE_MS,
      },
      bonds: { courtships: [], marriages: [] },
    },
  };
}
export function kitchenPeople(): PersonAuthoring[] {
  return ['chef', ...castForGame('pass').map((c) => c.castId.split('.')[2] as string)].map(kitchenPerson);
}
export interface KitchenOffer {
  id: string;
  action: string;
  label: string;
  duration: number;
  effort: number;
  focus?: number;
  mode?: 'awake' | 'sleep';
  advertises: Offer['expected']['needs'];
  material?: number;
  placeId?: string;
  norms?: Offer['norms'];
  followedBy?: readonly { label?: string; duration: number; effort: number; focus?: number }[];
}
function durationInMs(duration: number): number {
  const exactMs = duration * MINUTE_MS,
    durationMs = Math.round(exactMs);
  if (!Number.isSafeInteger(durationMs) || Math.abs(exactMs - durationMs) > 0.00001)
    throw new Error('Kitchen duration must be an integer number of milliseconds.');
  return durationMs;
}
export function kitchenOffer(person: string, a: KitchenOffer): Offer {
  const durationMs = durationInMs(a.duration);
  return {
    id: a.id,
    actionId: a.action,
    label: a.label,
    person,
    durationMs,
    ...(a.placeId ? { place: a.placeId } : {}),
    participants: [],
    alongside: [],
    demands: { effort: a.effort, focus: a.focus ?? 0, mode: a.mode ?? 'awake', requires: {} },
    tags: [],
    norms: a.norms ?? [],
    expected: {
      needs: a.advertises,
      ...(a.id === 'toilet' ? { voidsBladder: true } : {}),
      ...(a.material === undefined ? {} : { material: a.material }),
      followedBy: (a.followedBy ?? []).map(({ duration, ...span }) => ({
        ...span,
        durationMs: durationInMs(duration),
      })),
      provenance: ['pass:authored-offer'],
    },
    fulfills: [],
    advances: [],
    diminishes: [],
  };
}

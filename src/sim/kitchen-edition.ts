/**
 * Scope: pass@14's finite restaurant tasks, heard table requests and dated supply event.
 * HF owns choices, effort, suggestion history and duty conflicts. This module owns only
 * physical opportunity, stocks, travel, payments and what was actually said or done.
 * No new people, group-duty model, voice-request framework or generated inner speech.
 */
import { type Affordance, begin, decide, finish, interrupt, tick } from '@adam0white/human-framework';
import {
  cookOf,
  type FoodStation,
  type GameState,
  inKitchen,
  memberOf,
  offersFor,
  openAt,
  personOf,
  plan,
} from './kitchen.ts';

export const KITCHEN_EDITION = 'pass@14';
export const FOLLOWUP_EDITION = 'pass@15';
export const kitchenEdition = (s: Pick<GameState, 'version'>) =>
  s.version === KITCHEN_EDITION || s.version === FOLLOWUP_EDITION;
export interface KitchenWorld {
  night: number;
  stock: Record<FoodStation, number>;
  used: Record<FoodStation, number>;
  supply: {
    authored: '2026-10-26/wedding-night';
    expected: number;
    noticeAt: number;
    failed: boolean;
    replacement?: { paid: number; arrives: number; delivered: boolean };
  };
  guests: {
    ticket: number;
    who: string;
    at: number;
    action: string;
    verdict: string;
    outcome: 'heard' | 'explained' | 'unanswered' | 'washing' | 'left-before-reply';
  }[];
  conversations: {
    who: string;
    at: number;
    verdict: string;
    completed?: number;
    source?: { at?: number; night?: number; text: string };
  }[];
  followup?: {
    attention: Record<string, { until: number; activity: string }>;
    deliveries: {
      ticket: number;
      who: string;
      at: number;
      arrives: number;
      outcome: 'carrying' | 'served' | 'interrupted';
    }[];
  };
}
const words = (s: GameState, who: string, text: string) =>
  s.said.push({ at: s.minute, who, kind: 'answer', text });
const task = (
  id: string,
  label: string,
  duration: number,
  advertises: Affordance['advertises'],
  extra: Partial<Affordance> = {},
): Affordance => ({ id, action: id, label, duration, effort: 0.12, advertises, ...extra });
const locked = (s: GameState, who: string) =>
  ['no-replies', 'resign', 'conversation', 'explain-wait'].includes(
    personOf(s, who).activity?.affordanceId ?? '',
  );
export function kitchenNight(s: GameState) {
  const wedding = plan(s).wedding;
  const total = (st: FoodStation) =>
    s.tickets.reduce(
      (sum, t) => sum + t[st] - t[`done${st === 'grill' ? 'Grill' : st === 'cold' ? 'Cold' : 'Oven'}`],
      0,
    );
  s.kitchen = {
    night: s.night,
    stock: {
      grill: Math.max(0, total('grill') - (wedding?.grill ?? 0)),
      cold: total('cold'),
      oven: total('oven'),
    },
    used: { grill: 0, cold: 0, oven: 0 },
    supply: {
      authored: '2026-10-26/wedding-night',
      expected: wedding?.grill ?? 0,
      noticeAt: openAt(s.night) + 30,
      failed: false,
    },
    guests: [],
    conversations: [],
    ...(s.version === FOLLOWUP_EDITION ? { followup: { attention: {}, deliveries: [] } } : {}),
  };
  if (wedding)
    words(
      s,
      'narrator',
      'The wedding is tonight. Eight portions of lamb are due from the supplier at six. They are not in the kitchen yet. The trays are still due at eight.',
    );
}
export function takeIngredient(s: GameState, st: FoodStation): boolean {
  if (!kitchenEdition(s)) return true;
  if (!s.kitchen || s.kitchen.stock[st] <= 0) return false;
  s.kitchen.stock[st]--;
  s.kitchen.used[st]++;
  return true;
}
export function kitchenOffers(s: GameState, who: string): Affordance[] {
  if (!s.kitchen || s.phase !== 'service' || !inKitchen(s, who)) return [];
  const c = cookOf(s, who),
    m = memberOf(s, who);
  // Actual refused answers open this employment conversation. They never select its outcome.
  if (c.night.events.filter((e) => e.verdict === 'refused').length < 2) return [];
  return [
    task(
      'no-replies',
      'stop answering requests for twelve minutes',
      12,
      { autonomy: 0.45, relief: 0.15 },
      { effort: 0.15 },
    ),
    task(
      'resign',
      'end my employment and travel home',
      30,
      { rest: 0.5, autonomy: 0.65, sleep: 0.2 },
      {
        action: 'home',
        effort: 0.15,
        material: -(m.wage / 10 + 4),
      },
    ),
  ];
}
function start(s: GameState, who: string, aff: Affordance, rec: ReturnType<typeof decide>): boolean {
  const p = personOf(s, who),
    c = cookOf(s, who);
  if (p.activity?.affordanceId === aff.id) return true;
  if (p.activity) {
    const a = p.activity;
    interrupt(p, s.minute, 'kitchen-conversation');
    finish(p, { affordanceId: a.affordanceId, action: a.action, status: 'interrupted', at: s.minute });
  }
  if (!begin(p, aff, rec)) return false;
  c.cover = null;
  c.pending = null;
  c.deferred = null;
  c.made = 0;
  if (aff.id === 'home') c.gone = true;
  kitchenStarted(s, who, aff.id);
  return true;
}
export function kitchenStarted(s: GameState, who: string, id: string) {
  if (id === 'resign') {
    const c = cookOf(s, who),
      m = memberOf(s, who);
    c.gone = true;
    c.pending = null;
    c.deferred = null;
    m.left = { night: s.night, words: 'I am ending my kitchen shifts. I am going home now.' };
    words(s, who, `${m.left.words} You still owe my pay for tonight.`);
    // No release of family duties or retroactive forgiveness of the shift commitment.
  } else if (id === 'no-replies') {
    words(
      s,
      who,
      'I have answered you. I am putting down my work and will not answer more requests for twelve minutes.',
    );
  }
}
export function kitchenTask(s: GameState, who: string, kind: 'room' | 'conversation' | 'follow-up') {
  if (
    !kitchenEdition(s) ||
    !s.kitchen ||
    s.phase !== 'service' ||
    !s.people.some((p) => p.id === who) ||
    !s.crew.some((m) => m.id === who && !m.left) ||
    !inKitchen(s, who) ||
    locked(s, who) ||
    !attentionAvailable(s, who)
  )
    return;
  const p = personOf(s, who);
  const source = kind === 'follow-up' ? heardTopic(s, who) : undefined;
  if (kind === 'follow-up' && !source) return;
  if (p.activity?.affordanceId === kind) {
    words(s, who, 'I am already doing that, Chef.');
    return;
  }
  const aff =
    kind === 'room'
      ? task(
          'room',
          'work in the dining room for fifteen minutes',
          15,
          { belonging: 0.15, competence: 0.1, meaning: 0.15 },
          { material: 6, effort: 0.35, placeId: 'dining-room' },
        )
      : task(
          'conversation',
          'talk with the chef for three minutes',
          3,
          { belonging: 0.2, autonomy: 0.1 },
          { placeId: 'pass', material: 6 },
        );
  const offers = [...offersFor(s, who), aff];
  const rec = decide(p, offers, {
    now: s.minute,
    suggestion: { voiceId: 'chef', affordanceId: aff.id, strength: 0.5 },
  });
  const verdict = rec.suggestion?.verdict ?? 'refused';
  if (kind !== 'room')
    s.kitchen.conversations.push({
      who,
      at: s.minute,
      verdict,
      ...(source
        ? {
            source: {
              ...(source.at === undefined ? { night: source.night } : { at: source.at }),
              text: source.text,
            },
          }
        : {}),
    });
  words(
    s,
    'chef',
    kind !== 'room'
      ? source
        ? `You said, “${source.text}” Would you like to talk about that, ${p.name}?`
        : `How are you doing, ${p.name}?`
      : `${p.name}, will you work in the dining room for fifteen minutes? Your station will need someone else.`,
  );
  const chosen = offers.find((o) => o.id === rec.chosenAffordanceId);
  if (!chosen || !start(s, who, chosen, rec)) return;
  if (chosen.id !== aff.id) {
    reserveAttention(s, who, verdict);
    words(s, who, `${rec.suggestion?.says ?? 'Not now, Chef.'} I am not taking that request now.`);
    return;
  }
  words(
    s,
    who,
    kind !== 'room'
      ? (source?.reply ?? ordinaryWords(who))
      : 'I will take the dining room for fifteen minutes. I cannot cook while I am there.',
  );
}
const ordinaryWords = (who: string) =>
  ({
    selim:
      'I miss having Nevin beside the grill. These are her pans. Give me three minutes with you before I go back.',
    dilek:
      'I have been hearing that loose pan handle all afternoon. No recordings of people; I just like the kitchen sounds.',
    rafi: 'My hands are sore from the plates. I would like to learn the cold side when someone has time to show me.',
    zeynep: 'Paid hours matter to me. I still need to get home to my boys tonight.',
    hulya: 'I keep looking at that sunny ledge. For now I need a drink of water before I return to the heat.',
    murat:
      'I used to say I never got tired. I do get tired. I would rather tell you before I make a mistake.',
    sam: 'I wrote down what I tried today. There are still jobs here I have not learned. I want to say that plainly.',
  })[who] ?? 'I can talk for three minutes, Chef.';
export function kitchenMinute(s: GameState) {
  const world = s.kitchen;
  if (!world) return;
  for (const d of world.followup?.deliveries ?? []) {
    if (
      d.outcome === 'carrying' &&
      (s.tickets.find((t) => t.id === d.ticket)?.status !== 'open' ||
        personOf(s, d.who).activity?.affordanceId !== 'room')
    ) {
      d.outcome = 'interrupted';
      words(s, d.who, 'I could not finish carrying that meal. The pass must handle it.');
    }
  }
  const supply = world.supply;
  if (supply.expected && s.minute >= supply.noticeAt && !supply.failed) {
    supply.failed = true;
    words(
      s,
      'narrator',
      'At six the supplier phones: the van has broken down. None of the eight lamb portions will arrive tonight. There is no charge for the missing delivery. The wedding order and deadline still stand. Replacement lamb costs ₺240 and takes 45 minutes if you order it.',
    );
  }
  if (supply.replacement && !supply.replacement.delivered && s.minute >= supply.replacement.arrives) {
    supply.replacement.delivered = true;
    world.stock.grill += supply.expected;
    words(s, 'narrator', 'The replacement van has arrived. Eight lamb portions are now in the kitchen.');
  }
  for (const c of s.cooks) {
    if (!c.here || c.gone) continue;
    const p = personOf(s, c.id),
      a = p.activity;
    if (!a) continue;
    const custom = ['room', 'conversation', 'explain-wait', 'no-replies'].includes(a.affordanceId);
    if (custom) tick(p, s.minute);
    if (custom && s.minute >= a.endsAt) {
      finish(p, {
        affordanceId: a.affordanceId,
        action: a.action,
        status: 'completed',
        at: s.minute,
        ...(a.affordanceId === 'room' ? { material: 3 } : {}),
      });
      if (a.affordanceId === 'conversation') {
        const entry = world.conversations.findLast(
          (x) => x.who === c.id && x.completed === undefined && ['assented', 'complied'].includes(x.verdict),
        );
        if (entry) entry.completed = s.minute;
      }
      if (a.affordanceId === 'explain-wait') {
        const entry = world.guests.findLast((x) => x.who === c.id && x.outcome === 'heard');
        if (entry) {
          const table = s.tickets.find((t) => t.id === entry.ticket);
          entry.outcome = table?.status === 'walked' ? 'left-before-reply' : 'explained';
          words(
            s,
            c.id,
            table?.status === 'walked'
              ? 'The table left before I finished explaining the wait.'
              : table?.status === 'served'
                ? 'Their food left the pass while I was explaining the wait.'
                : 'I have told the table we will keep the order we agreed. They can wait or leave.',
          );
        }
      }
      c.idleUntil = s.minute;
      continue;
    }
    if (
      !['room', 'grill', 'cold', 'dish', 'oven'].includes(a.affordanceId) ||
      (!inKitchen(s, c.id) && a.affordanceId !== 'room')
    )
      continue;
    const t = s.tickets.find(
      (t) => t.status === 'open' && s.minute - t.at >= 8 && !world.guests.some((g) => g.ticket === t.id),
    );
    if (!t) continue;
    const requested = plan(s).dish && t.id % 2 === 1 ? 'dish' : 'explain-wait';
    const requestWords =
      requested === 'dish'
        ? 'Wash our plates now. Leave the other orders.'
        : 'Leave the other tables. Come and explain why our food is not here.';
    words(s, 'narrator', `Table ${t.table} says at the kitchen door to ${p.name}, “${requestWords}”`);
    const requestedOffer =
      requested === 'dish'
        ? offersFor(s, c.id).find((o) => o.id === 'dish')
        : task(
            'explain-wait',
            `explain the wait to table ${t.table}`,
            3,
            { belonging: 0.1, esteem: 0.1 },
            { placeId: 'dining-room', material: 6 },
          );
    if (!requestedOffer) continue;
    const rec = decide(p, a.affordanceId === requested ? [a.affordance] : [a.affordance, requestedOffer], {
      now: s.minute,
      suggestion: { voiceId: `table:${t.id}`, affordanceId: requested, strength: 0.5 },
    });
    const accepted =
      rec.chosenAffordanceId === requested &&
      ['assented', 'complied'].includes(rec.suggestion?.verdict ?? '');
    world.guests.push({
      ticket: t.id,
      who: c.id,
      at: s.minute,
      action: requested,
      verdict: rec.suggestion?.verdict ?? 'refused',
      outcome: accepted ? (requested === 'dish' ? 'washing' : 'heard') : 'unanswered',
    });
    words(
      s,
      c.id,
      accepted
        ? requested === 'dish'
          ? 'I will wash the plates now. The other orders will wait while I do that.'
          : 'I will explain the wait. I am leaving the other tables for three minutes. The cooks will keep the orders they already have.'
        : `${rec.suggestion?.says ?? 'No.'} I am staying with my work. Your order and your wait have not changed.`,
    );
    if (accepted) start(s, c.id, requestedOffer, rec);
  }
}

/** A finite authored topic requires the exact speaker's actual retained utterance. */
export function heardTopic(s: GameState, who: string) {
  if (s.version !== FOLLOWUP_EDITION) return undefined;
  // Keep the requested prayer topic available even after an ordinary check-in.
  // Its newest played report wins deliberately; array category order is not chronology.
  const prayerReport =
    who === 'selim'
      ? s.reports
          .toSorted((a, b) => b.night - a.night)
          .find((report) =>
            report.reviews.some(
              (r) => r.id === who && r.line.includes('I missed the sunset prayer tonight.'),
            ),
          )
      : undefined;
  const prayer = prayerReport?.reviews.find(
    (r) => r.id === who && r.line.includes('I missed the sunset prayer tonight.'),
  );
  const ordinary = s.said
    .filter((line) => line.who === who && line.text === ordinaryWords(who))
    .toSorted((a, b) => b.at - a.at)[0];
  const prior =
    prayer && prayerReport
      ? { at: undefined, night: prayerReport.night, text: prayer.line }
      : ordinary
        ? { ...ordinary, night: undefined }
        : undefined;
  if (!prior) return undefined;
  return {
    at: prior.at,
    night: prior.night,
    text: prior.text,
    reply:
      who === 'selim' && prior.text.includes('sunset prayer')
        ? 'I missed it that evening. I would like you to hear that. I still want to make room to step away before the rush; I am not asking you to decide it for me.'
        : ((
            {
              selim: 'Nevin knew these pans as well as I do. I miss working beside her.',
              dilek:
                'That loose handle rattles differently when the pan is hot. I listen for it while I work.',
              rafi: 'I want to learn the cold side, but saying that does not mean I already know it.',
              zeynep:
                'My boys expect me home. I do not want paid work to become a promise I cannot keep to them.',
              hulya: 'I was thinking of growing something on that ledge. I have not planted anything yet.',
              murat: 'Telling you I am tired is easier than pretending until I get something wrong.',
              sam: 'Writing it down helps me see what I still need to learn.',
            } as Record<string, string>
          )[who] ?? 'That is what I wanted you to hear.'),
  };
}
/** Work selected by HF owns attention until its next review, not a number of clicks. */
export function attentionAvailable(s: GameState, who: string): boolean {
  const boundary = s.kitchen?.followup?.attention[who];
  if (!boundary) return true;
  const a = personOf(s, who).activity;
  return !a || a.affordanceId !== boundary.activity || s.minute >= boundary.until;
}
export function reserveAttention(s: GameState, who: string, verdict: string) {
  const world = s.kitchen?.followup,
    a = personOf(s, who).activity;
  if (!world || verdict !== 'refused' || !a || a.reviewAt <= s.minute) return;
  world.attention[who] = { until: Math.min(a.reviewAt, a.endsAt), activity: a.affordanceId };
  words(s, who, 'I have answered. Let me finish this part of my work before you ask again.');
}
/** Ordinary tables retain existing payment/plates logic; only the actual carry waits. */
export function roomDelivery(s: GameState, ticket: number, table: number): boolean {
  const world = s.kitchen?.followup;
  if (!world) return true;
  const delivery = world.deliveries.findLast((d) => d.ticket === ticket);
  if (delivery) {
    if (delivery.outcome !== 'carrying') return true;
    const a = personOf(s, delivery.who).activity;
    if (a?.affordanceId !== 'room') {
      delivery.outcome = 'interrupted';
      return true;
    }
    if (s.minute < delivery.arrives) return false;
    delivery.outcome = 'served';
    words(s, delivery.who, `I carried the food to table ${table}. They have their meal now.`);
    return true;
  }
  const worker = s.cooks.find(
    (c) => c.here && !c.gone && personOf(s, c.id).activity?.affordanceId === 'room',
  );
  if (!worker || world.deliveries.some((d) => d.who === worker.id && d.outcome === 'carrying')) return true;
  const a = personOf(s, worker.id).activity;
  if (!a || a.endsAt <= s.minute + 2) return true;
  if (s.plates.clean <= 0) return false;
  const meal = s.tickets.find((t) => t.id === ticket);
  if (!meal) return false;
  s.plates.clean--;
  meal.platedAt = s.minute;
  world.deliveries.push({ ticket, who: worker.id, at: s.minute, arrives: s.minute + 2, outcome: 'carrying' });
  words(s, worker.id, `I am carrying the food from the pass to table ${table}.`);
  return false;
}

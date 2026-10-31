/**
 * Scope: pass@14's finite restaurant tasks, heard table requests and dated supply event.
 * HF owns choices, effort, suggestion history and duty conflicts. This module owns only
 * physical opportunity, stocks, travel, payments and what was actually said or done.
 * No new people, group-duty model, voice-request framework or generated inner speech.
 */

import { PRIVATE_CLUES } from './cast-scenes.ts';
import {
  type Affordance,
  begin,
  communityRun,
  decide,
  finish,
  interrupt,
  isHF4,
  type Person,
  tick,
} from './hf4-person.ts';
import {
  cookOf,
  type FoodStation,
  type GameState,
  inKitchen,
  memberOf,
  nameOf,
  offersFor,
  openAt,
  personOf,
  plan,
  stationOf,
} from './kitchen.ts';
import { suggestionWords } from './lines.ts';
import { NARRATION_EDITION, observeNarration, PANEL_EDITION } from './narration-edition.ts';

export const KITCHEN_EDITION = 'pass@14';
export const FOLLOWUP_EDITION = 'pass@15';
export const kitchenEdition = (s: Pick<GameState, 'version'>) =>
  [KITCHEN_EDITION, FOLLOWUP_EDITION, NARRATION_EDITION, PANEL_EDITION, 'pass@18', 'pass@20'].includes(
    s.version,
  );
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
    interrupted?: number;
    activity?: string;
    private?: true;
    source?: { at?: number; night?: number; text: string };
  }[];
  foregroundAt?: Record<string, number>;
  clearings?: {
    ticket: number;
    who: string;
    activity: string;
    at: number;
    outcome: 'clearing' | 'returned' | 'interrupted';
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
const words = (s: GameState, who: string, text: string, at = s.minute) =>
  s.said.push({ at, who, kind: 'answer', text });
const task = (
  id: string,
  label: string,
  duration: number,
  advertises: Affordance['advertises'],
  extra: Partial<Affordance> = {},
): Affordance => ({ id, action: id, label, duration, effort: 0.12, advertises, ...extra });
const locked = (s: GameState, who: string) =>
  ['no-replies', 'resign', 'conversation', 'explain-wait', 'clear-table'].includes(
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
    ...([FOLLOWUP_EDITION, NARRATION_EDITION, PANEL_EDITION, 'pass@18', 'pass@20'].includes(s.version)
      ? { followup: { attention: {}, deliveries: [] } }
      : {}),
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
function start(
  s: GameState,
  who: string,
  aff: Affordance,
  rec: ReturnType<typeof decide>,
  previous: Person['activity'],
): boolean {
  const p = personOf(s, who),
    c = cookOf(s, who);
  if (
    p.activity?.affordanceId === aff.id &&
    (!isHF4(p) || (previous?.affordanceId === aff.id && previous.startedAt === p.activity.startedAt))
  )
    return true;
  if (p.activity && !isHF4(p)) {
    const a = p.activity;
    interrupt(p, s.minute, 'kitchen-conversation');
    observeNarration(s, p, 'interrupted');
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
export function kitchenTask(
  s: GameState,
  who: string,
  kind: 'room' | 'conversation' | 'follow-up' | 'private',
  topic?: string,
) {
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
  if (kind === 'private' && !privateConversationAvailable(s, who)) return;
  const source = kind === 'follow-up' ? heardTopic(s, who, topic) : undefined;
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
  const offers = [...offersFor(s, who), aff],
    previous = p.activity;
  const rec = decide(p, offers, {
    now: s.minute,
    suggestion: { voiceId: 'chef', affordanceId: aff.id, strength: 0.5 },
    settleForeground: s.version === 'pass@20',
  });
  const verdict = rec.suggestion?.verdict ?? 'refused';
  if (kind !== 'room')
    s.kitchen.conversations.push({
      who,
      at: s.minute,
      verdict,
      ...(kind === 'private' ? { private: true as const } : {}),
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
        : kind === 'private'
          ? `${p.name}, would you like three minutes to talk in private? Someone else will need to take your station.`
          : `How are you doing, ${p.name}?`
      : `${p.name}, will you work in the dining room for fifteen minutes? Your station will need someone else.`,
  );
  const chosen = offers.find((o) => o.id === rec.chosenAffordanceId);
  if (!chosen || !start(s, who, chosen, rec, previous)) return;
  if (s.version === 'pass@20' && p.activity) {
    s.kitchen.foregroundAt ??= {};
    s.kitchen.foregroundAt[who] = p.activity.startedAt;
  }
  if (chosen.id !== aff.id) {
    reserveAttention(s, who, verdict);
    words(
      s,
      who,
      `${s.version === 'pass@20' && rec.suggestion ? (suggestionWords(p, rec.suggestion, aff.id, previous)?.text ?? 'Not now, Chef.') : (rec.suggestion?.says ?? 'Not now, Chef.')} ${[PANEL_EDITION, 'pass@18', 'pass@20'].includes(s.version) && kind !== 'room' ? personalReply(who, 'later') : 'I am not taking that request now.'}`,
    );
    return;
  }
  if (s.version === 'pass@20' && kind !== 'room') {
    const entry = s.kitchen.conversations.at(-1);
    if (entry) entry.activity = communityRun(p).active.find((a) => a.person === who)?.id;
  }
  words(
    s,
    who,
    kind !== 'room'
      ? kind === 'private'
        ? 'Yes. Let us step away from the stations for three minutes.'
        : (source?.reply ?? ordinaryWords(who))
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
/** These are spoken replies, not an imported private biography or an inferred thought. */
const personalReply = (who: string, kind: 'later' | 'private') => {
  const replies: Record<string, [string, string]> = {
    selim: [
      'I cannot leave these pans for a talk now. Ask me about Nevin when I have a moment.',
      'Nevin wanted someone else to learn the whole grill station. I still have not put a name on her list.',
    ],
    dilek: [
      'I cannot stop to talk now. I can tell you about the kitchen sounds when I have a moment.',
      'Those clips are kitchen sounds. I ask before recording a voice. I want you to take that seriously.',
    ],
    rafi: [
      'I cannot talk now. Ask me about the repair when I have a moment.',
      'Taking that deposit before checking the part was my mistake. Telling you does not repay it.',
    ],
    zeynep: [
      'I cannot stop now. I still want time to work out the daytime menu costs.',
      'The application is mine. The salary line is still blank; this needs to be paid work.',
    ],
    hulya: [
      'I cannot talk now. Ask me about the seeds when I have a moment.',
      'I have kept those envelopes through several staff rooms. I want to try the sunny ledge, but nothing is planted yet.',
    ],
    murat: [
      'I cannot stop now. We can discuss the reference when I have a moment.',
      'An accurate reference matters more than a flattering one. You have seen when I get tired.',
    ],
    sam: [
      'I cannot talk now. I can show you my testing notebook when I have a moment.',
      'I want the notebook to say what I actually tried. Reading another report is not reproducing its result.',
    ],
  };
  return replies[who]?.[kind === 'later' ? 0 : 1] ?? 'I cannot stop to talk now, Chef.';
};
/** An interrupted task keeps its original world fallback and reveals no private account. */
export function kitchenInterrupted(s: GameState, who: string, action: string, at: number, activity: string) {
  if (s.version !== 'pass@20') return;
  for (const lesson of s.grillLessons ?? []) {
    if (
      ['waiting', 'watching'].includes(lesson.state) &&
      [lesson.teacherActivity, lesson.learnerActivity].includes(activity)
    ) {
      lesson.state = 'interrupted';
      words(s, 'narrator', 'The grill lesson stopped before the demonstration was finished.', at);
    }
  }
  const conversation = s.kitchen?.conversations.find((entry) => entry.activity === activity);
  if (conversation) conversation.interrupted = at;
  const clearing = s.kitchen?.clearings?.find(
    (entry) => entry.activity === activity && entry.outcome === 'clearing',
  );
  if (clearing && action === 'clear-table') {
    clearing.outcome = 'interrupted';
    words(s, who, 'I stopped clearing the abandoned meal. Its plate still needs to come back.', at);
  }
}

/** Host consequences of an actual completion. HF4 calls this from its receipt drain. */
export function kitchenCompleted(s: GameState, who: string, action: string, at: number, activity?: string) {
  for (const lesson of s.grillLessons ?? []) {
    if (!activity) continue;
    if (lesson.learnerActivity === activity) lesson.learnerCompleted = at;
    if (!['waiting', 'watching'].includes(lesson.state) || lesson.teacherActivity !== activity) continue;
    lesson.teacherCompleted = at;
    lesson.state = lesson.guidedWork > 0 && lesson.learnerActivity ? 'demonstrated' : 'no-food-work';
    words(
      s,
      'narrator',
      lesson.state === 'demonstrated'
        ? `Selim finished his guidance while ${memberOf(s, lesson.learner).name} worked at the grill${lesson.learnerInsisted ? ' after you insisted on that work' : ''}. This records actual work together, not mastery.`
        : 'Selim’s time for guidance ended. No shared food work was confirmed. No completed demonstration is recorded.',
      at,
    );
  }
  const world = s.kitchen;
  if (!world || !['room', 'conversation', 'explain-wait', 'no-replies', 'clear-table'].includes(action))
    return;
  if (action === 'clear-table') {
    const entry = world.clearings?.find((x) => x.activity === activity && x.outcome === 'clearing');
    if (entry) {
      const index = s.plates.dirty.findIndex((d) => d.abandonedTicket === entry.ticket);
      if (index < 0) entry.outcome = 'interrupted';
      else {
        s.plates.dirty.splice(index, 1);
        if (plan(s).dish) s.plates.pile++;
        else s.plates.clean++;
        entry.outcome = 'returned';
        words(
          s,
          who,
          `I cleared the abandoned meal for table ${s.tickets.find((t) => t.id === entry.ticket)?.table}. The plate is back ${plan(s).dish ? 'at the dish station' : 'in the kitchen and washed'}.`,
          at,
        );
      }
    }
  }
  if (action === 'conversation') {
    const entry = world.conversations.findLast(
      (x) =>
        x.who === who &&
        x.completed === undefined &&
        ['assented', 'complied'].includes(x.verdict) &&
        (!x.activity || x.activity === activity),
    );
    if (entry) {
      entry.completed = at;
      if (entry.private && entry.activity === activity && !s.privateAccounts?.[who]) {
        words(s, who, PRIVATE_CLUES[who] ?? '', at);
        recordPrivateAccount(s, who, at);
      }
    }
  }
  if (action === 'explain-wait') {
    const entry = world.guests.findLast((x) => x.who === who && x.outcome === 'heard');
    if (entry) {
      const table = s.tickets.find((t) => t.id === entry.ticket);
      entry.outcome = table?.status === 'walked' ? 'left-before-reply' : 'explained';
      words(
        s,
        who,
        table?.status === 'walked'
          ? 'The table left before I finished explaining the wait.'
          : table?.status === 'served'
            ? 'Their food left the pass while I was explaining the wait.'
            : 'I have told the table we will keep the order we agreed. They can wait or leave.',
        at,
      );
    }
  }
  cookOf(s, who).idleUntil = at;
}

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
    const custom = ['room', 'conversation', 'explain-wait', 'no-replies', 'clear-table'].includes(
      a.affordanceId,
    );
    if (custom) tick(p, s.minute);
    if (custom && isHF4(p) && p.activity?.startedAt !== a.startedAt) continue;
    if (!isHF4(p) && custom && s.minute >= a.endsAt) {
      observeNarration(s, p, 'completed');
      finish(p, {
        affordanceId: a.affordanceId,
        action: a.action,
        status: 'completed',
        at: s.minute,
        ...(a.affordanceId === 'room' ? { material: 3 } : {}),
      });
      kitchenCompleted(s, c.id, a.affordanceId, s.minute);
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
    if (accepted) start(s, c.id, requestedOffer, rec, a);
  }
}

/** A finite authored topic requires the exact speaker's actual retained utterance. */
function retainedTopic(s: GameState, who: string) {
  if (![FOLLOWUP_EDITION, NARRATION_EDITION, PANEL_EDITION, 'pass@18', 'pass@20'].includes(s.version))
    return undefined;
  if ([PANEL_EDITION, 'pass@18', 'pass@20'].includes(s.version)) {
    const disclosure = s.said.findLast((line) => line.who === who && line.text === PRIVATE_CLUES[who]);
    if (disclosure)
      return {
        at: disclosure.at,
        night: undefined,
        text: disclosure.text,
        reply: personalReply(who, 'private'),
      };
  }
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

/** Successful discovery belongs to this notebook, not the capped presentation log. */
export function recordPrivateAccount(s: GameState, who: string, at: number) {
  const text = PRIVATE_CLUES[who];
  if (s.version !== 'pass@20' || !text || s.privateAccounts?.[who]) return;
  s.privateAccounts ??= {};
  s.privateAccounts[who] = { at, text };
}

/** Scope: a private invitation uses the same three-minute HF choice as ordinary contact.
 * Only an actual completion may disclose the existing account. Busy breaks stay private.
 */
export function privateConversationAvailable(s: GameState, who: string): boolean {
  return (
    s.version === 'pass@20' &&
    s.phase === 'service' &&
    !!PRIVATE_CLUES[who] &&
    s.people.some((p) => p.id === who) &&
    s.crew.some((m) => m.id === who && !m.left) &&
    inKitchen(s, who) &&
    !locked(s, who) &&
    attentionAvailable(s, who) &&
    !s.privateAccounts?.[who] &&
    !s.said.some((line) => line.who === who && line.text === PRIVATE_CLUES[who])
  );
}

/** Why the private invitation is unavailable now, from the same conditions. Empty when it is available. */
export function privateConversationNote(s: GameState, who: string): string {
  if (privateConversationAvailable(s, who)) return '';
  const name = nameOf(s, who);
  if (s.version !== 'pass@20' || !PRIVATE_CLUES[who]) return `${name} has nothing private to say.`;
  if (s.privateAccounts?.[who] || s.said.some((line) => line.who === who && line.text === PRIVATE_CLUES[who]))
    return `${name} has already told you this.`;
  if (s.phase !== 'service') return 'You can invite someone only while the kitchen is open.';
  return `${name} can be invited only while in the kitchen and free to answer.`;
}

export interface HeardTopic {
  id: string;
  at?: number;
  night?: number;
  text: string;
  reply: string;
}
/** Finite actual utterances, not biography lookup or a generated response to arbitrary text. */
export function heardTopics(s: GameState, who: string): HeardTopic[] {
  if (s.version !== 'pass@20') return [];
  const topics: HeardTopic[] = [];
  const account = s.privateAccounts?.[who];
  if (account) topics.push({ ...account, id: `private:${who}`, reply: personalReply(who, 'private') });
  const prior = retainedTopic(s, who);
  if (prior && !topics.some((topic) => topic.text === prior.text))
    topics.push({
      ...prior,
      id:
        prior.at === undefined
          ? `report:${prior.night}`
          : `said:${s.said.findIndex((line) => line.who === who && line.at === prior.at && line.text === prior.text)}`,
    });
  for (const [index, line] of [...s.said.entries()].reverse()) {
    if (line.who !== who || topics.some((topic) => topic.text === line.text)) continue;
    let reply: string | undefined;
    if (line.text === PRIVATE_CLUES[who]) reply = personalReply(who, 'private');
    else if (line.text === ordinaryWords(who)) reply = ordinaryFollowup(who);
    else if (
      line.at >= openAt(s.night) - 5 &&
      line.text === 'I will take the dining room for fifteen minutes. I cannot cook while I am there.'
    ) {
      const deliveries =
        s.kitchen?.followup?.deliveries.filter(
          (d) => d.who === who && d.at >= line.at && d.at < line.at + 15 && d.outcome === 'served',
        ) ?? [];
      reply = deliveries.length
        ? `I carried the food to table ${s.tickets.find((t) => t.id === deliveries[0]?.ticket)?.table}. I cannot prepare food at my station while I work in the dining room.`
        : 'I agreed to work in the dining room. That does not mean a meal has reached a table yet. I cannot prepare food at my station while I work there.';
    } else if (
      line.at >= openAt(s.night) - 5 &&
      line.text ===
        'I will explain the wait. I am leaving the other tables for three minutes. The cooks will keep the orders they already have.'
    ) {
      const visit = s.kitchen?.guests.find(
        (g) => g.who === who && g.at === line.at && g.action === 'explain-wait',
      );
      if (visit)
        reply =
          visit.outcome === 'explained'
            ? 'I explained the wait. I did not promise to put that table ahead of the other orders.'
            : visit.outcome === 'left-before-reply'
              ? 'They left before I finished explaining. Speaking to them did not finish their order.'
              : 'I agreed to explain the wait. That does not finish their order or put it ahead of the others.';
    }
    if (reply) topics.push({ id: `said:${index}`, at: line.at, text: line.text, reply });
  }
  return topics;
}
export function heardTopic(s: GameState, who: string, topic?: string) {
  if (s.version === 'pass@20') {
    const topics = heardTopics(s, who);
    return topic === undefined ? topics[0] : topics.find((t) => t.id === topic);
  }
  return retainedTopic(s, who);
}
const ordinaryFollowup = (who: string) =>
  ({
    selim: 'Nevin knew these pans as well as I do. I miss working beside her.',
    dilek: 'That loose handle rattles differently when the pan is hot. I listen for it while I work.',
    rafi: 'I want to learn the cold side, but saying that does not mean I already know it.',
    zeynep: 'My boys expect me home. I do not want paid work to become a promise I cannot keep to them.',
    hulya: 'I was thinking of growing something on that ledge. I have not planted anything yet.',
    murat: 'Telling you I am tired is easier than pretending until I get something wrong.',
    sam: 'Writing it down helps me see what I still need to learn.',
  })[who] ?? 'That is what I wanted you to hear.';

/** Scope: one existing abandoned meal, one plate, actual work before earlier recovery.
 * The original automatic return remains the fallback; no stock or payment is created.
 */
export function clearingAvailable(s: GameState, ticket: number): boolean {
  return (
    s.version === 'pass@20' &&
    s.phase === 'service' &&
    s.tickets.some((t) => t.id === ticket && t.status === 'walked' && t.platedAt !== undefined) &&
    s.plates.dirty.some((d) => d.abandonedTicket === ticket && d.at > s.minute + 3) &&
    !s.kitchen?.clearings?.some(
      (c) =>
        c.ticket === ticket &&
        c.outcome === 'clearing' &&
        communityRun(s.chef).active.some((a) => a.id === c.activity),
    )
  );
}
export function clearTable(s: GameState, who: string, ticket: number) {
  if (
    !clearingAvailable(s, ticket) ||
    !s.kitchen ||
    !s.people.some((p) => p.id === who) ||
    !s.crew.some((m) => m.id === who && !m.left) ||
    !inKitchen(s, who) ||
    locked(s, who) ||
    !attentionAvailable(s, who)
  )
    return;
  const p = personOf(s, who),
    previous = p.activity;
  const aff = task(
    'clear-table',
    'clear the abandoned meal and return its plate',
    3,
    { competence: 0.1, meaning: 0.15 },
    { material: 6, effort: 0.25, placeId: 'dining-room' },
  );
  const offers = [...offersFor(s, who), aff];
  const rec = decide(p, offers, {
    now: s.minute,
    suggestion: { voiceId: 'chef', affordanceId: aff.id, strength: 0.5 },
    settleForeground: true,
  });
  const table = s.tickets.find((t) => t.id === ticket)?.table;
  words(
    s,
    'chef',
    `${p.name}, will you clear the abandoned meal for table ${table} and bring its plate back? Your station will need someone else for three minutes.`,
  );
  const chosen = offers.find((o) => o.id === rec.chosenAffordanceId);
  if (!chosen || !start(s, who, chosen, rec, previous)) return;
  if (p.activity) {
    s.kitchen.foregroundAt ??= {};
    s.kitchen.foregroundAt[who] = p.activity.startedAt;
  }
  if (chosen.id !== aff.id) {
    reserveAttention(s, who, rec.suggestion?.verdict ?? 'refused');
    words(
      s,
      who,
      rec.suggestion
        ? (suggestionWords(p, rec.suggestion, aff.id, previous)?.text ?? 'Not now, Chef.')
        : 'Not now, Chef.',
    );
    return;
  }
  const active = communityRun(p).active.find((a) => a.person === who);
  if (!active) throw new Error('Missing accepted clearing activity.');
  s.kitchen.clearings ??= [];
  s.kitchen.clearings.push({ ticket, who, activity: active.id, at: s.minute, outcome: 'clearing' });
  words(s, who, `I will clear the abandoned meal for table ${table}. I cannot cook while I do that.`);
}

/** A finite physical lesson, not a competence award or a synthetic witnessed-method input.
 * Existing HF choices govern both people. Only actual overlapping guidance and food work, exact
 * completed activities and later learner food work are recorded as world observations.
 */
export interface GrillLesson {
  id: number;
  at: number;
  learner: string;
  teacherVerdict?: string;
  learnerVerdict: string;
  learnerInsisted?: boolean;
  teacherActivity?: string;
  learnerActivity?: string;
  teacherCompleted?: number;
  learnerCompleted?: number;
  guidedWork: number;
  learnerWork: number;
  lastLearnerWorkAt?: number;
  food?: { ticket: number; at: number };
  state: 'declined' | 'waiting' | 'watching' | 'demonstrated' | 'no-food-work' | 'interrupted' | 'practised';
}
export function grillLessonAvailable(s: GameState, learner: string): boolean {
  return (
    s.version === 'pass@20' &&
    s.phase === 'service' &&
    !!s.privateAccounts?.selim &&
    learner !== 'selim' &&
    s.crew.some((m) => m.id === learner && !m.left) &&
    s.cooks.some((c) => c.id === learner && c.here && !c.gone) &&
    s.cooks.some((c) => c.id === 'selim' && c.here && !c.gone) &&
    inKitchen(s, learner) &&
    stationOf(s, learner) !== 'grill' &&
    inKitchen(s, 'selim') &&
    !locked(s, learner) &&
    !locked(s, 'selim') &&
    attentionAvailable(s, learner) &&
    attentionAvailable(s, 'selim') &&
    !s.grillLessons?.some((x) => ['waiting', 'watching'].includes(x.state)) &&
    s.tickets.some((t) => t.status === 'open' && t.doneGrill < t.grill)
  );
}
export function grillLesson(s: GameState, learner: string) {
  if (!grillLessonAvailable(s, learner) || !s.kitchen) return;
  const lesson: GrillLesson = {
    id: s.applied - 1,
    at: s.minute,
    learner,
    learnerVerdict: 'not-asked',
    guidedWork: 0,
    learnerWork: 0,
    state: 'declined',
  };
  s.grillLessons ??= [];
  s.grillLessons.push(lesson);
  const teacher = personOf(s, 'selim');
  const teach = task(
    'conversation',
    `guide ${memberOf(s, learner).name} at the grill for three minutes`,
    3,
    { belonging: 0.2, autonomy: 0.1, meaning: 0.3 },
    { action: 'conversation', focus: 0, placeId: 'line', material: 6 },
  );
  const teacherOffers = [...offersFor(s, 'selim'), teach],
    old = teacher.activity;
  const reply = decide(teacher, teacherOffers, {
    now: s.minute,
    suggestion: { voiceId: 'chef', affordanceId: teach.id, strength: 0.5 },
    settleForeground: true,
  });
  lesson.teacherVerdict = reply.suggestion?.verdict ?? 'refused';
  const actual = teacherOffers.find((o) => o.id === reply.chosenAffordanceId);
  words(
    s,
    'chef',
    `Selim, will you show ${memberOf(s, learner).name} the grill while they prepare the waiting food?`,
  );
  if (!actual || !start(s, 'selim', actual, reply, old)) return;
  if (actual.id !== teach.id || !['assented', 'complied'].includes(lesson.teacherVerdict)) {
    words(s, 'selim', reply.suggestion?.says || 'I have not agreed to teach now.');
    reserveAttention(s, 'selim', lesson.teacherVerdict);
    return;
  }
  lesson.teacherActivity = communityRun(teacher).active.find((a) => a.person === 'selim')?.id;
  s.kitchen.foregroundAt ??= {};
  if (teacher.activity) s.kitchen.foregroundAt.selim = teacher.activity.startedAt;
  lesson.state = 'waiting';
  words(
    s,
    'selim',
    `I will make three minutes to guide ${memberOf(s, learner).name} at the grill. I will step back from cooking. They still need to choose that work.`,
  );
}
/** Associate only an actual successful station decision, never a predicted answer. */
export function noteLessonLearner(s: GameState, who: string, verdict: string, insisted: boolean) {
  for (const lesson of s.grillLessons ?? []) {
    if (!['waiting', 'watching'].includes(lesson.state) || lesson.learner !== who) continue;
    const active = communityRun(personOf(s, who)).active.find(
      (a) => a.person === who && a.offer.id === 'grill',
    );
    const teacher = communityRun(personOf(s, 'selim')).active.some(
      (a) => a.person === 'selim' && a.id === lesson.teacherActivity,
    );
    if (!active || !teacher || !['assented', 'complied', 'commanded'].includes(verdict)) continue;
    lesson.learnerActivity = active.id;
    lesson.learnerVerdict = verdict;
    lesson.learnerInsisted = insisted;
  }
}
export function noteLessonWork(s: GameState, who: string, amount: number) {
  if (!s.grillLessons?.length || amount <= 0) return;
  for (const lesson of s.grillLessons) {
    if (
      ['waiting', 'watching'].includes(lesson.state) &&
      who === lesson.learner &&
      communityRun(personOf(s, 'selim')).active.some(
        (a) => a.person === 'selim' && a.id === lesson.teacherActivity,
      ) &&
      communityRun(personOf(s, lesson.learner)).active.some(
        (a) => a.person === lesson.learner && a.id === lesson.learnerActivity,
      )
    ) {
      lesson.state = 'watching';
      lesson.guidedWork += amount;
    }
    if (lesson.state === 'demonstrated' && who === lesson.learner) {
      lesson.learnerWork += amount;
      lesson.lastLearnerWorkAt = s.minute;
    }
  }
}
export function noteLessonFood(s: GameState, ticket: number) {
  for (const lesson of s.grillLessons ?? []) {
    if (lesson.state !== 'demonstrated' || lesson.lastLearnerWorkAt !== s.minute || lesson.learnerWork <= 0)
      continue;
    lesson.food = { ticket, at: s.minute };
    lesson.state = 'practised';
    words(
      s,
      'narrator',
      `${memberOf(s, lesson.learner).name} worked at the grill as a portion for table ${s.tickets.find((t) => t.id === ticket)?.table} was finished. That is observed practice, not a promise of mastery.`,
    );
  }
}

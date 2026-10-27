/** Pass-authored vocabulary and observable causes. HF retains all review and norm facts. */
import { type Lexicon, type Person, promptingLine, reviewLine } from '@adam0white/human-framework';
import type { GameState } from './kitchen.ts';

export const NARRATION_EDITION = 'pass@16';
export const PANEL_EDITION = 'pass@17';
export interface NarrationEvidence {
  v: 1;
  causes: {
    who: string;
    commitment: string;
    label: string;
    day: number;
    at: number;
    startedAt: number;
    action: string;
    cause: 'ordered' | 'interrupted';
  }[];
}
export const kitchenLexicon: Lexicon = {
  plainEnglish: true,
  actions: {
    grill: { base: 'work at the grill', past: 'worked at the grill', gerund: 'working at the grill' },
    cold: {
      base: 'work at the cold side',
      past: 'worked at the cold side',
      gerund: 'working at the cold side',
    },
    dish: { base: 'wash the dishes', past: 'washed the dishes', gerund: 'washing the dishes' },
    oven: { base: 'look after the oven', past: 'looked after the oven', gerund: 'looking after the oven' },
    room: {
      base: 'work in the dining room',
      past: 'worked in the dining room',
      gerund: 'working in the dining room',
    },
  },
};

/** Called on the actual active interval before HF advances or ends it, never on a queued request. */
export function observeNarration(s: GameState, p: Person, status?: 'completed' | 'interrupted') {
  if (![NARRATION_EDITION, PANEL_EDITION, 'pass@18'].includes(s.version) || !s.narration) return;
  const a = p.activity;
  if (!a || a.startedAt >= s.minute) return;
  const ordered =
    a.suggestion?.voiceId === 'chef' &&
    ['assented', 'complied'].includes(a.suggestion.verdict) &&
    ['grill', 'cold', 'dish', 'oven', 'room'].includes(a.affordanceId);
  for (const c of p.agenda.commitments) {
    if (c.status !== 'pending' || c.exempt) continue;
    const inWindow = a.startedAt >= c.from && a.startedAt < c.until;
    const interrupted =
      status === 'interrupted' && inWindow && c.actions.includes(a.action) && s.minute <= c.until;
    const violated =
      status === 'completed' &&
      c.kind === 'abstain' &&
      c.violatedBy?.includes(a.action) &&
      s.minute >= c.from &&
      s.minute <= c.until;
    const displaced =
      c.kind !== 'abstain' &&
      !c.actions.includes(a.action) &&
      a.startedAt < c.until &&
      s.minute >= c.until &&
      s.minute - 1 < c.until &&
      a.endsAt >= c.until &&
      a.startedAt >= c.from;
    const cause = interrupted ? 'interrupted' : ordered && (violated || displaced) ? 'ordered' : undefined;
    if (!cause) continue;
    if (s.narration.causes.some((x) => x.who === p.id && x.commitment === c.id && x.cause === cause))
      continue;
    s.narration.causes.push({
      who: p.id,
      commitment: c.id,
      label: c.label ?? c.actions[0] ?? c.kind,
      day: Math.floor(c.until / 1440),
      at: s.minute,
      startedAt: a.startedAt,
      action: a.action,
      cause,
    });
  }
}

export function eveningNarration(s: GameState, p: Person): string | undefined {
  const review = p.review;
  const r = review?.last;
  if (![NARRATION_EDITION, PANEL_EDITION, 'pass@18'].includes(s.version) || !review || !r?.missed.length)
    return undefined;
  const groups = new Map<'ordered' | 'interrupted' | 'ordinary', string[]>();
  const lines: string[] = [];
  for (const label of r.missed) {
    // Prayer remains an observation, without a judgment or religious ruling.
    if (label.toLowerCase() === 'maghrib') {
      lines.push('I missed the sunset prayer tonight.');
      continue;
    }
    const evidence = s.narration?.causes.filter(
      (x) => x.who === p.id && x.day === r.day && x.label === label,
    );
    const cause = evidence?.some((x) => x.cause === 'interrupted')
      ? 'interrupted'
      : evidence?.some((x) => x.cause === 'ordered')
        ? 'ordered'
        : 'ordinary';
    groups.set(cause, [...(groups.get(cause) ?? []), label]);
  }
  for (const [cause, missed] of groups) {
    // A read-only narration view limits each sentence to facts with the same observed cause.
    // The source review, resolves, norms, history and RNG remain unchanged.
    const view = { ...p, review: { ...review, last: { ...r, missed } } };
    const line = reviewLine(view, { variety: true, ...(cause === 'ordinary' ? {} : { cause }) });
    if (line) lines.push(line);
  }
  return lines.join(' ');
}

export function promptCaption(p: Person): string | undefined {
  const r = p.promptings?.recent.at(-1);
  if (!r || !p.promptings) return undefined;
  const kind = p.promptings.responses.find((x) => x.id === r.responseId)?.kind;
  return promptingLine(p.promptings.reading, r.outcome, kind, { plainEnglish: true, voice: 'third' });
}

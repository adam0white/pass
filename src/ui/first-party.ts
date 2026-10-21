/** First-party start words. Reading these never advances the notebook. */
import { planOf } from '../sim/campaign.ts';
import { cookingStep, type GameState } from '../sim/kitchen.ts';

export function sundayOpenLabel(s: GameState, firstPartyStart: boolean): string {
  if ((s.sunday?.week ?? 0) >= 4) return 'Close the notebook';
  if (firstPartyStart && s.sunday?.week === 1) {
    const parties = (s.bookings ?? []).filter((b) => b.week === 2);
    const promised = parties.filter((b) => b.promised);
    const target = [...(promised.length ? promised : parties)].sort((a, b) => a.at - b.at)[0];
    if (target) return `Open on ${planOf(target.night).title}`;
  }
  return 'Open on Wednesday';
}

export function handoverContext(s: GameState): string {
  const food = (station: 'grill' | 'cold' | 'oven') =>
    station === 'grill' ? 'grill portion' : station === 'cold' ? 'cold plate' : 'pide';
  const table = (ticket: number) => s.tickets.find((t) => t.id === ticket)?.table;
  let hands = 'Your hands are empty.';
  if (s.help) {
    const act = cookingStep(s);
    hands = `You take over table ${table(s.help.ticket)}’s ${food(s.help.station)}. ${s.help.instinct ? 'Your hands are finishing it on instinct. ' : ''}${act?.text ?? 'The portion is on the station.'}`;
  }
  if (s.chefNext) hands += ` Chef’s next: table ${table(s.chefNext.ticket)}’s ${food(s.chefNext.station)}.`;
  return `The steady hand ran the service until now. ${hands}`;
}

/**
 * The hand-over words saved when the player took the pass. Saves made before they were saved have no record
 * of what the chef held then, so they get the neutral line rather than a reading of the current kitchen.
 */
export const handoverHands = (saved: string | undefined): string =>
  saved ?? 'The steady hand ran the service until the hand-over.';

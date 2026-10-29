/** Presentation of public world facts. No private Person state or inferred intention. */
import { type BoardRow, type GameState, nameOf, onShift, stationOf } from '../sim/kitchen.ts';
import { VERB_WORD } from '../sim/lines.ts';
import { SELIM_PRAYER_WINDOW } from '../sim/public-calendar.ts';

const time = (minute: number) =>
  `${String(Math.floor((minute % 1440) / 60)).padStart(2, '0')}:${String(Math.ceil(minute % 60)).padStart(2, '0')}`;

export function publicPrayerPlan(s: GameState, who: string, breakAt?: number): string {
  if (s.version !== 'pass@19' || who !== 'selim' || !onShift(s).includes(who)) return '';
  const { from, until } = SELIM_PRAYER_WINDOW;
  const meal =
    breakAt === undefined
      ? ''
      : ` The meal break is ${time(breakAt)}–${time(breakAt + 20)}; it ${breakAt % 1440 < until && (breakAt % 1440) + 20 > from ? 'overlaps' : 'falls outside'} that window.`;
  return `Selim’s scheduled sunset-prayer time is ${time(from)}–${time(until)}. Work requests can compete with that time.${meal}`;
}

export function cookRequestWarning(s: GameState, who: string): string {
  const station = stationOf(s, who);
  const others = onShift(s).filter((id) => id !== who && stationOf(s, id) === station);
  return station && others.length === 0
    ? `${nameOf(s, who)} is the only cook at ${VERB_WORD[station]}. A request to move or step away can leave ${VERB_WORD[station]} empty.`
    : '';
}

export function agreementStatus(s: GameState, row: BoardRow, revised: boolean): string {
  const name = nameOf(s, row.cook);
  if (revised) return `Waiting for a new answer from ${name}. The previous answer is below.`;
  const main = row.accepted ? `${name} agreed.` : `${name} refused or asked for a change.`;
  return row.cover
    ? `${main} ${nameOf(s, row.cover)} ${row.coverAccepted ? 'agreed' : 'has not agreed'} to cover.`
    : main;
}

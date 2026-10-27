import { cookOf, type GameState, nameOf, personOf } from '../sim/kitchen.ts';
import { lira } from './words.ts';

/** Private offers have one answer per notebook. Reading availability never changes the run. */
export function offerUnavailable(s: GameState, who: string): string | null {
  if (s.inputs.some((i) => i.kind === 'cast-talk' && i.who === who && i.choice === 'listen'))
    return 'You already heard this account. You can ask about what they said during service.';
  const cook = cookOf(s, who);
  if (!cook.here || cook.gone) return 'They are away from the kitchen. Ask when they return.';
  if (personOf(s, who).activity)
    return 'They are busy with their current work or break. Ask when they are free.';
  if (s.phase === 'return') return 'This kitchen chapter has ended.';
  return null;
}

/** Report observed outcomes, never assign a hypothetical loss to an unstaffed minute. */
export function closingChoices(s: GameState): string {
  const lost = s.tickets.filter((t) => t.status === 'walked' && t.due === undefined);
  const loss = lost.reduce((sum, t) => sum + t.price, 0);
  const served = s.tickets.filter((t) => t.status === 'served' && t.due === undefined);
  const plans = (s.board?.rows ?? [])
    .map(
      (row) =>
        `${nameOf(s, row.cook)}${row.accepted ? ' agreed to' : ' did not agree to'} ${row.station === 'cold' ? 'the cold side' : row.station === 'dish' ? 'the dishes' : `the ${row.station}`}, with a meal break at ${String(Math.floor(row.breakAt / 60)).padStart(2, '0')}:${String(row.breakAt % 60).padStart(2, '0')}. ${row.cover && row.coverAccepted ? `${nameOf(s, row.cover)} agreed to take over.` : 'Nobody agreed to take over during that break.'}`,
    )
    .join(' ');
  const request =
    s.request && s.request.state !== 'asking'
      ? `${nameOf(s, s.request.who)}’s request: ${s.request.ignored ? 'you did not answer; they decided for themselves' : s.request.state === 'yes' ? 'you said yes' : 'you said no'}. `
      : '';
  const wedding = s.tickets.find((t) => t.due !== undefined);
  const weddingWords = wedding
    ? wedding.status === 'served'
      ? wedding.servedAt !== undefined && wedding.servedAt <= (wedding.due ?? 0)
        ? `Wedding trays arrived on time: ${lira(wedding.price)} paid.`
        : `Wedding trays arrived late: ${lira(Math.round(wedding.price * 0.55))} paid, ${lira(wedding.price - Math.round(wedding.price * 0.55))} less than agreed.`
      : `The wedding delivery was not completed: ${lira(wedding.price)} in agreed payment was lost.`
    : '';
  return `Plan: ${plans} ${request}\nTables: ${served.length} of ${served.length + lost.length} ate. ${weddingWords}\nLost: ${lost.length ? `Table${lost.length === 1 ? '' : 's'} ${lost.map((t) => t.table).join(', ')}: ${lira(loss)} in booked meals.` : 'No booked meal was lost.'}\nWhy: You earn money when a table eats. A faster meal earns no more. Stations and breaks decide when food is ready. Late food makes tables leave.`;
}

/** Visible during service, including after a lost order leaves the rail. */
export function serviceAccount(s: GameState): string {
  const lost = s.tickets.filter((t) => t.status === 'walked' && t.due === undefined);
  const served = s.tickets.filter((t) => t.status === 'served' && t.due === undefined);
  return `Tables: ${served.length} served; ${lost.length} left. Lost meal payments: ${lira(lost.reduce((sum, t) => sum + t.price, 0))}.`;
}

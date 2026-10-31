import { STATIONS, type Station } from '../sim/cooks.ts';
import {
  bookingOf,
  type GameState,
  gasOut,
  nameOf,
  OVEN_HOT,
  onShift,
  owed,
  type Said,
  stationOf,
  stationsTonight,
} from '../sim/kitchen.ts';
import { VERB_WORD } from '../sim/lines.ts';
import { actionableStaffing, availableStaffing, canCoverStation } from './staffing.ts';

export function noCoverWords(station: string): string {
  return `Nobody can cover ${station} now. The cooks are unavailable or unwilling. Time runs at your chosen speed until someone can help.`;
}

/** A station the chef chose to leave empty, while that absence continues and nobody is working there. */
function leftEmpty(s: GameState, missing: readonly Station[]): Station[] {
  const stations = (s.staffing ?? [])
    .filter((d) => d.state === 'left' && d.open !== false && missing.includes(d.station))
    .map((d) => d.station);
  return [...new Set(stations)];
}

function stationList(stations: readonly Station[]): string {
  return stations.length === 3
    ? 'the grill, the cold side and the oven'
    : stations.map((st) => VERB_WORD[st]).join(' and ');
}

export interface ServiceStatus {
  text: string;
  needsResponse: boolean;
}

/** A visible reason for the current wait, without predicting a cook's decision. */
export function serviceStatus(s: GameState): ServiceStatus {
  const status = (text: string, needsResponse = false): ServiceStatus => ({ text, needsResponse });
  if (s.passDecision?.state === 'asking' && !s.help)
    return status('Orders are piling up. Choose which table the cooks serve first.', true);
  const queued = s.inputs.slice(s.applied).filter((input) => input.at <= s.minute);
  const staffing = availableStaffing(s)[0];
  if (staffing) {
    if (queued.some((input) => input.kind === 'staff' && input.id === staffing.id))
      return status('Waiting for your choice of who takes over.');
    return status(
      `${nameOf(s, staffing.who)} is leaving ${VERB_WORD[staffing.station]}. Choose someone to take over, or leave it empty.`,
      true,
    );
  }

  const uncovered = actionableStaffing(s)[0];
  if (uncovered && s.request?.state !== 'asking')
    return status(noCoverWords(VERB_WORD[uncovered.station] ?? uncovered.station));

  if (s.request?.state === 'asking') {
    if (queued.some((input) => input.kind === 'answer'))
      return status(`Waiting for ${nameOf(s, s.request.who)} to respond.`);
    return status(`${nameOf(s, s.request.who)} is waiting for your answer.`, true);
  }

  const queuedAsk = queued.find(
    (input) => input.kind === 'ask' && s.cooks.some((c) => c.id === input.cook && c.here && !c.gone),
  );
  if (queuedAsk?.kind === 'ask') return status(`Waiting for ${nameOf(s, queuedAsk.cook)}’s answer.`);

  const pending = s.cooks.find((c) => c.here && !c.gone && c.pending);
  if (pending) return status(`Waiting for ${nameOf(s, pending.id)}’s answer.`);

  const open = s.tickets.filter((t) => t.status === 'open');
  if (!open.length)
    return status(
      s.tickets.some((t) => t.status === 'waiting')
        ? 'Waiting for the next order.'
        : 'No orders are waiting. Waiting for closing time.',
    );

  const staffed = new Set<Station | null>(onShift(s).map((id) => stationOf(s, id)));
  const waitingForPlate = open.some(
    (t) => t.due === undefined && t.doneGrill >= t.grill && t.doneCold >= t.cold && t.doneOven >= t.oven,
  );
  if (s.plates.clean <= 0 && waitingForPlate) {
    if (staffed.has('dish') || !stationsTonight(s).includes('dish'))
      return status('Food is waiting for clean plates.');
    if (['pass@16', 'pass@17', 'pass@18', 'pass@20'].includes(s.version) && !canCoverStation(s, 'dish'))
      return status(`Food is waiting for clean plates. ${noCoverWords('the dishes')}`);
    return status(
      ['pass@5', 'pass@6', 'pass@7', 'pass@8', 'pass@9', 'pass@10', 'pass@11'].includes(s.version)
        ? 'Nobody is washing dishes, so food is waiting for clean plates.'
        : 'Food is waiting for clean plates. Choose a cook to wash the dishes.',
      !['pass@5', 'pass@6', 'pass@7', 'pass@8', 'pass@9', 'pass@10', 'pass@11'].includes(s.version),
    );
  }
  const remaining = owed(s);
  const needed = (['grill', 'cold', 'oven'] as const).filter((st) => remaining[st] > 0);
  const dark = gasOut(s);
  const missing = needed.filter((st) => !staffed.has(st) && (!dark || st === 'cold'));
  if (missing.length) {
    // The chef's own answer stays visible while the absence it answered continues. Every other
    // missing station keeps its own line and its own prompt.
    const left = s.version === 'pass@20' ? leftEmpty(s, missing) : [];
    const others = missing.filter((st) => !left.includes(st));
    const leftText = left.length
      ? `You left ${stationList(left)} empty. You will not be asked about it again while ${left.length === 1 ? 'it stays' : 'they stay'} empty. You can ask a cook to work there now.`
      : '';
    if (left.length && !others.length) return status(leftText);
    const names = stationList(others);
    const rest =
      ['pass@16', 'pass@17', 'pass@18', 'pass@20'].includes(s.version) &&
      others.every((station) => !canCoverStation(s, station))
        ? status(noCoverWords(names))
        : status(
            ['pass@5', 'pass@6', 'pass@7', 'pass@8', 'pass@9', 'pass@10', 'pass@11'].includes(s.version)
              ? `${names[0]?.toUpperCase()}${names.slice(1)} ${others.length === 1 ? 'has' : 'have'} nobody in tonight’s plan.`
              : `${names[0]?.toUpperCase()}${names.slice(1)} ${others.length === 1 ? 'needs' : 'need'} a cook.`,
            !['pass@5', 'pass@6', 'pass@7', 'pass@8', 'pass@9', 'pass@10', 'pass@11'].includes(s.version),
          );
    return left.length ? status(`${leftText} ${rest.text}`, rest.needsResponse) : rest;
  }

  if (dark && (remaining.grill > 0 || remaining.oven > 0))
    return status('Waiting for gas. The grill and the oven are off.');
  if (remaining.oven > 0 && s.oven.heat < OVEN_HOT)
    return status(
      s.oven.heat <= 0.15
        ? 'The oven is cold. Waiting for it to heat up.'
        : 'Waiting for the oven to heat up.',
    );
  if (needed.length) return status('Waiting for the cooks to finish the food.');

  return status('Food is ready for the pass.');
}

/** Only the nearest walkout is named; patience stays in the world's words. */
export function tableAboutToLeave(s: GameState): number | null {
  let nearest: { id: number; left: number } | null = null;
  for (const ticket of s.tickets) {
    if (ticket.status !== 'open' || ticket.due !== undefined || ticket.platedAt !== undefined) continue;
    const left =
      ticket.patience + (bookingOf(s, ticket.id)?.promised ? 0 : s.apron ? 12 : 0) - (s.minute - ticket.at);
    if (left <= 8 && (!nearest || left < nearest.left)) nearest = { id: ticket.id, left };
  }
  return nearest?.id ?? null;
}

/** Explain a recorded autonomous move after a refused whole-night board assignment. */
export function journalWords(s: GameState, line: Said): string {
  if (line.who !== 'narrator' || line.kind !== 'journal') return line.text;
  for (const row of s.board?.rows ?? []) {
    if (row.accepted !== false) continue;
    const name = nameOf(s, row.cook);
    const prefix = `${name} left `;
    if (!line.text.startsWith(prefix)) continue;
    const station = VERB_WORD[row.station];
    const from = STATIONS.find((place) =>
      line.text.startsWith(`${prefix}${VERB_WORD[place]} for ${station}`),
    );
    if (!from || !new RegExp(` for ${station}(?:[;,.])`, 'u').test(line.text)) continue;
    return `${name}: “I said no to ${station} for the whole night. But I can work there for a short time now. I left ${line.text.slice(prefix.length)}”`;
  }
  return line.text;
}

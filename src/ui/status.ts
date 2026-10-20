import type { Station } from '../sim/cooks.ts';
import {
  type GameState,
  gasOut,
  nameOf,
  OVEN_HOT,
  onShift,
  owed,
  stationOf,
  stationsTonight,
} from '../sim/kitchen.ts';

export interface ServiceStatus {
  text: string;
  needsResponse: boolean;
}

/** A visible reason for the current wait, without predicting a cook's decision. */
export function serviceStatus(s: GameState): ServiceStatus {
  const status = (text: string, needsResponse = false): ServiceStatus => ({ text, needsResponse });
  const queued = s.inputs.slice(s.applied).filter((input) => input.at <= s.minute);
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
        ? 'Waiting for the next ticket.'
        : 'The rail is clear; waiting for closing.',
    );

  const staffed = new Set<Station | null>(onShift(s).map((id) => stationOf(s, id)));
  const remaining = owed(s);
  const needed = (['grill', 'cold', 'oven'] as const).filter((st) => remaining[st] > 0);
  const dark = gasOut(s);
  const missing = needed.filter((st) => !staffed.has(st) && (!dark || st === 'cold'));
  if (missing.length) {
    const names = missing.length === 3 ? 'grill, cold and oven' : missing.join(' and ');
    return status(
      `${names[0]?.toUpperCase()}${names.slice(1)} ${missing.length === 1 ? 'needs' : 'need'} a cook; select a cook.`,
      true,
    );
  }

  if (dark && (remaining.grill > 0 || remaining.oven > 0))
    return status('Waiting for gas; the grill and oven are dark.');
  if (remaining.oven > 0 && s.oven.heat < OVEN_HOT)
    return status(
      s.oven.heat <= 0.15 ? 'Waiting for the cold oven to warm.' : 'Waiting for the oven to warm.',
    );
  if (needed.length) return status('Waiting for cooking.');

  if (s.plates.clean <= 0 && open.some((t) => t.due === undefined)) {
    if (staffed.has('dish') || !stationsTonight(s).includes('dish'))
      return status('Food is waiting for clean plates.');
    return status('Food needs clean plates; select a cook for dish.', true);
  }
  return status('Food is ready for the pass.');
}

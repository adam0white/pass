import { type GameState, nameOf } from '../sim/kitchen.ts';
import { serviceStatus } from './status.ts';

const SPEEDS = [0.5, 1.5, 3.5] as const;
export const SPEED_NAMES = ['Slow', 'Steady', 'Fast'] as const;

/** Playback only. Every simulation step remains exactly one game minute. */
export function clockPlayback(s: GameState, speed: number) {
  const chosen = SPEEDS[speed] ?? SPEEDS[1];
  const status = serviceStatus(s);
  let rate: number = chosen;
  let label: string = SPEED_NAMES[speed] ?? SPEED_NAMES[1];
  let reason = 'Your chosen speed.';
  const staffing = s.staffing?.find((decision) => decision.state === 'asking');
  if (staffing || s.request?.state === 'asking' || status.needsResponse) {
    rate = 0.1;
    label = 'Slow';
    reason = staffing
      ? `${nameOf(s, staffing.who)} needs a cover decision.`
      : s.request?.state === 'asking'
        ? `${nameOf(s, s.request.who)} needs an answer.`
        : 'A station needs a cook.';
  } else if (
    !s.tickets.some((t) => t.status === 'open' || (t.status === 'waiting' && t.at <= s.minute + 10))
  ) {
    rate *= 4;
    reason = 'Rail clear.';
  }
  return { rate, label: `${label} · ${rate} min/s`, reason };
}

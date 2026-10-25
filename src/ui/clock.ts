import { cookingChoice, cookingStep, type GameState, nameOf } from '../sim/kitchen.ts';
import { portionEdition } from './editions.ts';
import { actionableStaffing } from './staffing.ts';
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
  const staffing = actionableStaffing(s)[0];
  if (
    (s.passDecision?.state === 'asking' && !s.help) ||
    staffing ||
    s.request?.state === 'asking' ||
    status.needsResponse
  ) {
    rate = 0.1;
    label = 'Slow';
    reason =
      s.passDecision?.state === 'asking' && !s.help
        ? 'Choose which table the cooks serve first.'
        : staffing
          ? `${nameOf(s, staffing.who)} needs someone to take over.`
          : s.request?.state === 'asking'
            ? `${nameOf(s, s.request.who)} needs an answer.`
            : 'A station needs a cook.';
  } else if (portionEdition(s) && !s.help && s.chefGrace?.some((claim) => claim.until > s.minute)) {
    if (speed !== 2) {
      rate = 0.1;
      label = 'Slow';
    }
    reason = 'A cook is saving a portion for you to cook. Time is slowed so you can answer.';
  } else if (
    (s.version === 'pass@7' || portionEdition(s)) &&
    !s.help?.instinct &&
    ((speed <= 1 && cookingStep(s)?.ready) || (portionEdition(s) && cookingChoice(s)))
  ) {
    rate = 0.1;
    label = 'Slow';
    reason = cookingStep(s)?.text ?? 'Your portion is ready.';
  } else if (
    !s.tickets.some((t) => t.status === 'open' || (t.status === 'waiting' && t.at <= s.minute + 10))
  ) {
    rate *= 4;
    reason = 'No orders are waiting.';
  }
  return { rate, label: `${label} · ${rate} minutes per second`, reason };
}

/** Live automatic pacing. Legacy clockPlayback remains a pure reader for older playback policies. */
export function automaticClockPlayback(
  s: GameState,
  view: { reading?: boolean; inspecting?: boolean } = {},
  speed = 1,
) {
  // Keep live cooking decisions protected at every selected speed.
  const protectedPlayback = clockPlayback(s, 1);
  const playback = protectedPlayback.rate === 0.1 ? protectedPlayback : clockPlayback(s, speed);
  if (view.reading && playback.rate > 0.1)
    return { rate: 0.1, label: 'Reading · 0.1 minutes per second', reason: 'Let them finish speaking.' };
  if (view.inspecting && playback.rate > 0.5)
    return {
      rate: 0.5,
      label: 'Reading · 0.5 minutes per second',
      reason: 'Reading what the cook told you.',
    };
  return {
    ...playback,
    label: playback.label,
    reason: playback.reason,
  };
}

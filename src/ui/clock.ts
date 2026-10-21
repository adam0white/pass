import { cookingChoice, cookingStep, type GameState, nameOf } from '../sim/kitchen.ts';
import { portionEdition } from './editions.ts';
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
        ? 'Choose which table the cooks put first.'
        : staffing
          ? `${nameOf(s, staffing.who)} needs a cover decision.`
          : s.request?.state === 'asking'
            ? `${nameOf(s, s.request.who)} needs an answer.`
            : 'A station needs a cook.';
  } else if (portionEdition(s) && !s.help && s.chefGrace?.some((claim) => claim.until > s.minute)) {
    if (speed !== 2) {
      rate = 0.1;
      label = 'Slow';
    }
    reason = 'A cook is holding a portion for you: Yours, Chef?';
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
    reason = 'Rail clear.';
  }
  return { rate, label: `${label} · ${rate} min/s`, reason };
}

/** Live automatic pacing. Legacy clockPlayback remains a pure reader for older playback policies. */
export function automaticClockPlayback(s: GameState, view: { reading?: boolean; inspecting?: boolean } = {}) {
  const playback = clockPlayback(s, 1);
  if (view.reading && playback.rate > 0.1)
    return { rate: 0.1, label: 'Reading · 0.1 min/s', reason: 'Let them finish speaking.' };
  if (view.inspecting && playback.rate > 0.5)
    return { rate: 0.5, label: 'Reading · 0.5 min/s', reason: 'Reading the cook’s account.' };
  return {
    ...playback,
    label: playback.label.replace('Steady', 'Running'),
    reason: playback.reason === 'Your chosen speed.' ? 'The kitchen sets its pace.' : playback.reason,
  };
}

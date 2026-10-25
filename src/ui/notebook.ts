/** Presentation only: opening approaches and an optional reckoning of completed services. */
import type { GameState } from '../sim/kitchen.ts';

export const START_APPROACHES = {
  pace: 'Selim: “Keep the customers as patient as they were in the first week, all month long. I want time to get the lamb right.” Choose this to keep Nevin’s pace.',
  normal:
    'Dilek: “Leave it as it is. I want to learn the busy hours while the regular customers watch.” Leave this unchosen to keep the usual waiting times.',
};

/** The weights belong to this game, not HF or the people in the kitchen. Never changes state. */
export function endingTally(s: GameState, enabled: boolean): string {
  if (!enabled || s.phase !== 'end') return '';
  const served = s.reports.reduce((n, r) => n + r.served, 0);
  const walked = s.reports.reduce((n, r) => n + r.walked, 0);
  const paid = s.reports.filter((r) => r.bill?.paid).length;
  const total = served - walked + 10 * paid;
  return `<p><b>The kitchen’s tally: ${total}.</b> Tables served (${served}) − tables that left without eating (${walked}) + 10 × weekly bills paid (${paid}). This is the game’s own score. It does not measure the people.</p>`;
}

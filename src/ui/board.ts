/** Board suggestions are player inputs, not new simulation rules. */
import { RUSH_FROM, RUSH_TO } from '../sim/cooks.ts';
import {
  type BoardRow,
  boardDefaults,
  cloneState,
  type GameState,
  memberOf,
  nameOf,
  onShift,
  queueInput,
  restoreState,
} from '../sim/kitchen.ts';

export function breakSlots(current: number): { minute: number; label: string }[] {
  return [...new Set([1090, 1115, 1185, 1260, current])]
    .sort((a, b) => a - b)
    .map((minute) => ({
      minute,
      label: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')} ${minute < RUSH_FROM ? 'before' : minute >= RUSH_TO ? 'after' : 'during'} the rush`,
    }));
}

const hhmm = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
/** The early table arrives at 18:12 and needs the grill and the cold side until 18:24. */
const EARLY_ARRIVES = 18 * 60 + 12;
const EARLY_LEAVES = 18 * 60 + 24;

/**
 * Plain consequences of the plan as it stands: a meal break with nobody to cover it leaves its station
 * empty while the early table waits. It names the cook, the break and the station; it changes nothing.
 */
export function earlyCoverageWarnings(s: GameState, rows: readonly BoardRow[]): string[] {
  if (!['pass@18', 'pass@20'].includes(s.version) || s.night > 3) return [];
  const agreed = s.board?.agreed ? s.board.rows : [];
  const place: Record<string, string> = { grill: 'grill', cold: 'cold side' };
  const out: string[] = [];
  for (const row of rows) {
    const where = place[row.station];
    if (!where || row.breakAt >= EARLY_LEAVES || row.breakAt + 20 <= EARLY_ARRIVES) continue;
    const answer = agreed.find(
      (a) =>
        a.cook === row.cook &&
        a.station === row.station &&
        a.breakAt === row.breakAt &&
        a.cover === row.cover,
    );
    if (row.cover && answer?.coverAccepted !== false) continue;
    const staffed = rows.some(
      (other) =>
        other.cook !== row.cook &&
        other.station === row.station &&
        (other.breakAt >= EARLY_LEAVES || other.breakAt + 20 <= EARLY_ARRIVES),
    );
    if (staffed) continue;
    const name = nameOf(s, row.cook);
    out.push(
      row.cover
        ? `${name}\u2019s meal break (${hhmm(row.breakAt)}\u2013${hhmm(row.breakAt + 20)}) leaves the ${where} empty at 18:12 because the cook you chose to cover said no.`
        : `${name}\u2019s meal break (${hhmm(row.breakAt)}\u2013${hhmm(row.breakAt + 20)}) leaves the ${where} empty when the early table arrives at 18:12.`,
    );
  }
  return out;
}

export function openingBoard(s: GameState): BoardRow[] {
  const rows = boardDefaults(s);
  const ids = onShift(s);
  // Panel edition never assigns relief without a player's choice. Previous choices survive.
  if (['pass@17', 'pass@18', 'pass@20'].includes(s.version))
    return rows.map((row) => ({
      ...row,
      cover: s.previousBoard?.some((old) => old.cook === row.cook) ? row.cover : null,
    }));
  // Preserve deliberate gaps for a returning crew. A new relief cook can fill old gaps.
  const sameCrew =
    s.previousBoard?.length === ids.length && ids.every((id) => s.previousBoard?.some((r) => r.cook === id));
  if (sameCrew) return rows;
  for (const row of rows) {
    if (row.cover) continue;
    row.cover =
      ids.find(
        (id) =>
          id !== row.cook &&
          memberOf(s, id).home === 'dish' &&
          rows.every(
            (other) =>
              (other.cook !== id && other.cover !== id) || Math.abs(other.breakAt - row.breakAt) >= 20,
          ),
      ) ?? null;
  }
  return rows;
}

export function sameBoard(a: BoardRow[], b: BoardRow[]): boolean {
  return (
    a.length === b.length &&
    a.every((row, i) => {
      const other = b[i];
      return (
        other &&
        row.cook === other.cook &&
        row.station === other.station &&
        row.breakAt === other.breakAt &&
        row.cover === other.cover
      );
    })
  );
}

/** Run the existing HF decision on a copy; reading an old notebook must not append inputs. */
export function boardReplies(s: GameState): BoardRow[] {
  if (s.board?.agreed) return s.board.rows;
  const preview = restoreState(cloneState(s));
  queueInput(preview, { kind: 'board', rows: openingBoard(s) });
  return preview.board?.rows ?? [];
}

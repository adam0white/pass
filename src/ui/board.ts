/** Board suggestions are player inputs, not new simulation rules. */
import { RUSH_FROM, RUSH_TO } from '../sim/cooks.ts';
import {
  type BoardRow,
  boardDefaults,
  cloneState,
  type GameState,
  memberOf,
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

export function openingBoard(s: GameState): BoardRow[] {
  const rows = boardDefaults(s);
  const ids = onShift(s);
  // Panel edition never assigns relief without a player's choice. Previous choices survive.
  if (['pass@17', 'pass@18', 'pass@19'].includes(s.version))
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

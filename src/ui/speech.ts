import type { Said } from '../sim/kitchen.ts';

/** UI cursor only. Object identity survives trimming of the live bounded speech log. */
export function unseenSpeech(lines: readonly Said[], last: Said | undefined): readonly Said[] {
  return lines.slice(last === undefined ? 0 : lines.lastIndexOf(last) + 1);
}

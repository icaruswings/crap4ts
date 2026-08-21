import type { CrapEntry } from '../model.js';

export function sortEntries(entries: CrapEntry[]): CrapEntry[] {
  return [...entries].sort(compareEntries);
}

function compareEntries(left: CrapEntry, right: CrapEntry): number {
  if (left.crap !== null && right.crap !== null) {
    const scoreOrder = right.crap - left.crap;
    if (scoreOrder !== 0) return scoreOrder;
  } else if (left.crap !== null) {
    return -1;
  } else if (right.crap !== null) {
    return 1;
  }

  return (
    compareText(left.source, right.source) ||
    left.range.start.line - right.range.start.line ||
    left.range.start.column - right.range.start.column ||
    compareText(left.name, right.name)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

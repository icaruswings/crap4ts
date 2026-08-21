import type { CrapEntry } from '../model.js';

type SortValue = string | number;
type EntrySortKey = readonly [string, number, number, string];

export function sortEntries(entries: CrapEntry[]): CrapEntry[] {
  return [...entries].sort(compareEntries);
}

function compareEntries(left: CrapEntry, right: CrapEntry): number {
  const crapOrder = compareCrap(left.crap, right.crap);
  return crapOrder === 0
    ? compareSortKeys(entrySortKey(left), entrySortKey(right))
    : crapOrder;
}

function compareCrap(left: number | null, right: number | null): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return right - left;
}

function entrySortKey(value: CrapEntry): EntrySortKey {
  return [
    value.source,
    value.range.start.line,
    value.range.start.column,
    value.name,
  ];
}

function compareSortKeys(left: readonly SortValue[], right: readonly SortValue[]): number {
  for (let index = 0; index < left.length; index += 1) {
    const order = compareSortValue(left[index]!, right[index]!);
    if (order !== 0) return order;
  }
  return 0;
}

function compareSortValue(left: SortValue, right: SortValue): number {
  if (typeof left === 'string' && typeof right === 'string') {
    return compareText(left, right);
  }
  return (left as number) - (right as number);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

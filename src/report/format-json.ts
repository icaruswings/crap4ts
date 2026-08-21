import type { AnalysisResult } from '../analysis/analyze-project.js';
import type { CoverageKind, CrapEntry, Diagnostic } from '../model.js';
import { normalizePath } from '../paths/normalize-path.js';
import { sortEntries } from './sort-entries.js';

export interface JsonReportInput {
  toolVersion: string;
  coverage: {
    format: 'lcov' | 'istanbul';
    kind: CoverageKind;
    path: string;
  };
  result: AnalysisResult;
}

type SortValue = string | number;
type DiagnosticSortKey = readonly [string, string, number, number, string];

export function formatJsonReport(input: JsonReportInput): string {
  const report = {
    schemaVersion: 1,
    tool: {
      name: 'crap4ts',
      version: input.toolVersion,
    },
    coverage: {
      format: input.coverage.format,
      kind: input.coverage.kind,
      path: normalizePath(input.coverage.path),
    },
    entries: sortEntries(input.result.entries).map(toJsonEntry),
    diagnostics: [...input.result.diagnostics].sort(compareDiagnostics),
  };

  return `${JSON.stringify(report, null, 2)}\n`;
}

function toJsonEntry(entry: CrapEntry) {
  return {
    name: entry.name,
    module: entry.module,
    source: entry.source,
    start: entry.range.start,
    end: entry.range.end,
    complexity: entry.complexity,
    coverage: entry.coverage,
    coverageKind: entry.coverageKind,
    crap: entry.crap,
  };
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  return compareSortKeys(diagnosticSortKey(left), diagnosticSortKey(right));
}

function diagnosticSortKey(value: Diagnostic): DiagnosticSortKey {
  return [
    value.code,
    value.source ?? '',
    value.range?.start.line ?? 0,
    value.range?.start.column ?? 0,
    value.message,
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

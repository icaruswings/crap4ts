import type { AnalysisResult } from '../analysis/analyze-project.js';
import type { CoverageKind, Diagnostic } from '../model.js';
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
    entries: sortEntries(input.result.entries),
    diagnostics: [...input.result.diagnostics].sort(compareDiagnostics),
  };

  return `${JSON.stringify(report, null, 2)}\n`;
}

function compareDiagnostics(left: Diagnostic, right: Diagnostic): number {
  return (
    compareText(left.code, right.code) ||
    compareText(left.source ?? '', right.source ?? '') ||
    (left.range?.start.line ?? 0) - (right.range?.start.line ?? 0) ||
    (left.range?.start.column ?? 0) - (right.range?.start.column ?? 0) ||
    compareText(left.message, right.message)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

import type { AnalysisResult } from '../analysis/analyze-project.js';
import { reportCells, reportSummary } from './report-cells.js';
import { sortEntries } from './sort-entries.js';
import wrapAnsi from 'wrap-ansi';
import { terminalColumns, textTable } from './text-table.js';

export interface TextReportOptions {
  color?: boolean;
  columns?: number;
}

export function formatTextReport(result: AnalysisResult, options: TextReportOptions = {}): string {
  const entries = sortEntries(result.entries);
  const rows = entries.map((entry) => reportCells(entry, options.color ?? false));
  const summary = wrapAnsi(reportSummary(entries), terminalColumns(options.columns) ?? 100, { hard: true });
  return ['CRAP Report', '===========', textTable(rows, options.columns), '', summary, ''].join('\n');
}

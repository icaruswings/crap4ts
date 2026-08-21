import type { AnalysisResult } from '../analysis/analyze-project.js';
import type { CrapEntry } from '../model.js';
import { sortEntries } from './sort-entries.js';

const functionWidth = 30;
const moduleWidth = 35;
const complexityWidth = 4;
const coverageWidth = 7;
const crapWidth = 8;

export function formatTextReport(result: AnalysisResult): string {
  const header = formatRow('Function', 'Module', 'CC', 'Cov%', 'CRAP');
  const lines = sortEntries(result.entries).map(formatEntry);

  return ['CRAP Report', '===========', header, '-'.repeat(header.length), ...lines, ''].join('\n');
}

function formatEntry(entry: CrapEntry): string {
  return formatRow(
    entry.name,
    entry.module,
    String(entry.complexity),
    entry.coverage === null ? ' N/A ' : `${entry.coverage.toFixed(1)}%`,
    entry.crap === null ? ' N/A' : entry.crap.toFixed(1),
  );
}

function formatRow(
  name: string,
  module: string,
  complexity: string,
  coverage: string,
  crap: string,
): string {
  return [
    name.padEnd(functionWidth),
    module.padEnd(moduleWidth),
    complexity.padStart(complexityWidth),
    coverage.padStart(coverageWidth),
    crap.padStart(crapWidth),
  ].join(' ');
}

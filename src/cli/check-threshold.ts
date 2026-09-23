import type { AnalysisResult } from '../analysis/analyze-project.js';
import type { CrapEntry, Diagnostic } from '../model.js';

export function checkThreshold(result: AnalysisResult, threshold: number | undefined) {
  if (threshold === undefined) return { result, status: 0 };
  const violations = result.entries
    .filter((entry) => entry.crap !== null && entry.crap > threshold)
    .map((entry) => thresholdDiagnostic(entry, threshold));
  return {
    result: { ...result, diagnostics: [...result.diagnostics, ...violations] },
    status: violations.length > 0 ? 3 : 0,
  };
}

function thresholdDiagnostic(entry: CrapEntry, threshold: number): Diagnostic {
  return {
    code: 'CRAP_THRESHOLD_EXCEEDED',
    message: `Function "${entry.name}" has CRAP ${entry.crap}, exceeding threshold ${threshold}`,
    source: entry.source,
    range: entry.range,
  };
}

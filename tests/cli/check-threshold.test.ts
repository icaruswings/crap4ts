import { describe, expect, it } from 'vitest';
import { checkThreshold } from '../../src/cli/check-threshold.js';
import type { CrapEntry } from '../../src/model.js';

function entry(crap: number | null): CrapEntry {
  return {
    name: 'example', source: 'src/example.ts', module: 'src/example',
    range: { start: { line: 1, column: 1 }, end: { line: 3, column: 2 } },
    complexity: 5, coverage: 80, coverageKind: 'statement', crap,
  };
}

describe('checkThreshold', () => {
  it.each([
    { score: 4.9, status: 0 },
    { score: 5, status: 0 },
    { score: 5.01, status: 3 },
    { score: 5.1, status: 3 },
    { score: 6, status: 3 },
    { score: null, status: 0 },
  ])('with threshold 5, score $score returns $status', ({ score, status }) => {
    const result = { entries: [entry(score)], diagnostics: [] };
    const checked = checkThreshold(result, 5);
    expect(checked.status).toBe(status);
    expect(checked.result.diagnostics).toHaveLength(status === 3 ? 1 : 0);
    expect(result.diagnostics).toEqual([]);
  });

  it('remains report-only without a threshold', () => {
    const result = { entries: [entry(100)], diagnostics: [] };
    expect(checkThreshold(result, undefined)).toEqual({ result, status: 0 });
  });

  it('retains all entries and existing diagnostics while reporting every violation', () => {
    const diagnostic = { code: 'EXISTING', message: 'Existing diagnostic' };
    const result = { entries: [entry(2), entry(6), entry(9)], diagnostics: [diagnostic] };
    const checked = checkThreshold(result, 5);
    expect(checked.status).toBe(3);
    expect(checked.result.entries).toEqual(result.entries);
    expect(checked.result.diagnostics).toEqual([
      diagnostic,
      expect.objectContaining({ code: 'CRAP_THRESHOLD_EXCEEDED', message: expect.stringContaining('CRAP 6') }),
      expect.objectContaining({ code: 'CRAP_THRESHOLD_EXCEEDED', message: expect.stringContaining('CRAP 9') }),
    ]);
  });
});

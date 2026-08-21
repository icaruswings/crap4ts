import { describe, expect, it } from 'vitest';
import type { CoverageFile, LineCoverageFile, StatementCoverageFile } from '../../src/coverage/model.js';
import { measureFunctionCoverage } from '../../src/coverage/measure-function.js';
import type { FunctionInfo, SourceRange } from '../../src/model.js';

describe('measureFunctionCoverage', () => {
  it('preserves line measurement kind when no coverage file matched', () => {
    const measurement = measureFunctionCoverage(fn(), null, 'line');

    expect(measurement).toEqual({
      percentage: null,
      kind: 'line',
      diagnostics: [
        expect.objectContaining({
          code: 'NO_MATCHING_COVERAGE_FILE',
          source: 'src/orders.ts',
        }),
      ],
    });
  });

  it('attributes Istanbul statements by body start position and excludes nested bodies', () => {
    const file = statementFile([
      statement(1, 1, 1),
      statement(2, 1, 1),
      statement(3, 4, 0),
      statement(4, 5, 1),
      statement(5, 3, 1),
      statement(6, 1, 1),
      statement(6, 2, 0),
      statement(8, 1, 1),
      statement(8, 2, 1),
    ]);

    expect(measureFunctionCoverage(fn(), file, 'statement')).toEqual({
      percentage: 50,
      kind: 'statement',
      diagnostics: [],
    });
  });

  it('returns null when a matched Istanbul file has no attributable statements', () => {
    const file = statementFile([statement(1, 1, 2), statement(5, 1, 2), statement(9, 1, 2)]);

    const measurement = measureFunctionCoverage(fn(), file, 'statement');

    expect(measurement.percentage).toBeNull();
    expect(measurement.diagnostics).toEqual([
      expect.objectContaining({
        code: 'NO_TRACKED_COVERAGE',
        source: 'src/orders.ts',
      }),
    ]);
  });

  it('returns zero only when attributable Istanbul statements are tracked and all have zero hits', () => {
    const file = statementFile([statement(2, 2, 0), statement(7, 1, 0)]);

    expect(measureFunctionCoverage(fn(), file, 'statement')).toEqual({
      percentage: 0,
      kind: 'statement',
      diagnostics: [],
    });
  });

  it('excludes strictly interior nested LCOV lines while retaining shared boundary lines', () => {
    const file = lineFile([
      { line: 1, hits: 1 },
      { line: 2, hits: 1 },
      { line: 3, hits: 0 },
      { line: 4, hits: 1 },
      { line: 5, hits: 1 },
      { line: 6, hits: 0 },
      { line: 7, hits: 1 },
      { line: 8, hits: 0 },
      { line: 9, hits: 1 },
    ]);

    const measurement = measureFunctionCoverage(fn(), file, 'line');

    expect(measurement.percentage).toBe(50);
    expect(measurement.kind).toBe('line');
    expect(measurement.diagnostics).toEqual([
      expect.objectContaining({
        code: 'LCOV_NESTED_LINE_OVERLAP',
        source: 'src/orders.ts',
      }),
    ]);
    expect(measurement.diagnostics[0]?.message).toContain('4, 6, 7');
  });

  it('does not report an LCOV overlap when no retained nested boundary is tracked', () => {
    const file = lineFile([{ line: 3, hits: 1 }, { line: 5, hits: 1 }]);

    expect(measureFunctionCoverage(fn(), file, 'line')).toEqual({
      percentage: 100,
      kind: 'line',
      diagnostics: [],
    });
  });

  it('returns null when a matched LCOV file has no tracked body line', () => {
    const file = lineFile([{ line: 1, hits: 0 }, { line: 9, hits: 0 }]);

    expect(measureFunctionCoverage(fn(), file, 'line')).toEqual({
      percentage: null,
      kind: 'line',
      diagnostics: [expect.objectContaining({ code: 'NO_TRACKED_COVERAGE' })],
    });
  });

  it('returns zero when LCOV body lines are tracked and all have zero hits', () => {
    const file = lineFile([{ line: 2, hits: 0 }, { line: 8, hits: 0 }]);

    expect(measureFunctionCoverage(fn(), file, 'line')).toEqual({
      percentage: 0,
      kind: 'line',
      diagnostics: [],
    });
  });

  it('rejects a coverage file whose discriminant differs from the expected kind', () => {
    const mismatchedFile: CoverageFile = statementFile([statement(2, 1, 1)]);

    expect(() => measureFunctionCoverage(fn(), mismatchedFile, 'line')).toThrow(TypeError);
    expect(() => measureFunctionCoverage(fn(), mismatchedFile, 'line')).toThrow(
      'expected line, received statement',
    );
  });
});

function fn(): FunctionInfo {
  return {
    id: 'src/orders.ts:1:1-8:2',
    name: 'orders',
    source: 'src/orders.ts',
    range: range(1, 1, 8, 2),
    bodyRange: range(2, 1, 8, 2),
    nestedBodyRanges: [range(4, 5, 6, 2), range(7, 3, 7, 20)],
    complexity: 1,
  };
}

function range(startLine: number, startColumn: number, endLine: number, endColumn: number): SourceRange {
  return {
    start: { line: startLine, column: startColumn },
    end: { line: endLine, column: endColumn },
  };
}

function statement(line: number, column: number, hits: number) {
  return { range: range(line, column, line, column + 1), hits };
}

function statementFile(statements: StatementCoverageFile['statements']): StatementCoverageFile {
  return { sourcePath: 'src/orders.ts', kind: 'statement', statements };
}

function lineFile(lines: LineCoverageFile['lines']): LineCoverageFile {
  return { sourcePath: 'src/orders.ts', kind: 'line', lines };
}

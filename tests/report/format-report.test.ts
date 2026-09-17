import { describe, expect, it } from 'vitest';
import { stripVTControlCharacters } from 'node:util';
import stringWidth from 'string-width';
import {
  formatJsonReport,
  formatTextReport,
  sortEntries,
  TOOL_VERSION,
  type AnalysisResult,
  type CrapEntry,
} from '../../src/index.js';

const result: AnalysisResult = {
  entries: [
    entry('unknownLater', 'src/zeta.ts', 2, 1, null, null),
    entry('sameColumn', 'src/alpha.ts', 12, 9, 10, 50),
    entry('sameName', 'src/alpha.ts', 12, 9, 10, 50),
    entry('highest', 'src/billing.ts', 3, 4, 35.958, 45),
    entry('unknownFirst', 'src/alpha.ts', 1, 1, null, null),
    entry('sameLineEarlierColumn', 'src/alpha.ts', 12, 2, 10, 50),
    entry('sameScoreEarlierSource', 'src/account.ts', 12, 9, 10, 50),
  ],
  diagnostics: [
    {
      code: 'UNMATCHED_COVERAGE_FILE',
      message: 'zeta coverage was not used',
      source: 'coverage/zeta.info',
    },
    {
      code: 'NO_TRACKED_COVERAGE',
      message: 'later message',
      source: 'src/orders.ts',
      range: { start: { line: 4, column: 2 }, end: { line: 4, column: 6 } },
    },
    {
      code: 'NO_TRACKED_COVERAGE',
      message: 'earlier message',
      source: 'src/orders.ts',
      range: { start: { line: 4, column: 2 }, end: { line: 4, column: 6 } },
    },
    {
      code: 'NO_TRACKED_COVERAGE',
      message: 'earlier column',
      source: 'src/orders.ts',
      range: { start: { line: 4, column: 1 }, end: { line: 4, column: 6 } },
    },
  ],
};

describe('sortEntries', () => {
  it('orders numeric CRAP descending, then source, position, and name without mutating input', () => {
    const entries = [...result.entries];

    expect(sortEntries(entries).map(({ name }) => name)).toEqual([
      'highest',
      'sameScoreEarlierSource',
      'sameLineEarlierColumn',
      'sameColumn',
      'sameName',
      'unknownFirst',
      'unknownLater',
    ]);
    expect(entries).toEqual(result.entries);
  });
});

describe('formatTextReport', () => {
  it('renders separated columns, rounded values, summary counts, and one final newline', () => {
    const report = formatTextReport(result);
    expect(report).toContain('| Function');
    expect(report).toContain('| Module');
    expect(report).toContain('Coverage');
    expect(report).toContain('36.0');
    expect(report).toContain('N/A');
    expect(report).toContain('Functions: 7');
    expect(report).toContain('High risk (>30): 1');
    expect(report).toContain('Missing coverage: 2');
    expect(report.indexOf('highest')).toBeLessThan(report.indexOf('sameScoreEarlierSource'));
    expect(report.endsWith('\n')).toBe(true);
    expect(report.endsWith('\n\n')).toBe(false);
    expect(report).not.toContain('\u001b[');
  });

  it.each([
    { crap: 5, coverage: 80, crapCode: 32, coverageCode: 32 },
    { crap: 5.01, coverage: 79.99, crapCode: 33, coverageCode: 33 },
    { crap: 30, coverage: 50, crapCode: 33, coverageCode: 33 },
    { crap: 30.01, coverage: 49.99, crapCode: 31, coverageCode: 31 },
    { crap: 0, coverage: 0, crapCode: 32, coverageCode: 31 },
  ])('colours numeric cells using unrounded boundaries $crap / $coverage', ({ crap, coverage, crapCode, coverageCode }) => {
    const report = formatTextReport({ entries: [entry('name', 'src/a.ts', 1, 1, crap, coverage)], diagnostics: [] }, { color: true });
    expect(report).toContain(`\u001b[${crapCode}m${crap.toFixed(1)}\u001b[39m`);
    expect(report).toContain(`\u001b[${coverageCode}m${coverage.toFixed(1)}%\u001b[39m`);
    expect(report).not.toContain('\u001b[32mname');
  });

  it('distinguishes missing coverage in grey and handles an empty report', () => {
    expect(formatTextReport(result, { color: true })).toContain('\u001b[90mN/A\u001b[39m');
    const empty = formatTextReport({ entries: [], diagnostics: [] });
    expect(empty).toContain('Functions: 0');
    expect(empty).toContain('High risk (>30): 0');
    expect(empty).toContain('Missing coverage: 0');
  });

  it.each([60, 80, 100])('fits a %s-column terminal with long names and intact numbers', (columns) => {
    const long = { entries: [entry('x'.repeat(120), 'src/' + 'y'.repeat(120), 1, 1, 12345.6, 100)], diagnostics: [] };
    const report = formatTextReport(long, { columns });
    expect(report.split('\n').every((line) => line.length <= columns)).toBe(true);
    expect(report).toContain('12345.6');
    expect(report).toContain('100.0%');
    expect(report).toContain('…');
    expect(formatTextReport(long)).toContain('x'.repeat(120));
  });

  it('keeps Unicode and coloured column separators aligned', () => {
    const entries = [entry('処理😀', 'src/日本語.ts', 1, 1, 3, 100), entry('other', 'src/a.ts', 1, 1, 31, 20)];
    const report = formatTextReport({ entries, diagnostics: [] }, { color: true, columns: 60 });
    const lines = stripVTControlCharacters(report).split('\n').filter((line) => line.startsWith('|'));
    const offsets = lines.map((line) => line.split('|').slice(0, -1).map((_, index, parts) =>
      stringWidth(parts.slice(0, index + 1).join('|'))));
    expect(offsets.every((row) => JSON.stringify(row) === JSON.stringify(offsets[0]))).toBe(true);
    expect(lines.every((line) => stringWidth(line) <= 60)).toBe(true);
  });

  it('removes terminal controls and embedded newlines from names', () => {
    const report = formatTextReport({ entries: [entry('a\u001b[31m\nb', 'src/x.ts', 1, 1, 3, 100)], diagnostics: [] });
    expect(report).toContain('a b');
    expect(report).not.toContain('\u001b[');
  });

  it.each([undefined, 0, -10, NaN, Infinity])('ignores unusable terminal width %s', (columns) => {
    const options = columns === undefined ? {} : { columns };
    expect(formatTextReport(result, options)).toBe(formatTextReport(result));
  });

  it('wraps long Unicode names in the narrow layout without losing them', () => {
    const name = '長い名前'.repeat(20);
    const report = formatTextReport({ entries: [entry(name, 'src/a.ts', 1, 1, 2, 100)], diagnostics: [] }, { columns: 30 });
    expect(report).not.toContain('…');
    expect(report.replace(/\s/g, '')).toContain(name);
    expect(report.split('\n').every((line) => stringWidth(line) <= 30)).toBe(true);
  });

  it('uses the minimum layout width for tiny terminals and handles empty narrow reports', () => {
    const report = formatTextReport({ entries: [], diagnostics: [] }, { columns: 1 });
    expect(report).toContain('Functions: 0');
    expect(report.split('\n').every((line) => stringWidth(line) <= 20)).toBe(true);
  });

  it('uses labelled records on a narrow terminal and preserves data', () => {
    const report = formatTextReport({ entries: [entry('risk', 'src/a.ts', 1, 1, 35, 40)], diagnostics: [] }, { columns: 30 });
    expect(report).toContain('Function: risk');
    expect(report).toContain('Module: src/a');
    expect(report).toContain('CRAP: 35.0');
    expect(report.split('\n').every((line) => line.length <= 30)).toBe(true);
  });

});

describe('formatJsonReport', () => {
  it('orders matching diagnostic codes by source path', () => {
    const report = JSON.parse(formatJsonReport({
      toolVersion: TOOL_VERSION,
      coverage: { format: 'lcov', kind: 'line', path: 'coverage/lcov.info' },
      result: {
        entries: [],
        diagnostics: [
          { code: 'NO_TRACKED_COVERAGE', message: 'same', source: 'src/zeta.ts' },
          { code: 'NO_TRACKED_COVERAGE', message: 'same', source: 'src/alpha.ts' },
        ],
      },
    })) as { diagnostics: Array<{ source: string }> };

    expect(report.diagnostics.map(({ source }) => source)).toEqual([
      'src/alpha.ts',
      'src/zeta.ts',
    ]);
  });

  it('renders a complete byte-stable report with full numbers and sorted diagnostics', () => {
    const input = {
      toolVersion: TOOL_VERSION,
      coverage: {
        format: 'lcov' as const,
        kind: 'line' as const,
        path: 'coverage\\./lcov.info',
      },
      result,
    };

    const report = formatJsonReport(input);

    expect(report).toBe(`{
  "schemaVersion": 1,
  "tool": {
    "name": "crap4ts",
    "version": "${TOOL_VERSION}"
  },
  "coverage": {
    "format": "lcov",
    "kind": "line",
    "path": "coverage/lcov.info"
  },
  "entries": [
    {
      "name": "highest",
      "module": "src/billing",
      "source": "src/billing.ts",
      "start": {
        "line": 3,
        "column": 4
      },
      "end": {
        "line": 3,
        "column": 8
      },
      "complexity": 12,
      "coverage": 45,
      "coverageKind": "line",
      "crap": 35.958
    },
    {
      "name": "sameScoreEarlierSource",
      "module": "src/account",
      "source": "src/account.ts",
      "start": {
        "line": 12,
        "column": 9
      },
      "end": {
        "line": 12,
        "column": 13
      },
      "complexity": 12,
      "coverage": 50,
      "coverageKind": "line",
      "crap": 10
    },
    {
      "name": "sameLineEarlierColumn",
      "module": "src/alpha",
      "source": "src/alpha.ts",
      "start": {
        "line": 12,
        "column": 2
      },
      "end": {
        "line": 12,
        "column": 6
      },
      "complexity": 12,
      "coverage": 50,
      "coverageKind": "line",
      "crap": 10
    },
    {
      "name": "sameColumn",
      "module": "src/alpha",
      "source": "src/alpha.ts",
      "start": {
        "line": 12,
        "column": 9
      },
      "end": {
        "line": 12,
        "column": 13
      },
      "complexity": 12,
      "coverage": 50,
      "coverageKind": "line",
      "crap": 10
    },
    {
      "name": "sameName",
      "module": "src/alpha",
      "source": "src/alpha.ts",
      "start": {
        "line": 12,
        "column": 9
      },
      "end": {
        "line": 12,
        "column": 13
      },
      "complexity": 12,
      "coverage": 50,
      "coverageKind": "line",
      "crap": 10
    },
    {
      "name": "unknownFirst",
      "module": "src/alpha",
      "source": "src/alpha.ts",
      "start": {
        "line": 1,
        "column": 1
      },
      "end": {
        "line": 1,
        "column": 5
      },
      "complexity": 3,
      "coverage": null,
      "coverageKind": "line",
      "crap": null
    },
    {
      "name": "unknownLater",
      "module": "src/zeta",
      "source": "src/zeta.ts",
      "start": {
        "line": 2,
        "column": 1
      },
      "end": {
        "line": 2,
        "column": 5
      },
      "complexity": 3,
      "coverage": null,
      "coverageKind": "line",
      "crap": null
    }
  ],
  "diagnostics": [
    {
      "code": "NO_TRACKED_COVERAGE",
      "message": "earlier column",
      "source": "src/orders.ts",
      "range": {
        "start": {
          "line": 4,
          "column": 1
        },
        "end": {
          "line": 4,
          "column": 6
        }
      }
    },
    {
      "code": "NO_TRACKED_COVERAGE",
      "message": "earlier message",
      "source": "src/orders.ts",
      "range": {
        "start": {
          "line": 4,
          "column": 2
        },
        "end": {
          "line": 4,
          "column": 6
        }
      }
    },
    {
      "code": "NO_TRACKED_COVERAGE",
      "message": "later message",
      "source": "src/orders.ts",
      "range": {
        "start": {
          "line": 4,
          "column": 2
        },
        "end": {
          "line": 4,
          "column": 6
        }
      }
    },
    {
      "code": "UNMATCHED_COVERAGE_FILE",
      "message": "zeta coverage was not used",
      "source": "coverage/zeta.info"
    }
  ]
}\n`);
    expect(formatJsonReport(input)).toBe(report);
  });
});

function entry(
  name: string,
  source: string,
  line: number,
  column: number,
  crap: number | null,
  coverage: number | null,
): CrapEntry {
  return {
    name,
    module: source.replace(/\.ts$/, ''),
    source,
    range: {
      start: { line, column },
      end: { line, column: column + 4 },
    },
    complexity: crap === null ? 3 : 12,
    coverage,
    coverageKind: 'line',
    crap,
  };
}

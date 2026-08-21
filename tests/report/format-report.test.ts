import { describe, expect, it } from 'vitest';
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
  it('renders a complete fixed-width report with rounded values, N/A cells, and one final newline', () => {
    expect(formatTextReport(result)).toBe(
      'CRAP Report\n' +
        '===========\n' +
        'Function                       Module                                CC    Cov%     CRAP\n' +
        '----------------------------------------------------------------------------------------\n' +
        'highest                        src/billing                           12   45.0%     36.0\n' +
        'sameScoreEarlierSource         src/account                           12   50.0%     10.0\n' +
        'sameLineEarlierColumn          src/alpha                             12   50.0%     10.0\n' +
        'sameColumn                     src/alpha                             12   50.0%     10.0\n' +
        'sameName                       src/alpha                             12   50.0%     10.0\n' +
        'unknownFirst                   src/alpha                              3    N/A       N/A\n' +
        'unknownLater                   src/zeta                               3    N/A       N/A\n',
    );
  });
});

describe('formatJsonReport', () => {
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
    "version": "0.1.0"
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
      "range": {
        "start": {
          "line": 3,
          "column": 4
        },
        "end": {
          "line": 3,
          "column": 8
        }
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
      "range": {
        "start": {
          "line": 12,
          "column": 9
        },
        "end": {
          "line": 12,
          "column": 13
        }
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
      "range": {
        "start": {
          "line": 12,
          "column": 2
        },
        "end": {
          "line": 12,
          "column": 6
        }
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
      "range": {
        "start": {
          "line": 12,
          "column": 9
        },
        "end": {
          "line": 12,
          "column": 13
        }
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
      "range": {
        "start": {
          "line": 12,
          "column": 9
        },
        "end": {
          "line": 12,
          "column": 13
        }
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
      "range": {
        "start": {
          "line": 1,
          "column": 1
        },
        "end": {
          "line": 1,
          "column": 5
        }
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
      "range": {
        "start": {
          "line": 2,
          "column": 1
        },
        "end": {
          "line": 2,
          "column": 5
        }
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

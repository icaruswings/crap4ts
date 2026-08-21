import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  analyzeProject,
  formatJsonReport,
  parseIstanbulCoverage,
  parseLcov,
  type AnalysisResult,
  type AnalyzeProjectOptions,
} from '../../src/index.js';

const projectRoot = fileURLToPath(new URL('../fixtures/project/', import.meta.url));

const fixture = (name: string): Promise<string> =>
  readFile(new URL(`../fixtures/project/coverage/${name}`, import.meta.url), 'utf8');

describe('analyzeProject', () => {
  it('analyzes Istanbul coverage in source and function order with stable diagnostics', async () => {
    const options: AnalyzeProjectOptions = {
      projectRoot,
      sourceRoots: ['src'],
      filters: [],
      coverage: parseIstanbulCoverage(await fixture('coverage-final.json')),
    };

    const result: AnalysisResult = await analyzeProject(options);

    expect(result.entries).toEqual([
      {
        name: 'Component',
        module: 'src/component',
        source: 'src/component.tsx',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 3, column: 2 },
        },
        complexity: 2,
        coverage: 100,
        coverageKind: 'statement',
        crap: 2,
      },
      {
        name: 'placeOrder',
        module: 'src/orders',
        source: 'src/orders.ts',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 6, column: 2 },
        },
        complexity: 2,
        coverage: 50,
        coverageKind: 'statement',
        crap: 2.5,
      },
      {
        name: 'receipt',
        module: 'src/orders',
        source: 'src/orders.ts',
        range: {
          start: { line: 7, column: 17 },
          end: { line: 7, column: 32 },
        },
        complexity: 1,
        coverage: null,
        coverageKind: 'statement',
        crap: null,
      },
    ]);
    expect(result.diagnostics).toEqual([
      {
        code: 'NO_TRACKED_COVERAGE',
        message: 'Function "receipt" has no tracked statement coverage locations',
        source: 'src/orders.ts',
        range: {
          start: { line: 7, column: 17 },
          end: { line: 7, column: 32 },
        },
      },
      {
        code: 'UNMATCHED_COVERAGE_FILE',
        message: 'Coverage file "generated/outside.ts" did not match any analyzed source file',
        source: 'generated/outside.ts',
      },
    ]);
    expect(result.diagnostics.some(({ source }) => source === 'src/empty.ts')).toBe(false);
    await expect(analyzeProject(options)).resolves.toEqual(result);
  });

  it('analyzes LCOV coverage and reports every record unused after filtering', async () => {
    const options: AnalyzeProjectOptions = {
      projectRoot,
      sourceRoots: ['src'],
      filters: [],
      coverage: parseLcov(await fixture('lcov.info')),
    };

    const result: AnalysisResult = await analyzeProject(options);

    expect(result.entries).toEqual([
      {
        name: 'Component',
        module: 'src/component',
        source: 'src/component.tsx',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 3, column: 2 },
        },
        complexity: 2,
        coverage: 0,
        coverageKind: 'line',
        crap: 6,
      },
      {
        name: 'placeOrder',
        module: 'src/orders',
        source: 'src/orders.ts',
        range: {
          start: { line: 1, column: 1 },
          end: { line: 6, column: 2 },
        },
        complexity: 2,
        coverage: 100,
        coverageKind: 'line',
        crap: 2,
      },
      {
        name: 'receipt',
        module: 'src/orders',
        source: 'src/orders.ts',
        range: {
          start: { line: 7, column: 17 },
          end: { line: 7, column: 32 },
        },
        complexity: 1,
        coverage: null,
        coverageKind: 'line',
        crap: null,
      },
    ]);
    expect(result.diagnostics).toEqual([
      {
        code: 'NO_TRACKED_COVERAGE',
        message: 'Function "receipt" has no tracked line coverage locations',
        source: 'src/orders.ts',
        range: {
          start: { line: 7, column: 17 },
          end: { line: 7, column: 32 },
        },
      },
      {
        code: 'UNMATCHED_COVERAGE_FILE',
        message: 'Coverage file "generated/outside.ts" did not match any analyzed source file',
        source: 'generated/outside.ts',
      },
    ]);
    expect(result.diagnostics.some(({ source }) => source === 'src/empty.ts')).toBe(false);
    await expect(analyzeProject(options)).resolves.toEqual(result);

    const filtered = await analyzeProject({ ...options, filters: ['orders'] });

    expect(filtered.entries.map(({ source }) => source)).not.toContain('src/component.tsx');
    expect(filtered.diagnostics).toEqual([
      {
        code: 'NO_TRACKED_COVERAGE',
        message: 'Function "receipt" has no tracked line coverage locations',
        source: 'src/orders.ts',
        range: {
          start: { line: 7, column: 17 },
          end: { line: 7, column: 32 },
        },
      },
      {
        code: 'UNMATCHED_COVERAGE_FILE',
        message: 'Coverage file "generated/outside.ts" did not match any analyzed source file',
        source: 'generated/outside.ts',
      },
      {
        code: 'UNMATCHED_COVERAGE_FILE',
        message: 'Coverage file "src/component.tsx" did not match any analyzed source file',
        source: 'src/component.tsx',
      },
      {
        code: 'UNMATCHED_COVERAGE_FILE',
        message: 'Coverage file "src/empty.ts" did not match any analyzed source file',
        source: 'src/empty.ts',
      },
    ]);
  });

  it.each([
    {
      format: 'lcov' as const,
      coverage: () => parseLcov([
        `SF:${join(projectRoot, 'src/component.tsx')}`,
        'DA:2,1',
        'end_of_record',
        'SF:/external/build/generated.ts',
        'DA:1,1',
        'end_of_record',
      ].join('\n')),
    },
    {
      format: 'istanbul' as const,
      coverage: () => parseIstanbulCoverage(JSON.stringify({
        [join(projectRoot, 'src/component.tsx')]: {
          statementMap: {
            0: { start: { line: 2, column: 2 }, end: { line: 2, column: 3 } },
          },
          s: { 0: 1 },
        },
        '/external/build/generated.ts': {
          statementMap: {
            0: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
          },
          s: { 0: 1 },
        },
      })),
    },
  ])('keeps absolute $format coverage paths out of JSON checkout diagnostics', async ({ format, coverage }) => {
    const result = await analyzeProject({
      projectRoot,
      sourceRoots: ['src'],
      filters: ['orders'],
      coverage: coverage(),
    });

    const report = formatJsonReport({
      toolVersion: '0.1.0',
      coverage: {
        format,
        kind: format === 'lcov' ? 'line' : 'statement',
        path: format === 'lcov' ? 'coverage/lcov.info' : 'coverage/coverage-final.json',
      },
      result,
    });
    const parsed = JSON.parse(report) as {
      diagnostics: Array<{ message: string; source: string }>;
    };

    expect(report).not.toContain(projectRoot);
    expect(parsed.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'src/component.tsx',
        message: 'Coverage file "src/component.tsx" did not match any analyzed source file',
      }),
      expect.objectContaining({ source: '/external/build/generated.ts' }),
    ]));
  });
});

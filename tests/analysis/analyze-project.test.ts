import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  analyzeProject,
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
        coverage: 0,
        coverageKind: 'statement',
        crap: 2,
      },
    ]);
    expect(result.diagnostics.map(({ code, source }) => ({ code, source }))).toEqual([
      { code: 'UNMATCHED_COVERAGE_FILE', source: 'generated/outside.ts' },
    ]);
    await expect(analyzeProject(options)).resolves.toEqual(result);
  });

  it('analyzes LCOV coverage and reports every record unused after filtering', async () => {
    const options: AnalyzeProjectOptions = {
      projectRoot,
      sourceRoots: ['src'],
      filters: ['orders'],
      coverage: parseLcov(await fixture('lcov.info')),
    };

    const result: AnalysisResult = await analyzeProject(options);

    expect(result.entries).toEqual([
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
        coverage: 100,
        coverageKind: 'line',
        crap: 1,
      },
    ]);
    expect(result.entries.map(({ source }) => source)).not.toContain('src/component.tsx');
    expect(result.diagnostics.map(({ code, source }) => ({ code, source }))).toEqual([
      { code: 'UNMATCHED_COVERAGE_FILE', source: 'generated/outside.ts' },
      { code: 'UNMATCHED_COVERAGE_FILE', source: 'src/component.tsx' },
    ]);
    await expect(analyzeProject(options)).resolves.toEqual(result);
  });
});

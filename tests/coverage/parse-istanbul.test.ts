import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CoverageParseError } from '../../src/errors.js';
import { parseIstanbulCoverage } from '../../src/coverage/istanbul/parse-istanbul.js';

const fixture = (name: string): Promise<string> =>
  readFile(fileURLToPath(new URL(`../fixtures/coverage/${name}`, import.meta.url)), 'utf8');

describe('parseIstanbulCoverage', () => {
  it('normalizes and orders files, preserves sorted statement hits, and converts columns to one-based ranges', async () => {
    const coverage = parseIstanbulCoverage(await fixture('istanbul-valid.json'));

    expect(coverage).toEqual({
      format: 'istanbul',
      kind: 'statement',
      files: [
        {
          sourcePath: 'src/Zeta.ts',
          kind: 'statement',
          statements: [
            {
              range: {
                start: { line: 2, column: 3 },
                end: { line: 2, column: 7 },
              },
              hits: 8,
            },
          ],
        },
        {
          sourcePath: 'src/zeta.ts',
          kind: 'statement',
          statements: [
            {
              range: {
                start: { line: 1, column: 2 },
                end: { line: 1, column: 4 },
              },
              hits: 2,
            },
            {
              range: {
                start: { line: 1, column: 5 },
                end: { line: 1, column: 8 },
              },
              hits: 1,
            },
            {
              range: {
                start: { line: 1, column: 5 },
                end: { line: 1, column: 10 },
              },
              hits: 4,
            },
            {
              range: {
                start: { line: 3, column: 1 },
                end: { line: 3, column: 13 },
              },
              hits: 0,
            },
          ],
        },
      ],
    });
  });

  it('rejects invalid JSON', () => {
    expect(() => parseIstanbulCoverage('{')).toThrow(CoverageParseError);
    expect(() => parseIstanbulCoverage('{')).toThrow('Istanbul coverage JSON');
  });

  it('accepts the null end column emitted for an unbounded V8 statement range', () => {
    const coverage = parseIstanbulCoverage(JSON.stringify({
      'src/example.ts': {
        statementMap: {
          0: {
            start: { line: 2, column: 4 },
            end: { line: 3, column: null },
          },
        },
        s: { 0: 1 },
      },
    }));

    const file = coverage.files[0];
    expect(file?.kind).toBe('statement');
    if (file?.kind !== 'statement') throw new Error('Expected statement coverage');

    expect(file.statements[0]?.range).toEqual({
      start: { line: 2, column: 5 },
      end: { line: 3, column: 9007199254740991 },
    });
  });

  it.each([
    ['missingStatementMap', 'src/missing-map.ts.statementMap'],
    ['counterWithoutLocation', 'src/no-location.ts.s.0'],
    ['negativeHitCount', 'src/negative-hit.ts.s.0'],
    ['nonIntegerHitCount', 'src/fractional-hit.ts.s.0'],
    ['invalidRange', 'src/invalid-range.ts.statementMap.0.start.line'],
    ['invalidColumn', 'src/invalid-column.ts.statementMap.0.start.column'],
  ])('rejects %s with a path-specific error', async (caseName, path) => {
    const malformed = JSON.parse(await fixture('istanbul-malformed.json')) as Record<string, unknown>;

    expect(() => parseIstanbulCoverage(JSON.stringify(malformed[caseName]))).toThrow(CoverageParseError);
    expect(() => parseIstanbulCoverage(JSON.stringify(malformed[caseName]))).toThrow(path);
  });
});

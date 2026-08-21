import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CoverageParseError } from '../../src/errors.js';
import { parseLcov } from '../../src/coverage/lcov/parse-lcov.js';

const fixture = (name: string): Promise<string> =>
  readFile(fileURLToPath(new URL(`../fixtures/coverage/${name}`, import.meta.url)), 'utf8');

describe('parseLcov', () => {
  it('normalizes, merges, and orders line coverage records', async () => {
    const coverage = parseLcov(await fixture('lcov-valid.info'));

    expect(coverage).toEqual({
      format: 'lcov',
      kind: 'line',
      files: [
        {
          sourcePath: '/workspace/project/src/Alpha file.ts',
          kind: 'line',
          lines: [
            { line: 2, hits: 8 },
            { line: 10, hits: 1 },
          ],
        },
        {
          sourcePath: 'src/beta.ts',
          kind: 'line',
          lines: [
            { line: 1, hits: 0 },
            { line: 5, hits: 3 },
          ],
        },
      ],
    });
  });

  it.each([
    ['dataBeforeSource', 0, 1, 'DA record requires an SF record'],
    ['malformedSource', 1, 1, 'SF record requires a source path'],
    ['malformedLine', 2, 2, 'DA line number must be a positive integer'],
    ['negativeHits', 3, 2, 'DA hit count must be a nonnegative integer'],
    ['missingTerminator', 4, 3, 'missing end_of_record'],
  ])('rejects %s at source line %i', async (caseName, recordIndex, lineNumber, message) => {
    const malformed = await fixture('lcov-malformed.info');
    const records = malformed.split('\n\n');
    const record = records[recordIndex];
    expect(record).toBeDefined();
    if (record === undefined) throw new Error(`Missing malformed LCOV fixture ${recordIndex}`);

    expect(() => parseLcov(record)).toThrow(CoverageParseError);
    expect(() => parseLcov(record)).toThrow(`line ${lineNumber}: ${message}`);
  });

  it.each([
    ['SF', 'SF record must begin with SF:'],
    ['SF=/workspace/src/file.ts', 'SF record must begin with SF:'],
    ['DA', 'DA record must begin with DA:'],
    ['DA=2,1', 'DA record must begin with DA:'],
  ])('rejects malformed required %s records', (record, message) => {
    expect(() => parseLcov(record)).toThrow(`line 1: ${message}`);
  });

  it('ignores unrelated LCOV record types while still parsing SF and DA records', () => {
    const coverage = parseLcov([
      'TN:suite',
      'SF:src/file.ts',
      'FN:1,file',
      'FNDA:1,file',
      'FNF:1',
      'FNH:1',
      'BRDA:1,0,0,1',
      'LF:1',
      'LH:1',
      'DA:1,1',
      'end_of_record',
    ].join('\n'));

    expect(coverage.files).toEqual([{
      sourcePath: 'src/file.ts',
      kind: 'line',
      lines: [{ line: 1, hits: 1 }],
    }]);
  });

  it('rejects unsafe hit totals for duplicate lines within a record', () => {
    const lcov = [
      'SF:src/file.ts',
      `DA:1,${Number.MAX_SAFE_INTEGER}`,
      'DA:1,1',
      'end_of_record',
    ].join('\n');

    expect(() => parseLcov(lcov)).toThrow('line 3: accumulated DA hit count must be a nonnegative safe integer');
  });

  it('rejects unsafe hit totals across duplicate normalized file records', () => {
    const lcov = [
      'SF:file:///workspace/src/file.ts',
      `DA:1,${Number.MAX_SAFE_INTEGER}`,
      'end_of_record',
      'SF:/workspace/src/file.ts',
      'DA:1,1',
      'end_of_record',
    ].join('\n');

    expect(() => parseLcov(lcov)).toThrow('line 6: accumulated DA hit count must be a nonnegative safe integer');
  });
});

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

    expect(() => parseLcov(record)).toThrow(CoverageParseError);
    expect(() => parseLcov(record)).toThrow(`line ${lineNumber}: ${message}`);
  });

  it.each([
    ['SF', 'SF record must begin with SF:'],
    ['DA', 'DA record must begin with DA:'],
  ])('rejects malformed required %s records', (record, message) => {
    expect(() => parseLcov(record)).toThrow(`line 1: ${message}`);
  });
});

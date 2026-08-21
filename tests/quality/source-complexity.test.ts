import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractFunctions } from '../../src/complexity/extract-functions.js';
import { findSourceFiles } from '../../src/files/find-source-files.js';

describe('source complexity budget', () => {
  it('keeps every production function at cyclomatic complexity 5 or less', async () => {
    const projectRoot = resolve(import.meta.dirname, '../..');
    const sourceFiles = await findSourceFiles(projectRoot, ['src'], []);
    const violations: string[] = [];

    for (const source of sourceFiles) {
      const sourceText = await readFile(resolve(projectRoot, source), 'utf8');
      for (const fn of extractFunctions(source, sourceText)) {
        if (fn.complexity > 5) violations.push(`${fn.name} (${source}): ${fn.complexity}`);
      }
    }

    expect(violations).toEqual([]);
  });
});

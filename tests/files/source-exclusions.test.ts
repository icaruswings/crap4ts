import { describe, expect, it } from 'vitest';
import { ConfigError } from '../../src/errors.js';
import { exclusionPattern, sourceExclusion } from '../../src/files/source-exclusions.js';

describe('source exclusions', () => {
  it('uses project-relative globs with globstars, braces, and dot files', () => {
    const excluded = sourceExclusion(['**/*.{test,spec}.{ts,tsx}', 'src/generated/**']);
    for (const path of ['root.test.ts', 'src/.hidden/x.spec.tsx', 'src/generated/deep/a.ts']) {
      expect(excluded(path)).toBe(true);
    }
    for (const path of ['src/testing.ts', 'src/test-helper.ts', 'other/generated/a.ts']) {
      expect(excluded(path)).toBe(false);
    }
  });

  it('supports exact paths, leading ./, wildcards, and character classes', () => {
    const excluded = sourceExclusion(['./src/exact.ts', 'src/test?.ts', 'src/[ab].ts']);
    expect(excluded('src/exact.ts')).toBe(true);
    expect(excluded('src/test1.ts')).toBe(true);
    expect(excluded('src/a.ts')).toBe(true);
    expect(excluded('src/deep/test1.ts')).toBe(false);
    expect(excluded('src/c.ts')).toBe(false);
  });

  it('has no implicit test exclusions', () => {
    expect(sourceExclusion()('src/a.test.ts')).toBe(false);
    expect(sourceExclusion([])('src/__tests__/a.ts')).toBe(false);
  });

  it.each(['', ' ', '/tmp/**', 'C:/src/**', '../src/**', 'src/../**', '!src/a.ts', 'src/[broken', 'src/('])(
    'rejects invalid pattern %j for library callers', (pattern) => {
      expect(() => sourceExclusion([pattern])).toThrow(ConfigError);
    },
  );

  it('rejects non-string values', () => {
    expect(() => exclusionPattern(42)).toThrow(ConfigError);
  });
});

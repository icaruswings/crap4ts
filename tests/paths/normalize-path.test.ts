import { describe, expect, it } from 'vitest';
import { normalizePath, toProjectRelative } from '../../src/paths/normalize-path.js';

describe('normalizePath', () => {
  it('normalizes file URLs, URL encoding, separators, and dot segments', () => {
    expect(normalizePath('file:///workspace//my%20project\\src/./entry.ts')).toBe(
      '/workspace/my project/src/entry.ts',
    );
  });

  it('preserves an absolute path after normalization', () => {
    expect(normalizePath('/workspace//project/../project/src')).toBe('/workspace/project/src');
  });

  it('normalizes Windows path strings without relying on the host platform', () => {
    expect(normalizePath('C:\\workspace\\project\\src\\..\\Button.tsx')).toBe(
      'C:/workspace/project/Button.tsx',
    );
  });

  it('preserves malformed percent signs while decoding valid URL escapes', () => {
    expect(normalizePath('src/100%coverage/%E2%9C%93.ts')).toBe('src/100%coverage/✓.ts');
  });
});

describe('toProjectRelative', () => {
  it('returns a POSIX relative path for normalized Windows inputs', () => {
    expect(
      toProjectRelative(
        'C:\\workspace\\project',
        'file:C:\\workspace\\project\\src\\components\\Button.tsx',
      ),
    ).toBe('src/components/Button.tsx');
  });
});

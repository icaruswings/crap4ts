import { describe, expect, it } from 'vitest';
import {
  isAbsolutePath,
  normalizePath,
  toProjectDiagnosticPath,
  toProjectRelative,
} from '../../src/paths/normalize-path.js';

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

  it.each([
    ['c:/repo/src/drive.ts', 'src/drive.ts'],
    ['C:/repo/src/component.ts', 'src/component.ts'],
  ])('uses Windows case-insensitive semantics for %s', (value, expected) => {
    expect(toProjectRelative('C:/Repo', value)).toBe(expected);
  });
});

describe('toProjectDiagnosticPath', () => {
  it('preserves cross-drive, traversal, and POSIX case-sensitive external paths', () => {
    expect(toProjectDiagnosticPath('C:/Repo', 'D:/Repo/src/file.ts')).toBe(
      'D:/Repo/src/file.ts',
    );
    expect(toProjectDiagnosticPath('C:/Repo', 'C:/Other/file.ts')).toBe('C:/Other/file.ts');
    expect(toProjectDiagnosticPath('/workspace/Repo', '/workspace/repo/src/file.ts')).toBe(
      '/workspace/repo/src/file.ts',
    );
  });
});

describe('isAbsolutePath', () => {
  it('recognizes POSIX and Windows-drive absolute paths after normalization', () => {
    expect(isAbsolutePath('/workspace/project/src/file.ts')).toBe(true);
    expect(isAbsolutePath('C:/repo/src/file.ts')).toBe(true);
    expect(isAbsolutePath('src/file.ts')).toBe(false);
  });
});

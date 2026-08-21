import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CoverageFile, LineCoverageFile } from '../../src/coverage/model.js';
import { matchCoverageFile } from '../../src/coverage/match-file.js';
import { AmbiguousCoveragePathError } from '../../src/errors.js';

const temporaryPaths: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryPaths.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

describe('matchCoverageFile', () => {
  it('prefers an exact normalized project-relative path over suffix matches', () => {
    const exact = lineFile('src/orders.ts');
    const suffix = lineFile('/coverage-copy/src/orders.ts');

    expect(
      matchCoverageFile('/workspace/project', '/workspace/project/src/./orders.ts', [suffix, exact]),
    ).toBe(exact);
  });

  it('matches an exact normalized absolute path', () => {
    const file = lineFile('file:///workspace/my%20project/src/orders.ts');

    expect(
      matchCoverageFile('/workspace/my project', 'src/orders.ts', [file]),
    ).toBe(file);
  });

  it('matches the canonical absolute source path through a project symlink', async () => {
    const realRoot = await mkdtemp(join(tmpdir(), 'crap4ts-real-'));
    const linkedRoot = `${realRoot}-link`;
    temporaryPaths.push(linkedRoot, realRoot);
    await mkdir(join(realRoot, 'src'));
    await writeFile(join(realRoot, 'src', 'orders.ts'), 'export function orders() {}\n');
    await symlink(realRoot, linkedRoot, 'dir');
    const file = lineFile(join(realRoot, 'src', 'orders.ts'));

    expect(matchCoverageFile(linkedRoot, join(linkedRoot, 'src', 'orders.ts'), [file])).toBe(file);
  });

  it('matches a relative coverage path when the source and project root use physical and symlink paths', async () => {
    const realRoot = await mkdtemp(join(tmpdir(), 'crap4ts-real-'));
    const linkedRoot = `${realRoot}-link`;
    temporaryPaths.push(linkedRoot, realRoot);
    await mkdir(join(realRoot, 'src'));
    await writeFile(join(realRoot, 'src', 'orders.ts'), 'export function orders() {}\n');
    await symlink(realRoot, linkedRoot, 'dir');
    const file = lineFile('src/orders.ts');

    expect(matchCoverageFile(linkedRoot, join(realRoot, 'src', 'orders.ts'), [file])).toBe(file);
  });

  it('prefers an exact Windows absolute path over a competing suffix match', () => {
    const exact = lineFile('C:\\workspace\\project\\src\\orders.ts');
    const suffix = lineFile('/remote/build/src/orders.ts');

    expect(
      matchCoverageFile('C:\\workspace\\project', 'src\\orders.ts', [suffix, exact]),
    ).toBe(exact);
  });

  it('uses a unique complete-segment suffix when exact candidates do not match', () => {
    const file = lineFile('/remote/agent/build/src/orders.ts');

    expect(matchCoverageFile('/workspace/project', 'src/orders.ts', [file])).toBe(file);
  });

  it('does not match a partial path-segment suffix', () => {
    const file = lineFile('/remote/agent/not-src/orders.ts');

    expect(matchCoverageFile('/workspace/project', 'src/orders.ts', [file])).toBeNull();
  });

  it('does not match a coverage path shorter than the project-relative source path', () => {
    const file = lineFile('orders.ts');

    expect(matchCoverageFile('/workspace/project', 'src/orders.ts', [file])).toBeNull();
  });

  it('returns null when no coverage path matches', () => {
    expect(
      matchCoverageFile('/workspace/project', 'src/orders.ts', [lineFile('src/customers.ts')]),
    ).toBeNull();
  });

  it('rejects an ambiguous suffix and lists every candidate in stable order', () => {
    const files: CoverageFile[] = [
      lineFile('/z-build/src/orders.ts'),
      lineFile('/a-build/src/orders.ts'),
    ];

    const match = (): CoverageFile | null =>
      matchCoverageFile('/workspace/project', 'src/orders.ts', files);

    expect(match).toThrow(AmbiguousCoveragePathError);
    expect(match).toThrow('/a-build/src/orders.ts');
    expect(match).toThrow('/z-build/src/orders.ts');

    try {
      match();
    } catch (error) {
      expect((error as Error).message.indexOf('/a-build/src/orders.ts')).toBeLessThan(
        (error as Error).message.indexOf('/z-build/src/orders.ts'),
      );
    }
  });

  it('rejects ambiguity between exact relative and absolute candidates', () => {
    const files: CoverageFile[] = [
      lineFile('src/orders.ts'),
      lineFile('/workspace/project/src/orders.ts'),
    ];

    expect(() => matchCoverageFile('/workspace/project', 'src/orders.ts', files)).toThrow(
      AmbiguousCoveragePathError,
    );
  });
});

function lineFile(sourcePath: string): LineCoverageFile {
  return { sourcePath, kind: 'line', lines: [] };
}

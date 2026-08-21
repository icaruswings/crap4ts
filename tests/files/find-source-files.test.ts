import { chmod, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigError, NoSourceFilesError, SourceTraversalError } from '../../src/errors.js';
import { findSourceFiles } from '../../src/files/find-source-files.js';

const temporaryDirectories: string[] = [];

async function makeProject(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'crap4ts-find-source-files-'));
  temporaryDirectories.push(projectRoot);
  return projectRoot;
}

async function writeProjectFile(projectRoot: string, relativePath: string): Promise<void> {
  const filePath = join(projectRoot, relativePath);
  await mkdir(join(filePath, '..'), { recursive: true });
  await writeFile(filePath, 'export {};\n');
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('findSourceFiles', () => {
  it('returns TypeScript sources from multiple roots in lexical project-relative order', async () => {
    const projectRoot = await makeProject();
    await Promise.all([
      writeProjectFile(projectRoot, 'src/zeta.ts'),
      writeProjectFile(projectRoot, 'src/components/Button.tsx'),
      writeProjectFile(projectRoot, 'src/types.d.ts'),
      writeProjectFile(projectRoot, 'src/helper.js'),
      writeProjectFile(projectRoot, 'src/node_modules/ignored.ts'),
      writeProjectFile(projectRoot, 'packages/api/server.ts'),
      writeProjectFile(projectRoot, 'packages/api/view.tsx'),
    ]);

    await expect(findSourceFiles(projectRoot, ['packages', 'src'], [])).resolves.toEqual([
      'packages/api/server.ts',
      'packages/api/view.tsx',
      'src/components/Button.tsx',
      'src/zeta.ts',
    ]);
  });

  it('applies filters as OR substrings to POSIX project-relative paths', async () => {
    const projectRoot = await makeProject();
    await Promise.all([
      writeProjectFile(projectRoot, 'src/components/Button.tsx'),
      writeProjectFile(projectRoot, 'src/features/cart/checkout.ts'),
      writeProjectFile(projectRoot, 'src/features/profile/settings.ts'),
    ]);

    await expect(findSourceFiles(projectRoot, ['src'], ['components/', 'cart/'])).resolves.toEqual([
      'src/components/Button.tsx',
      'src/features/cart/checkout.ts',
    ]);
  });

  it('does not follow directory symlinks while walking a source root', async () => {
    const projectRoot = await makeProject();
    const outsideDirectory = await mkdtemp(join(tmpdir(), 'crap4ts-outside-source-files-'));
    temporaryDirectories.push(outsideDirectory);
    await writeProjectFile(projectRoot, 'src/kept.ts');
    await writeFile(join(outsideDirectory, 'escaped.ts'), 'export {};\n');
    await symlink(outsideDirectory, join(projectRoot, 'src', 'linked-directory'), 'dir');

    await expect(findSourceFiles(projectRoot, ['src'], [])).resolves.toEqual(['src/kept.ts']);
  });

  it('rejects source roots outside the project', async () => {
    const projectRoot = await makeProject();

    await expect(findSourceFiles(projectRoot, ['../outside'], [])).rejects.toBeInstanceOf(ConfigError);
  });

  it('rejects configured source-root symlinks that target outside the project', async () => {
    const projectRoot = await makeProject();
    const outsideDirectory = await mkdtemp(join(tmpdir(), 'crap4ts-outside-source-root-'));
    temporaryDirectories.push(outsideDirectory);
    await writeFile(join(outsideDirectory, 'escaped.ts'), 'export {};\n');
    await symlink(outsideDirectory, join(projectRoot, 'linked-source-root'), 'dir');

    await expect(findSourceFiles(projectRoot, ['linked-source-root'], [])).rejects.toBeInstanceOf(
      ConfigError,
    );
  });

  it('wraps a source-root realpath failure with the configured path', async () => {
    const projectRoot = await makeProject();
    await symlink('loop', join(projectRoot, 'loop'), 'dir');

    const error = await findSourceFiles(projectRoot, ['loop'], []).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(SourceTraversalError);
    expect(error).toHaveProperty('message', 'Could not resolve source root: loop');
  });

  it('wraps a source directory traversal failure with its project-relative path', async () => {
    const projectRoot = await makeProject();
    const unreadable = join(projectRoot, 'src/unreadable');
    await mkdir(unreadable, { recursive: true });
    await chmod(unreadable, 0o000);

    const error = await findSourceFiles(projectRoot, ['src'], []).catch((reason: unknown) => reason);
    await chmod(unreadable, 0o700);

    expect(error).toBeInstanceOf(SourceTraversalError);
    expect(error).toHaveProperty('message', 'Could not read source directory: src/unreadable');
  });

  it('reports configured roots and filters when no matching source files exist', async () => {
    const projectRoot = await makeProject();
    await writeProjectFile(projectRoot, 'src/available.ts');

    await expect(findSourceFiles(projectRoot, ['src'], ['missing/'])).rejects.toBeInstanceOf(
      NoSourceFilesError,
    );
    await expect(findSourceFiles(projectRoot, ['src'], ['missing/'])).rejects.toThrow('src');
    await expect(findSourceFiles(projectRoot, ['src'], ['missing/'])).rejects.toThrow('missing/');
  });
});

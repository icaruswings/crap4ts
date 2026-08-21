import { lstat, readdir } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { ConfigError, NoSourceFilesError } from '../errors.js';
import { normalizePath, toProjectRelative } from '../paths/normalize-path.js';

function isWithinProject(projectRoot: string, candidate: string): boolean {
  const pathFromProject = relative(projectRoot, candidate);

  return pathFromProject !== '..'
    && !pathFromProject.startsWith(`..${sep}`)
    && !isAbsolute(pathFromProject);
}

function isSourceFile(projectRelativePath: string): boolean {
  return (projectRelativePath.endsWith('.ts') || projectRelativePath.endsWith('.tsx'))
    && !projectRelativePath.endsWith('.d.ts')
    && !projectRelativePath.split('/').includes('node_modules');
}

async function walkSourceRoot(
  projectRoot: string,
  sourceRoot: string,
  sourceFiles: Set<string>,
): Promise<void> {
  const rootStats = await lstat(sourceRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    return;
  }

  const entries = await readdir(sourceRoot, { withFileTypes: true });
  entries.sort((left, right) => {
    if (left.name < right.name) {
      return -1;
    }
    if (left.name > right.name) {
      return 1;
    }
    return 0;
  });

  for (const entry of entries) {
    const entryPath = join(sourceRoot, entry.name);

    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') {
        await walkSourceRoot(projectRoot, entryPath, sourceFiles);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const projectRelativePath = toProjectRelative(projectRoot, entryPath);
    if (isSourceFile(projectRelativePath)) {
      sourceFiles.add(projectRelativePath);
    }
  }
}

function noSourceFilesError(sourceRoots: string[], filters: string[]): NoSourceFilesError {
  const roots = sourceRoots.length === 0 ? '(none)' : sourceRoots.join(', ');
  const configuredFilters = filters.length === 0 ? '(none)' : filters.join(', ');

  return new NoSourceFilesError(
    `No TypeScript source files found for source roots: ${roots}; filters: ${configuredFilters}`,
  );
}

export async function findSourceFiles(
  projectRoot: string,
  sourceRoots: string[],
  filters: string[],
): Promise<string[]> {
  const resolvedProjectRoot = resolve(projectRoot);
  const resolvedSourceRoots = sourceRoots.map((sourceRoot) => {
    const resolvedSourceRoot = resolve(resolvedProjectRoot, normalizePath(sourceRoot));
    if (!isWithinProject(resolvedProjectRoot, resolvedSourceRoot)) {
      throw new ConfigError(`Source root resolves outside the project: ${sourceRoot}`);
    }

    return resolvedSourceRoot;
  });
  const sourceFiles = new Set<string>();

  for (const sourceRoot of resolvedSourceRoots) {
    await walkSourceRoot(resolvedProjectRoot, sourceRoot, sourceFiles);
  }

  const matchingFiles = [...sourceFiles]
    .filter((sourceFile) => filters.length === 0 || filters.some((filter) => sourceFile.includes(filter)))
    .sort();

  if (matchingFiles.length === 0) {
    throw noSourceFilesError(sourceRoots, filters);
  }

  return matchingFiles;
}

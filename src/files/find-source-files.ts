import type { Dirent, Stats } from 'node:fs';
import { lstat, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { ConfigError, NoSourceFilesError, SourceTraversalError } from '../errors.js';
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
  const rootStats = await sourceRootStats(projectRoot, sourceRoot);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) return;

  const entries = await sourceRootEntries(projectRoot, sourceRoot);
  for (const entry of entries) {
    await collectEntry(projectRoot, sourceRoot, entry, sourceFiles);
  }
}

async function sourceRootStats(projectRoot: string, sourceRoot: string): Promise<Stats> {
  const displayPath = toProjectRelative(projectRoot, sourceRoot);
  try {
    return await lstat(sourceRoot);
  } catch (error) {
    throw new SourceTraversalError(`Could not inspect source path: ${displayPath}`, { cause: error });
  }
}

async function sourceRootEntries(projectRoot: string, sourceRoot: string): Promise<Dirent[]> {
  const displayPath = toProjectRelative(projectRoot, sourceRoot);
  try {
    return (await readdir(sourceRoot, { withFileTypes: true })).sort(compareDirectoryEntries);
  } catch (error) {
    throw new SourceTraversalError(`Could not read source directory: ${displayPath}`, { cause: error });
  }
}

function compareDirectoryEntries(left: Dirent, right: Dirent): number {
  if (left.name < right.name) return -1;
  if (left.name > right.name) return 1;
  return 0;
}

async function collectEntry(
  projectRoot: string,
  sourceRoot: string,
  entry: Dirent,
  sourceFiles: Set<string>,
): Promise<void> {
  if (entry.isSymbolicLink()) return;

  const entryPath = join(sourceRoot, entry.name);
  if (entry.isDirectory()) {
    return collectDirectory(projectRoot, entryPath, entry.name, sourceFiles);
  }
  if (!entry.isFile()) return;

  const projectRelativePath = toProjectRelative(projectRoot, entryPath);
  if (isSourceFile(projectRelativePath)) {
    sourceFiles.add(projectRelativePath);
  }
}

async function collectDirectory(
  projectRoot: string,
  directoryPath: string,
  directoryName: string,
  sourceFiles: Set<string>,
): Promise<void> {
  if (directoryName === 'node_modules') return;
  await walkSourceRoot(projectRoot, directoryPath, sourceFiles);
}

interface ResolvedProjectRoot {
  lexical: string;
  canonical: string;
}

async function resolveProjectRoot(projectRoot: string): Promise<ResolvedProjectRoot> {
  const lexical = resolve(projectRoot);
  try {
    return { lexical, canonical: await realpath(lexical) };
  } catch (error) {
    throw new SourceTraversalError(`Could not resolve project root: ${projectRoot}`, { cause: error });
  }
}

async function resolveSourceRoot(
  projectRoot: ResolvedProjectRoot,
  sourceRoot: string,
): Promise<string> {
  const resolvedSourceRoot = resolve(projectRoot.lexical, normalizePath(sourceRoot));
  if (!isWithinProject(projectRoot.lexical, resolvedSourceRoot)) {
    throw new ConfigError(`Source root resolves outside the project: ${sourceRoot}`);
  }

  let canonicalSourceRoot: string;
  try {
    canonicalSourceRoot = await realpath(resolvedSourceRoot);
  } catch (error) {
    if (isMissingPath(error)) {
      throw new ConfigError(`Could not resolve source root: ${sourceRoot}`, { cause: error });
    }
    throw new SourceTraversalError(`Could not resolve source root: ${sourceRoot}`, { cause: error });
  }
  if (!isWithinProject(projectRoot.canonical, canonicalSourceRoot)) {
    throw new ConfigError(`Source root resolves outside the project: ${sourceRoot}`);
  }

  return resolvedSourceRoot;
}

function matchingSourceFiles(sourceFiles: Set<string>, filters: string[]): string[] {
  return [...sourceFiles]
    .filter((sourceFile) => filters.length === 0 || filters.some((filter) => sourceFile.includes(filter)))
    .sort();
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
  const resolvedProjectRoot = await resolveProjectRoot(projectRoot);
  const resolvedSourceRoots = await Promise.all(
    sourceRoots.map((sourceRoot) => resolveSourceRoot(resolvedProjectRoot, sourceRoot)),
  );
  const sourceFiles = new Set<string>();

  for (const sourceRoot of resolvedSourceRoots) {
    await walkSourceRoot(resolvedProjectRoot.lexical, sourceRoot, sourceFiles);
  }

  const matchingFiles = matchingSourceFiles(sourceFiles, filters);

  if (matchingFiles.length === 0) {
    throw noSourceFilesError(sourceRoots, filters);
  }

  return matchingFiles;
}

function isMissingPath(error: unknown): boolean {
  return error instanceof Error
    && 'code' in error
    && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

import { realpathSync } from 'node:fs';
import { posix } from 'node:path';
import { AmbiguousCoveragePathError } from '../errors.js';
import { normalizePath, toProjectRelative } from '../paths/normalize-path.js';
import type { CoverageFile } from './model.js';

export function matchCoverageFile(
  projectRoot: string,
  source: string,
  files: CoverageFile[],
): CoverageFile | null {
  const normalizedRoot = absolutePath(normalizePath(projectRoot));
  const canonicalRoot = canonicalPath(normalizedRoot);
  const normalizedSource = normalizePath(source);
  const absoluteSource = isAbsolutePath(normalizedSource)
    ? normalizedSource
    : normalizePath(posix.join(normalizedRoot, normalizedSource));
  const relativeSource = normalizePath(toProjectRelative(normalizedRoot, absoluteSource));
  const canonicalSource = canonicalPath(absoluteSource);
  const canonicalRelativeSource = normalizePath(toProjectRelative(canonicalRoot, canonicalSource));
  const relativeCandidates = new Set([relativeSource, canonicalRelativeSource]);
  const exactCandidates = new Set([
    ...relativeCandidates,
    absoluteSource,
    canonicalSource,
  ]);
  const normalizedFiles = files.map((file) => ({ file, path: normalizePath(file.sourcePath) }));

  const exactMatches = normalizedFiles.filter(({ path }) => exactCandidates.has(path));
  if (exactMatches.length > 0) return uniqueMatch(source, exactMatches);

  const suffixMatches = normalizedFiles.filter(({ path }) =>
    [...relativeCandidates].some((candidate) => isCompleteSegmentSuffix(path, candidate)),
  );
  if (suffixMatches.length > 0) return uniqueMatch(source, suffixMatches);

  return null;
}

interface NormalizedCoverageFile {
  file: CoverageFile;
  path: string;
}

function uniqueMatch(source: string, matches: NormalizedCoverageFile[]): CoverageFile {
  if (matches.length === 1) return matches[0]!.file;

  const candidates = matches.map(({ path }) => path).sort(compareStrings);
  throw new AmbiguousCoveragePathError(
    `Coverage path for "${normalizePath(source)}" is ambiguous: ${candidates.join(', ')}`,
  );
}

function absolutePath(path: string): string {
  return isAbsolutePath(path) ? path : normalizePath(posix.resolve(path));
}

function canonicalPath(path: string): string {
  try {
    return normalizePath(realpathSync.native(path));
  } catch {
    return path;
  }
}

function isAbsolutePath(path: string): boolean {
  return posix.isAbsolute(path) || /^[A-Za-z]:\//.test(path);
}

function isCompleteSegmentSuffix(path: string, suffix: string): boolean {
  if (suffix.length === 0 || suffix === '.' || suffix.startsWith('../') || isAbsolutePath(suffix)) {
    return false;
  }

  return path.endsWith(`/${suffix}`);
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

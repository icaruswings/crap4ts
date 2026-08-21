import { lstat, realpath, rm } from 'node:fs/promises';
import { dirname, isAbsolute, posix, resolve, sep, win32 } from 'node:path';
import { ConfigError } from '../errors.js';

function isMissingComponent(error: unknown): boolean {
  return error instanceof Error
    && 'code' in error
    && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

function isProjectDescendant(projectRoot: string, candidate: string): boolean {
  const rootPrefix = projectRoot.endsWith(sep) ? projectRoot : `${projectRoot}${sep}`;
  return candidate.startsWith(rootPrefix);
}

function invalidTarget(target: string): ConfigError {
  return new ConfigError(`Coverage cleanup target must stay below the project root: ${target}`);
}

function platformPath(target: string): string {
  return sep === '/' ? target.replaceAll('\\', '/') : target.replaceAll('/', '\\');
}

async function resolveExistingComponents(candidate: string, target: string): Promise<string> {
  let existingCandidate = candidate;
  const missingSegments: string[] = [];

  while (true) {
    try {
      await lstat(existingCandidate);
    } catch (error) {
      if (!isMissingComponent(error)) {
        throw new ConfigError(`Could not inspect coverage cleanup target: ${target}`, { cause: error });
      }
      const parent = dirname(existingCandidate);
      if (parent === existingCandidate) throw invalidTarget(target);
      missingSegments.unshift(existingCandidate.slice(parent.length + (parent.endsWith(sep) ? 0 : 1)));
      existingCandidate = parent;
      continue;
    }

    try {
      return resolve(await realpath(existingCandidate), ...missingSegments);
    } catch (error) {
      throw new ConfigError(`Could not resolve coverage cleanup target: ${target}`, { cause: error });
    }
  }
}

async function safeCleanupTarget(realProjectRoot: string, target: string): Promise<string> {
  if (target.trim().length === 0
    || isAbsolute(target)
    || posix.isAbsolute(target)
    || win32.isAbsolute(target)) {
    throw invalidTarget(target);
  }

  const resolvedTarget = resolve(realProjectRoot, platformPath(target));
  if (!isProjectDescendant(realProjectRoot, resolvedTarget)) throw invalidTarget(target);

  const realTarget = await resolveExistingComponents(resolvedTarget, target);
  if (!isProjectDescendant(realProjectRoot, realTarget)) throw invalidTarget(target);

  return resolvedTarget;
}

export async function prepareCoverage(
  projectRoot: string,
  artifactPath: string,
  coverageDirectory?: string,
): Promise<void> {
  const realProjectRoot = await realpath(resolve(projectRoot));
  const artifact = await safeCleanupTarget(realProjectRoot, artifactPath);
  const directory = coverageDirectory === undefined
    ? undefined
    : await safeCleanupTarget(realProjectRoot, coverageDirectory);

  await rm(artifact, { force: true });
  if (directory !== undefined) await rm(directory, { recursive: true, force: true });
}

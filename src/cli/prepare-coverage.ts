import { lstat, realpath, rm } from 'node:fs/promises';
import { dirname, isAbsolute, posix, resolve, sep, win32 } from 'node:path';
import { ConfigError, CoverageCleanupError } from '../errors.js';

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

interface ExistingComponent {
  kind: 'existing';
  path: string;
}

interface MissingComponent {
  kind: 'missing';
  parentPath: string;
  segment: string;
}

type ComponentInspection = ExistingComponent | MissingComponent;

async function inspectExistingComponent(
  candidate: string,
  target: string,
): Promise<ComponentInspection> {
  try {
    await lstat(candidate);
    return { kind: 'existing', path: candidate };
  } catch (error) {
    if (!isMissingComponent(error)) {
      throw new CoverageCleanupError(
        `Could not inspect coverage cleanup target: ${target}`,
        { cause: error },
      );
    }
    const parentPath = dirname(candidate);
    if (parentPath === candidate) throw invalidTarget(target);
    const separatorLength = parentPath.endsWith(sep) ? 0 : 1;
    return {
      kind: 'missing',
      parentPath,
      segment: candidate.slice(parentPath.length + separatorLength),
    };
  }
}

async function resolveFromExistingComponent(
  existingPath: string,
  missingSegments: string[],
  target: string,
): Promise<string> {
  try {
    return resolve(await realpath(existingPath), ...missingSegments);
  } catch (error) {
    throw new CoverageCleanupError(
      `Could not resolve coverage cleanup target: ${target}`,
      { cause: error },
    );
  }
}

async function resolveExistingComponents(candidate: string, target: string): Promise<string> {
  let existingCandidate = candidate;
  const missingSegments: string[] = [];

  while (true) {
    const inspection = await inspectExistingComponent(existingCandidate, target);
    if (inspection.kind === 'existing') {
      return resolveFromExistingComponent(inspection.path, missingSegments, target);
    }
    missingSegments.unshift(inspection.segment);
    existingCandidate = inspection.parentPath;
  }
}

function isAbsoluteCleanupPath(target: string): boolean {
  return isAbsolute(target) || posix.isAbsolute(target) || win32.isAbsolute(target);
}

function validateRelativeCleanupPath(target: string): void {
  if (target.trim().length === 0) throw invalidTarget(target);
  if (isAbsoluteCleanupPath(target)) throw invalidTarget(target);
}

async function resolveProjectRoot(projectRoot: string): Promise<string> {
  try {
    return await realpath(resolve(projectRoot));
  } catch (error) {
    throw new CoverageCleanupError(
      `Could not resolve project root for coverage cleanup: ${projectRoot}`,
      { cause: error },
    );
  }
}

async function resolveCleanupTarget(realProjectRoot: string, target: string): Promise<string> {
  validateRelativeCleanupPath(target);

  const resolvedTarget = resolve(realProjectRoot, platformPath(target));
  if (!isProjectDescendant(realProjectRoot, resolvedTarget)) throw invalidTarget(target);

  const realTarget = await resolveExistingComponents(resolvedTarget, target);
  if (!isProjectDescendant(realProjectRoot, realTarget)) throw invalidTarget(target);

  return resolvedTarget;
}

async function removeArtifact(artifact: string, configuredPath: string): Promise<void> {
  try {
    await rm(artifact, { force: true });
  } catch (error) {
    throw new CoverageCleanupError(`Could not remove coverage artifact: ${configuredPath}`, {
      cause: error,
    });
  }
}

async function removeDirectory(directory: string, configuredPath: string): Promise<void> {
  try {
    await rm(directory, { recursive: true, force: true });
  } catch (error) {
    throw new CoverageCleanupError(
      `Could not remove coverage directory: ${configuredPath}`,
      { cause: error },
    );
  }
}

export async function prepareCoverage(
  projectRoot: string,
  artifactPath: string,
  coverageDirectory?: string,
): Promise<void> {
  const realProjectRoot = await resolveProjectRoot(projectRoot);
  const artifact = await resolveCleanupTarget(realProjectRoot, artifactPath);
  const directory = coverageDirectory === undefined
    ? undefined
    : {
        path: await resolveCleanupTarget(realProjectRoot, coverageDirectory),
        configuredPath: coverageDirectory,
      };

  await removeArtifact(artifact, artifactPath);
  if (directory !== undefined) await removeDirectory(directory.path, directory.configuredPath);
}

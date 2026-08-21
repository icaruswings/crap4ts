import { access, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prepareCoverage } from '../../src/cli/prepare-coverage.js';
import { ConfigError } from '../../src/errors.js';

const temporaryDirectories: string[] = [];

interface TemporaryProject {
  projectRoot: string;
  outsideDirectory: string;
}

async function makeProject(): Promise<TemporaryProject> {
  const sandbox = await mkdtemp(join(tmpdir(), 'crap4ts-prepare-coverage-'));
  const projectRoot = join(sandbox, 'project');
  const outsideDirectory = join(sandbox, 'outside');
  temporaryDirectories.push(sandbox);
  await Promise.all([
    mkdir(projectRoot, { recursive: true }),
    mkdir(outsideDirectory, { recursive: true }),
  ]);
  return { projectRoot, outsideDirectory };
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function writeProjectFile(projectRoot: string, relativePath: string): Promise<string> {
  const path = join(projectRoot, relativePath);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, 'keep or remove\n');
  return path;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('prepareCoverage', () => {
  it('removes the configured artifact and explicitly configured disposable directory', async () => {
    const { projectRoot } = await makeProject();
    const artifact = await writeProjectFile(projectRoot, 'artifacts/coverage-final.json');
    const disposableFile = await writeProjectFile(projectRoot, '.coverage-work/cache/result.json');

    await prepareCoverage(projectRoot, 'artifacts/coverage-final.json', '.coverage-work');

    await expect(exists(artifact)).resolves.toBe(false);
    await expect(exists(join(projectRoot, '.coverage-work'))).resolves.toBe(false);
    await expect(exists(disposableFile)).resolves.toBe(false);
  });

  it('removes only the artifact when its parent is not an explicit cleanup directory', async () => {
    const { projectRoot } = await makeProject();
    const artifact = await writeProjectFile(projectRoot, 'coverage/coverage-final.json');
    const sibling = await writeProjectFile(projectRoot, 'coverage/keep-me.json');

    await prepareCoverage(projectRoot, 'coverage/coverage-final.json');

    await expect(exists(artifact)).resolves.toBe(false);
    await expect(exists(sibling)).resolves.toBe(true);
  });

  it.each([
    { name: 'absolute artifact', artifact: '/tmp/coverage-final.json' },
    { name: 'Windows absolute artifact', artifact: 'C:\\coverage\\coverage-final.json' },
    { name: 'empty artifact', artifact: '' },
    { name: 'dot artifact', artifact: '.' },
    { name: 'parent artifact', artifact: '..' },
    { name: 'outside artifact', artifact: '../outside/coverage-final.json' },
    { name: 'project-root artifact', artifact: 'coverage/..' },
  ])('rejects a $name target', async ({ artifact }) => {
    const { projectRoot } = await makeProject();

    await expect(prepareCoverage(projectRoot, artifact)).rejects.toBeInstanceOf(ConfigError);
  });

  it.each([
    { name: 'absolute directory', directory: '/tmp/coverage' },
    { name: 'Windows absolute directory', directory: 'C:\\coverage' },
    { name: 'empty directory', directory: '' },
    { name: 'dot directory', directory: '.' },
    { name: 'parent directory', directory: '..' },
    { name: 'outside directory', directory: '../outside' },
    { name: 'project-root directory', directory: 'coverage/..' },
  ])('rejects a $name target before removing a safe artifact', async ({ directory }) => {
    const { projectRoot } = await makeProject();
    const artifact = await writeProjectFile(projectRoot, 'coverage-final.json');

    await expect(prepareCoverage(projectRoot, 'coverage-final.json', directory)).rejects.toBeInstanceOf(
      ConfigError,
    );
    await expect(exists(artifact)).resolves.toBe(true);
  });

  it('rejects an artifact symlink that resolves outside the project', async () => {
    const { projectRoot, outsideDirectory } = await makeProject();
    const outsideArtifact = join(outsideDirectory, 'coverage-final.json');
    const artifactLink = join(projectRoot, 'coverage-final.json');
    await writeFile(outsideArtifact, '{}\n');
    await symlink(outsideArtifact, artifactLink, 'file');

    await expect(prepareCoverage(projectRoot, 'coverage-final.json')).rejects.toBeInstanceOf(ConfigError);
    await expect(exists(outsideArtifact)).resolves.toBe(true);
    await expect(exists(artifactLink)).resolves.toBe(true);
  });

  it('rejects a cleanup-directory symlink that resolves outside the project', async () => {
    const { projectRoot, outsideDirectory } = await makeProject();
    const outsideFile = join(outsideDirectory, 'keep-me.json');
    const directoryLink = join(projectRoot, 'coverage');
    const artifact = await writeProjectFile(projectRoot, 'coverage-final.json');
    await writeFile(outsideFile, '{}\n');
    await symlink(outsideDirectory, directoryLink, 'dir');

    await expect(prepareCoverage(projectRoot, 'coverage-final.json', 'coverage')).rejects.toBeInstanceOf(
      ConfigError,
    );
    await expect(exists(artifact)).resolves.toBe(true);
    await expect(exists(outsideFile)).resolves.toBe(true);
    await expect(exists(directoryLink)).resolves.toBe(true);
  });

  it.each([
    { name: 'artifact', artifact: 'escaped/missing/coverage-final.json' },
    { name: 'directory', artifact: 'coverage-final.json', directory: 'escaped/missing/coverage' },
  ])('rejects a nonexistent $name below an outside-pointing symlink', async ({ artifact, directory }) => {
    const { projectRoot, outsideDirectory } = await makeProject();
    const escapeLink = join(projectRoot, 'escaped');
    const safeArtifact = await writeProjectFile(projectRoot, 'coverage-final.json');
    await symlink(outsideDirectory, escapeLink, 'dir');

    await expect(prepareCoverage(projectRoot, artifact, directory)).rejects.toBeInstanceOf(ConfigError);
    await expect(exists(safeArtifact)).resolves.toBe(true);
    await expect(exists(escapeLink)).resolves.toBe(true);
  });
});

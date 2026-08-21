import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigError } from '../../src/errors.js';
import { loadConfig } from '../../src/config/load-config.js';

const temporaryDirectories: string[] = [];

async function temporaryProject(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'crap4ts-config-'));
  temporaryDirectories.push(projectRoot);
  return projectRoot;
}

async function writeConfig(projectRoot: string, contents: unknown): Promise<void> {
  const text = typeof contents === 'string' ? contents : JSON.stringify(contents);
  await writeFile(join(projectRoot, 'crap4ts.config.json'), text);
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe('loadConfig', () => {
  it('loads every approved configuration field', async () => {
    const projectRoot = await temporaryProject();
    await writeConfig(projectRoot, {
      sourceRoots: ['src', 'packages/core/src'],
      coverageCommand: 'npm test -- --coverage',
      coveragePath: 'coverage/lcov.info',
      coverageFormat: 'lcov',
      coverageDirectory: 'coverage',
    });

    await expect(loadConfig(projectRoot)).resolves.toEqual({
      sourceRoots: ['src', 'packages/core/src'],
      coverageCommand: 'npm test -- --coverage',
      coveragePath: 'coverage/lcov.info',
      coverageFormat: 'lcov',
      coverageDirectory: 'coverage',
    });
  });

  it('uses the default source root when the project config is missing', async () => {
    const parentRoot = await temporaryProject();
    const projectRoot = join(parentRoot, 'nested');
    await mkdir(projectRoot);
    await writeConfig(parentRoot, { sourceRoots: ['parent-src'] });

    await expect(loadConfig(projectRoot)).resolves.toEqual({ sourceRoots: ['src'] });
  });

  it('rejects malformed JSON', async () => {
    const projectRoot = await temporaryProject();
    await writeConfig(projectRoot, '{"sourceRoots": [}');

    await expect(loadConfig(projectRoot)).rejects.toBeInstanceOf(ConfigError);
  });

  it.each([
    { name: 'null', config: null },
    { name: 'an array', config: [] },
    { name: 'a string', config: 'not an object' },
    { name: 'a non-array sourceRoots value', config: { sourceRoots: 'src' } },
    { name: 'a non-string source root', config: { sourceRoots: ['src', 7] } },
    { name: 'a non-string coverage command', config: { sourceRoots: ['src'], coverageCommand: 7 } },
    { name: 'a non-string coverage path', config: { sourceRoots: ['src'], coveragePath: false } },
    { name: 'a non-string coverage format', config: { sourceRoots: ['src'], coverageFormat: 7 } },
    { name: 'a non-string coverage directory', config: { sourceRoots: ['src'], coverageDirectory: {} } },
  ])('rejects $name', async ({ config }) => {
    const projectRoot = await temporaryProject();
    await writeConfig(projectRoot, config);

    await expect(loadConfig(projectRoot)).rejects.toBeInstanceOf(ConfigError);
  });

  it('rejects an empty source root list', async () => {
    const projectRoot = await temporaryProject();
    await writeConfig(projectRoot, { sourceRoots: [] });

    await expect(loadConfig(projectRoot)).rejects.toBeInstanceOf(ConfigError);
  });

  it('rejects unknown configuration keys', async () => {
    const projectRoot = await temporaryProject();
    await writeConfig(projectRoot, { sourceRoots: ['src'], coverageFile: 'coverage/lcov.info' });

    await expect(loadConfig(projectRoot)).rejects.toBeInstanceOf(ConfigError);
  });

  it.each(['json', 'cobertura', ''])('rejects the coverage format %j', async (coverageFormat) => {
    const projectRoot = await temporaryProject();
    await writeConfig(projectRoot, { sourceRoots: ['src'], coverageFormat });

    await expect(loadConfig(projectRoot)).rejects.toBeInstanceOf(ConfigError);
  });

  it.each([
    { name: 'an empty source root', config: { sourceRoots: [''] } },
    { name: 'a whitespace-only command', config: { sourceRoots: ['src'], coverageCommand: '  ' } },
    { name: 'an empty coverage path', config: { sourceRoots: ['src'], coveragePath: '' } },
    { name: 'an empty coverage directory', config: { sourceRoots: ['src'], coverageDirectory: '' } },
    { name: 'an absolute source root', config: { sourceRoots: ['/private/src'] } },
    { name: 'an absolute coverage path', config: { sourceRoots: ['src'], coveragePath: '/private/lcov.info' } },
    { name: 'an absolute coverage directory', config: { sourceRoots: ['src'], coverageDirectory: '/private/coverage' } },
  ])('rejects $name', async ({ config }) => {
    const projectRoot = await temporaryProject();
    await writeConfig(projectRoot, config);

    await expect(loadConfig(projectRoot)).rejects.toBeInstanceOf(ConfigError);
  });
});

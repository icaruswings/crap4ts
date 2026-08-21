import { readFile } from 'node:fs/promises';
import { isAbsolute, join, win32 } from 'node:path';
import { ConfigError } from '../errors.js';

export interface ProjectConfig {
  sourceRoots: string[];
  coverageCommand?: string;
  coveragePath?: string;
  coverageFormat?: 'lcov' | 'istanbul';
  coverageDirectory?: string;
}

const CONFIG_FILENAME = 'crap4ts.config.json';
const CONFIG_KEYS = new Set([
  'sourceRoots',
  'coverageCommand',
  'coveragePath',
  'coverageFormat',
  'coverageDirectory',
]);

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function nonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ConfigError(`${field} must be a non-empty string`);
  }
  return value;
}

function relativePath(value: unknown, field: string): string {
  const path = nonEmptyString(value, field);
  if (isAbsolute(path) || win32.isAbsolute(path)) {
    throw new ConfigError(`${field} must be project-relative`);
  }
  return path;
}

function sourceRoots(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ConfigError('sourceRoots must be a non-empty array');
  }
  return value.map((root) => relativePath(root, 'sourceRoots entries'));
}

function coverageFormat(value: unknown): 'lcov' | 'istanbul' {
  if (value !== 'lcov' && value !== 'istanbul') {
    throw new ConfigError('coverageFormat must be "lcov" or "istanbul"');
  }
  return value;
}

function parseConfig(contents: string): unknown {
  try {
    return JSON.parse(contents) as unknown;
  } catch (error) {
    throw new ConfigError(`Could not parse ${CONFIG_FILENAME}`, { cause: error });
  }
}

function validateConfig(value: unknown): ProjectConfig {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ConfigError(`${CONFIG_FILENAME} must contain an object`);
  }
  const record = value as Record<string, unknown>;
  const unknownKey = Object.keys(record).find((key) => !CONFIG_KEYS.has(key));
  if (unknownKey !== undefined) {
    throw new ConfigError(`Unknown configuration key: ${unknownKey}`);
  }

  const config: ProjectConfig = { sourceRoots: sourceRoots(record.sourceRoots) };
  if ('coverageCommand' in record) {
    config.coverageCommand = nonEmptyString(record.coverageCommand, 'coverageCommand');
  }
  if ('coveragePath' in record) {
    config.coveragePath = relativePath(record.coveragePath, 'coveragePath');
  }
  if ('coverageFormat' in record) {
    config.coverageFormat = coverageFormat(record.coverageFormat);
  }
  if ('coverageDirectory' in record) {
    config.coverageDirectory = relativePath(record.coverageDirectory, 'coverageDirectory');
  }
  return config;
}

export async function loadConfig(projectRoot: string): Promise<ProjectConfig> {
  const configPath = join(projectRoot, CONFIG_FILENAME);
  let contents: string;
  try {
    contents = await readFile(configPath, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) return { sourceRoots: ['src'] };
    throw new ConfigError(`Could not read ${CONFIG_FILENAME}`, { cause: error });
  }
  return validateConfig(parseConfig(contents));
}

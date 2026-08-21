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

type OptionalConfig = Omit<ProjectConfig, 'sourceRoots'>;
type ParsedOptionalConfig = Required<OptionalConfig>;

interface OptionalFieldDescriptor<Key extends keyof ParsedOptionalConfig> {
  key: Key;
  parser: (value: unknown) => ParsedOptionalConfig[Key];
}

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

function optionalField<Key extends keyof ParsedOptionalConfig>(
  key: Key,
  parser: (value: unknown) => ParsedOptionalConfig[Key],
): OptionalFieldDescriptor<Key> {
  return { key, parser };
}

const OPTIONAL_FIELDS = [
  optionalField('coverageCommand', (value) => nonEmptyString(value, 'coverageCommand')),
  optionalField('coveragePath', (value) => relativePath(value, 'coveragePath')),
  optionalField('coverageFormat', coverageFormat),
  optionalField('coverageDirectory', (value) => relativePath(value, 'coverageDirectory')),
] as const;

function parseConfig(contents: string): unknown {
  try {
    return JSON.parse(contents) as unknown;
  } catch (error) {
    throw new ConfigError(`Could not parse ${CONFIG_FILENAME}`, { cause: error });
  }
}

function configRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ConfigError(`${CONFIG_FILENAME} must contain an object`);
  }

  return value as Record<string, unknown>;
}

function rejectUnknownKeys(record: Record<string, unknown>): void {
  const unknownKey = Object.keys(record).find((key) => !CONFIG_KEYS.has(key));
  if (unknownKey !== undefined) {
    throw new ConfigError(`Unknown configuration key: ${unknownKey}`);
  }
}

function readOptionalField<Key extends keyof ParsedOptionalConfig>(
  record: Record<string, unknown>,
  config: Partial<ParsedOptionalConfig>,
  descriptor: OptionalFieldDescriptor<Key>,
): void {
  if (descriptor.key in record) {
    config[descriptor.key] = descriptor.parser(record[descriptor.key]);
  }
}

function readOptionalFields(record: Record<string, unknown>): OptionalConfig {
  const config: Partial<ParsedOptionalConfig> = {};
  for (const descriptor of OPTIONAL_FIELDS) {
    readOptionalField(record, config, descriptor);
  }
  return config;
}

function validateConfig(value: unknown): ProjectConfig {
  const record = configRecord(value);
  rejectUnknownKeys(record);
  return {
    sourceRoots: sourceRoots(record.sourceRoots),
    ...readOptionalFields(record),
  };
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

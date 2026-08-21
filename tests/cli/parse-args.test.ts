import { describe, expect, it } from 'vitest';
import { ConfigError, UsageError } from '../../src/errors.js';
import { parseArgs } from '../../src/cli/parse-args.js';
import { resolveOptions } from '../../src/cli/resolve-options.js';
import type { ProjectConfig } from '../../src/config/load-config.js';

const completeConfig: ProjectConfig = {
  sourceRoots: ['configured-src'],
  coverageCommand: 'pnpm configured-coverage',
  coveragePath: 'coverage/configured.json',
  coverageFormat: 'istanbul',
  coverageDirectory: 'configured-coverage',
};

describe('parseArgs', () => {
  it('parses positional OR filters and every approved option', () => {
    expect(parseArgs([
      'orders',
      '--source-root',
      'src',
      '--source-root',
      'packages/core/src',
      '--coverage-command',
      'pnpm test --coverage',
      '--coverage',
      'coverage/lcov.info',
      '--coverage-format',
      'lcov',
      '--coverage-directory',
      'coverage',
      '--use-existing-coverage',
      '--json',
      '--help',
      'billing',
    ])).toEqual({
      filters: ['orders', 'billing'],
      sourceRoots: ['src', 'packages/core/src'],
      coverageCommand: 'pnpm test --coverage',
      coveragePath: 'coverage/lcov.info',
      coverageFormat: 'lcov',
      coverageDirectory: 'coverage',
      useExistingCoverage: true,
      json: true,
      help: true,
    });
  });

  it('returns explicit defaults when no arguments are present', () => {
    expect(parseArgs([])).toEqual({
      filters: [],
      useExistingCoverage: false,
      json: false,
      help: false,
    });
  });

  it.each([
    '--source-root',
    '--coverage-command',
    '--coverage',
    '--coverage-format',
    '--coverage-directory',
  ])('rejects a missing value for %s', (flag) => {
    expect(() => parseArgs([flag])).toThrow(UsageError);
    expect(() => parseArgs([flag, '--json'])).toThrow(UsageError);
  });

  it.each(['--unknown', '-x', '--'])('rejects unknown flag %s', (flag) => {
    expect(() => parseArgs([flag])).toThrow(UsageError);
  });

  it.each(['json', 'cobertura', ''])('rejects invalid coverage format %j', (format) => {
    expect(() => parseArgs(['--coverage-format', format])).toThrow(UsageError);
  });

  it.each([
    ['--source-root', ''],
    ['--source-root', '/absolute/src'],
    ['--coverage-command', '  '],
    ['--coverage', ''],
    ['--coverage', '/absolute/coverage.json'],
    ['--coverage-directory', ''],
    ['--coverage-directory', '/absolute/coverage'],
  ])('rejects invalid value %j for %s', (flag, value) => {
    expect(() => parseArgs([flag, value])).toThrow(UsageError);
  });
});

describe('resolveOptions', () => {
  it('lets command-line values replace every configured generated-mode value', () => {
    const args = parseArgs([
      'orders',
      'billing',
      '--source-root',
      'src',
      '--source-root',
      'packages/web/src',
      '--coverage-command',
      'pnpm coverage',
      '--coverage',
      'artifacts/lcov.info',
      '--coverage-format',
      'lcov',
      '--coverage-directory',
      'artifacts',
      '--json',
    ]);

    expect(resolveOptions(completeConfig, args)).toEqual({
      action: 'analyze',
      coverageMode: 'generated',
      sourceRoots: ['src', 'packages/web/src'],
      filters: ['orders', 'billing'],
      coverageCommand: 'pnpm coverage',
      coveragePath: 'artifacts/lcov.info',
      coverageFormat: 'lcov',
      coverageDirectory: 'artifacts',
      json: true,
    });
  });

  it('uses configured values when command-line values are absent', () => {
    expect(resolveOptions(completeConfig, parseArgs([]))).toEqual({
      action: 'analyze',
      coverageMode: 'generated',
      sourceRoots: ['configured-src'],
      filters: [],
      coverageCommand: 'pnpm configured-coverage',
      coveragePath: 'coverage/configured.json',
      coverageFormat: 'istanbul',
      coverageDirectory: 'configured-coverage',
      json: false,
    });
  });

  it('resolves existing mode without a coverage command or cleanup directory', () => {
    const args = parseArgs([
      '--use-existing-coverage',
      '--coverage',
      'artifacts/lcov.info',
      '--coverage-format',
      'lcov',
    ]);

    expect(resolveOptions(completeConfig, args)).toEqual({
      action: 'analyze',
      coverageMode: 'existing',
      sourceRoots: ['configured-src'],
      filters: [],
      coveragePath: 'artifacts/lcov.info',
      coverageFormat: 'lcov',
      json: false,
    });
  });

  it('resolves help without requiring coverage settings', () => {
    expect(resolveOptions({ sourceRoots: ['src'] }, parseArgs(['--help']))).toEqual({ action: 'help' });
  });

  it.each([
    { name: 'coverage path', config: { sourceRoots: ['src'], coverageFormat: 'lcov' } },
    { name: 'coverage format', config: { sourceRoots: ['src'], coveragePath: 'coverage/lcov.info' } },
  ])('requires a $name in existing mode', ({ config }) => {
    expect(() => resolveOptions(config as ProjectConfig, parseArgs(['--use-existing-coverage']))).toThrow(ConfigError);
  });

  it('requires a coverage command in generated mode', () => {
    const config: ProjectConfig = {
      sourceRoots: ['src'],
      coveragePath: 'coverage/lcov.info',
      coverageFormat: 'lcov',
    };

    expect(() => resolveOptions(config, parseArgs([]))).toThrow(ConfigError);
  });
});

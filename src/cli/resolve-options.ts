import { ConfigError } from '../errors.js';
import type { CliArgs } from './parse-args.js';
import type { ProjectConfig } from '../config/load-config.js';

export interface HelpOptions {
  action: 'help';
}

interface AnalyzeOptions {
  action: 'analyze';
  sourceRoots: string[];
  filters: string[];
  coveragePath: string;
  coverageFormat: 'lcov' | 'istanbul';
  json: boolean;
}

export interface GeneratedCoverageOptions extends AnalyzeOptions {
  coverageMode: 'generated';
  coverageCommand: string;
  coverageDirectory?: string;
}

export interface ExistingCoverageOptions extends AnalyzeOptions {
  coverageMode: 'existing';
}

export type ResolvedOptions = HelpOptions | GeneratedCoverageOptions | ExistingCoverageOptions;

function requiredValue<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new ConfigError(`${name} is required`);
  }
  return value;
}

function commonOptions(config: ProjectConfig, args: CliArgs): AnalyzeOptions {
  return {
    action: 'analyze',
    sourceRoots: [...(args.sourceRoots ?? config.sourceRoots)],
    filters: [...args.filters],
    coveragePath: requiredValue(args.coveragePath ?? config.coveragePath, 'coveragePath'),
    coverageFormat: requiredValue(args.coverageFormat ?? config.coverageFormat, 'coverageFormat'),
    json: args.json,
  };
}

function existingOptions(common: AnalyzeOptions): ExistingCoverageOptions {
  return { ...common, coverageMode: 'existing' };
}

function generatedOptions(
  config: ProjectConfig,
  args: CliArgs,
  common: AnalyzeOptions,
): GeneratedCoverageOptions {
  const generated: GeneratedCoverageOptions = {
    ...common,
    coverageMode: 'generated',
    coverageCommand: requiredValue(
      args.coverageCommand ?? config.coverageCommand,
      'coverageCommand',
    ),
  };
  const coverageDirectory = args.coverageDirectory ?? config.coverageDirectory;
  if (coverageDirectory !== undefined) generated.coverageDirectory = coverageDirectory;
  return generated;
}

export function resolveOptions(config: ProjectConfig, args: CliArgs): ResolvedOptions {
  if (args.help) return { action: 'help' };

  const common = commonOptions(config, args);
  if (args.useExistingCoverage) return existingOptions(common);
  return generatedOptions(config, args, common);
}

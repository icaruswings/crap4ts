import { isAbsolute, win32 } from 'node:path';
import { UsageError } from '../errors.js';

export interface CliArgs {
  filters: string[];
  sourceRoots?: string[];
  coverageCommand?: string;
  coveragePath?: string;
  coverageFormat?: 'lcov' | 'istanbul';
  coverageDirectory?: string;
  useExistingCoverage: boolean;
  json: boolean;
  help: boolean;
}

function optionValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('-')) {
    throw new UsageError(`${flag} requires a value`);
  }
  return value;
}

function nonEmptyValue(value: string, flag: string): string {
  if (value.trim().length === 0) {
    throw new UsageError(`${flag} requires a non-empty value`);
  }
  return value;
}

function relativeValue(value: string, flag: string): string {
  const path = nonEmptyValue(value, flag);
  if (isAbsolute(path) || win32.isAbsolute(path)) {
    throw new UsageError(`${flag} requires a project-relative path`);
  }
  return path;
}

function formatValue(value: string): 'lcov' | 'istanbul' {
  if (value !== 'lcov' && value !== 'istanbul') {
    throw new UsageError('--coverage-format must be "lcov" or "istanbul"');
  }
  return value;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    filters: [],
    useExistingCoverage: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === undefined) continue;
    if (!argument.startsWith('-')) {
      args.filters.push(nonEmptyValue(argument, 'filter'));
      continue;
    }
    if (argument === '--use-existing-coverage') args.useExistingCoverage = true;
    else if (argument === '--json') args.json = true;
    else if (argument === '--help') args.help = true;
    else if (argument === '--source-root') {
      const root = relativeValue(optionValue(argv, index, argument), argument);
      args.sourceRoots = [...(args.sourceRoots ?? []), root];
      index += 1;
    } else if (argument === '--coverage-command') {
      args.coverageCommand = nonEmptyValue(optionValue(argv, index, argument), argument);
      index += 1;
    } else if (argument === '--coverage') {
      args.coveragePath = relativeValue(optionValue(argv, index, argument), argument);
      index += 1;
    } else if (argument === '--coverage-format') {
      args.coverageFormat = formatValue(optionValue(argv, index, argument));
      index += 1;
    } else if (argument === '--coverage-directory') {
      args.coverageDirectory = relativeValue(optionValue(argv, index, argument), argument);
      index += 1;
    } else {
      throw new UsageError(`Unknown option: ${argument}`);
    }
  }

  return args;
}

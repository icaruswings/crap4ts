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

interface OptionResult {
  nextIndex: number;
}

type OptionHandler = (args: CliArgs, argv: string[], index: number) => OptionResult;

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

function useExistingCoverageOption(args: CliArgs, _argv: string[], index: number): OptionResult {
  args.useExistingCoverage = true;
  return { nextIndex: index + 1 };
}

function jsonOption(args: CliArgs, _argv: string[], index: number): OptionResult {
  args.json = true;
  return { nextIndex: index + 1 };
}

function helpOption(args: CliArgs, _argv: string[], index: number): OptionResult {
  args.help = true;
  return { nextIndex: index + 1 };
}

function sourceRootOption(args: CliArgs, argv: string[], index: number): OptionResult {
  const flag = argv[index]!;
  const root = relativeValue(optionValue(argv, index, flag), flag);
  args.sourceRoots = [...(args.sourceRoots ?? []), root];
  return { nextIndex: index + 2 };
}

function coverageCommandOption(args: CliArgs, argv: string[], index: number): OptionResult {
  const flag = argv[index]!;
  args.coverageCommand = nonEmptyValue(optionValue(argv, index, flag), flag);
  return { nextIndex: index + 2 };
}

function coveragePathOption(args: CliArgs, argv: string[], index: number): OptionResult {
  const flag = argv[index]!;
  args.coveragePath = relativeValue(optionValue(argv, index, flag), flag);
  return { nextIndex: index + 2 };
}

function coverageFormatOption(args: CliArgs, argv: string[], index: number): OptionResult {
  const flag = argv[index]!;
  args.coverageFormat = formatValue(optionValue(argv, index, flag));
  return { nextIndex: index + 2 };
}

function coverageDirectoryOption(args: CliArgs, argv: string[], index: number): OptionResult {
  const flag = argv[index]!;
  args.coverageDirectory = relativeValue(optionValue(argv, index, flag), flag);
  return { nextIndex: index + 2 };
}

const optionHandlers: Record<string, OptionHandler> = {
  '--use-existing-coverage': useExistingCoverageOption,
  '--json': jsonOption,
  '--help': helpOption,
  '--source-root': sourceRootOption,
  '--coverage-command': coverageCommandOption,
  '--coverage': coveragePathOption,
  '--coverage-format': coverageFormatOption,
  '--coverage-directory': coverageDirectoryOption,
};

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    filters: [],
    useExistingCoverage: false,
    json: false,
    help: false,
  };

  let index = 0;
  while (index < argv.length) {
    const argument = argv[index];
    if (argument === undefined) {
      index += 1;
      continue;
    }
    if (!argument.startsWith('-')) {
      args.filters.push(nonEmptyValue(argument, 'filter'));
      index += 1;
      continue;
    }

    const handler = optionHandlers[argument];
    if (handler === undefined) throw new UsageError(`Unknown option: ${argument}`);
    index = handler(args, argv, index).nextIndex;
  }

  return args;
}

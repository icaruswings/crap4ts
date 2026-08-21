#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeProject } from '../analysis/analyze-project.js';
import { loadConfig } from '../config/load-config.js';
import { parseIstanbulCoverage } from '../coverage/istanbul/parse-istanbul.js';
import { parseLcov } from '../coverage/lcov/parse-lcov.js';
import type { CoverageArtifact } from '../coverage/model.js';
import { Crap4tsError, UsageError } from '../errors.js';
import type { Diagnostic } from '../model.js';
import { formatJsonReport } from '../report/format-json.js';
import { formatTextReport } from '../report/format-text.js';
import { TOOL_VERSION } from '../version.js';
import { parseArgs } from './parse-args.js';
import { prepareCoverage } from './prepare-coverage.js';
import { resolveOptions, type ResolvedOptions } from './resolve-options.js';
import { runCoverageCommand } from './run-coverage.js';

const usage = `Usage: crap4ts [filters...] [options]

Calculate cyclomatic complexity and coverage-weighted CRAP scores for TypeScript.

Options:
  --source-root <path>          Source root. Repeat to provide more than one.
  --coverage-command <command> Command that generates coverage.
  --coverage <path>            Project-relative coverage artifact path.
  --coverage-format <format>   Coverage format: istanbul or lcov.
  --coverage-directory <path>  Explicit disposable coverage directory.
  --use-existing-coverage      Analyze the current artifact without generating it.
  --json                       Write one JSON report instead of text.
  --help                       Show this help.
`;

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const processIo: CliIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

export async function runCli(
  argv: string[],
  io: CliIo = processIo,
  projectRoot: string = process.cwd(),
): Promise<number> {
  try {
    const args = parseArgs(argv);
    if (args.help) {
      io.stdout(usage);
      return 0;
    }

    const options = resolveOptions(await loadConfig(projectRoot), args);
    if (options.action === 'help') {
      io.stdout(usage);
      return 0;
    }

    await generateCoverage(options, projectRoot);
    const coverage = await readCoverage(options, projectRoot);
    const result = await analyzeProject({
      projectRoot,
      sourceRoots: options.sourceRoots,
      filters: options.filters,
      coverage,
    });

    if (options.json) {
      io.stdout(formatJsonReport({
        toolVersion: TOOL_VERSION,
        coverage: {
          format: options.coverageFormat,
          kind: coverage.kind,
          path: options.coveragePath,
        },
        result,
      }));
    } else {
      io.stdout(formatTextReport(result));
      for (const diagnostic of result.diagnostics) io.stderr(formatDiagnostic(diagnostic));
    }

    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`Error: ${error.message}\n`);
      return 2;
    }
    if (error instanceof Crap4tsError) {
      io.stderr(`Error: ${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

async function generateCoverage(options: ResolvedOptions, projectRoot: string): Promise<void> {
  if (options.action !== 'analyze' || options.coverageMode === 'existing') return;
  await prepareCoverage(projectRoot, options.coveragePath, options.coverageDirectory);
  await runCoverageCommand(options.coverageCommand, projectRoot, {
    stdout: options.json ? 'stderr' : 'inherit',
  });
}

async function readCoverage(
  options: Extract<ResolvedOptions, { action: 'analyze' }>,
  projectRoot: string,
): Promise<CoverageArtifact> {
  const artifactPath = resolve(projectRoot, options.coveragePath);
  let text: string;
  try {
    text = await readFile(artifactPath, 'utf8');
  } catch (error) {
    throw new Crap4tsError(`Could not read coverage artifact: ${options.coveragePath}`, { cause: error });
  }

  return options.coverageFormat === 'istanbul'
    ? parseIstanbulCoverage(text)
    : parseLcov(text);
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  const location = diagnostic.source === undefined
    ? ''
    : ` [${diagnostic.source}${diagnostic.range === undefined
        ? ''
        : `:${diagnostic.range.start.line}:${diagnostic.range.start.column}`}]`;
  return `${diagnostic.code}${location}: ${diagnostic.message}\n`;
}

const entryScript = process.argv[1];
if (entryScript !== undefined && isEntryScript(import.meta.url, entryScript)) {
  process.exitCode = await runCli(process.argv.slice(2));
}

function isEntryScript(moduleUrl: string, entryScript: string): boolean {
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(resolve(entryScript));
  } catch {
    return false;
  }
}

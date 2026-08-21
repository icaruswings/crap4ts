import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractFunctions } from '../complexity/extract-functions.js';
import { matchCoverageFile } from '../coverage/match-file.js';
import { measureFunctionsCoverage } from '../coverage/measure-function.js';
import type { CoverageMeasurement } from '../coverage/measure-function.js';
import type { CoverageArtifact, CoverageFile } from '../coverage/model.js';
import { SourceReadError } from '../errors.js';
import { findSourceFiles } from '../files/find-source-files.js';
import type { CrapEntry, Diagnostic, FunctionInfo } from '../model.js';
import { toProjectDiagnosticPath } from '../paths/normalize-path.js';
import { crapScore } from '../scorer.js';

export interface AnalyzeProjectOptions {
  projectRoot: string;
  sourceRoots: string[];
  filters: string[];
  coverage: CoverageArtifact;
}

export interface AnalysisResult {
  entries: CrapEntry[];
  diagnostics: Diagnostic[];
}

async function readSource(projectRoot: string, source: string): Promise<string> {
  try {
    return await readFile(resolve(projectRoot, source), 'utf8');
  } catch (error) {
    throw new SourceReadError(`Could not read source file: ${source}`, { cause: error });
  }
}

function entriesForSource(
  source: string,
  functions: FunctionInfo[],
  measurements: CoverageMeasurement[],
): CrapEntry[] {
  return functions.map((fn, index) => {
    const measurement = measurements[index]!;
    return {
      name: fn.name,
      module: source.replace(/\.tsx?$/, ''),
      source,
      range: fn.range,
      complexity: fn.complexity,
      coverage: measurement.percentage,
      coverageKind: measurement.kind,
      crap: crapScore(fn.complexity, measurement.percentage),
    };
  });
}

function unmatchedCoverageDiagnostics(
  projectRoot: string,
  files: CoverageFile[],
  matched: Set<CoverageFile>,
): Diagnostic[] {
  return files
    .filter((file) => !matched.has(file))
    .map((file) => unmatchedCoverageFile(projectRoot, file));
}

interface SourceAnalysis {
  entries: CrapEntry[];
  diagnostics: Diagnostic[];
  matchedCoverageFile: CoverageFile | null;
}

async function analyzeSource(
  projectRoot: string,
  source: string,
  coverage: CoverageArtifact,
): Promise<SourceAnalysis> {
  const sourceText = await readSource(projectRoot, source);
  const functions = extractFunctions(source, sourceText);
  const coverageFile = matchCoverageFile(projectRoot, source, coverage.files);
  const measurements = measureFunctionsCoverage(functions, coverageFile, coverage.kind);

  return {
    entries: entriesForSource(source, functions, measurements),
    diagnostics: measurements.flatMap(({ diagnostics }) => diagnostics),
    matchedCoverageFile: coverageFile,
  };
}

export async function analyzeProject(options: AnalyzeProjectOptions): Promise<AnalysisResult> {
  const sources = await findSourceFiles(options.projectRoot, options.sourceRoots, options.filters);
  const entries: CrapEntry[] = [];
  const diagnostics: Diagnostic[] = [];
  const matchedCoverageFiles = new Set<CoverageFile>();

  for (const source of sources) {
    const result = await analyzeSource(options.projectRoot, source, options.coverage);
    entries.push(...result.entries);
    diagnostics.push(...result.diagnostics);
    if (result.matchedCoverageFile !== null) {
      matchedCoverageFiles.add(result.matchedCoverageFile);
    }
  }

  diagnostics.push(...unmatchedCoverageDiagnostics(
    options.projectRoot,
    options.coverage.files,
    matchedCoverageFiles,
  ));

  return { entries, diagnostics };
}

export function unmatchedCoverageFile(projectRoot: string, file: CoverageFile): Diagnostic {
  const sourcePath = toProjectDiagnosticPath(projectRoot, file.sourcePath);
  return {
    code: 'UNMATCHED_COVERAGE_FILE',
    message: `Coverage file "${sourcePath}" did not match any analyzed source file`,
    source: sourcePath,
  };
}

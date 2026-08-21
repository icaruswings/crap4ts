import { readFile } from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import { extractFunctions } from '../complexity/extract-functions.js';
import { matchCoverageFile } from '../coverage/match-file.js';
import { measureFunctionsCoverage } from '../coverage/measure-function.js';
import type { CoverageArtifact, CoverageFile } from '../coverage/model.js';
import { SourceReadError } from '../errors.js';
import { findSourceFiles } from '../files/find-source-files.js';
import type { CrapEntry, Diagnostic } from '../model.js';
import { normalizePath, toProjectRelative } from '../paths/normalize-path.js';
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

export async function analyzeProject(options: AnalyzeProjectOptions): Promise<AnalysisResult> {
  const sources = await findSourceFiles(options.projectRoot, options.sourceRoots, options.filters);
  const entries: CrapEntry[] = [];
  const diagnostics: Diagnostic[] = [];
  const matchedCoverageFiles = new Set<CoverageFile>();

  for (const source of sources) {
    let sourceText: string;
    try {
      sourceText = await readFile(resolve(options.projectRoot, source), 'utf8');
    } catch (error) {
      throw new SourceReadError(`Could not read source file: ${source}`, { cause: error });
    }
    const functions = extractFunctions(source, sourceText);
    const coverageFile = matchCoverageFile(options.projectRoot, source, options.coverage.files);

    if (coverageFile !== null) {
      matchedCoverageFiles.add(coverageFile);
    }

    const measurements = measureFunctionsCoverage(functions, coverageFile, options.coverage.kind);
    for (const [index, fn] of functions.entries()) {
      const measurement = measurements[index]!;

      entries.push({
        name: fn.name,
        module: source.replace(/\.tsx?$/, ''),
        source,
        range: fn.range,
        complexity: fn.complexity,
        coverage: measurement.percentage,
        coverageKind: measurement.kind,
        crap: crapScore(fn.complexity, measurement.percentage),
      });
      diagnostics.push(...measurement.diagnostics);
    }
  }

  for (const file of options.coverage.files) {
    if (!matchedCoverageFiles.has(file)) {
      diagnostics.push(unmatchedCoverageFile(options.projectRoot, file));
    }
  }

  return { entries, diagnostics };
}

function unmatchedCoverageFile(projectRoot: string, file: CoverageFile): Diagnostic {
  const sourcePath = diagnosticCoveragePath(projectRoot, file.sourcePath);
  return {
    code: 'UNMATCHED_COVERAGE_FILE',
    message: `Coverage file "${sourcePath}" did not match any analyzed source file`,
    source: sourcePath,
  };
}

function diagnosticCoveragePath(projectRoot: string, sourcePath: string): string {
  const normalizedSource = normalizePath(sourcePath);
  if (!posix.isAbsolute(normalizedSource)) return normalizedSource;

  const relativeSource = normalizePath(toProjectRelative(resolve(projectRoot), normalizedSource));
  return relativeSource !== '..'
    && !relativeSource.startsWith('../')
    && !posix.isAbsolute(relativeSource)
    ? relativeSource
    : normalizedSource;
}

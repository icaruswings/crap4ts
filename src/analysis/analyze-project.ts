import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractFunctions } from '../complexity/extract-functions.js';
import { matchCoverageFile } from '../coverage/match-file.js';
import { measureFunctionCoverage } from '../coverage/measure-function.js';
import type { CoverageArtifact, CoverageFile } from '../coverage/model.js';
import { findSourceFiles } from '../files/find-source-files.js';
import type { CrapEntry, Diagnostic } from '../model.js';
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
    const sourceText = await readFile(resolve(options.projectRoot, source), 'utf8');
    const functions = extractFunctions(source, sourceText);
    const coverageFile = matchCoverageFile(options.projectRoot, source, options.coverage.files);

    if (coverageFile !== null) {
      matchedCoverageFiles.add(coverageFile);
    }

    for (const fn of functions) {
      const measurement = measureFunctionCoverage(fn, coverageFile, options.coverage.kind);

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
      diagnostics.push(unmatchedCoverageFile(file));
    }
  }

  return { entries, diagnostics };
}

function unmatchedCoverageFile(file: CoverageFile): Diagnostic {
  return {
    code: 'UNMATCHED_COVERAGE_FILE',
    message: `Coverage file "${file.sourcePath}" did not match any analyzed source file`,
    source: file.sourcePath,
  };
}

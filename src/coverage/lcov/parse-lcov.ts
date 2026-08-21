import { CoverageParseError } from '../../errors.js';
import { normalizePath } from '../../paths/normalize-path.js';
import type { CoverageArtifact, LineCoverageFile } from '../model.js';

type HitsByLine = Map<number, number>;

export function parseLcov(text: string): CoverageArtifact {
  const filesByPath = new Map<string, HitsByLine>();
  let currentPath: string | undefined;
  let currentLines: HitsByLine | undefined;

  for (const [index, record] of text.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;

    if (hasMalformedDelimiter(record, 'SF')) {
      throw invalid(lineNumber, 'SF record must begin with SF:');
    }

    if (record.startsWith('SF:')) {
      if (currentPath !== undefined) {
        throw invalid(lineNumber, 'SF record requires end_of_record for the preceding source file');
      }

      currentPath = parseSourcePath(record, lineNumber);
      currentLines = new Map();
      continue;
    }

    if (hasMalformedDelimiter(record, 'DA')) {
      throw invalid(lineNumber, 'DA record must begin with DA:');
    }

    if (record.startsWith('DA:')) {
      if (currentLines === undefined) {
        throw invalid(lineNumber, 'DA record requires an SF record');
      }

      const { line, hits } = parseLineData(record, lineNumber);
      currentLines.set(line, addHits(currentLines.get(line), hits, lineNumber));
      continue;
    }

    if (record === 'end_of_record') {
      if (currentPath === undefined || currentLines === undefined) {
        throw invalid(lineNumber, 'end_of_record requires an SF record');
      }

      mergeFile(filesByPath, currentPath, currentLines, lineNumber);
      currentPath = undefined;
      currentLines = undefined;
    }
  }

  if (currentPath !== undefined) {
    throw invalid(text.split(/\r?\n/).length, 'missing end_of_record');
  }

  return {
    format: 'lcov',
    kind: 'line',
    files: [...filesByPath]
      .map(([sourcePath, lines]) => toLineCoverageFile(sourcePath, lines))
      .sort(compareFiles),
  };
}

function hasMalformedDelimiter(record: string, tag: 'SF' | 'DA'): boolean {
  if (!record.startsWith(tag)) return false;

  const delimiter = record[tag.length];
  return delimiter === undefined
    || (delimiter !== ':' && !/[A-Za-z0-9_]/.test(delimiter));
}

function parseSourcePath(record: string, lineNumber: number): string {
  const sourcePath = record.slice('SF:'.length).trim();
  if (sourcePath.length === 0) {
    throw invalid(lineNumber, 'SF record requires a source path');
  }

  return normalizePath(sourcePath);
}

function parseLineData(record: string, lineNumber: number): { line: number; hits: number } {
  const [rawLine, rawHits, ...extraFields] = record.slice('DA:'.length).split(',');
  if (rawLine === undefined || rawHits === undefined || extraFields.length > 1) {
    throw invalid(lineNumber, 'DA record must contain line number and hit count');
  }

  return {
    line: parsePositiveInteger(rawLine, lineNumber, 'DA line number'),
    hits: parseNonnegativeInteger(rawHits, lineNumber, 'DA hit count'),
  };
}

function parsePositiveInteger(value: string, lineNumber: number, label: string): number {
  if (!/^\d+$/.test(value)) {
    throw invalid(lineNumber, `${label} must be a positive integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw invalid(lineNumber, `${label} must be a positive integer`);
  }

  return parsed;
}

function parseNonnegativeInteger(value: string, lineNumber: number, label: string): number {
  if (!/^\d+$/.test(value)) {
    throw invalid(lineNumber, `${label} must be a nonnegative integer`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw invalid(lineNumber, `${label} must be a nonnegative integer`);
  }

  return parsed;
}

function mergeFile(
  filesByPath: Map<string, HitsByLine>,
  sourcePath: string,
  lines: HitsByLine,
  lineNumber: number,
): void {
  const existingLines = filesByPath.get(sourcePath);
  if (existingLines === undefined) {
    filesByPath.set(sourcePath, lines);
    return;
  }

  for (const [line, hits] of lines) {
    existingLines.set(line, addHits(existingLines.get(line), hits, lineNumber));
  }
}

function addHits(existingHits: number | undefined, newHits: number, lineNumber: number): number {
  const accumulatedHits = (existingHits ?? 0) + newHits;
  if (!Number.isSafeInteger(accumulatedHits) || accumulatedHits < 0) {
    throw invalid(lineNumber, 'accumulated DA hit count must be a nonnegative safe integer');
  }

  return accumulatedHits;
}

function toLineCoverageFile(sourcePath: string, hitsByLine: HitsByLine): LineCoverageFile {
  return {
    sourcePath,
    kind: 'line',
    lines: [...hitsByLine]
      .map(([line, hits]) => ({ line, hits }))
      .sort((left, right) => left.line - right.line),
  };
}

function compareFiles(left: LineCoverageFile, right: LineCoverageFile): number {
  if (left.sourcePath < right.sourcePath) return -1;
  if (left.sourcePath > right.sourcePath) return 1;
  return 0;
}

function invalid(lineNumber: number, message: string): CoverageParseError {
  return new CoverageParseError(`line ${lineNumber}: ${message}`);
}

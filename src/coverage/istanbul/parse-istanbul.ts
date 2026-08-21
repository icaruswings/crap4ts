import { CoverageParseError } from '../../errors.js';
import type { SourcePosition, SourceRange } from '../../model.js';
import { normalizePath } from '../../paths/normalize-path.js';
import type { CoverageArtifact, StatementCoverageFile, StatementLocation } from '../model.js';

type UnknownRecord = Record<string, unknown>;

export function parseIstanbulCoverage(text: string): CoverageArtifact {
  const parsed = parseJson(text);
  const coverage = asRecord(parsed, 'Istanbul coverage');
  const files = Object.entries(coverage)
    .map(([rawPath, file]) => parseFile(rawPath, file))
    .sort((left, right) => compareStrings(left.sourcePath, right.sourcePath));

  return {
    format: 'istanbul',
    kind: 'statement',
    files,
  };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CoverageParseError('Invalid Istanbul coverage JSON');
  }
}

function parseFile(rawPath: string, rawFile: unknown): StatementCoverageFile {
  const file = asRecord(rawFile, rawPath);
  const statementMap = asRecord(file.statementMap, `${rawPath}.statementMap`);
  const counters = asRecord(file.s, `${rawPath}.s`);
  const hitsByStatement = new Map<string, number>();

  for (const [id, hitCount] of Object.entries(counters)) {
    const counterPath = `${rawPath}.s.${id}`;
    if (!Object.hasOwn(statementMap, id)) {
      throw new CoverageParseError(`${counterPath}: no matching statement location`);
    }

    hitsByStatement.set(id, asNonnegativeInteger(hitCount, counterPath));
  }

  const statements = Object.entries(statementMap)
    .map(([id, rawLocation]) => {
      const hits = hitsByStatement.get(id);
      if (hits === undefined) {
        throw new CoverageParseError(`${rawPath}.statementMap.${id}: missing statement counter`);
      }

      return {
        range: parseRange(rawLocation, `${rawPath}.statementMap.${id}`),
        hits,
      };
    })
    .sort(compareStatements);

  return {
    sourcePath: normalizePath(rawPath),
    kind: 'statement',
    statements,
  };
}

function parseRange(value: unknown, path: string): SourceRange {
  const location = asRecord(value, path);
  const start = parsePosition(location.start, `${path}.start`);
  const end = parsePosition(location.end, `${path}.end`);

  if (comparePositions(end, start) < 0) {
    throw new CoverageParseError(`${path}: end must not precede start`);
  }

  return { start, end };
}

function parsePosition(value: unknown, path: string): SourcePosition {
  const position = asRecord(value, path);
  const line = asPositiveInteger(position.line, `${path}.line`);
  const zeroBasedColumn = asNonnegativeInteger(position.column, `${path}.column`);

  return { line, column: zeroBasedColumn + 1 };
}

function asRecord(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CoverageParseError(`${path}: expected an object`);
  }

  return value as UnknownRecord;
}

function asNonnegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new CoverageParseError(`${path}: expected a nonnegative integer`);
  }

  return value;
}

function asPositiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new CoverageParseError(`${path}: expected a positive integer`);
  }

  return value;
}

function compareStatements(left: StatementLocation, right: StatementLocation): number {
  return comparePositions(left.range.start, right.range.start)
    || comparePositions(left.range.end, right.range.end);
}

function comparePositions(left: SourcePosition, right: SourcePosition): number {
  return left.line - right.line || left.column - right.column;
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

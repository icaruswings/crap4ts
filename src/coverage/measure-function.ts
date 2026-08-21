import type { CoverageFile, LineCoverageFile, StatementCoverageFile } from './model.js';
import type {
  CoverageKind,
  Diagnostic,
  FunctionInfo,
  SourcePosition,
  SourceRange,
} from '../model.js';

export interface CoverageMeasurement {
  percentage: number | null;
  kind: CoverageKind;
  diagnostics: Diagnostic[];
}

export function measureFunctionsCoverage(
  functions: FunctionInfo[],
  file: CoverageFile | null,
  expectedKind: CoverageKind,
): CoverageMeasurement[] {
  const overlapsByFunction = file?.kind === 'line' && expectedKind === 'line'
    ? sharedTrackedLines(functions, file)
    : functions.map(() => [] as number[]);

  return functions.map((fn, index) => measureFunctionCoverage(
    fn,
    file,
    expectedKind,
    overlapsByFunction[index] ?? [],
  ));
}

export function measureFunctionCoverage(
  fn: FunctionInfo,
  file: CoverageFile | null,
  expectedKind: CoverageKind,
  sharedFunctionLines?: readonly number[],
): CoverageMeasurement {
  if (file === null) {
    return unknownMeasurement(
      fn,
      expectedKind,
      'NO_MATCHING_COVERAGE_FILE',
      `No coverage file matches source "${fn.source}"`,
    );
  }

  if (file.kind !== expectedKind) {
    throw new TypeError(
      `Coverage kind mismatch for "${file.sourcePath}": expected ${expectedKind}, received ${file.kind}`,
    );
  }

  return file.kind === 'statement'
    ? measureStatements(fn, file)
    : measureLines(fn, file, sharedFunctionLines);
}

function measureStatements(fn: FunctionInfo, file: StatementCoverageFile): CoverageMeasurement {
  const trackedStatements = file.statements.filter(({ range }) =>
    positionInRange(range.start, fn.bodyRange)
    && !fn.nestedBodyRanges.some((nestedRange) => positionInRange(range.start, nestedRange)),
  );

  if (trackedStatements.length === 0) {
    return noTrackedCoverage(fn, 'statement');
  }

  return measured(
    'statement',
    trackedStatements.filter(({ hits }) => hits > 0).length,
    trackedStatements.length,
  );
}

function measureLines(
  fn: FunctionInfo,
  file: LineCoverageFile,
  sharedFunctionLines?: readonly number[],
): CoverageMeasurement {
  const trackedLines = trackedLinesForFunction(fn, file);

  if (trackedLines.length === 0) {
    return noTrackedCoverage(fn, 'line');
  }

  const overlapLines = sharedFunctionLines === undefined
    ? nestedBoundaryLines(fn, trackedLines.map(({ line }) => line))
    : [...sharedFunctionLines];
  const diagnostics = overlapLines.length === 0
    ? []
    : [diagnostic(
      fn,
      'LCOV_FUNCTION_LINE_OVERLAP',
      `LCOV cannot separate function coverage on shared line${overlapLines.length === 1 ? '' : 's'} ${overlapLines.join(', ')}`,
    )];

  return measured(
    'line',
    trackedLines.filter(({ hits }) => hits > 0).length,
    trackedLines.length,
    diagnostics,
  );
}

function sharedTrackedLines(functions: FunctionInfo[], file: LineCoverageFile): number[][] {
  const ownersByLine = new Map<number, number[]>();

  functions.forEach((fn, functionIndex) => {
    for (const { line } of trackedLinesForFunction(fn, file)) {
      const owners = ownersByLine.get(line);
      if (owners === undefined) ownersByLine.set(line, [functionIndex]);
      else owners.push(functionIndex);
    }
  });

  const overlaps = functions.map(() => [] as number[]);
  for (const [line, owners] of ownersByLine) {
    if (owners.length < 2) continue;
    for (const owner of owners) overlaps[owner]!.push(line);
  }
  return overlaps;
}

function trackedLinesForFunction(fn: FunctionInfo, file: LineCoverageFile): LineCoverageFile['lines'] {
  return file.lines.filter(({ line }) =>
    line >= fn.bodyRange.start.line
    && line <= fn.bodyRange.end.line
    && !fn.nestedBodyRanges.some((nestedRange) => lineStrictlyInsideMultilineRange(line, nestedRange)),
  );
}

function nestedBoundaryLines(fn: FunctionInfo, trackedLines: number[]): number[] {
  return [...new Set(
    trackedLines.filter((line) => fn.nestedBodyRanges.some((range) => isBoundaryLine(line, range))),
  )].sort((left, right) => left - right);
}

function measured(
  kind: CoverageKind,
  executed: number,
  tracked: number,
  diagnostics: Diagnostic[] = [],
): CoverageMeasurement {
  return {
    percentage: executed / tracked * 100,
    kind,
    diagnostics,
  };
}

function noTrackedCoverage(fn: FunctionInfo, kind: CoverageKind): CoverageMeasurement {
  return unknownMeasurement(
    fn,
    kind,
    'NO_TRACKED_COVERAGE',
    `Function "${fn.name}" has no tracked ${kind} coverage locations`,
  );
}

function unknownMeasurement(
  fn: FunctionInfo,
  kind: CoverageKind,
  code: string,
  message: string,
): CoverageMeasurement {
  return {
    percentage: null,
    kind,
    diagnostics: [diagnostic(fn, code, message)],
  };
}

function diagnostic(fn: FunctionInfo, code: string, message: string): Diagnostic {
  return { code, message, source: fn.source, range: fn.range };
}

function positionInRange(position: SourcePosition, range: SourceRange): boolean {
  return comparePositions(position, range.start) >= 0 && comparePositions(position, range.end) < 0;
}

function comparePositions(left: SourcePosition, right: SourcePosition): number {
  return left.line - right.line || left.column - right.column;
}

function lineStrictlyInsideMultilineRange(line: number, range: SourceRange): boolean {
  return range.start.line < range.end.line && line > range.start.line && line < range.end.line;
}

function isBoundaryLine(line: number, range: SourceRange): boolean {
  return line === range.start.line || line === range.end.line;
}

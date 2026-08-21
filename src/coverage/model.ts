import type { CoverageKind, SourceRange } from '../model.js';

export interface StatementLocation {
  range: SourceRange;
  hits: number;
}

export interface StatementCoverageFile {
  sourcePath: string;
  kind: 'statement';
  statements: StatementLocation[];
}

export interface LineLocation {
  line: number;
  hits: number;
}

export interface LineCoverageFile {
  sourcePath: string;
  kind: 'line';
  lines: LineLocation[];
}

export type CoverageFile = StatementCoverageFile | LineCoverageFile;

export interface CoverageArtifact {
  format: 'istanbul' | 'lcov';
  kind: CoverageKind;
  files: CoverageFile[];
}

export interface SourcePosition { line: number; column: number }
export interface SourceRange { start: SourcePosition; end: SourcePosition }

export interface FunctionInfo {
  id: string;
  name: string;
  source: string;
  range: SourceRange;
  bodyRange: SourceRange;
  nestedBodyRanges: SourceRange[];
  complexity: number;
}

export type CoverageKind = 'statement' | 'line';

export interface Diagnostic {
  code: string;
  message: string;
  source?: string;
  range?: SourceRange;
}

export interface CrapEntry {
  name: string;
  module: string;
  source: string;
  range: SourceRange;
  complexity: number;
  coverage: number | null;
  coverageKind: CoverageKind;
  crap: number | null;
}

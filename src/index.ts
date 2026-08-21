export { crapScore } from './scorer.js';
export { analyzeProject } from './analysis/analyze-project.js';
export type { AnalysisResult, AnalyzeProjectOptions } from './analysis/analyze-project.js';
export { extractFunctions, parseFunctions } from './complexity/extract-functions.js';
export type { ParsedFunction } from './complexity/extract-functions.js';
export { measureComplexity } from './complexity/measure-complexity.js';
export { parseIstanbulCoverage } from './coverage/istanbul/parse-istanbul.js';
export { parseLcov } from './coverage/lcov/parse-lcov.js';
export { matchCoverageFile } from './coverage/match-file.js';
export { measureFunctionCoverage } from './coverage/measure-function.js';
export type { CoverageMeasurement } from './coverage/measure-function.js';
export { findSourceFiles } from './files/find-source-files.js';
export { normalizePath, toProjectRelative } from './paths/normalize-path.js';
export { TOOL_VERSION } from './version.js';
export {
  AmbiguousCoveragePathError,
  ConfigError,
  CoverageCommandError,
  CoverageParseError,
  Crap4tsError,
  NoSourceFilesError,
  UsageError,
} from './errors.js';
export type {
  CoverageArtifact,
  CoverageFile,
  LineCoverageFile,
  LineLocation,
  StatementCoverageFile,
  StatementLocation,
} from './coverage/model.js';
export type {
  CrapEntry,
  CoverageKind,
  Diagnostic,
  FunctionInfo,
  SourcePosition,
  SourceRange,
} from './model.js';

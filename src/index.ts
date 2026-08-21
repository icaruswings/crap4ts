export { crapScore } from './scorer.js';
export { analyzeProject } from './analysis/analyze-project.js';
export type { AnalysisResult, AnalyzeProjectOptions } from './analysis/analyze-project.js';
export { sortEntries } from './report/sort-entries.js';
export { formatTextReport } from './report/format-text.js';
export { formatJsonReport } from './report/format-json.js';
export type { JsonReportInput } from './report/format-json.js';
export { extractFunctions, parseFunctions } from './complexity/extract-functions.js';
export type { ParsedFunction } from './complexity/extract-functions.js';
export { measureComplexity } from './complexity/measure-complexity.js';
export { parseIstanbulCoverage } from './coverage/istanbul/parse-istanbul.js';
export { parseLcov } from './coverage/lcov/parse-lcov.js';
export { matchCoverageFile } from './coverage/match-file.js';
export { measureFunctionCoverage, measureFunctionsCoverage } from './coverage/measure-function.js';
export type { CoverageMeasurement } from './coverage/measure-function.js';
export { findSourceFiles } from './files/find-source-files.js';
export { normalizePath, toProjectRelative } from './paths/normalize-path.js';
export { TOOL_VERSION } from './version.js';
export { loadConfig } from './config/load-config.js';
export type { ProjectConfig } from './config/load-config.js';
export { parseArgs } from './cli/parse-args.js';
export type { CliArgs } from './cli/parse-args.js';
export { resolveOptions } from './cli/resolve-options.js';
export { prepareCoverage } from './cli/prepare-coverage.js';
export { runCoverageCommand } from './cli/run-coverage.js';
export type { RunCoverageOptions } from './cli/run-coverage.js';
export { runCli } from './cli/main.js';
export type { CliIo } from './cli/main.js';
export type {
  ExistingCoverageOptions,
  GeneratedCoverageOptions,
  HelpOptions,
  ResolvedOptions,
} from './cli/resolve-options.js';
export {
  AmbiguousCoveragePathError,
  ConfigError,
  CoverageCommandError,
  CoverageCleanupError,
  CoverageParseError,
  Crap4tsError,
  NoSourceFilesError,
  SourceReadError,
  SourceTraversalError,
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

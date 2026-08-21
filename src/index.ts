export { crapScore } from './scorer.js';
export { extractFunctions, parseFunctions } from './complexity/extract-functions.js';
export type { ParsedFunction } from './complexity/extract-functions.js';
export { measureComplexity } from './complexity/measure-complexity.js';
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
  CrapEntry,
  CoverageKind,
  Diagnostic,
  FunctionInfo,
  SourcePosition,
  SourceRange,
} from './model.js';

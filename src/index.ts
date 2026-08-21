export { crapScore } from './scorer.js';
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

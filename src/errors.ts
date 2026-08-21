export class Crap4tsError extends Error {}
export class UsageError extends Crap4tsError {}
export class ConfigError extends UsageError {}
export class NoSourceFilesError extends UsageError {}
export class CoverageParseError extends Crap4tsError {}
export class AmbiguousCoveragePathError extends Crap4tsError {}
export class CoverageCommandError extends Crap4tsError {}

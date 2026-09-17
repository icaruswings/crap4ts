import { posix, win32 } from 'node:path';
import picomatch from 'picomatch';
import { ConfigError } from '../errors.js';

const globOptions = { dot: true, nonegate: true, strictBrackets: true };

function validatePatternPath(pattern: string): void {
  if (posix.isAbsolute(pattern) || win32.isAbsolute(pattern)) {
    throw new ConfigError('Exclusion patterns must be project-relative');
  }
  if (pattern.split('/').includes('..') || pattern.includes('\\')) {
    throw new ConfigError('Exclusion patterns must use forward slashes without parent segments');
  }
}

function validateGlob(pattern: string): void {
  if (pattern.startsWith('!')) throw new ConfigError('Exclusion patterns do not support negation');
  try {
    picomatch.makeRe(pattern, globOptions);
  } catch (cause) {
    throw new ConfigError(`Invalid exclusion glob: ${pattern}`, { cause });
  }
}

export function exclusionPattern(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ConfigError('Exclusion patterns must be non-empty strings');
  }
  validatePatternPath(value);
  validateGlob(value);
  return value;
}

export function sourceExclusion(patterns: string[] = []): (path: string) => boolean {
  const validated = patterns.map(exclusionPattern);
  if (validated.length === 0) return () => false;
  return picomatch(validated, globOptions);
}

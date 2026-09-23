import { ConfigError } from '../errors.js';

export function thresholdValue(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ConfigError('threshold must be a finite, non-negative number');
  }
  return value;
}

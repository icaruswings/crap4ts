import { posix } from 'node:path';

export function normalizePath(value: string): string {
  const decoded = decodeURIComponent(value);
  const withoutFilePrefix = decoded.startsWith('file:') ? decoded.slice('file:'.length) : decoded;

  return posix.normalize(withoutFilePrefix.replaceAll('\\', '/'));
}

export function toProjectRelative(projectRoot: string, value: string): string {
  return posix.relative(normalizePath(projectRoot), normalizePath(value));
}

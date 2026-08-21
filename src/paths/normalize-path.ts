import { posix } from 'node:path';

function decodePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value.replace(/(?:%[\dA-Fa-f]{2})+/g, (encoded) => {
      try {
        return decodeURIComponent(encoded);
      } catch {
        return encoded;
      }
    });
  }
}

export function normalizePath(value: string): string {
  const decoded = decodePath(value);
  const withoutFilePrefix = decoded.startsWith('file:') ? decoded.slice('file:'.length) : decoded;

  return posix.normalize(withoutFilePrefix.replaceAll('\\', '/'));
}

export function toProjectRelative(projectRoot: string, value: string): string {
  return posix.relative(normalizePath(projectRoot), normalizePath(value));
}

import { realpathSync } from 'node:fs';
import { posix, win32 } from 'node:path';

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

export function isAbsolutePath(value: string): boolean {
  const normalized = normalizePath(value);
  return posix.isAbsolute(normalized) || isWindowsDriveAbsolute(normalized);
}

export function toAbsolutePath(value: string): string {
  const normalized = normalizePath(value);
  return isAbsolutePath(normalized) ? normalized : normalizePath(posix.resolve(normalized));
}

export function canonicalPath(value: string): string {
  const normalized = normalizePath(value);
  try {
    return normalizePath(realpathSync.native(normalized));
  } catch {
    return normalized;
  }
}

export function toProjectRelative(projectRoot: string, value: string): string {
  const normalizedRoot = normalizePath(projectRoot);
  const normalizedValue = normalizePath(value);
  if (isWindowsDriveAbsolute(normalizedRoot) && isWindowsDriveAbsolute(normalizedValue)) {
    return normalizePath(win32.relative(normalizedRoot, normalizedValue));
  }

  return posix.relative(normalizedRoot, normalizedValue);
}

export function toProjectDiagnosticPath(projectRoot: string, value: string): string {
  const normalizedValue = normalizePath(value);
  if (!isAbsolutePath(normalizedValue)) return normalizedValue;

  const lexicalRoot = toAbsolutePath(projectRoot);
  const canonicalRoot = canonicalPath(lexicalRoot);
  for (const root of new Set([lexicalRoot, canonicalRoot])) {
    const relative = normalizePath(toProjectRelative(root, normalizedValue));
    if (isContainedRelativePath(relative)) return relative;
  }

  return normalizedValue;
}

function isContainedRelativePath(value: string): boolean {
  return value !== '..' && !value.startsWith('../') && !isAbsolutePath(value);
}

function isWindowsDriveAbsolute(value: string): boolean {
  return /^[A-Za-z]:\//.test(value);
}

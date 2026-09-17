import { stripVTControlCharacters } from 'node:util';
import type { CrapEntry } from '../model.js';

export const reportHeaders = ['Function', 'Module', 'CC', 'Coverage', 'CRAP'];

function safeText(value: string): string {
  return stripVTControlCharacters(value).replace(/\p{Cc}/gu, ' ');
}

function paint(text: string, code: number, color: boolean): string {
  return color ? `\u001b[${code}m${text}\u001b[39m` : text;
}

function crapColor(value: number): number {
  if (value <= 5) return 32;
  return value <= 30 ? 33 : 31;
}

function coverageColor(value: number): number {
  if (value >= 80) return 32;
  return value >= 50 ? 33 : 31;
}

function metric(value: number | null, kind: 'coverage' | 'crap', color: boolean): string {
  if (value === null) return paint('N/A', 90, color);
  const code = kind === 'coverage' ? coverageColor(value) : crapColor(value);
  const suffix = kind === 'coverage' ? '%' : '';
  return paint(`${value.toFixed(1)}${suffix}`, code, color);
}

export function reportCells(entry: CrapEntry, color: boolean): string[] {
  return [safeText(entry.name), safeText(entry.module), String(entry.complexity),
    metric(entry.coverage, 'coverage', color), metric(entry.crap, 'crap', color)];
}

export function reportSummary(entries: CrapEntry[]): string {
  const highRisk = entries.filter((entry) => entry.crap !== null && entry.crap > 30).length;
  const missing = entries.filter((entry) => entry.coverage === null).length;
  return `Functions: ${entries.length}\nHigh risk (>30): ${highRisk}\nMissing coverage: ${missing}`;
}

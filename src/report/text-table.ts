import Table from 'cli-table3';
import stringWidth from 'string-width';
import wrapAnsi from 'wrap-ansi';
import { reportHeaders } from './report-cells.js';

const chars = {
  top: '-', 'top-mid': '+', 'top-left': '+', 'top-right': '+',
  bottom: '-', 'bottom-mid': '+', 'bottom-left': '+', 'bottom-right': '+',
  left: '|', 'left-mid': '+', mid: '-', 'mid-mid': '+', right: '|', 'right-mid': '+', middle: '|',
};
const style = { head: [], border: [], compact: true };

function naturalWidths(rows: string[][]): number[] {
  return reportHeaders.map((header, index) => rows.reduce(
    (width, row) => Math.max(width, stringWidth(row[index]!) + 2), stringWidth(header) + 2,
  ));
}

function fittedWidths(widths: number[], columns: number): number[] {
  const numeric = widths.slice(2);
  const available = columns - numeric.reduce((sum, width) => sum + width, 0) - 6;
  const name = Math.min(widths[0]!, Math.max(10, Math.floor(available * 0.45)));
  const module = Math.min(widths[1]!, available - name);
  return [name, module, ...numeric];
}

function narrowReport(rows: string[][], columns: number): string {
  return rows.map((row) => row.map((cell, index) =>
    wrapAnsi(`${reportHeaders[index]}: ${cell}`, columns, { hard: true }),
  ).join('\n')).join('\n\n');
}

export function terminalColumns(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.max(20, Math.floor(value));
}

export function textTable(rows: string[][], requestedColumns?: number): string {
  const columns = terminalColumns(requestedColumns);
  const widths = naturalWidths(rows);
  const minimum = widths.slice(2).reduce((sum, width) => sum + width, 26);
  if (columns !== undefined && columns < Math.max(60, minimum)) return narrowReport(rows, columns);
  const table = new Table({
    head: reportHeaders, chars, style,
    colAligns: ['left', 'left', 'right', 'right', 'right'],
    colWidths: columns === undefined ? widths : fittedWidths(widths, columns),
  });
  for (const row of rows) table.push(row);
  return table.toString();
}

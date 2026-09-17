import type { TextReportOptions } from '../report/format-text.js';

export interface ReportTerminal {
  isTTY?: boolean;
  columns?: number;
}

function colorDisabled(noColor: boolean, environment: NodeJS.ProcessEnv): boolean {
  return noColor || environment.NO_COLOR !== undefined || environment.TERM === 'dumb';
}

export function reportStyle(
  terminal: ReportTerminal,
  noColor = false,
  environment: NodeJS.ProcessEnv = process.env,
): TextReportOptions {
  const disabled = colorDisabled(noColor, environment);
  const style: TextReportOptions = { color: terminal.isTTY === true && !disabled };
  if (terminal.isTTY && terminal.columns !== undefined) style.columns = terminal.columns;
  return style;
}

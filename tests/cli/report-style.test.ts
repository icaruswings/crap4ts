import { describe, expect, it } from 'vitest';
import { reportStyle } from '../../src/cli/report-style.js';

describe('report style', () => {
  it('uses colour and terminal width only for a terminal', () => {
    expect(reportStyle({ isTTY: true, columns: 80 }, false, {})).toEqual({ color: true, columns: 80 });
    expect(reportStyle({ isTTY: false, columns: 80 }, false, {})).toEqual({ color: false });
    expect(reportStyle({}, false, {})).toEqual({ color: false });
    expect(reportStyle({ isTTY: true }, false, {})).toEqual({ color: true });
  });

  it.each([{ NO_COLOR: '1' }, { NO_COLOR: '' }, { TERM: 'dumb' }])('honours environment %j', (environment) => {
    expect(reportStyle({ isTTY: true }, false, environment).color).toBe(false);
  });

  it('honours the explicit opt-out', () => {
    expect(reportStyle({ isTTY: true }, true, { FORCE_COLOR: '1' }).color).toBe(false);
  });
});

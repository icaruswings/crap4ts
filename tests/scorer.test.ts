import { describe, expect, it } from 'vitest';
import { crapScore } from '../src/scorer.js';

describe('crapScore', () => {
  it.each([
    { cc: 1, coverage: 100, expected: 1 },
    { cc: 2, coverage: 0, expected: 6 },
    { cc: 12, coverage: 45, expected: 35.958 },
  ])('scores CC $cc at $coverage percent', ({ cc, coverage, expected }) => {
    expect(crapScore(cc, coverage)).toBeCloseTo(expected, 10);
  });

  it('returns null for unknown coverage', () => {
    expect(crapScore(3, null)).toBeNull();
  });

  it.each([
    [0, 50],
    [1.5, 50],
    [1, -1],
    [1, 101],
    [Number.NaN, 50],
  ])('rejects invalid inputs', (cc, coverage) => {
    expect(() => crapScore(cc, coverage)).toThrow(RangeError);
  });
});

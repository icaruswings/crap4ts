export function crapScore(
  complexity: number,
  coveragePercent: number | null,
): number | null {
  if (!Number.isInteger(complexity) || complexity < 1) {
    throw new RangeError('complexity must be an integer greater than or equal to 1');
  }
  if (coveragePercent === null) return null;
  if (!Number.isFinite(coveragePercent) || coveragePercent < 0 || coveragePercent > 100) {
    throw new RangeError('coveragePercent must be between 0 and 100');
  }
  const uncovered = 1 - coveragePercent / 100;
  return complexity ** 2 * uncovered ** 3 + complexity;
}

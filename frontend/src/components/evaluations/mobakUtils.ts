
/**
 * Utility functions for Mobak parameter scoring
 */

/**
 * Calculate points for Mobak Method ID 4 (0-6 scale)
 * @param score Selected Mobak score (0-6)
 * @returns Points obtained (0, 1, or 2)
 */
export const calculateMobakMethod4Points = (score: number): number => {
  if (score >= 0 && score <= 2) {
    return 0;
  }
  if (score >= 3 && score <= 4) {
    return 1;
  }
  if (score >= 5 && score <= 6) {
    return 2;
  }
  return 0; // fallback
};

/**
 * Calculate points for Mobak Method ID 5 (0-2 scale)
 * @param score Selected Mobak score (0-2)
 * @returns Points obtained (0, 1, or 2)
 */
export const calculateMobakMethod5Points = (score: number): number => {
  if (score === 0) {
    return 0;
  }
  if (score === 1) {
    return 1;
  }
  if (score === 2) {
    return 2;
  }
  return 0; // fallback
};

/**
 * Calculate points for any Mobak method
 * @param methodId The evaluation method ID (4 or 5)
 * @param score The selected Mobak score
 * @returns Points obtained
 */
export const calculateMobakPoints = (methodId: number, score: number): number => {
  if (methodId === 4) {
    return calculateMobakMethod4Points(score);
  } else if (methodId === 5) {
    return calculateMobakMethod5Points(score);
  }
  return 0;
};

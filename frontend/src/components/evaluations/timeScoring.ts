
/**
 * Time-based scoring utility functions for evaluations
 */

export interface TimeRangeRule {
  evatieran_op_cero: string;
  evatieran_tiempo_cero: number;
  evatieran_op_full: string;
  evatieran_tiempo_full: number;
}

/**
 * Calculates interpolated score for time-based evaluation attempts
 */
export const calculateTimeBasedScore = (
  timeInSeconds: number,
  timeRange: TimeRangeRule,
  maxPointsPerAttempt: number
): number => {
  const {
    evatieran_op_cero,
    evatieran_tiempo_cero,
    evatieran_op_full,
    evatieran_tiempo_full
  } = timeRange;

  // Check if time meets 0-point condition
  if (meetsTimeCondition(timeInSeconds, evatieran_op_cero, evatieran_tiempo_cero)) {
    return 0;
  }

  // Check if time meets full-point condition
  if (meetsTimeCondition(timeInSeconds, evatieran_op_full, evatieran_tiempo_full)) {
    return maxPointsPerAttempt;
  }

  // Calculate interpolated value
  const ratio = calculateInterpolationRatio(
    timeInSeconds,
    evatieran_tiempo_cero,
    evatieran_tiempo_full,
    evatieran_op_cero,
    evatieran_op_full
  );

  const interpolatedScore = ratio * maxPointsPerAttempt;
  
  // Round to 2 decimal places
  return Math.round(interpolatedScore * 100) / 100;
};

/**
 * Checks if a time value meets a specific condition
 */
const meetsTimeCondition = (
  timeValue: number,
  operator: string,
  threshold: number
): boolean => {
  switch (operator) {
    case '>':
      return timeValue > threshold;
    case '>=':
      return timeValue >= threshold;
    case '<':
      return timeValue < threshold;
    case '<=':
      return timeValue <= threshold;
    default:
      return false;
  }
};

/**
 * Calculates the interpolation ratio between 0 and 1
 */
const calculateInterpolationRatio = (
  timeValue: number,
  zeroPointTime: number,
  fullPointTime: number,
  zeroOperator: string,
  fullOperator: string
): number => {
  // Determine the direction of interpolation based on operators
  const isTimeDecreasing = 
    (zeroOperator === '>' || zeroOperator === '>=') &&
    (fullOperator === '<' || fullOperator === '<=');

  if (isTimeDecreasing) {
    // More time = fewer points (e.g., sprint times)
    // Linear interpolation: ratio = (zeroTime - currentTime) / (zeroTime - fullTime)
    if (zeroPointTime === fullPointTime) return 0;
    const ratio = (zeroPointTime - timeValue) / (zeroPointTime - fullPointTime);
    return Math.max(0, Math.min(1, ratio));
  } else {
    // Less time = fewer points (e.g., endurance times)
    // Linear interpolation: ratio = (currentTime - zeroTime) / (fullTime - zeroTime)
    if (fullPointTime === zeroPointTime) return 0;
    const ratio = (timeValue - zeroPointTime) / (fullPointTime - zeroPointTime);
    return Math.max(0, Math.min(1, ratio));
  }
};

/**
 * Converts HH:MM:SS time string to seconds
 */
export const parseTimeToSeconds = (timeString: string): number => {
  if (!timeString) return 0;
  
  const parts = timeString.split(':');
  if (parts.length !== 3) return 0;
  
  const hours = parseInt(parts[0]) || 0;
  const minutes = parseInt(parts[1]) || 0;
  const seconds = parseInt(parts[2]) || 0;
  
  return hours * 3600 + minutes * 60 + seconds;
};


import { formatInTimeZone } from 'date-fns-tz';

const ECUADOR_TIMEZONE = 'America/Guayaquil';

/**
 * Get current time in Ecuador timezone as HH:mm string
 * @returns Time string in HH:mm format
 */
export const getCurrentEcuadorTime = (): string => {
  return formatInTimeZone(new Date(), ECUADOR_TIMEZONE, 'HH:mm');
};

/**
 * Format a time string for display (ensures HH:mm format)
 * @param timeString - Time string from database (e.g., "20:00:00")
 * @returns Time string in HH:mm format
 */
export const formatTimeForDisplay = (timeString: string): string => {
  if (!timeString) return '';
  // Extract HH:mm from HH:mm:ss format
  return timeString.substring(0, 5);
};

/**
 * Convert HH:mm input to HH:mm:ss for database storage
 * @param timeString - Time in HH:mm format
 * @returns Time string in HH:mm:ss format for database
 */
export const formatTimeForDatabase = (timeString: string): string => {
  if (!timeString) return '';
  // Ensure we have seconds for database storage
  return timeString.includes(':') && timeString.split(':').length === 2 
    ? `${timeString}:00` 
    : timeString;
};

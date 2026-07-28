
import { formatInTimeZone } from 'date-fns-tz';

const ECUADOR_TIMEZONE = 'America/Guayaquil';

/**
 * Convert a UTC ISO-like timestamp string to Ecuador local time in "yyyy-MM-dd HH:mm".
 * Returns empty string if value is null/invalid.
 */
export const formatUtcISOToEcuadorLocal = (iso?: string | null): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return formatInTimeZone(date, ECUADOR_TIMEZONE, 'yyyy-MM-dd HH:mm');
};


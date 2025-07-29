const TIMEZONE = 'Asia/Kolkata';

export function toIST(date: Date | string): Date {
  const utcDate = typeof date === 'string' ? new Date(date) : date;
  return new Date(utcDate.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

export function formatIST(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', { 
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

export function getCurrentISTTime(): Date {
  return toIST(new Date());
}

export const TIMEZONE_CONFIG = {
  timezone: TIMEZONE,
  offset: '+05:30'
};

// Add new function specifically for handling date-only values
export function formatISTDateOnly(dateStr: string): string {
  // Create date at midnight IST
  const date = new Date(dateStr);
  // Adjust for IST offset (5 hours and 30 minutes ahead of UTC)
  date.setHours(5, 30, 0, 0);

  return date.toLocaleString('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

// Function to convert IST date to UTC for storage
export function toUTCStorage(dateStr: string): string {
  const date = new Date(dateStr);
  // Set to midnight IST (which is previous day 18:30 UTC)
  date.setUTCHours(18, 30, 0, 0);
  return date.toISOString();
}
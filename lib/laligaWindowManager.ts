/**
 * LaLiga Window Manager
 * Handles LaLiga-specific window logic and D to D+16 filtering
 * 
 * LaLiga Window (WIB = UTC+7):
 * - Opens: 01:00 AM WIB (D)
 * - Closes: 04:00 PM WIB (D)
 * - In UTC: 18:00 UTC (D-1) — 09:00 UTC (D)
 * 
 * Match Range: D to D+16 (17-day window from window open day)
 * 
 * Auto Times:
 * - Auto-Select: 11:00 PM WIB (23:00 UTC, D-1)
 * - Auto-Predict: 12:00 AM WIB (17:00 UTC, D-1)
 * - Auto-Raffle: 15:00 WIB (08:00 UTC, D)
 */

/**
 * Convert UTC hours to WIB hours
 * WIB = UTC + 7
 */
function getWIBHour(utcDate: Date): number {
  return (utcDate.getUTCHours() + 7) % 24;
}

/**
 * Get today's date in WIB timezone
 */
function getTodayWIB(utcDate: Date): string {
  const wibHour = getWIBHour(utcDate);
  
  // If WIB hour < UTC hour, we're still in previous calendar day
  let date = new Date(utcDate);
  if (wibHour < utcDate.getUTCHours()) {
    date.setDate(date.getDate() - 1);
  }
  
  return date.toISOString().split('T')[0];
}

/**
 * Get D1 date (next day in WIB)
 */
function getD1DateWIB(utcDate: Date): string {
  const todayWIB = getTodayWIB(utcDate);
  const [year, month, day] = todayWIB.split('-').map(Number);
  const tomorrow = new Date(year, month - 1, day + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * Get date range for D to D+16
 */
export function getLaligaWindowDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const startDate = getTodayWIB(now);
  
  const [year, month, day] = startDate.split('-').map(Number);
  const endDateObj = new Date(year, month - 1, day + 16);
  const endDate = endDateObj.toISOString().split('T')[0];

  return { startDate, endDate };
}

/**
 * Check if LaLiga selection window is open (01:00 - 16:00 WIB)
 */
export function isLaligaWindowOpen(): boolean {
  const now = new Date();
  const wibHour = getWIBHour(now);
  return wibHour >= 1 && wibHour < 16;
}

/**
 * Get time until LaLiga window opens/closes
 */
export function getLaligaWindowStatus(): {
  isOpen: boolean;
  nextStatusChange: Date;
  message: string;
} {
  const now = new Date();
  const wibHour = getWIBHour(now);
  const isOpen = wibHour >= 1 && wibHour < 16;

  // Calculate next status change
  let nextStatusChange: Date;
  if (isOpen) {
    // Window open, closes at 16:00 WIB
    nextStatusChange = new Date(now);
    nextStatusChange.setUTCHours(9, 0, 0, 0); // 16:00 WIB = 09:00 UTC
  } else {
    // Window closed, opens tomorrow at 01:00 WIB
    nextStatusChange = new Date(now);
    nextStatusChange.setUTCHours(18, 0, 0, 0); // 01:00 WIB next day = 18:00 UTC
  }

  const timeStr = nextStatusChange.toUTCString().split(' ')[4]; // Get HH:MM:SS

  return {
    isOpen,
    nextStatusChange,
    message: isOpen
      ? `LaLiga window closes at ${timeStr} UTC`
      : `LaLiga window opens at ${timeStr} UTC tomorrow`,
  };
}

/**
 * Filter LaLiga matches by window (D to D+16)
 */
export function filterLaligaMatchesByWindow(
  matches: Array<{ dateEvent: string }>
): Array<{ dateEvent: string }> {
  const { startDate, endDate } = getLaligaWindowDateRange();

  return matches.filter((match) => {
    const matchDate = match.dateEvent;
    return matchDate >= startDate && matchDate <= endDate;
  });
}

/**
 * Lock LaLiga selection - stores 6 matches minimum
 */
export async function lockLaligaSelection(
  matchIds: string[]
): Promise<{
  success: boolean;
  locked: number;
  message: string;
}> {
  if (matchIds.length < 6) {
    return {
      success: false,
      locked: 0,
      message: `LaLiga requires minimum 6 matches. Only ${matchIds.length} provided.`,
    };
  }

  return {
    success: true,
    locked: matchIds.length,
    message: `✅ Locked ${matchIds.length} LaLiga matches`,
  };
}

/**
 * Validate LaLiga matches are within selection window
 */
export function validateLaligaMatches(
  matches: Array<{ dateEvent: string; id: string }>
): {
  valid: string[];
  invalid: string[];
} {
  const { startDate, endDate } = getLaligaWindowDateRange();

  const valid: string[] = [];
  const invalid: string[] = [];

  for (const match of matches) {
    if (match.dateEvent >= startDate && match.dateEvent <= endDate) {
      valid.push(match.id);
    } else {
      invalid.push(match.id);
    }
  }

  return { valid, invalid };
}

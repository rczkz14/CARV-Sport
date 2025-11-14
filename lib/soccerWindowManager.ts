/**
 * Soccer Window Manager
 * Handles soccer-specific window logic (EPL and La Liga unified)
 *
 * Soccer Window (WIB = UTC+7):
 * - Opens: 01:00 AM WIB (D)
 * - Closes: 04:00 PM WIB (D)
 * - In UTC: 18:00 UTC (D-1) — 09:00 UTC (D)
 *
 * Match Visibility: 7 days matches starting from window open day
 * - Window opens on day D at 01:00 WIB
 * - Visibility starts on day D+0 at 01:00 WIB
 * - Shows matches from D+0 to D+6 (7 days)
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
function utcToWIB(utcHour: number): number {
  return (utcHour + 7) % 24;
}

/**
 * Get soccer window status
 */
export function getSoccerWindowStatus(nowUtc: Date = new Date()) {
  const utcHour = nowUtc.getUTCHours();
  const wibHour = utcToWIB(utcHour);

  // Soccer window in WIB: 01:00 — 16:00 (same day)
  // In UTC: 18:00 (previous day) — 09:00 (same day)
  const isOpen = utcHour >= 18 || utcHour < 9;

  return {
    isOpen,
    wibHour,
    utcHour,
  };
}

/**
 * Get the visibility date range for soccer matches
 * Visibility starts on window open day, shows 7 days of matches
 *
 * Window opens on day D at 01:00 WIB
 * Visibility: D+0 to D+6 (7 days)
 *
 * Returns: { startUTC, endUTC, visibilityStartWIB, visibilityEndWIB }
 */
export function getSoccerDateRangeWIB(nowUtc: Date = new Date()): {
  startUTC: number;
  endUTC: number;
  visibilityStartWIB: string;
  visibilityEndWIB: string;
} {
  // Figure out what day it is in WIB RIGHT NOW
  const nowWIBTime = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);
  const todayWIBString = nowWIBTime.toLocaleString('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const [month, day, year] = todayWIBString.split('/');
  const todayWIB = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));

  // Window open day D: today in WIB
  const dDate = new Date(todayWIB);

  // Visibility starts on D+0 (same day as window open)
  const visibilityStartDate = new Date(dDate);

  // Visibility ends on D+6 (7 days from D+0)
  const visibilityEndDate = new Date(visibilityStartDate);
  visibilityEndDate.setDate(visibilityStartDate.getDate() + 6); // +6 to get 7 days total

  const visibilityStartWIB = visibilityStartDate.toISOString().split('T')[0];
  const visibilityEndWIB = visibilityEndDate.toISOString().split('T')[0];

  // Start: 00:00:00 WIB on D+0 (convert to UTC)
  const startWIB = new Date(`${visibilityStartWIB}T00:00:00Z`);
  const startUTC = new Date(startWIB.getTime() - 7 * 60 * 60 * 1000);

  // End: 23:59:59 WIB on D+6 (convert to UTC)
  const endWIB = new Date(`${visibilityEndWIB}T23:59:59Z`);
  const endUTC = new Date(endWIB.getTime() - 7 * 60 * 60 * 1000);

  return {
    startUTC: startUTC.getTime(),
    endUTC: endUTC.getTime(),
    visibilityStartWIB,
    visibilityEndWIB,
  };
}

/**
 * Filter soccer matches to visibility range (D+7 to D+13)
 */
export function filterSoccerMatchesToDateRange(
  matches: any[],
  nowUtc: Date = new Date()
): any[] {
  const { startUTC, endUTC } = getSoccerDateRangeWIB(nowUtc);

  return matches.filter((match) => {
    if (!match.datetime) return false;
    const matchTime = new Date(match.datetime).getTime();
    return matchTime >= startUTC && matchTime <= endUTC;
  });
}

/**
 * Get auto-select time (11:00 PM WIB = 23:00 UTC previous day)
 */
export function getNextAutoSelectTimeSoccer(nowUtc: Date = new Date()) {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  // Auto-select triggers at 23:00 UTC (11:00 PM WIB)
  const autoSelectHourUTC = 23;

  let nextTrigger: Date;

  if (utcHour < autoSelectHourUTC || (utcHour === autoSelectHourUTC && utcMinute < 0)) {
    // Trigger hasn't happened today, schedule for today at 23:00 UTC
    nextTrigger = new Date(nowUtc);
    nextTrigger.setUTCHours(autoSelectHourUTC, 0, 0, 0);
  } else {
    // Trigger already happened today, schedule for tomorrow at 23:00 UTC
    nextTrigger = new Date(nowUtc);
    nextTrigger.setUTCDate(nextTrigger.getUTCDate() + 1);
    nextTrigger.setUTCHours(autoSelectHourUTC, 0, 0, 0);
  }

  return nextTrigger;
}

/**
 * Check if current time is within auto-select window
 * Window: 23:00 - 23:05 UTC
 */
export function isAutoSelectTimeSoccer(nowUtc: Date = new Date()): boolean {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  return utcHour === 23 && utcMinute < 5;
}

/**
 * Get auto-predict time (12:00 AM WIB = 17:00 UTC previous day)
 */
export function getNextAutoPredictTimeSoccer(nowUtc: Date = new Date()) {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  // Auto-predict triggers at 17:00 UTC (12:00 AM WIB)
  const autoPredictHourUTC = 17;

  let nextTrigger: Date;

  if (utcHour < autoPredictHourUTC || (utcHour === autoPredictHourUTC && utcMinute < 0)) {
    // Trigger hasn't happened today, schedule for today at 17:00 UTC
    nextTrigger = new Date(nowUtc);
    nextTrigger.setUTCHours(autoPredictHourUTC, 0, 0, 0);
  } else {
    // Trigger already happened today, schedule for tomorrow at 17:00 UTC
    nextTrigger = new Date(nowUtc);
    nextTrigger.setUTCDate(nextTrigger.getUTCDate() + 1);
    nextTrigger.setUTCHours(autoPredictHourUTC, 0, 0, 0);
  }

  return nextTrigger;
}

/**
 * Check if current time is within auto-predict window
 * Window: 17:00 - 17:05 UTC
 */
export function isAutoPredictTimeSoccer(nowUtc: Date = new Date()): boolean {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  return utcHour === 17 && utcMinute < 5;
}

/**
 * Get auto-raffle time (15:00 WIB = 08:00 UTC)
 */
export function getNextAutoRaffleTimeSoccer(nowUtc: Date = new Date()) {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  // Auto-raffle triggers at 08:00 UTC (15:00 WIB)
  const autoRaffleHourUTC = 8;

  let nextTrigger: Date;

  if (utcHour < autoRaffleHourUTC || (utcHour === autoRaffleHourUTC && utcMinute < 0)) {
    // Trigger hasn't happened today, schedule for today at 08:00 UTC
    nextTrigger = new Date(nowUtc);
    nextTrigger.setUTCHours(autoRaffleHourUTC, 0, 0, 0);
  } else {
    // Trigger already happened today, schedule for tomorrow at 08:00 UTC
    nextTrigger = new Date(nowUtc);
    nextTrigger.setUTCDate(nextTrigger.getUTCDate() + 1);
    nextTrigger.setUTCHours(autoRaffleHourUTC, 0, 0, 0);
  }

  return nextTrigger;
}

/**
 * Check if current time is within auto-raffle window
 * Window: 08:00 - 08:05 UTC
 */
export function isAutoRaffleTimeSoccer(nowUtc: Date = new Date()): boolean {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  return utcHour === 8 && utcMinute < 5;
}

/**
 * Get locked soccer selection file path
 */
export function getSoccerLockedSelectionFilePath(): string {
  const path = require('path');
  return path.join(process.cwd(), 'data/soccer_locked_selection.json');
}

/**
 * Lock the selected soccer matches
 */
export async function lockSoccerSelection(matchIds: string[]): Promise<void> {
  const fs = require('fs').promises;
  const filePath = getSoccerLockedSelectionFilePath();

  // Get today's WIB date (D)
  const nowWIBTime = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayWIBString = nowWIBTime.toLocaleString('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const [month, day, year] = todayWIBString.split('/');
  const dDate = `${year}-${month}-${day}`;

  const data = {
    lockedAt: new Date().toISOString(),
    matchIds: matchIds.slice(0, 5), // Allow up to 5 matches
    dDate: dDate,
  };

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Get locked soccer selection
 */
export async function getLockedSoccerSelection(): Promise<string[] | null> {
  const fs = require('fs').promises;
  const filePath = getSoccerLockedSelectionFilePath();

  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed.matchIds) || parsed.matchIds.length === 0) {
      return null;
    }

    // Verify it's still valid for this window
    const nowWIBTime = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const todayWIBString = nowWIBTime.toLocaleString('en-US', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [month, day, year] = todayWIBString.split('/');
    const expectedDDate = `${year}-${month}-${day}`;

    if (parsed.dDate === expectedDDate) {
      return parsed.matchIds;
    }

    return null;
  } catch (error) {
    console.warn('[Soccer Window] Error reading locked selection:', error);
    return null;
  }
}
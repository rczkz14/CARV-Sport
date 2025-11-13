/**
 * EPL Window Manager
 * Handles EPL-specific window logic and D to D+16 filtering
 * 
 * EPL Window (WIB = UTC+7):
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
function utcToWIB(utcHour: number): number {
  return (utcHour + 7) % 24;
}

/**
 * Get EPL window status
 */
export function getEPLWindowStatus(nowUtc: Date = new Date()) {
  const utcHour = nowUtc.getUTCHours();
  const wibHour = utcToWIB(utcHour);

  // EPL window in WIB: 01:00 — 16:00 (same day)
  // In UTC: 18:00 (previous day) — 09:00 (same day)
  const isOpen = utcHour >= 18 || utcHour < 9;

  return {
    isOpen,
    wibHour,
    utcHour,
  };
}

/**
 * Get the D to D+16 date range for EPL matches
 * D is the window open day (01:00 AM WIB)
 * D+16 is 16 days later
 * 
 * Returns: { startUTC, endUTC, daysWIB: [date strings] }
 */
export function getEPLDateRangeWIB(nowUtc: Date = new Date()): {
  startUTC: number;
  endUTC: number;
  daysWIB: string[];
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
  const todayWIB = `${year}-${month}-${day}`;

  // D to D+16: 17 days total starting from today in WIB
  const daysWIB: string[] = [];
  const startDate = new Date(todayWIB);

  for (let i = 0; i < 17; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const y = d.getFullYear();
    daysWIB.push(`${y}-${m}-${dd}`);
  }

  // Start: 00:00:00 WIB on first day (convert to UTC)
  const d1StartWIB = new Date(`${daysWIB[0]}T00:00:00Z`);
  const startUTC = new Date(d1StartWIB.getTime() - 7 * 60 * 60 * 1000);

  // End: 23:59:59 WIB on last day (convert to UTC)
  const d16EndWIB = new Date(`${daysWIB[16]}T23:59:59Z`);
  const endUTC = new Date(d16EndWIB.getTime() - 7 * 60 * 60 * 1000);

  return {
    startUTC: startUTC.getTime(),
    endUTC: endUTC.getTime(),
    daysWIB,
  };
}

/**
 * Filter EPL matches to D to D+8 range
 */
export function filterEPLMatchesToDateRange(
  matches: any[],
  nowUtc: Date = new Date()
): any[] {
  const { startUTC, endUTC } = getEPLDateRangeWIB(nowUtc);

  return matches.filter((match) => {
    if (!match.datetime) return false;
    const matchTime = new Date(match.datetime).getTime();
    return matchTime >= startUTC && matchTime <= endUTC;
  });
}

/**
 * Get auto-select time (11:00 PM WIB = 23:00 UTC previous day)
 */
export function getNextAutoSelectTimeEPL(nowUtc: Date = new Date()) {
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
export function isAutoSelectTimeEPL(nowUtc: Date = new Date()): boolean {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  return utcHour === 23 && utcMinute < 5;
}

/**
 * Get auto-predict time (12:00 AM WIB = 17:00 UTC previous day)
 */
export function getNextAutoPredictTimeEPL(nowUtc: Date = new Date()) {
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
export function isAutoPredictTimeEPL(nowUtc: Date = new Date()): boolean {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  return utcHour === 17 && utcMinute < 5;
}

/**
 * Get auto-raffle time (15:00 WIB = 08:00 UTC)
 */
export function getNextAutoRaffleTimeEPL(nowUtc: Date = new Date()) {
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
export function isAutoRaffleTimeEPL(nowUtc: Date = new Date()): boolean {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  return utcHour === 8 && utcMinute < 5;
}

/**
 * Get locked EPL selection file path
 */
export function getEPLLockedSelectionFilePath(): string {
  const path = require('path');
  return path.join(process.cwd(), 'data/epl_locked_selection.json');
}

/**
 * Lock the selected 6 EPL matches
 */
export async function lockEPLSelection(matchIds: string[]): Promise<void> {
  const fs = require('fs').promises;
  const filePath = getEPLLockedSelectionFilePath();

  // Get today's WIB date (D)
  const { daysWIB } = getEPLDateRangeWIB(new Date());
  const dDate = daysWIB[0]; // First day of range

  const data = {
    lockedAt: new Date().toISOString(),
    matchIds: matchIds.slice(0, 6),
    dDate: dDate,
  };

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Get locked EPL selection
 */
export async function getLockedEPLSelection(): Promise<string[] | null> {
  const fs = require('fs').promises;
  const filePath = getEPLLockedSelectionFilePath();

  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed.matchIds) || parsed.matchIds.length === 0) {
      return null;
    }

    // Verify it's still valid for this D to D+8 range
    const { daysWIB } = getEPLDateRangeWIB(new Date());
    const expectedDDate = daysWIB[0];

    if (parsed.dDate === expectedDDate) {
      return parsed.matchIds;
    }

    return null;
  } catch (error) {
    console.warn('[EPL Window] Error reading locked selection:', error);
    return null;
  }
}

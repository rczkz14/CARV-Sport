/**
 * NBA Window Manager
 * Handles NBA-specific window logic and D+1 filtering
 * 
 * NBA Window (WIB = UTC+7):
 * - Opens: 13:00 WIB (D)
 * - Closes: 06:30 WIB (D+1)
 * - In UTC: 06:00 — 23:30 UTC (same day)
 * 
 * For Matches Tab:
 * - Show only D+1 matches (next calendar day)
 * - Max 5 matches
 */

/**
 * Convert UTC hours to WIB hours
 * WIB = UTC + 7
 */
function utcToWIB(utcHour: number): number {
  return (utcHour + 7) % 24;
}

/**
 * Get NBA window status
 * Returns: { isOpen, hoursUntilOpen, hoursUntilClose }
 */
export function getNBAWindowStatus(nowUtc: Date = new Date()) {
  const utcHour = nowUtc.getUTCHours();
  const wibHour = utcToWIB(utcHour);

  // NBA window in WIB: 13:00 — 06:30 (next day)
  // In UTC: 06:00 — 23:30 same UTC day
  const utcMinutes = nowUtc.getUTCHours() * 60 + nowUtc.getUTCMinutes();
  const openMinutes = 6 * 60; // 06:00 UTC
  const closeMinutes = 23 * 60 + 30; // 23:30 UTC
  const isOpen = utcMinutes >= openMinutes && utcMinutes < closeMinutes;

  // Calculate minutes until next transition
  let minutesUntilNextChange: number;
  let isOpeningNext: boolean;

  if (isOpen) {
    // Window is open, next change is CLOSE at 23:30 UTC
    minutesUntilNextChange = closeMinutes - utcMinutes;
    isOpeningNext = false; // Next event is close
  } else {
    // Window is closed, next change is OPEN at 06:00 UTC
    if (utcMinutes < openMinutes) {
      minutesUntilNextChange = openMinutes - utcMinutes;
    } else {
      minutesUntilNextChange = 24 * 60 - (utcMinutes - openMinutes); // Next day at 06:00
    }
    isOpeningNext = true; // Next event is open
  }

  return {
    isOpen,
    wibHour,
    utcHour,
    minutesUntilNextChange,
    nextEventIsOpening: isOpeningNext,
  };
}

/**
 * Get the D+1 date range for NBA matches
 * D+1 means the next calendar day (in WIB) from window open time
 * 
 * Timeline:
 * - Window opens at 13:00 WIB on day N (= 06:00 UTC on day N)
 * - D+1 is the calendar period day N+1 (00:00-23:59 WIB on day N+1)
 * - But we're asking for the D+1 that matches the CURRENT window
 * 
 * Logic:
 * - If we're between 13:00 WIB and 23:59 WIB on day N: D+1 is day N+1
 * - If we're between 00:00 WIB and 04:00 WIB on day N+1: D+1 is STILL day N+1 (same window!)
 * - If we're between 04:00 WIB and 13:00 WIB: No window open, but D+1 would be day N+2 (next window)
 * 
 * WIB Timezone Conversion:
 * - WIB = UTC + 7 hours
 * - WIB 00:00 = UTC 17:00 (previous day)
 * - WIB 23:59:59 = UTC 16:59:59 (same day)
 * 
 * Returns: { startUTC, endUTC, dateStringWIB }
 */
export function getD1DateRangeWIB(nowUtc: Date = new Date()) {
   // First, figure out what day it is in WIB RIGHT NOW
   const nowWIBTime = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000);

   // Get today's WIB date
   const todayWIB = nowWIBTime.toLocaleString('en-US', {
     timeZone: 'Asia/Jakarta',
     year: 'numeric',
     month: '2-digit',
     day: '2-digit'
   });

   const [month, day, year] = todayWIB.split('/');
   const todayDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));

   // Determine D+1 based on current WIB hour
   const nowWIBHour = nowWIBTime.getHours() + nowWIBTime.getMinutes() / 60;
   let d1Date: Date;
   if (nowWIBHour >= 13) {
     // Window opened today, D+1 is tomorrow
     d1Date = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);
   } else if (nowWIBHour < 6.5) {
     // Window opened yesterday, D+1 is today
     d1Date = todayDate;
   } else {
     // Not in window, but function shouldn't be called
     d1Date = new Date(todayDate.getTime() + 24 * 60 * 60 * 1000);
   }

   const d1Year = d1Date.getUTCFullYear();
   const d1Month = String(d1Date.getUTCMonth() + 1).padStart(2, '0');
   const d1Day = String(d1Date.getUTCDate()).padStart(2, '0');
   const dateStringWIB = `${d1Year}-${d1Month}-${d1Day}`;

   console.log(`[NBA D+1] D+1 date: ${dateStringWIB}, today WIB: ${todayWIB}, now WIB hour: ${nowWIBHour.toFixed(2)}`);

   // D+1 start: 00:00:00 WIB on D+1 date
   // Create UTC time: dateStringWIB T 00:00:00 - 7 hours
   const d1StartWIB = new Date(`${dateStringWIB}T00:00:00Z`);
   const startUTC = new Date(d1StartWIB.getTime() - 7 * 60 * 60 * 1000);

   // D+1 end: 23:59:59 WIB on D+1 date
   // Create UTC time: dateStringWIB T 23:59:59 - 7 hours
   const d1EndWIB = new Date(`${dateStringWIB}T23:59:59Z`);
   const endUTC = new Date(d1EndWIB.getTime() - 7 * 60 * 60 * 1000);

   return {
     startUTC: startUTC.getTime(),
     endUTC: endUTC.getTime(),
     dateStringWIB,
   };
}

/**
 * Filter NBA matches to only D+1 matches and limit to 3
 * Randomly selects 3 matches from D+1 period
 */
export function filterNBAMatchesToD1(
  matches: any[],
  nowUtc: Date = new Date()
): any[] {
  const { startUTC, endUTC } = getD1DateRangeWIB(nowUtc);

  // Filter to D+1 matches only
  const d1Matches = matches.filter((match) => {
    if (!match.datetime) return false;
    const matchTime = new Date(match.datetime).getTime();
    return matchTime >= startUTC && matchTime <= endUTC;
  });

  // Randomly shuffle and pick 3
  for (let i = d1Matches.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d1Matches[i], d1Matches[j]] = [d1Matches[j], d1Matches[i]];
  }

  // Limit to max 5 matches
  return d1Matches.slice(0, 5);
}

/**
 * Get the auto-select time (11:00 WIB = 04:00 UTC)
 * Returns next auto-select trigger time
 */
export function getNextAutoSelectTime(nowUtc: Date = new Date()) {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  // Auto-select triggers at 04:00 UTC (11:00 WIB)
  const autoSelectHourUTC = 4;

  let nextTrigger: Date;

  if (utcHour < autoSelectHourUTC || (utcHour === autoSelectHourUTC && utcMinute < 0)) {
    // Trigger hasn't happened today, schedule for today at 04:00 UTC
    nextTrigger = new Date(nowUtc);
    nextTrigger.setUTCHours(autoSelectHourUTC, 0, 0, 0);
  } else {
    // Trigger already happened today, schedule for tomorrow at 04:00 UTC
    nextTrigger = new Date(nowUtc);
    nextTrigger.setUTCDate(nextTrigger.getUTCDate() + 1);
    nextTrigger.setUTCHours(autoSelectHourUTC, 0, 0, 0);
  }

  return nextTrigger;
}

/**
 * Check if current time is within auto-select window
 * Window: 04:00 - 04:05 UTC (allow 5 minutes for processing)
 * 11:00 WIB
 */
export function isAutoSelectTime(nowUtc: Date = new Date()): boolean {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  return utcHour === 4 && utcMinute < 5;
}

/**
 * Get the auto-predict time (12:00 WIB = 05:00 UTC)
 * Returns next auto-predict trigger time
 */
export function getNextAutoPredictTime(nowUtc: Date = new Date()) {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  // Auto-predict triggers at 05:00 UTC (12:00 WIB)
  const autoPredictHourUTC = 5;

  let nextTrigger: Date;

  if (utcHour < autoPredictHourUTC || (utcHour === autoPredictHourUTC && utcMinute < 0)) {
    // Trigger hasn't happened today, schedule for today at 05:00 UTC
    nextTrigger = new Date(nowUtc);
    nextTrigger.setUTCHours(autoPredictHourUTC, 0, 0, 0);
  } else {
    // Trigger already happened today, schedule for tomorrow at 05:00 UTC
    nextTrigger = new Date(nowUtc);
    nextTrigger.setUTCDate(nextTrigger.getUTCDate() + 1);
    nextTrigger.setUTCHours(autoPredictHourUTC, 0, 0, 0);
  }

  return nextTrigger;
}

/**
 * Check if current time is within auto-predict window
 * Window: 05:00 - 05:05 UTC (allow 5 minutes for processing)
 * 12:00 WIB
 */
export function isAutoPredictTime(nowUtc: Date = new Date()): boolean {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  return utcHour === 5 && utcMinute < 5;
}

/**
 * Get the auto-raffle time (15:00 WIB = 08:00 UTC)
 * Returns next auto-raffle trigger time
 */
export function getNextAutoRaffleTime(nowUtc: Date = new Date()) {
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
 * Window: 08:00 - 08:05 UTC (allow 5 minutes for processing)
 * 15:00 WIB
 */
export function isAutoRaffleTime(nowUtc: Date = new Date()): boolean {
  const utcHour = nowUtc.getUTCHours();
  const utcMinute = nowUtc.getUTCMinutes();

  return utcHour === 8 && utcMinute < 5;
}

/**
 * Get match result storage file path
 * Matches that finish (FT) are stored in data/nba_history.json
 */
export function getNBAHistoryFilePath(): string {
  const path = require('path');
  return path.join(process.cwd(), 'data/nba_history.json');
}

/**
 * Get locked NBA selection file path
 * Stores which 3 D+1 matches were randomly selected
 */
export function getNBALockedSelectionFilePath(): string {
  const path = require('path');
  return path.join(process.cwd(), 'data/nba_locked_selection.json');
}

/**
 * Lock the selected 3 matches for this D+1 window
 * 
 * Stores the current D+1 date (today's date in WIB during the active window)
 */
export async function lockNBASelection(matchIds: string[]): Promise<void> {
  const fs = require('fs').promises;
  const filePath = getNBALockedSelectionFilePath();
  
  // Get today's WIB date (which is the D+1 period we're locking for)
  const { dateStringWIB } = getD1DateRangeWIB(new Date());
  
  // Convert YYYY-MM-DD to MM/DD/YYYY format for consistency
  const [year, month, day] = dateStringWIB.split('-');
  const d1DateFormatted = `${month}/${day}/${year}`;
  
  const data = {
    lockedAt: new Date().toISOString(),
    matchIds: matchIds.slice(0, 5),
    d1Date: d1DateFormatted,
  };
  
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Get locked selection for current D+1 window
 * 
 * A window is valid if:
 * - It was locked for a D+1 date that matches the D+1 period we're currently in
 * - The D+1 period runs from 13:00 WIB on day N to 04:00 WIB on day N+1
 * - So a lock from day N is valid on day N (13:00-23:59) AND day N+1 (00:00-04:00)
 */
export async function getLockedNBASelection(): Promise<string[] | null> {
  const fs = require('fs').promises;
  const filePath = getNBALockedSelectionFilePath();
  
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    
    if (!Array.isArray(parsed.matchIds) || parsed.matchIds.length === 0) {
      return null;
    }
    
    // For now, return the locked selection if it exists and was locked within the last 24 hours
    // This allows the locked matches to be shown during the current window period
    const lockedAt = new Date(parsed.lockedAt);
    const now = new Date();
    const hoursSinceLocked = (now.getTime() - lockedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLocked <= 48) { // Allow locked selection for up to 48 hours
      console.log(`[NBA Window] Using locked selection from ${hoursSinceLocked.toFixed(1)} hours ago:`, parsed.matchIds);
      return parsed.matchIds;
    }
    
    console.log(`[NBA Window] Locked selection too old (${hoursSinceLocked.toFixed(1)} hours), ignoring`);
    return null;
  } catch (error) {
    console.warn('[NBA Window] Error reading locked selection:', error);
    return null;
  }
}

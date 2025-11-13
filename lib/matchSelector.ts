/**
 * Match Selector Service
 * 
 * Selects random matches based on:
 * - NBA: 3 random matches within 2 days of window open
 * - Soccer: 3 random matches per league within 15 days of window open
 * - Tracks selected matches to avoid duplicates within the same window
 */

import { promises as fs } from 'fs';
import path from 'path';

const SELECTED_MATCHES_FILE = path.join(process.cwd(), 'data/selected_matches.json');
const WINDOW_DATES_FILE = path.join(process.cwd(), 'data/window_dates.json');

interface SelectedMatches {
  nba: string[]; // event IDs
  epl: string[];
  laliga: string[];
  lastUpdated: string;
  windowOpen: {
    nba: string | null;
    soccer: string | null;
  };
}

/**
 * Read selected matches file
 */
async function readSelectedMatches(): Promise<SelectedMatches> {
  try {
    const data = await fs.readFile(SELECTED_MATCHES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Selected matches file not found, returning empty');
    return {
      nba: [],
      epl: [],
      laliga: [],
      lastUpdated: new Date().toISOString(),
      windowOpen: { nba: null, soccer: null }
    };
  }
}

/**
 * Save selected matches file
 */
async function saveSelectedMatches(data: SelectedMatches): Promise<void> {
  try {
    await fs.writeFile(SELECTED_MATCHES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving selected matches:', error);
  }
}

/**
 * Save window dates file (tracks which matches belong to which date)
 */
async function saveWindowDates(windows: any[]): Promise<void> {
  try {
    await fs.writeFile(WINDOW_DATES_FILE, JSON.stringify({ windows }, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving window dates:', error);
  }
}

/**
 * Read window dates file
 */
async function readWindowDates(): Promise<any[]> {
  try {
    const data = await fs.readFile(WINDOW_DATES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.windows || [];
  } catch (error) {
    return [];
  }
}

/**
 * Get window status to determine if we need to select new matches
 * NBA window: 13:00-04:00 WIB = 06:00-21:00 UTC
 * Select matches 1 hour before NBA window opens = 05:00 UTC
 * 
 * Soccer (EPL/LaLiga) window: 01:00-16:00 WIB = 18:00 (prev)-09:00 UTC
 * Select matches 1 hour before soccer window opens = 17:00 UTC (00:00 WIB)
 */
function getWindowStatus(nowUtc: Date) {
  const hour = nowUtc.getUTCHours();
  // NBA: open when UTC hour in [5,21), includes 1 hour pre-window at 05:00 UTC for auto-predict
  const openNBA = (hour >= 5 && hour < 21); // 05:00..20:59 UTC
  // Soccer: open when UTC hour in [17,24) OR [0,9), includes 1 hour pre-window at 17:00 UTC for auto-predict
  const openSoccer = (hour >= 17 || hour < 9); // 17:00..23:59 OR 00:00..08:59 UTC
  
  return { openNBA, openSoccer };
}

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Select random matches for the current window
 * 
 * Prediction logic:
 * - Auto-predict when: 1 hour before window opens + match is within selection window
 * - NBA: Select at 05:00 UTC for matches today + up to 2 days (same day window)
 * - Soccer: Select at 17:00 UTC for matches tomorrow + next 14 days (D-1 logic + 15 day lookahead)
 */
export async function selectMatchesForWindow(
  nbaMatches: any[],
  eplMatches: any[],
  laligaMatches: any[]
): Promise<SelectedMatches> {
  const nowUtc = new Date();
  const { openNBA, openSoccer } = getWindowStatus(nowUtc);
  
  const selected = await readSelectedMatches();
  const currentWindowKey = nowUtc.toISOString().split('T')[0]; // YYYY-MM-DD

  // Check if we need to select new NBA matches
  // Select if: window is open AND we haven't selected for this date yet
  const nbaWindowChanged = selected.windowOpen.nba !== currentWindowKey;
  if (openNBA && nbaWindowChanged) {
    console.log('[MatchSelector] NBA window opened (05:00 UTC), selecting 3 random matches from next 2 days...');
    
    // Calculate today's date range (in UTC)
    const todayStart = new Date(nowUtc);
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setUTCHours(23, 59, 59, 999);
    
    // Also include matches up to 2 days away (for flexibility)
    const twoDaysEnd = new Date(todayEnd);
    twoDaysEnd.setUTCDate(twoDaysEnd.getUTCDate() + 2);
    
    const validNBA = nbaMatches.filter((m: any) => {
      if (!m.startMs) return false;
      return m.startMs > nowUtc.getTime() && m.startMs <= twoDaysEnd.getTime();
    });

    if (validNBA.length >= 3) {
      const shuffled = shuffle(validNBA);
      selected.nba = shuffled.slice(0, 3).map((m: any) => m.id);
      selected.windowOpen.nba = currentWindowKey;
      console.log(`[MatchSelector] Selected NBA matches: ${selected.nba.join(', ')}`);
    } else {
      console.warn(`[MatchSelector] Not enough NBA matches available (${validNBA.length} found, need 3)`);
    }
  }

  // Check if we need to select new Soccer matches
  // Select at 17:00 UTC for matches within next 15 days (D-1 principle: starts at tomorrow, but also include today for testing)
  if (openSoccer && selected.windowOpen.soccer !== currentWindowKey) {
    console.log('[MatchSelector] Soccer window opened (17:00 UTC), selecting 3 random EPL + 3 LaLiga from next 15 days...');
    
    // Calculate today's start (for testing purposes - normally would be tomorrow)
    const today = new Date(nowUtc);
    today.setUTCHours(0, 0, 0, 0);
    
    // Include all matches from today through 15 days ahead
    const fifteenDaysAhead = new Date(today);
    fifteenDaysAhead.setUTCDate(fifteenDaysAhead.getUTCDate() + 15); // +15 days starting from today
    fifteenDaysAhead.setUTCHours(23, 59, 59, 999);
    
    const validEPL = eplMatches.filter((m: any) => {
      if (!m.startMs) return false;
      return m.startMs >= today.getTime() && m.startMs <= fifteenDaysAhead.getTime();
    });

    const validLaLiga = laligaMatches.filter((m: any) => {
      if (!m.startMs) return false;
      return m.startMs >= today.getTime() && m.startMs <= fifteenDaysAhead.getTime();
    });

    console.log(`[MatchSelector] Found ${validEPL.length} EPL matches in 15-day window, ${validLaLiga.length} LaLiga matches`);

    if (validEPL.length >= 3) {
      const shuffled = shuffle(validEPL);
      selected.epl = shuffled.slice(0, 3).map((m: any) => m.id);
      console.log(`[MatchSelector] Selected EPL matches: ${selected.epl.join(', ')}`);
    } else {
      console.warn(`[MatchSelector] Not enough EPL matches available (${validEPL.length} found, need 3)`);
    }

    if (validLaLiga.length >= 3) {
      const shuffled = shuffle(validLaLiga);
      selected.laliga = shuffled.slice(0, 3).map((m: any) => m.id);
      console.log(`[MatchSelector] Selected LaLiga matches: ${selected.laliga.join(', ')}`);
    } else {
      console.warn(`[MatchSelector] Not enough LaLiga matches available (${validLaLiga.length} found, need 3)`);
    }

    selected.windowOpen.soccer = currentWindowKey;
  }

  selected.lastUpdated = nowUtc.toISOString();
  await saveSelectedMatches(selected);
  
  // Also save to window_dates.json for historical tracking
  const windows = await readWindowDates();
  const currentDateStr = currentWindowKey; // YYYY-MM-DD
  
  // Find or create entry for this date
  let windowEntry = windows.find((w: any) => w.date === currentDateStr);
  if (!windowEntry) {
    windowEntry = {
      date: currentDateStr,
      nba: [],
      epl: [],
      laliga: [],
      closed: false
    };
    windows.push(windowEntry);
  }
  
  // Update with selected matches
  if (openNBA && selected.windowOpen.nba === currentWindowKey) {
    windowEntry.nba = selected.nba;
  }
  if (openSoccer && selected.windowOpen.soccer === currentWindowKey) {
    windowEntry.epl = selected.epl;
    windowEntry.laliga = selected.laliga;
  }
  
  await saveWindowDates(windows);
  
  return selected;
}

/**
 * Check if we are in D-1 football window (01:00-16:00 WIB for EPL/LaLiga)
 * WIB = UTC+7, so:
 * 01:00 WIB = 18:00 UTC (previous day)
 * 16:00 WIB = 09:00 UTC
 */
function isFootballWindowOpen(nowUtc: Date): boolean {
  const hour = nowUtc.getUTCHours();
  // 18:00-23:59 UTC (previous day's 01:00-09:59 WIB) + 00:00-08:59 UTC (next day's 07:00-16:00 WIB)
  return hour >= 18 || hour < 9;
}

/**
 * Get D-1 football matches (matches happening tomorrow, within 01:00-16:00 WIB window)
 */
export async function selectFootballD1Matches(
  eplMatches: any[],
  laligaMatches: any[]
): Promise<{ epl: string[]; laliga: string[] }> {
  const nowUtc = new Date();
  const tomorrowStart = new Date(nowUtc);
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
  tomorrowStart.setUTCHours(0, 0, 0, 0);
  
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setUTCHours(23, 59, 59, 999);

  const result = { epl: [] as string[], laliga: [] as string[] };

  // Filter EPL matches for tomorrow
  const tomorrowEPL = eplMatches.filter((m: any) => {
    if (!m.startMs) return false;
    return m.startMs >= tomorrowStart.getTime() && m.startMs <= tomorrowEnd.getTime();
  });

  // Filter LaLiga matches for tomorrow
  const tomorrowLaLiga = laligaMatches.filter((m: any) => {
    if (!m.startMs) return false;
    return m.startMs >= tomorrowStart.getTime() && m.startMs <= tomorrowEnd.getTime();
  });

  // Return all D-1 matches (they already come pre-filtered as max 3 from API)
  result.epl = tomorrowEPL.slice(0, 3).map((m: any) => m.id);
  result.laliga = tomorrowLaLiga.slice(0, 3).map((m: any) => m.id);

  console.log(`[MatchSelector] D-1 Football matches - EPL: ${result.epl.length}, LaLiga: ${result.laliga.length}`);

  return result;
}

/**
 * Get currently selected matches
 */
export async function getSelectedMatches(): Promise<SelectedMatches> {
  return readSelectedMatches();
}

/**
 * Check if a match is currently selected/buyable
 */
export async function isMatchSelected(eventId: string): Promise<boolean> {
  const selected = await readSelectedMatches();
  return (
    selected.nba.includes(eventId) ||
    selected.epl.includes(eventId) ||
    selected.laliga.includes(eventId)
  );
}

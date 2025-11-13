/**
 * Window Close Cron Job
 * Automatically runs at:
 * - NBA: 04:00 AM WIB (21:00 UTC) every day
 * - EPL: 16:00 WIB (09:00 UTC) every day
 * 
 * This is a server-side background job that runs without needing a browser tab
 */

import { CronJob } from 'cron';
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
const NBA_LOCKED_FILE = path.join(process.cwd(), 'data/nba_locked_selection.json');
const EPL_LOCKED_FILE = path.join(process.cwd(), 'data/epl_locked_selection.json');
const LALIGA_LOCKED_FILE = path.join(process.cwd(), 'data/laliga_locked_selection.json');
const NBA_HISTORY_FILE = path.join(process.cwd(), 'data/nba_history.json');
const EPL_HISTORY_FILE = path.join(process.cwd(), 'data/epl_history.json');
const LALIGA_HISTORY_FILE = path.join(process.cwd(), 'data/laliga_history.json');

let nbaJob: CronJob | null = null;
let eplJob: CronJob | null = null;
let laligaJob: CronJob | null = null;

/**
 * Archive matches for a league
 */
async function archiveLeagueMatches(
  league: 'NBA' | 'EPL' | 'LaLiga',
  lockedFile: string,
  historyFile: string
): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] [Window Close] Starting ${league} archival...`);

    // Read locked matches
    let lockedMatches: string[] = [];
    try {
      const lockedData = JSON.parse(await fs.readFile(lockedFile, 'utf-8'));
      if (lockedData.locked && Array.isArray(lockedData.locked)) {
        lockedMatches = lockedData.locked;
      }
    } catch (e) {
      console.warn(`[Window Close] No locked ${league} matches found`);
      return;
    }

    if (lockedMatches.length === 0) {
      console.log(`[Window Close] No locked ${league} matches to archive`);
      return;
    }

    // Read cache
    let cache: any = null;
    try {
      cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf-8'));
    } catch (e) {
      console.warn(`[Window Close] Could not read cache`);
      return;
    }

    // Get full match details
    let fullMatches: any[] = [];
    const leagueKey = league.toLowerCase();
    
    if (cache[leagueKey]?.league && Array.isArray(cache[leagueKey].league)) {
      for (const match of cache[leagueKey].league) {
        if (lockedMatches.includes(String(match.idEvent))) {
          fullMatches.push(match);
        }
      }
    }
    
    if (cache[leagueKey]?.daily && Array.isArray(cache[leagueKey].daily)) {
      for (const match of cache[leagueKey].daily) {
        if (lockedMatches.includes(String(match.idEvent)) && !fullMatches.find((m: any) => m.idEvent === match.idEvent)) {
          fullMatches.push(match);
        }
      }
    }

    if (fullMatches.length === 0) {
      console.log(`[Window Close] No matching cache entries for ${league}`);
      return;
    }

    // Read existing history
    let historyData: any = { matches: [] };
    try {
      const existing = await fs.readFile(historyFile, 'utf-8');
      historyData = JSON.parse(existing);
    } catch (e) {
      console.log(`[Window Close] Creating new ${league} history file`);
    }

    // Archive matches
    let archiveCount = 0;
    for (const match of fullMatches) {
      const exists = historyData.matches.some((h: any) => String(h.id) === String(match.idEvent));
      if (!exists) {
        historyData.matches.push({
          id: match.idEvent,
          home: match.strHomeTeam,
          away: match.strAwayTeam,
          homeScore: match.intHomeScore ? parseInt(match.intHomeScore) : null,
          awayScore: match.intAwayScore ? parseInt(match.intAwayScore) : null,
          status: match.strStatus || 'TBD',
          datetime: match.strTimestamp,
          venue: match.strVenue,
          archived: new Date().toISOString(),
        });
        archiveCount++;
      }
    }

    // Write history
    await fs.writeFile(historyFile, JSON.stringify(historyData, null, 2));
    console.log(`[${new Date().toISOString()}] [Window Close] ✓ Archived ${archiveCount} ${league} matches to history`);

    // Mark window as closed in window_dates.json
    try {
      const WINDOW_DATES_FILE = path.join(process.cwd(), 'data/window_dates.json');
      let windowDates: any = { windows: [] };
      try {
        const existing = await fs.readFile(WINDOW_DATES_FILE, 'utf-8');
        windowDates = JSON.parse(existing);
      } catch (e) {
        console.log(`[Window Close] Creating new window_dates file`);
      }

      // Get today's date in WIB
      const now = new Date();
      const wibDate = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const wibDateStr = wibDate.toISOString().split('T')[0]; // YYYY-MM-DD

      // Find or create window entry
      let windowEntry = windowDates.windows.find((w: any) => w.date === wibDateStr);
      if (!windowEntry) {
        windowEntry = { date: wibDateStr, nba: [], epl: [], laliga: [] };
        windowDates.windows.push(windowEntry);
      }

      // Mark as closed
      windowEntry.closed = true;
      windowEntry.closedAt = new Date().toISOString();

      await fs.writeFile(WINDOW_DATES_FILE, JSON.stringify(windowDates, null, 2));
      console.log(`[Window Close] ✓ Marked ${league} window as closed`);
    } catch (e) {
      console.warn(`[Window Close] Could not mark window as closed:`, e);
    }
  } catch (error: any) {
    console.error(`[Window Close] ${league} error:`, error?.message || error);
  }
}

/**
 * Start all cron jobs
 */
export function startWindowCloseCrons() {
  try {
    console.log('[Window Close] Initializing cron jobs...');

    // NBA: 04:00 AM WIB = 21:00 UTC (previous day)
    // Cron format: minute hour day month dayOfWeek (in UTC)
    // 21:00 UTC = "0 21 * * *"
    nbaJob = new CronJob('0 21 * * *', () => {
      archiveLeagueMatches('NBA', NBA_LOCKED_FILE, NBA_HISTORY_FILE);
    }, null, true, 'UTC');

    console.log('[Window Close] ✓ NBA cron job started (04:00 AM WIB = 21:00 UTC daily)');

    // EPL: 16:00 WIB = 09:00 UTC
    // "0 9 * * *"
    eplJob = new CronJob('0 9 * * *', () => {
      archiveLeagueMatches('EPL', EPL_LOCKED_FILE, EPL_HISTORY_FILE);
    }, null, true, 'UTC');

    console.log('[Window Close] ✓ EPL cron job started (16:00 WIB = 09:00 UTC daily)');

    // LaLiga: 16:00 WIB = 09:00 UTC (same as EPL)
    // "0 9 * * *"
    laligaJob = new CronJob('0 9 * * *', () => {
      archiveLeagueMatches('LaLiga', LALIGA_LOCKED_FILE, LALIGA_HISTORY_FILE);
    }, null, true, 'UTC');

    console.log('[Window Close] ✓ LaLiga cron job started (16:00 WIB = 09:00 UTC daily)');
  } catch (error: any) {
    console.error('[Window Close] Failed to start cron jobs:', error?.message || error);
  }
}

/**
 * Stop all cron jobs (cleanup)
 */
export function stopWindowCloseCrons() {
  try {
    if (nbaJob) {
      nbaJob.stop();
      console.log('[Window Close] NBA cron job stopped');
    }
    if (eplJob) {
      eplJob.stop();
      console.log('[Window Close] EPL cron job stopped');
    }
    if (laligaJob) {
      laligaJob.stop();
      console.log('[Window Close] LaLiga cron job stopped');
    }
  } catch (error: any) {
    console.error('[Window Close] Error stopping cron jobs:', error?.message || error);
  }
}

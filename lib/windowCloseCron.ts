/**
 * Window Close Cron Job
 * Automatically runs at:
 * - NBA: 04:00 AM WIB (21:00 UTC) every day
 * - EPL: 16:00 WIB (09:00 UTC) every day
 * 
 * This is a server-side background job that runs without needing a browser tab
 */

import 'dotenv/config';
import { CronJob } from 'cron';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);

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

    if (league === 'NBA') {
      // For NBA, archive from Supabase nba_matches_pending to nba_matches_history
      await archiveNBAMatchesFromSupabase();
    } else {
      // For EPL/LaLiga, use the old method with local files
      await archiveLeagueMatchesFromFiles(league, lockedFile, historyFile);
    }
  } catch (error: any) {
    console.error(`[Window Close] ${league} error:`, error?.message || error);
  }
}

/**
 * Archive NBA matches from Supabase (nba_matches_pending → nba_matches_history)
 */
async function archiveNBAMatchesFromSupabase(): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] [Window Close] Archiving NBA matches from Supabase...`);

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

    // Get all pending NBA matches
    const { data: pendingMatches, error: fetchError } = await supabase
      .from('nba_matches_pending')
      .select('*');

    if (fetchError) {
      console.error('[Window Close] Error fetching NBA matches from Supabase:', fetchError.message);
      return;
    }

    console.log('[Window Close] Fetched pendingMatches:', JSON.stringify(pendingMatches, null, 2));

    if (!pendingMatches || pendingMatches.length === 0) {
      console.log('[Window Close] No NBA matches in pending table');
      return;
    }

    console.log(`[Window Close] Found ${pendingMatches.length} NBA matches to archive`);

    // Prepare history entries
    const historyEntries = pendingMatches.map(match => ({
      id: match.id,
      event_id: match.event_id,
      home_team: match.home_team,
      away_team: match.away_team,
      event_date: match.event_date,
      venue: match.venue || null,
      status: 'waiting for result',
      created_at: match.created_at,
      home_score: match.home_score || null,
      away_score: match.away_score || null,
    }));

    console.log('[Window Close] Prepared historyEntries:', JSON.stringify(historyEntries, null, 2));

    // Insert into history table
    const { error: insertError, data: insertData } = await supabase
      .from('nba_matches_history')
      .upsert(historyEntries, { onConflict: 'event_id' });

    if (insertError) {
      console.error('[Window Close] Error inserting NBA matches to history:', insertError.message);
      return;
    }
    console.log('[Window Close] Inserted to history:', JSON.stringify(insertData, null, 2));

    // Delete from pending table
    const eventIds = pendingMatches.map(m => m.event_id);
    console.log('[Window Close] Deleting eventIds from pending:', JSON.stringify(eventIds, null, 2));
    const { error: deleteError, data: deleteData } = await supabase
      .from('nba_matches_pending')
      .delete()
      .in('event_id', eventIds);

    if (deleteError) {
      console.error('[Window Close] Error deleting NBA matches from pending:', deleteError.message);
      return;
    }
    console.log('[Window Close] Deleted from pending:', JSON.stringify(deleteData, null, 2));

    console.log(`[${new Date().toISOString()}] [Window Close] ✓ Archived ${pendingMatches.length} NBA matches from Supabase`);
  } catch (error: any) {
    console.error(`[Window Close] NBA Supabase archival error:`, error?.message || error);
  }
}

/**
 * Archive matches for EPL/LaLiga from local files (legacy method)
 */
async function archiveLeagueMatchesFromFiles(
  league: 'EPL' | 'LaLiga',
  lockedFile: string,
  historyFile: string
): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] [Window Close] Starting ${league} archival from files...`);

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

// Export the NBA archival function for manual testing
export { archiveNBAMatchesFromSupabase };

// Run NBA archival if this file is executed directly
if (process.argv[1] === __filename) {
  console.log('[Window Close] Running NBA archival manually...');
  archiveNBAMatchesFromSupabase().then(() => {
    console.log('[Window Close] Manual NBA archival completed');
    process.exit(0);
  }).catch((error) => {
    console.error('[Window Close] Manual NBA archival failed:', error);
    process.exit(1);
  });
}

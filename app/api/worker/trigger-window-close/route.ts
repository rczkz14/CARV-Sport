/**
 * Auto-trigger Window Close Workers
 * Runs every minute and checks if it's time to close windows
 * 
 * NBA: 04:00 AM WIB (21:00 UTC previous day)
 * EPL: 16:00 WIB (09:00 UTC same day)
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
const WINDOW_DATES_FILE = path.join(process.cwd(), 'data/window_dates.json');
const NBA_LOCKED_FILE = path.join(process.cwd(), 'data/nba_locked_selection.json');
const EPL_LOCKED_FILE = path.join(process.cwd(), 'data/epl_locked_selection.json');
const NBA_HISTORY_FILE = path.join(process.cwd(), 'data/nba_history.json');
const EPL_HISTORY_FILE = path.join(process.cwd(), 'data/epl_history.json');

/**
 * Check if current time matches close time for a league
 * Returns true if within the close window (within 2 minutes)
 */
function isCloseTime(league: 'NBA' | 'EPL'): boolean {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  
  if (league === 'NBA') {
    // Close at 04:00 AM WIB = 21:00 UTC previous day
    // In UTC terms: if UTC hour is 21 (9 PM) and we're in first 2 minutes
    return hour === 21 && minute < 2;
  } else if (league === 'EPL') {
    // Close at 16:00 WIB = 09:00 UTC same day
    // In UTC terms: if UTC hour is 9 (9 AM) and we're in first 2 minutes
    return hour === 9 && minute < 2;
  }
  
  return false;
}

/**
 * Archive matches for a league when window closes
 */
async function archiveLeagueMatches(
  league: 'NBA' | 'EPL',
  lockedFile: string,
  historyFile: string
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    console.log(`[Window Close Trigger] Starting ${league} window close archival...`);

    // Read locked matches
    let lockedMatches: any[] = [];
    try {
      const lockedData = JSON.parse(await fs.readFile(lockedFile, 'utf-8'));
      if (lockedData.locked && Array.isArray(lockedData.locked)) {
        lockedMatches = lockedData.locked;
      }
    } catch (e) {
      console.warn(`[Window Close Trigger] No locked ${league} matches found`);
      return { success: false, count: 0, message: `No locked ${league} matches` };
    }

    if (lockedMatches.length === 0) {
      return { success: false, count: 0, message: `No locked ${league} matches` };
    }

    // Read cache for full match details
    let cache: any = null;
    try {
      cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf-8'));
    } catch (e) {
      console.warn(`[Window Close Trigger] Could not read cache`);
      return { success: false, count: 0, message: 'Cache not available' };
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
      return { success: false, count: 0, message: `No matching cache entries for ${league}` };
    }

    // Read existing history
    let historyData: any = { matches: [] };
    try {
      const existing = await fs.readFile(historyFile, 'utf-8');
      historyData = JSON.parse(existing);
    } catch (e) {
      console.log(`[Window Close Trigger] Creating new ${league} history file`);
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
    console.log(`[Window Close Trigger] Archived ${archiveCount} ${league} matches`);

    return {
      success: true,
      count: archiveCount,
      message: `Archived ${archiveCount} ${league} matches`,
    };
  } catch (error: any) {
    console.error(`[Window Close Trigger] ${league} error:`, error);
    return { success: false, count: 0, message: error?.message || 'Unknown error' };
  }
}

/**
 * Main trigger - called every minute by cron/scheduler
 */
export async function GET(req: Request) {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      nba: { triggered: false },
      epl: { triggered: false },
    };

    // Check NBA close time (04:00 AM WIB = 21:00 UTC)
    if (isCloseTime('NBA')) {
      console.log('[Window Close Trigger] NBA close time detected!');
      const nbaResult = await archiveLeagueMatches('NBA', NBA_LOCKED_FILE, NBA_HISTORY_FILE);
      results.nba = { triggered: true, ...nbaResult };
    }

    // Check EPL close time (16:00 WIB = 09:00 UTC)
    if (isCloseTime('EPL')) {
      console.log('[Window Close Trigger] EPL close time detected!');
      const eplResult = await archiveLeagueMatches('EPL', EPL_LOCKED_FILE, EPL_HISTORY_FILE);
      results.epl = { triggered: true, ...eplResult };
    }

    return NextResponse.json({
      ok: true,
      ...results,
    });
  } catch (error: any) {
    console.error('[Window Close Trigger] Fatal error:', error);
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Unknown error',
    }, { status: 500 });
  }
}

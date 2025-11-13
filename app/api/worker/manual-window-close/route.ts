/**
 * Manual Window Close Trigger for Testing
 * Call this endpoint to manually archive matches to history
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
const NBA_LOCKED_FILE = path.join(process.cwd(), 'data/nba_locked_selection.json');
const EPL_LOCKED_FILE = path.join(process.cwd(), 'data/epl_locked_selection.json');
const NBA_HISTORY_FILE = path.join(process.cwd(), 'data/nba_history.json');
const EPL_HISTORY_FILE = path.join(process.cwd(), 'data/epl_history.json');

async function archiveLeagueMatches(
  league: 'NBA' | 'EPL',
  lockedFile: string,
  historyFile: string
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    console.log(`[Manual Close] Starting ${league} archival...`);

    // Read locked matches
    let lockedMatches: string[] = [];
    try {
      const lockedData = JSON.parse(await fs.readFile(lockedFile, 'utf-8'));
      // Support both 'locked' and 'matchIds' keys
      if (lockedData.locked && Array.isArray(lockedData.locked)) {
        lockedMatches = lockedData.locked;
      } else if (lockedData.matchIds && Array.isArray(lockedData.matchIds)) {
        lockedMatches = lockedData.matchIds;
      }
    } catch (e) {
      console.warn(`[Manual Close] No locked ${league} matches found`);
      return { success: false, count: 0, message: `No locked ${league} matches` };
    }

    if (lockedMatches.length === 0) {
      return { success: false, count: 0, message: `No locked ${league} matches` };
    }

    // Read cache
    let cache: any = null;
    try {
      cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf-8'));
    } catch (e) {
      console.warn(`[Manual Close] Could not read cache`);
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

    console.log(`[Manual Close] Found ${fullMatches.length} matches to archive`);

    // Read existing history
    let historyData: any = { matches: [] };
    try {
      const existing = await fs.readFile(historyFile, 'utf-8');
      historyData = JSON.parse(existing);
    } catch (e) {
      console.log(`[Manual Close] Creating new ${league} history file`);
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
    console.log(`[Manual Close] ✓ Archived ${archiveCount} ${league} matches`);

    // Mark window as closed in window_dates.json
    try {
      const WINDOW_DATES_FILE = path.join(process.cwd(), 'data/window_dates.json');
      let windowDates: any = { windows: [] };
      try {
        const existing = await fs.readFile(WINDOW_DATES_FILE, 'utf-8');
        windowDates = JSON.parse(existing);
      } catch (e) {
        console.log(`[Manual Close] Creating new window_dates file`);
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
      console.log(`[Manual Close] ✓ Marked ${league} window as closed`);
    } catch (e) {
      console.warn(`[Manual Close] Could not mark window as closed:`, e);
    }

    return { success: true, count: archiveCount, message: `Archived ${archiveCount} ${league} matches` };
  } catch (error: any) {
    console.error(`[Manual Close] ${league} error:`, error);
    return { success: false, count: 0, message: error?.message || 'Unknown error' };
  }
}

export async function POST(req: Request) {
  try {
    const { league } = await req.json();

    if (league === 'NBA') {
      const result = await archiveLeagueMatches('NBA', NBA_LOCKED_FILE, NBA_HISTORY_FILE);
      return NextResponse.json({ ok: result.success, ...result });
    } else if (league === 'EPL') {
      const result = await archiveLeagueMatches('EPL', EPL_LOCKED_FILE, EPL_HISTORY_FILE);
      return NextResponse.json({ ok: result.success, ...result });
    } else if (league === 'ALL') {
      const nbaResult = await archiveLeagueMatches('NBA', NBA_LOCKED_FILE, NBA_HISTORY_FILE);
      const eplResult = await archiveLeagueMatches('EPL', EPL_LOCKED_FILE, EPL_HISTORY_FILE);
      return NextResponse.json({
        ok: nbaResult.success && eplResult.success,
        nba: nbaResult,
        epl: eplResult,
      });
    }

    return NextResponse.json({ ok: false, error: 'Invalid league' }, { status: 400 });
  } catch (error: any) {
    console.error('[Manual Close] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Unknown error',
    }, { status: 500 });
  }
}

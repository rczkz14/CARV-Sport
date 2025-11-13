/**
 * EPL Window Close Worker
 * Triggers at 16:00 WIB (window close time)
 * Archives matched predictions to epl_history.json
 * 
 * Called by: External cron job or manual trigger
 * When: Every day at 16:00 WIB (09:00 UTC same day)
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const EPL_LOCKED_FILE = path.join(process.cwd(), 'data/epl_locked_selection.json');
const EPL_HISTORY_FILE = path.join(process.cwd(), 'data/epl_history.json');
const PREDICTIONS_FILE = path.join(process.cwd(), 'data/predictions.json');
const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
const WINDOW_DATES_FILE = path.join(process.cwd(), 'data/window_dates.json');

/**
 * Archive EPL matches from locked selection to history
 * when the window closes at 16:00 WIB
 */
export async function POST(req: Request) {
  try {
    console.log('[EPL Window Close] Starting EPL window close archival...');

    // Read locked EPL matches for this window
    let lockedMatches: any[] = [];
    try {
      const lockedData = JSON.parse(await fs.readFile(EPL_LOCKED_FILE, 'utf-8'));
      if (lockedData.locked && Array.isArray(lockedData.locked)) {
        lockedMatches = lockedData.locked.map((id: string) => ({ idEvent: id }));
      }
      console.log(`[EPL Window Close] Found ${lockedMatches.length} locked EPL matches`);
    } catch (e) {
      console.warn('[EPL Window Close] Could not read locked selection:', e);
    }

    if (lockedMatches.length === 0) {
      return NextResponse.json({
        ok: false,
        message: 'No locked EPL matches found for this window',
      });
    }

    // Read current cache to get full match details
    let cache: any = null;
    try {
      cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf-8'));
    } catch (e) {
      console.warn('[EPL Window Close] Could not read cache:', e);
      return NextResponse.json({
        ok: false,
        error: 'Cache file not available',
      }, { status: 503 });
    }

    // Get full match details from cache.epl.league or cache.epl.daily
    const fullMatches: any[] = [];
    const sources: string[] = [];
    
    if (cache.epl?.league && Array.isArray(cache.epl.league)) {
      for (const match of cache.epl.league) {
        const locked = lockedMatches.find((l: any) => String(l.idEvent) === String(match.idEvent));
        if (locked) {
          fullMatches.push(match);
          sources.push('league');
        }
      }
    }
    
    if (cache.epl?.daily && Array.isArray(cache.epl.daily)) {
      for (const match of cache.epl.daily) {
        const locked = lockedMatches.find((l: any) => String(l.idEvent) === String(match.idEvent));
        if (locked && !fullMatches.find((m: any) => String(m.idEvent) === String(match.idEvent))) {
          fullMatches.push(match);
          sources.push('daily');
        }
      }
    }

    console.log(`[EPL Window Close] Retrieved ${fullMatches.length} full match details from cache`);

    // Read existing history
    let historyData: any = { matches: [] };
    try {
      const existing = await fs.readFile(EPL_HISTORY_FILE, 'utf-8');
      historyData = JSON.parse(existing);
    } catch (e) {
      // File doesn't exist yet, start fresh
      console.log('[EPL Window Close] Creating new history file');
    }

    // Convert cache matches to history format and add to history
    const archiveCount = fullMatches.length;
    for (const match of fullMatches) {
      // Check if already archived
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
      }
    }

    // Write updated history
    await fs.writeFile(EPL_HISTORY_FILE, JSON.stringify(historyData, null, 2));
    console.log(`[EPL Window Close] Archived ${archiveCount} EPL matches to history`);

    // Update window_dates.json to mark this window as closed
    let windowDates: any[] = [];
    try {
      const existing = await fs.readFile(WINDOW_DATES_FILE, 'utf-8');
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed.windows)) windowDates = parsed.windows;
    } catch (e) {
      console.warn('[EPL Window Close] Could not read window dates');
    }

    // Find today's window (EPL window is 01:00-16:00 WIB same day)
    const now = new Date();
    const wibDate = new Date(now.getTime() + 7 * 60 * 60 * 1000); // WIB = UTC + 7 hours
    const wibDateStr = wibDate.toISOString().split('T')[0]; // YYYY-MM-DD in WIB

    let windowEntry = windowDates.find((w: any) => w.date === wibDateStr && w.league === 'EPL');
    if (!windowEntry) {
      windowEntry = {
        date: wibDateStr,
        league: 'EPL',
        nba: [],
        epl: lockedMatches.map((l: any) => l.idEvent),
        laliga: [],
        closed: false,
      };
      windowDates.push(windowEntry);
    }

    // Mark window as closed
    windowEntry.closed = true;
    windowEntry.closedAt = new Date().toISOString();

    await fs.writeFile(
      WINDOW_DATES_FILE,
      JSON.stringify({ windows: windowDates }, null, 2)
    );
    console.log('[EPL Window Close] Marked EPL window as closed in window_dates.json');

    return NextResponse.json({
      ok: true,
      message: `Successfully archived ${archiveCount} EPL matches to history`,
      archived: archiveCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[EPL Window Close] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Unknown error',
    }, { status: 500 });
  }
}

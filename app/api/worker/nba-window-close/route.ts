/**
 * NBA Window Close Worker
 * Triggers at 04:00 AM WIB (window close time)
 * Archives matched predictions to nba_history.json
 * 
 * Called by: External cron job or manual trigger
 * When: Every day at 04:00 AM WIB (21:00 UTC previous day)
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const NBA_LOCKED_FILE = path.join(process.cwd(), 'data/nba_locked_selection.json');
const NBA_HISTORY_FILE = path.join(process.cwd(), 'data/nba_history.json');
const PREDICTIONS_FILE = path.join(process.cwd(), 'data/predictions.json');
const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
const WINDOW_DATES_FILE = path.join(process.cwd(), 'data/window_dates.json');

/**
 * Archive NBA matches from locked selection to history
 * when the window closes at 04:00 AM WIB
 */
export async function POST(req: Request) {
  try {
    console.log('[NBA Window Close] Starting NBA window close archival...');

    // Read locked NBA matches for this window
    let lockedMatches: any[] = [];
    try {
      const lockedData = JSON.parse(await fs.readFile(NBA_LOCKED_FILE, 'utf-8'));
      if (lockedData.locked && Array.isArray(lockedData.locked)) {
        lockedMatches = lockedData.locked.map((id: string) => ({ idEvent: id }));
      }
      console.log(`[NBA Window Close] Found ${lockedMatches.length} locked NBA matches`);
    } catch (e) {
      console.warn('[NBA Window Close] Could not read locked selection:', e);
    }

    if (lockedMatches.length === 0) {
      return NextResponse.json({
        ok: false,
        message: 'No locked NBA matches found for this window',
      });
    }

    // Read current cache to get full match details
    let cache: any = null;
    try {
      cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf-8'));
    } catch (e) {
      console.warn('[NBA Window Close] Could not read cache:', e);
      return NextResponse.json({
        ok: false,
        error: 'Cache file not available',
      }, { status: 503 });
    }

    // Get full match details from cache.nba.daily
    const fullMatches: any[] = [];
    if (cache.nba?.daily && Array.isArray(cache.nba.daily)) {
      for (const match of cache.nba.daily) {
        const locked = lockedMatches.find((l: any) => String(l.idEvent) === String(match.idEvent));
        if (locked) {
          fullMatches.push(match);
        }
      }
    }

    console.log(`[NBA Window Close] Retrieved ${fullMatches.length} full match details from cache`);

    // Read existing history
    let historyData: any = { matches: [] };
    try {
      const existing = await fs.readFile(NBA_HISTORY_FILE, 'utf-8');
      historyData = JSON.parse(existing);
    } catch (e) {
      // File doesn't exist yet, start fresh
      console.log('[NBA Window Close] Creating new history file');
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
    await fs.writeFile(NBA_HISTORY_FILE, JSON.stringify(historyData, null, 2));
    console.log(`[NBA Window Close] Archived ${archiveCount} NBA matches to history`);

    // Update window_dates.json to mark this window as closed
    let windowDates: any[] = [];
    try {
      const existing = await fs.readFile(WINDOW_DATES_FILE, 'utf-8');
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed.windows)) windowDates = parsed.windows;
    } catch (e) {
      console.warn('[NBA Window Close] Could not read window dates');
    }

    // Find today's window (based on NBA window dates)
    const now = new Date();
    const wibDate = new Date(now.getTime() + 7 * 60 * 60 * 1000); // WIB = UTC + 7 hours
    const wibDateStr = wibDate.toISOString().split('T')[0]; // YYYY-MM-DD in WIB

    let windowEntry = windowDates.find((w: any) => w.date === wibDateStr && w.league === 'NBA');
    if (!windowEntry) {
      windowEntry = {
        date: wibDateStr,
        league: 'NBA',
        nba: lockedMatches.map((l: any) => l.idEvent),
        epl: [],
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
    console.log('[NBA Window Close] Marked NBA window as closed in window_dates.json');

    return NextResponse.json({
      ok: true,
      message: `Successfully archived ${archiveCount} NBA matches to history`,
      archived: archiveCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[NBA Window Close] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Unknown error',
    }, { status: 500 });
  }
}

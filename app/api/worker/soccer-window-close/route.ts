/**
 * Soccer Window Close Worker
 * Triggers at 04:00 PM WIB (window close time)
 * Archives matched predictions to soccer_matches_history on Supabase
 *
 * Called by: External cron job or manual trigger
 * When: Every day at 04:00 PM WIB (09:00 UTC same day)
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabaseClient';
import { getSoccerDateRangeWIB } from '@/lib/soccerWindowManager';

const SOCCER_LOCKED_FILE = path.join(process.cwd(), 'data/soccer_locked_selection.json');
const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
const WINDOW_DATES_FILE = path.join(process.cwd(), 'data/window_dates.json');

/**
 * Archive soccer matches from locked selection to history
 * when the window closes at 04:00 PM WIB
 */
export async function POST(req: Request) {
  try {
    console.log('[Soccer Window Close] Starting soccer window close archival...');

    // Get selected matches for the current visibility window from soccer_locked_selections
    const nowUtc = new Date();
    const { visibilityStartWIB } = getSoccerDateRangeWIB(nowUtc);

    const { data: lockedSelection, error: selectError } = await supabase
      .from('soccer_locked_selections')
      .select('match_ids')
      .eq('visibility_start_date', visibilityStartWIB)
      .single();

    if (selectError || !lockedSelection?.match_ids) {
      console.error('[Soccer Window Close] Error fetching locked selection:', selectError?.message);
      return NextResponse.json({
        ok: false,
        message: 'No locked soccer matches found for this window',
      });
    }

    const lockedMatchIds = lockedSelection.match_ids;
    console.log(`[Soccer Window Close] Found ${lockedMatchIds.length} locked soccer matches for ${visibilityStartWIB}`);

    // Read current cache to get full match details
    let cache: any = null;
    try {
      cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf-8'));
    } catch (e) {
      console.warn('[Soccer Window Close] Could not read cache:', e);
      return NextResponse.json({
        ok: false,
        error: 'Cache file not available',
      }, { status: 503 });
    }

    // Get full match details from cache.soccer.daily for locked matches
    const fullMatches: any[] = [];
    if (cache.soccer?.daily && Array.isArray(cache.soccer.daily)) {
      for (const match of cache.soccer.daily) {
        if (lockedMatchIds.includes(String(match.idEvent))) {
          fullMatches.push(match);
        }
      }
    }

    console.log(`[Soccer Window Close] Retrieved ${fullMatches.length} full match details from cache`);

    // Archive matches to soccer_matches_history on Supabase
    const archiveCount = fullMatches.length;
    for (const match of fullMatches) {
      try {
        // Check if already archived
        const { data: existing } = await supabase
          .from('soccer_matches_history')
          .select('id')
          .eq('id', match.idEvent)
          .single();

        if (!existing) {
          const { error: insertError } = await supabase
            .from('soccer_matches_history')
            .insert({
              id: match.idEvent,
              strHomeTeam: match.strHomeTeam,
              strAwayTeam: match.strAwayTeam,
              intHomeScore: match.intHomeScore ? parseInt(match.intHomeScore) : null,
              intAwayScore: match.intAwayScore ? parseInt(match.intAwayScore) : null,
              strStatus: match.strStatus || 'TBD',
              strTimestamp: match.strTimestamp,
              strVenue: match.strVenue,
              archived_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error(`[Soccer Window Close] Error archiving match ${match.idEvent}:`, insertError.message);
          } else {
            console.log(`[Soccer Window Close] Archived match ${match.idEvent} to soccer_matches_history`);
          }
        } else {
          console.log(`[Soccer Window Close] Match ${match.idEvent} already archived`);
        }
      } catch (err) {
        console.error(`[Soccer Window Close] Error processing match ${match.idEvent}:`, err);
      }
    }

    console.log(`[Soccer Window Close] Attempted to archive ${archiveCount} soccer matches to Supabase`);

    // Update window_dates.json to mark this window as closed
    let windowDates: any[] = [];
    try {
      const existing = await fs.readFile(WINDOW_DATES_FILE, 'utf-8');
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed.windows)) windowDates = parsed.windows;
    } catch (e) {
      console.warn('[Soccer Window Close] Could not read window dates');
    }

    // Find today's window (based on soccer window dates)
    const now = new Date();
    const wibDate = new Date(now.getTime() + 7 * 60 * 60 * 1000); // WIB = UTC + 7 hours
    const wibDateStr = wibDate.toISOString().split('T')[0]; // YYYY-MM-DD in WIB

    let windowEntry = windowDates.find((w: any) => w.date === wibDateStr && w.league === 'Soccer');
    if (!windowEntry) {
      windowEntry = {
        date: wibDateStr,
        league: 'Soccer',
        nba: [],
        epl: lockedMatchIds,
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
    console.log('[Soccer Window Close] Marked soccer window as closed in window_dates.json');

    return NextResponse.json({
      ok: true,
      message: `Successfully archived ${archiveCount} soccer matches to history`,
      archived: archiveCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Soccer Window Close] Error:', error);
    return NextResponse.json({
      ok: false,
      error: error?.message || 'Unknown error',
    }, { status: 500 });
  }
}
/**
 * NBA Window Close Worker
 * Triggers at 04:00 AM WIB (window close time)
 * Archives matched predictions to nba_matches_history on Supabase
 *
 * Called by: External cron job or manual trigger
 * When: Every day at 04:00 AM WIB (21:00 UTC previous day)
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabaseClient';

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

    // Get selected matches for the current D+1 date from nba_matches_pending
    const nowUtc = new Date();
    const wibDate = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000); // WIB = UTC + 7
    const wibDateStr = wibDate.toISOString().split('T')[0]; // YYYY-MM-DD in WIB

    // Only select matches with wib_time equal to today's WIB date
    const { data: selectedMatches, error: selectError } = await supabase
      .from('nba_matches_pending')
      .select('*')
      .eq('wib_time', wibDateStr);

    if (selectError) {
      console.error('[NBA Window Close] Error fetching selected matches:', selectError.message);
      return NextResponse.json({
        ok: false,
        message: 'Failed to fetch selected matches',
      }, { status: 500 });
    }

    console.log(`[NBA Window Close] Found ${selectedMatches?.length || 0} selected NBA matches for ${d1DateStr}`);

    if (!selectedMatches || selectedMatches.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No selected NBA matches found for this window',
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

    // Get full match details from cache.nba.daily for selected matches
    const fullMatches: any[] = [];
    if (cache.nba?.daily && Array.isArray(cache.nba.daily)) {
      for (const match of cache.nba.daily) {
        const selected = selectedMatches.find((s: any) => String(s.event_id) === String(match.idEvent));
        if (selected) {
          fullMatches.push({ ...match, selectedData: selected });
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

    // Process matches: archive played matches, keep unplayed ones for next window
    let archivedCount = 0;
    let keptCount = 0;

    for (const match of fullMatches) {
      try {
        const isPlayed = match.intHomeScore !== null && match.intAwayScore !== null &&
                        (match.strStatus?.toLowerCase().includes('final') ||
                         match.strStatus?.toLowerCase().includes('ft') ||
                         match.strStatus?.toLowerCase().includes('completed'));

        if (isPlayed) {
          // Archive played matches to nba_matches_history
          const { data: existing } = await supabase
            .from('nba_matches_history')
            .select('id')
            .eq('event_id', match.idEvent)
            .single();

          if (!existing) {
            const { error: insertError } = await supabase
              .from('nba_matches_history')
              .insert({
                event_id: match.idEvent,
                home_team: match.strHomeTeam,
                away_team: match.strAwayTeam,
                home_score: match.intHomeScore ? parseInt(match.intHomeScore) : null,
                away_score: match.intAwayScore ? parseInt(match.intAwayScore) : null,
                status: match.strStatus || 'FT',
                event_date: match.strTimestamp,
                venue: match.strVenue,
                archived_at: new Date().toISOString(),
              });

            if (insertError) {
              console.error(`[NBA Window Close] Error archiving match ${match.idEvent}:`, insertError.message);
            } else {
              console.log(`[NBA Window Close] Archived played match ${match.idEvent} to nba_matches_history`);
              archivedCount++;
            }
          } else {
            console.log(`[NBA Window Close] Match ${match.idEvent} already archived`);
            archivedCount++;
          }

          // Remove from nba_matches_pending
          await supabase
            .from('nba_matches_pending')
            .delete()
            .eq('event_id', match.idEvent);

        } else {
          // Keep unplayed matches in nba_matches_pending for next window
          console.log(`[NBA Window Close] Keeping unplayed match ${match.idEvent} in nba_matches_pending for next window`);
          keptCount++;
        }
      } catch (err) {
        console.error(`[NBA Window Close] Error processing match ${match.idEvent}:`, err);
      }
    }

    console.log(`[NBA Window Close] Processed ${archivedCount} archived + ${keptCount} kept NBA matches`);

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
        nba: selectedMatches.map((s: any) => s.event_id),
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
      message: `Successfully processed NBA window close: ${archivedCount} archived, ${keptCount} kept for next window`,
      archived: archivedCount,
      kept: keptCount,
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

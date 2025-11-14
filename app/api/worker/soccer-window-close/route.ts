/**
 * Soccer Window Close Worker
 * Triggers at 16:00 WIB (window close time for both EPL and LaLiga)
 * Archives matched predictions to soccer_matches_history on Supabase
 *
 * Called by: External cron job or manual trigger
 * When: Every day at 16:00 WIB (09:00 UTC)
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { supabase } from '@/lib/supabaseClient';

const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
const WINDOW_DATES_FILE = path.join(process.cwd(), 'data/window_dates.json');

/**
 * Archive soccer matches from selected to history
 * when the window closes at 16:00 WIB
 */
export async function POST(req: Request) {
  try {
    console.log('[Soccer Window Close] Starting soccer window close archival...');

    // Get selected matches for the current D+1 date from soccer_matches_pending
    const nowUtc = new Date();
    const d1Date = new Date(nowUtc.getTime() + 7 * 60 * 60 * 1000); // WIB = UTC + 7
    const d1DateStr = d1Date.toISOString().split('T')[0]; // YYYY-MM-DD in WIB

    const { data: selectedMatches, error: selectError } = await supabase
      .from('soccer_matches_pending')
      .select('*')
      .eq('selected_for_date', d1DateStr);

    if (selectError) {
      console.error('[Soccer Window Close] Error fetching selected matches:', selectError.message);
      return NextResponse.json({
        ok: false,
        message: 'Failed to fetch selected matches',
      }, { status: 500 });
    }

    console.log(`[Soccer Window Close] Found ${selectedMatches?.length || 0} selected soccer matches for ${d1DateStr}`);

    if (!selectedMatches || selectedMatches.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No selected soccer matches found for this window',
      });
    }

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

    // Get full match details from cache.epl.daily/league and cache.laliga.daily/league for selected matches
    const fullMatches: any[] = [];
    const leagues = ['epl', 'laliga'];
    for (const leagueKey of leagues) {
      if (cache[leagueKey]?.daily) {
        cache[leagueKey].daily.forEach((m: any) => {
          const selected = selectedMatches.find((s: any) => String(s.event_id) === String(m.idEvent));
          if (selected) {
            fullMatches.push({ ...m, selectedData: selected });
          }
        });
      }
      if (cache[leagueKey]?.league) {
        cache[leagueKey].league.forEach((m: any) => {
          const selected = selectedMatches.find((s: any) => String(s.event_id) === String(m.idEvent));
          if (selected) {
            fullMatches.push({ ...m, selectedData: selected });
          }
        });
      }
    }

    console.log(`[Soccer Window Close] Retrieved ${fullMatches.length} full match details from cache`);

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
          // Archive played matches to soccer_matches_history
          const { data: existing } = await supabase
            .from('soccer_matches_history')
            .select('id')
            .eq('event_id', match.idEvent)
            .single();

          if (!existing) {
            const { error: insertError } = await supabase
              .from('soccer_matches_history')
              .insert({
                event_id: match.idEvent,
                home_team: match.strHomeTeam,
                away_team: match.strAwayTeam,
                home_score: match.intHomeScore ? parseInt(match.intHomeScore) : null,
                away_score: match.intAwayScore ? parseInt(match.intAwayScore) : null,
                status: match.strStatus || 'FT',
                event_date: match.strTimestamp,
                venue: match.strVenue,
                league: match.selectedData.league,
                archived_at: new Date().toISOString(),
              });

            if (insertError) {
              console.error(`[Soccer Window Close] Error archiving match ${match.idEvent}:`, insertError.message);
            } else {
              console.log(`[Soccer Window Close] Archived played match ${match.idEvent} to soccer_matches_history`);
              archivedCount++;
            }
          } else {
            console.log(`[Soccer Window Close] Match ${match.idEvent} already archived`);
            archivedCount++;
          }

          // Remove from soccer_matches_pending
          await supabase
            .from('soccer_matches_pending')
            .delete()
            .eq('event_id', match.idEvent);

        } else {
          // Keep unplayed matches in soccer_matches_pending for next window
          console.log(`[Soccer Window Close] Keeping unplayed match ${match.idEvent} in soccer_matches_pending for next window`);
          keptCount++;
        }
      } catch (err) {
        console.error(`[Soccer Window Close] Error processing match ${match.idEvent}:`, err);
      }
    }

    console.log(`[Soccer Window Close] Processed ${archivedCount} archived + ${keptCount} kept soccer matches`);

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

    let windowEntry = windowDates.find((w: any) => w.date === wibDateStr && (w.league === 'EPL' || w.league === 'LaLiga'));
    if (!windowEntry) {
      windowEntry = {
        date: wibDateStr,
        league: 'Soccer',
        epl: selectedMatches.filter(m => m.league === 'English Premier League').map((s: any) => s.event_id),
        laliga: selectedMatches.filter(m => m.league === 'Spanish La Liga').map((s: any) => s.event_id),
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
      message: `Successfully processed soccer window close: ${archivedCount} archived, ${keptCount} kept for next window`,
      archived: archivedCount,
      kept: keptCount,
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
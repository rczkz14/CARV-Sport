/**
 * Auto-Select NBA Worker
 * Triggers at 11:00 WIB (04:00 UTC)
 * Selects and locks up to 5 D+1 matches for the upcoming window
 * Adds new matches to existing selection instead of replacing
 * Does NOT generate predictions yet - that happens at 12:00 WIB
 */

import { NextResponse } from "next/server";
import { isAutoSelectTime, filterNBAMatchesToD1, getNBAWindowStatus, getD1DateRangeWIB } from "@/lib/nbaWindowManager";
import { fetchLiveMatchData } from "@/lib/sportsFetcher";
import { promises as fs } from 'fs';
import path from 'path';

async function readCache(): Promise<any> {
  try {
    const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Auto-Select] Error reading cache file:', error);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const nowUtc = new Date();
    
    // Check authorization header
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key');
    const expectedKey = process.env.WORKER_API_KEY || 'event-asu';
    
    if (authHeader !== `Bearer ${expectedKey}` && authHeader !== expectedKey) {
      console.warn('[Auto-Select] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const windowStatus = getNBAWindowStatus(nowUtc);
    console.log(`[Auto-Select] Called at ${nowUtc.toISOString()} UTC (${windowStatus.wibHour}:00 WIB)`);

    // Check if we're within the auto-select window (04:00-04:05 UTC = 11:00-11:05 WIB)
    const isValidTime = isAutoSelectTime(nowUtc);
    if (!isValidTime) {
      console.warn(`[Auto-Select] Called at wrong time. Current UTC hour: ${windowStatus.utcHour}, expected: 4`);
      console.log('[Auto-Select] Proceeding anyway (manual trigger allowed)');
    }

    // 1. Get NBA matches from Supabase
    console.log('[Auto-Select] Fetching NBA matches from Supabase...');
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

    const { data: nbaMatches, error } = await supabase
      .from('nba_matches_pending')
      .select('*');
    if (error) {
      console.error('[Auto-Select] Error fetching from Supabase:', error.message);
      return NextResponse.json({ ok: false, error: "Failed to fetch matches" }, { status: 500 });
    }

    console.log(`[Auto-Select] Got ${nbaMatches?.length || 0} NBA matches from Supabase`);

    // Live data merge skipped since using Supabase data

    // Normalize match data format for filtering
    const normalizedMatches = nbaMatches.map((e: any) => ({
      id: e.event_id,
      home: e.home_team,
      away: e.away_team,
      league: "NBA",
      datetime: e.event_date,
      venue: e.venue,
      raw: e,
    }));

    // 3. Check for existing selected matches for this D+1 date
    const d1Date = getD1DateRangeWIB(nowUtc).dateStringWIB;
    console.log(`[Auto-Select] D+1 date: ${d1Date}`);

    const { data: existingSelected, error: selectCheckError } = await supabase
      .from('nba_matches_pending')
      .select('event_id')
      .eq('selected_for_date', d1Date)
      .not('event_id', 'is', null);

    let existingMatchIds: string[] = [];
    if (!selectCheckError && existingSelected) {
      existingMatchIds = existingSelected.map(m => m.event_id);
      console.log(`[Auto-Select] Found existing selected matches: ${existingMatchIds.join(', ')}`);
    } else {
      console.log('[Auto-Select] No existing selected matches for this D+1 date');
    }

    // 4. Filter to D+1 matches and exclude already locked ones
    const d1Matches = filterNBAMatchesToD1(normalizedMatches, nowUtc);
    console.log(`[Auto-Select] After D+1 filter: ${d1Matches.length} matches`);

    // Filter out matches that are already locked
    const availableMatches = d1Matches.filter((m: any) => !existingMatchIds.includes(String(m.id)));
    console.log(`[Auto-Select] Available matches (excluding locked): ${availableMatches.length}`);

    if (availableMatches.length === 0 && existingMatchIds.length >= 5) {
      console.log('[Auto-Select] Already have 5+ locked matches, no need to add more');
      return NextResponse.json({
        ok: true,
        message: `Already have ${existingMatchIds.length} locked matches for D+1`,
        selectedCount: 0,
        totalLocked: existingMatchIds.length
      });
    }

    // 5. Add new matches to existing selection (up to 5 total)
    const neededMatches = Math.max(0, 5 - existingMatchIds.length);
    const newMatchesToAdd = availableMatches.slice(0, neededMatches);
    const finalSelectedIds = [...existingMatchIds, ...newMatchesToAdd.map((m: any) => String(m.id))];

    console.log(`[Auto-Select] Adding ${newMatchesToAdd.length} new matches to existing ${existingMatchIds.length}`);
    console.log(`[Auto-Select] Final selection (${finalSelectedIds.length} total): ${finalSelectedIds.join(', ')}`);

    if (finalSelectedIds.length === 0) {
      console.log('[Auto-Select] No matches to select');
      return NextResponse.json({
        ok: true,
        message: "No matches to select",
        selectedCount: 0
      });
    }

    // 6. Mark the final selection in nba_matches_pending
    try {
      const selectedIds = finalSelectedIds;
      const d1Date = getD1DateRangeWIB(nowUtc).dateStringWIB;

      // First, clear any existing selections for this date
      await supabase
        .from('nba_matches_pending')
        .update({ selected_for_date: null })
        .eq('selected_for_date', d1Date);

      // Then mark the selected matches
      const { error: selectError } = await supabase
        .from('nba_matches_pending')
        .update({
          selected_for_date: d1Date,
          selected_at: nowUtc.toISOString()
        })
        .in('event_id', selectedIds);

      if (selectError) {
        console.error('[Auto-Select] Error marking selection in nba_matches_pending:', selectError.message);
        return NextResponse.json(
          { ok: false, error: "Failed to mark selection in database" },
          { status: 500 }
        );
      }

      console.log(`[Auto-Select] 🔒 Marked selection in nba_matches_pending: ${selectedIds.join(', ')}`);
    } catch (e) {
      console.warn('[Auto-Select] Error marking selection:', e);
      return NextResponse.json(
        { ok: false, error: "Failed to mark selection" },
        { status: 500 }
      );
    }

    console.log(`[Auto-Select] ✅ Successfully updated selection: ${existingMatchIds.length} existing + ${newMatchesToAdd.length} new = ${finalSelectedIds.length} total`);
    console.log(`[Auto-Select] Predictions will be generated at 12:00 WIB by auto-predict worker`);

    return NextResponse.json({
      ok: true,
      message: `Updated NBA selection: kept ${existingMatchIds.length} existing, added ${newMatchesToAdd.length} new (${finalSelectedIds.length} total)`,
      timestamp: nowUtc.toISOString(),
      existingCount: existingMatchIds.length,
      addedCount: newMatchesToAdd.length,
      totalCount: finalSelectedIds.length,
      newMatches: newMatchesToAdd.map(m => `${m.home} vs ${m.away}`),
      nextStep: "Predictions will generate at 12:00 WIB",
    });

  } catch (err: any) {
    console.error('[Auto-Select] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

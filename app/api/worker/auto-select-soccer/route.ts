/**
 * Auto-Select Soccer Worker
 * Triggers at 11:00 PM WIB (23:00 UTC)
 * Selects and locks up to 10 soccer matches for the upcoming visibility window
 * Adds new matches to existing selection instead of replacing
 * Does NOT generate predictions yet - that happens at 12:00 AM WIB
 */

import { NextResponse } from "next/server";
import {
  isAutoSelectTimeSoccer,
  filterSoccerMatchesToDateRange,
  getSoccerWindowStatus,
  lockSoccerSelection,
  getSoccerDateRangeWIB
} from "@/lib/soccerWindowManager";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const nowUtc = new Date();

    // Check authorization header
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key');
    const expectedKey = process.env.WORKER_API_KEY || 'event-asu';

    if (authHeader !== `Bearer ${expectedKey}` && authHeader !== expectedKey) {
      console.warn('[Auto-Select Soccer] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const windowStatus = getSoccerWindowStatus(nowUtc);
    console.log(`[Auto-Select Soccer] Called at ${nowUtc.toISOString()} UTC (${windowStatus.wibHour}:00 WIB)`);

    // Check if we're within the auto-select window (23:00-23:05 UTC = 11:00-11:05 PM WIB)
    const isValidTime = isAutoSelectTimeSoccer(nowUtc);
    if (!isValidTime) {
      console.warn(`[Auto-Select Soccer] Called at wrong time. Current UTC hour: ${windowStatus.utcHour}, expected: 23`);
      console.log('[Auto-Select Soccer] Proceeding anyway (manual trigger allowed)');
    }

    // 1. Get soccer matches from Supabase
    console.log('[Auto-Select Soccer] Fetching soccer matches from Supabase...');

    const { data: soccerMatches, error } = await supabase
      .from('soccer_matches_pending')
      .select('*');
    if (error) {
      console.error('[Auto-Select Soccer] Error fetching from Supabase:', error.message);
      return NextResponse.json({ ok: false, error: "Failed to fetch matches" }, { status: 500 });
    }

    console.log(`[Auto-Select Soccer] Got ${soccerMatches?.length || 0} soccer matches from Supabase`);

    // Normalize match data format for filtering
    const normalizedMatches = soccerMatches.map((e: any) => ({
      id: e.event_id,
      home: e.home_team,
      away: e.away_team,
      league: e.league || 'Soccer',
      datetime: e.event_date,
      venue: e.venue,
      raw: e,
    }));

    // 2. Get visibility date range (D+7 to D+13)
    const { visibilityStartWIB } = getSoccerDateRangeWIB(nowUtc);
    console.log(`[Auto-Select Soccer] Visibility starts: ${visibilityStartWIB}`);

    // 3. Check for existing selected matches for this date
    const { data: existingSelected, error: selectCheckError } = await supabase
      .from('soccer_matches_pending')
      .select('event_id')
      .eq('selected_for_date', visibilityStartWIB)
      .not('event_id', 'is', null);

    let existingMatchIds: string[] = [];
    if (!selectCheckError && existingSelected) {
      existingMatchIds = existingSelected.map(m => m.event_id);
      console.log(`[Auto-Select Soccer] Found existing selected matches: ${existingMatchIds.join(', ')}`);
    } else {
      console.log('[Auto-Select Soccer] No existing selected matches for this date');
    }

    // 4. Filter to visibility range matches and exclude already locked ones
    const visibilityMatches = filterSoccerMatchesToDateRange(normalizedMatches, nowUtc);
    console.log(`[Auto-Select Soccer] After visibility filter: ${visibilityMatches.length} matches`);

    // Filter out matches that are already locked
    const availableMatches = visibilityMatches.filter((m: any) => !existingMatchIds.includes(String(m.id)));
    console.log(`[Auto-Select Soccer] Available matches (excluding locked): ${availableMatches.length}`);

    if (availableMatches.length === 0 && existingMatchIds.length >= 10) {
      console.log('[Auto-Select Soccer] Already have 10+ locked matches, no need to add more');
      return NextResponse.json({
        ok: true,
        message: `Already have ${existingMatchIds.length} locked matches for visibility window`,
        selectedCount: 0,
        totalLocked: existingMatchIds.length
      });
    }

    // 5. Add new matches to existing selection (up to 10 total)
    const neededMatches = Math.max(0, 10 - existingMatchIds.length);
    const newMatchesToAdd = availableMatches.slice(0, neededMatches);
    const finalSelectedIds = [...existingMatchIds, ...newMatchesToAdd.map((m: any) => String(m.id))];

    console.log(`[Auto-Select Soccer] Adding ${newMatchesToAdd.length} new matches to existing ${existingMatchIds.length}`);
    console.log(`[Auto-Select Soccer] Final selection (${finalSelectedIds.length} total): ${finalSelectedIds.join(', ')}`);

    if (finalSelectedIds.length === 0) {
      console.log('[Auto-Select Soccer] No matches to select');
      return NextResponse.json({
        ok: true,
        message: "No matches to select",
        selectedCount: 0
      });
    }

    // 6. Mark the final selection in soccer_matches_pending (like NBA)
    try {
      const selectedIds = finalSelectedIds;
      const d1Date = visibilityStartWIB; // Use visibility start date

      // First, clear any existing selections for this date
      await supabase
        .from('soccer_matches_pending')
        .update({ selected_for_date: null, selected_at: null })
        .eq('selected_for_date', d1Date);

      // Then mark the selected matches
      const { error: selectError } = await supabase
        .from('soccer_matches_pending')
        .update({
          selected_for_date: d1Date,
          selected_at: nowUtc.toISOString()
        })
        .in('event_id', selectedIds);

      if (selectError) {
        console.error('[Auto-Select Soccer] Error marking selection in soccer_matches_pending:', selectError.message);
        return NextResponse.json(
          { ok: false, error: "Failed to mark selection in database" },
          { status: 500 }
        );
      }

      console.log(`[Auto-Select Soccer] 🔒 Marked selection in soccer_matches_pending: ${selectedIds.join(', ')}`);
    } catch (e) {
      console.warn('[Auto-Select Soccer] Error marking selection:', e);
      return NextResponse.json(
        { ok: false, error: "Failed to mark selection" },
        { status: 500 }
      );
    }

    console.log(`[Auto-Select Soccer] ✅ Successfully updated selection: ${existingMatchIds.length} existing + ${newMatchesToAdd.length} new = ${finalSelectedIds.length} total`);
    console.log(`[Auto-Select Soccer] Predictions will be generated at 12:00 AM WIB by auto-predict worker`);

    return NextResponse.json({
      ok: true,
      message: `Updated soccer selection: kept ${existingMatchIds.length} existing, added ${newMatchesToAdd.length} new (${finalSelectedIds.length} total)`,
      timestamp: nowUtc.toISOString(),
      existingCount: existingMatchIds.length,
      addedCount: newMatchesToAdd.length,
      totalCount: finalSelectedIds.length,
      newMatches: newMatchesToAdd.map(m => `${m.home} vs ${m.away}`),
      nextStep: "Predictions will generate at 12:00 AM WIB",
    });

  } catch (err: any) {
    console.error('[Auto-Select Soccer] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
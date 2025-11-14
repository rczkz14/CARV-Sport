/**
 * Auto-Open Soccer Worker
 * Triggers at 01:00 AM WIB (18:00 UTC)
 * Sets status to 'open' for soccer matches that have predictions generated
 *
 * Workflow:
 * - 11:00 PM WIB: auto-select-soccer locks matches
 * - 12:00 AM WIB: auto-predict-soccer generates predictions for those locked matches
 * - 01:00 AM WIB: auto-open-soccer sets matches with predictions to 'open' for purchase
 */

import { NextResponse } from "next/server";
import { getSoccerWindowStatus } from "@/lib/soccerWindowManager";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const nowUtc = new Date();

    // Check authorization header
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key');
    const expectedKey = process.env.WORKER_API_KEY || 'test-key';

    if (authHeader !== `Bearer ${expectedKey}` && authHeader !== expectedKey) {
      console.warn('[Auto-Open Soccer] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const windowStatus = getSoccerWindowStatus(nowUtc);
    console.log(`[Auto-Open Soccer] Called at ${nowUtc.toISOString()} UTC (${windowStatus.wibHour}:00 WIB)`);

    // Check if window is open (should be true at 18:00 UTC)
    if (!windowStatus.isOpen) {
      console.warn(`[Auto-Open Soccer] Called but window is not open. Current status: ${windowStatus.isOpen}`);
      return NextResponse.json({
        ok: false,
        error: "Window not open",
        windowStatus
      }, { status: 400 });
    }

    // 1. Get soccer matches that have predictions
    console.log('[Auto-Open Soccer] Finding soccer matches with predictions...');

    const { data: matchesWithPredictions, error: fetchError } = await supabase
      .from('soccer_matches_pending')
      .select('event_id, home_team, away_team, status')
      .not('event_id', 'is', null);

    if (fetchError) {
      console.error('[Auto-Open Soccer] Error fetching matches:', fetchError.message);
      return NextResponse.json({ ok: false, error: "Failed to fetch matches" }, { status: 500 });
    }

    console.log(`[Auto-Open Soccer] Found ${matchesWithPredictions?.length || 0} soccer matches in pending`);

    // 2. Check which matches have predictions in soccer_predictions table
    const matchesToOpen: any[] = [];
    for (const match of matchesWithPredictions || []) {
      const { data: prediction, error: predError } = await supabase
        .from('soccer_predictions')
        .select('event_id')
        .eq('event_id', match.event_id)
        .single();

      if (!predError && prediction) {
        matchesToOpen.push(match);
      }
    }

    console.log(`[Auto-Open Soccer] Found ${matchesToOpen.length} matches with predictions to open`);

    if (matchesToOpen.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No matches with predictions to open",
        openedCount: 0
      });
    }

    // 3. Update status to 'open' for matches with predictions
    const matchIdsToOpen = matchesToOpen.map(m => m.event_id);
    console.log(`[Auto-Open Soccer] Setting status to 'open' for matches: ${matchIdsToOpen.join(', ')}`);

    const { error: updateError } = await supabase
      .from('soccer_matches_pending')
      .update({ status: 'open' })
      .in('event_id', matchIdsToOpen);

    if (updateError) {
      console.error('[Auto-Open Soccer] Error updating match status:', updateError.message);
      return NextResponse.json({
        ok: false,
        error: `Failed to open matches: ${updateError.message}`
      }, { status: 500 });
    }

    console.log(`[Auto-Open Soccer] ✅ Successfully opened ${matchIdsToOpen.length} soccer matches for purchase`);

    return NextResponse.json({
      ok: true,
      message: `Opened ${matchesToOpen.length} soccer matches for purchase`,
      timestamp: nowUtc.toISOString(),
      openedCount: matchesToOpen.length,
      matches: matchesToOpen.map((m: any) => `${m.home_team} vs ${m.away_team}`),
    });

  } catch (err: any) {
    console.error('[Auto-Open Soccer] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
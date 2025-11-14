/**
 * Auto-Predict Soccer Worker
 * Triggers at 12:00 AM WIB (17:00 UTC)
 * Generates predictions for matches that were selected at 11:00 PM WIB
 *
 * Workflow:
 * - 11:00 PM WIB: auto-select-soccer locks matches
 * - 12:00 AM WIB: auto-predict-soccer generates predictions for those locked matches
 * - 01:00 AM WIB: Window opens, users can buy predictions
 */

import { NextResponse } from "next/server";

import { isAutoPredictTimeSoccer, getSoccerWindowStatus, getLockedSoccerSelection, getSoccerDateRangeWIB } from "@/lib/soccerWindowManager";
import { generatePredictionsForMatches, getPredictionForMatch } from "@/lib/predictionGenerator";
import { supabase } from "@/lib/supabaseClient";
import { promises as fs } from 'fs';
import path from 'path';

async function readCache(): Promise<any> {
  try {
    const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Auto-Predict Soccer] Error reading cache file:', error);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const nowUtc = new Date();

    // Check authorization header
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key');
    const expectedKey = process.env.WORKER_API_KEY || 'test-key';

    if (authHeader !== `Bearer ${expectedKey}` && authHeader !== expectedKey) {
      console.warn('[Auto-Predict Soccer] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const windowStatus = getSoccerWindowStatus(nowUtc);
    console.log(`[Auto-Predict Soccer] Called at ${nowUtc.toISOString()} UTC (${windowStatus.wibHour}:00 WIB)`);

    // Check if we're within the auto-predict window (17:00-17:05 UTC = 12:00-12:05 AM WIB)
    const isValidTime = isAutoPredictTimeSoccer(nowUtc);
    if (!isValidTime) {
      console.warn(`[Auto-Predict Soccer] Called at wrong time. Current UTC hour: ${windowStatus.utcHour}, expected: 17`);
      console.log('[Auto-Predict Soccer] Proceeding anyway (manual trigger allowed)');
    }

    // 1. Get locked selection from Supabase (primary) or fallback to local file
    let lockedIds: string[] = [];

    // Try Supabase first
    const { visibilityStartWIB } = getSoccerDateRangeWIB(nowUtc);
    const { data: lockedSelection, error: lockError } = await supabase
      .from('soccer_locked_selections')
      .select('match_ids')
      .eq('visibility_start_date', visibilityStartWIB)
      .single();

    if (!lockError && lockedSelection?.match_ids && Array.isArray(lockedSelection.match_ids)) {
      lockedIds = lockedSelection.match_ids;
      console.log('[Auto-Predict Soccer] Found locked selection in Supabase:', lockedIds);
    } else {
      console.log('[Auto-Predict Soccer] No locked selection in Supabase, trying local file...');
      // Fallback to local file
      lockedIds = await getLockedSoccerSelection() || [];
    }

    if (!lockedIds || lockedIds.length === 0) {
      console.log('[Auto-Predict Soccer] No locked selection found anywhere. Falling back to all soccer_matches_pending.');

      // Fallback: Get all event_ids from soccer_matches_pending
      const { data: pendingMatches, error } = await supabase
        .from('soccer_matches_pending')
        .select('event_id');
      if (error) {
        console.error('[Auto-Predict Soccer] Error fetching pending matches:', error.message);
        return NextResponse.json({
          ok: false,
          message: "No locked selection and failed to fetch pending matches",
          generatedCount: 0
        }, { status: 500 });
      }
      lockedIds = pendingMatches?.map(m => m.event_id) || [];
      console.log('[Auto-Predict Soccer] Fallback lockedIds:', lockedIds);
      if (lockedIds.length === 0) {
        return NextResponse.json({
          ok: false,
          message: "No matches found in soccer_matches_pending",
          generatedCount: 0
        }, { status: 400 });
      }
    }

    console.log(`[Auto-Predict Soccer] Found locked selection: ${lockedIds.join(', ')}`);

    // 2. Get match details from soccer_matches_pending
    const { data: allPendingMatches, error: fetchError } = await supabase
      .from('soccer_matches_pending')
      .select('*');
    if (fetchError) {
      console.error('[Auto-Predict Soccer] Error fetching all match details from Supabase:', fetchError.message);
      return NextResponse.json({ ok: false, error: "Failed to fetch match details" }, { status: 500 });
    }
    const pendingMatches = allPendingMatches?.filter(m => lockedIds.includes(m.event_id)) || [];

    let soccerMatches: any[] = pendingMatches || [];
    console.log(`[Auto-Predict Soccer] Found ${soccerMatches.length} matches in soccer_matches_pending for IDs:`, lockedIds);

    if (soccerMatches.length === 0) {
      console.log('[Auto-Predict Soccer] No matches found for IDs:', lockedIds.join(', '));
      return NextResponse.json({
        ok: false,
        message: "No matches found for the selected IDs",
        generatedCount: 0
      }, { status: 404 });
    }

    // 3. Check if predictions already exist for these matches
    const existingPredictions = new Set<string>();
    try {
      const dataPath = path.join(process.cwd(), 'data');
      const files = await fs.readdir(dataPath);
      for (const file of files) {
        if (file.startsWith('raffle-') && file.endsWith('.json')) {
          const matchId = file.replace('raffle-', '').replace('.json', '');
          existingPredictions.add(matchId);
        }
      }
      console.log(`[Auto-Predict Soccer] Found existing predictions for: ${Array.from(existingPredictions).join(', ')}`);
    } catch (e) {
      console.warn('[Auto-Predict Soccer] Error reading data directory:', e);
    }

    // 4. Generate predictions for matches that don't have any yet
    const matchesToPredict = soccerMatches
      .filter((m: any) => !existingPredictions.has(String(m.event_id)))
      .map((m: any) => ({
        id: m.event_id,
        home: m.home_team,
        away: m.away_team,
        league: m.league || 'Soccer',
        datetime: m.event_date,
        venue: m.venue,
      }));

    if (matchesToPredict.length === 0) {
      console.log('[Auto-Predict Soccer] All locked matches already have predictions');
      return NextResponse.json({
        ok: true,
        message: "All locked matches already have predictions",
        timestamp: nowUtc.toISOString(),
        generatedCount: 0,
        matchCount: soccerMatches.length,
        matches: soccerMatches.map((m: any) => `${m.home_team} vs ${m.away_team}`),
      });
    }

    console.log(`[Auto-Predict Soccer] Generating predictions for ${matchesToPredict.length} matches:`,
      matchesToPredict.map((m: any) => `${m.home} vs ${m.away}`));


    const generatedCount = await generatePredictionsForMatches(matchesToPredict, { bypassLeagueCheck: true });

    // Store predictions in Supabase
    for (const match of matchesToPredict) {
      console.log(`[Auto-Predict Soccer] Processing match ${match.id}: ${match.home} vs ${match.away}`);
      try {
        const prediction = await getPredictionForMatch(match.id);
        console.log(`[Auto-Predict Soccer] Got prediction for ${match.id}:`, prediction ? 'yes' : 'no');
        if (prediction && prediction.prediction) {
          const { predictedWinner, generatedAt } = prediction.prediction;
          const { id } = match;
          const { status } = prediction;
          const upsertData = {
            event_id: id,
            prediction_winner: predictedWinner,
            prediction_time: generatedAt,
            status: status || 'pending',
            prediction_text: prediction.predictionText,
            created_at: new Date().toISOString(),
          };
          console.log(`[Auto-Predict Soccer] Upserting to soccer_predictions:`, upsertData);
          const { data, error } = await supabase.from('soccer_predictions').upsert([upsertData], { onConflict: 'event_id' });
          console.log(`[Auto-Predict Soccer] Upsert result for ${match.id}:`, { data, error });
          if (!error) {
            console.log(`[Auto-Predict Soccer] Successfully saved prediction for match ${match.id}`);
          } else {
            console.warn(`[Auto-Predict Soccer] Upsert error for ${match.id}:`, error.message);
          }
        } else {
          console.warn(`[Auto-Predict Soccer] No prediction data for match ${match.id}`);
        }
      } catch (e) {
        console.warn(`[Auto-Predict Soccer] Error saving prediction for match ${match.id} to Supabase:`, e);
      }
    }

    console.log(`[Auto-Predict Soccer] ✅ Successfully generated ${generatedCount} predictions and stored in Supabase`);

    return NextResponse.json({
      ok: true,
      message: `Generated ${generatedCount} predictions for locked soccer matches and stored in Supabase`,
      timestamp: nowUtc.toISOString(),
      generatedCount,
      matchCount: matchesToPredict.length,
      matches: matchesToPredict.map((m: any) => `${m.home} vs ${m.away}`),
    });

  } catch (err: any) {
    console.error('[Auto-Predict Soccer] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
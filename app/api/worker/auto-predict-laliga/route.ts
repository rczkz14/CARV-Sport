/**
 * Auto-Predict LaLiga Worker
 * Triggers at 00:00 WIB (17:00 UTC)
 * Generates predictions for matches that were selected at 23:00 WIB
 *
 * Workflow:
 * - 23:00 WIB: auto-select-laliga locks 3 matches
 * - 00:00 WIB: auto-predict-laliga generates predictions for those locked matches
 * - Window opens, users can buy predictions
 */

import { NextResponse } from "next/server";

import { isAutoPredictTime, getNBAWindowStatus, getD1DateRangeWIB } from "@/lib/nbaWindowManager";
import { generatePredictionsForMatches, getPredictionForMatch } from "@/lib/predictionGenerator";
import { fetchLiveMatchData } from "@/lib/sportsFetcher";
import { supabase } from "@/lib/supabaseClient";
import { promises as fs } from 'fs';
import path from 'path';

async function readCache(): Promise<any> {
  try {
    const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Auto-Predict LaLiga] Error reading cache file:', error);
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
      console.warn('[Auto-Predict LaLiga] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const windowStatus = getNBAWindowStatus(nowUtc);
    console.log(`[Auto-Predict LaLiga] Called at ${nowUtc.toISOString()} UTC (${windowStatus.wibHour}:00 WIB)`);

    // Check if we're within the auto-predict window (17:00-17:05 UTC = 00:00-00:05 WIB)
    const isValidTime = nowUtc.getUTCHours() === 17 && nowUtc.getUTCMinutes() < 5;
    if (!isValidTime) {
      console.warn(`[Auto-Predict LaLiga] Called at wrong time. Current UTC hour: ${nowUtc.getUTCHours()}, expected: 17`);
      console.log('[Auto-Predict LaLiga] Proceeding anyway (manual trigger allowed)');
    }

    // 1. Get selected matches from soccer_matches_pending (those with selected_for_date set)
    const d1Date = getD1DateRangeWIB(nowUtc).dateStringWIB;
    console.log(`[Auto-Predict LaLiga] Looking for selected matches for D+1 date: ${d1Date}`);

    const { data: selectedMatches, error: selectError } = await supabase
      .from('soccer_matches_pending')
      .select('event_id')
      .eq('selected_for_date', d1Date)
      .eq('league', 'Spanish La Liga')
      .not('event_id', 'is', null);

    if (selectError) {
      console.error('[Auto-Predict LaLiga] Error fetching selected matches:', selectError.message);
      return NextResponse.json({
        ok: false,
        message: "Failed to fetch selected matches",
        generatedCount: 0
      }, { status: 500 });
    }

    const lockedIds = selectedMatches?.map(m => m.event_id) || [];
    console.log(`[Auto-Predict LaLiga] Found ${lockedIds.length} selected matches for ${d1Date}:`, lockedIds);

    if (lockedIds.length === 0) {
      console.log('[Auto-Predict LaLiga] No selected matches found for this D+1 date');
      return NextResponse.json({
        ok: true,
        message: "No selected matches found for this D+1 date",
        generatedCount: 0
      });
    }

    console.log(`[Auto-Predict LaLiga] Found locked selection: ${lockedIds.join(', ')}`);

    // 2. Get match details from soccer_matches_pending
    const { data: allPendingMatches, error: fetchError } = await supabase
      .from('soccer_matches_pending')
      .select('*')
      .eq('league', 'Spanish La Liga');
    if (fetchError) {
      console.error('[Auto-Predict LaLiga] Error fetching all match details from Supabase:', fetchError.message);
      return NextResponse.json({ ok: false, error: "Failed to fetch match details" }, { status: 500 });
    }
    const pendingMatches = allPendingMatches?.filter(m => lockedIds.includes(m.event_id)) || [];

    let laligaMatches: any[] = pendingMatches || [];
    console.log(`[Auto-Predict LaLiga] Found ${laligaMatches.length} matches in soccer_matches_pending for IDs:`, lockedIds);
    console.log('[Auto-Predict LaLiga] Pending matches:', pendingMatches);

    if (laligaMatches.length === 0) {
      console.log('[Auto-Predict LaLiga] No matches found for IDs:', lockedIds.join(', '));
      return NextResponse.json({
        ok: false,
        message: "No matches found for the selected IDs",
        generatedCount: 0
      }, { status: 404 });
    }

    // 3. Check if predictions already exist for these matches
    const existingPredictions = new Set<string>();
    try {
      const { data: existing } = await supabase
        .from('soccer_predictions')
        .select('event_id')
        .in('event_id', lockedIds);
      if (existing) {
        existing.forEach((p: any) => existingPredictions.add(p.event_id));
      }
      console.log(`[Auto-Predict LaLiga] Found existing predictions for: ${Array.from(existingPredictions).join(', ')}`);
    } catch (e) {
      console.warn('[Auto-Predict LaLiga] Error checking existing predictions:', e);
    }

    // 4. Generate predictions for matches that don't have any yet
    const matchesToPredict = laligaMatches
      .filter((m: any) => !existingPredictions.has(String(m.event_id)))
      .map((m: any) => ({
        id: m.event_id,
        home: m.home_team,
        away: m.away_team,
        league: "Spanish La Liga",
        datetime: m.event_date,
        venue: m.venue,
      }));

    if (matchesToPredict.length === 0) {
      console.log('[Auto-Predict LaLiga] All locked matches already have predictions');
      return NextResponse.json({
        ok: true,
        message: "All locked matches already have predictions",
        timestamp: nowUtc.toISOString(),
        generatedCount: 0,
        matchCount: laligaMatches.length,
        matches: laligaMatches.map((m: any) => `${m.home_team} vs ${m.away_team}`),
      });
    }

    console.log(`[Auto-Predict LaLiga] Generating predictions for ${matchesToPredict.length} matches:`,
      matchesToPredict.map((m: any) => `${m.home} vs ${m.away}`));


    const generatedCount = await generatePredictionsForMatches(matchesToPredict, { bypassLeagueCheck: true });

    // Store predictions in Supabase
    for (const match of matchesToPredict) {
      console.log(`[Auto-Predict LaLiga] Processing match ${match.id}: ${match.home} vs ${match.away}`);
      try {
        const prediction = await getPredictionForMatch(match.id);
        console.log(`[Auto-Predict LaLiga] Got prediction for ${match.id}:`, prediction ? 'yes' : 'no');
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
          console.log(`[Auto-Predict LaLiga] Upserting to soccer_predictions:`, upsertData);
          const { data, error } = await supabase.from('soccer_predictions').upsert([upsertData], { onConflict: 'event_id' });
          console.log(`[Auto-Predict LaLiga] Upsert result for ${match.id}:`, { data, error });
          if (!error) {
            console.log(`[Auto-Predict LaLiga] Successfully saved prediction for match ${match.id}`);
          } else {
            console.warn(`[Auto-Predict LaLiga] Upsert error for ${match.id}:`, error.message);
          }
        } else {
          console.warn(`[Auto-Predict LaLiga] No prediction data for match ${match.id}`);
        }
      } catch (e) {
        console.warn(`[Auto-Predict LaLiga] Error saving prediction for match ${match.id} to Supabase:`, e);
      }
    }

    console.log(`[Auto-Predict LaLiga] ✅ Successfully generated ${generatedCount} predictions and stored in Supabase`);

    return NextResponse.json({
      ok: true,
      message: `Generated ${generatedCount} predictions for locked LaLiga matches and stored in Supabase`,
      timestamp: nowUtc.toISOString(),
      generatedCount,
      matchCount: matchesToPredict.length,
      matches: matchesToPredict.map((m: any) => `${m.home} vs ${m.away}`),
    });

  } catch (err: any) {
    console.error('[Auto-Predict LaLiga] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

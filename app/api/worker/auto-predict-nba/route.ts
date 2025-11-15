/**
 * Auto-Predict NBA Worker
 * Triggers at 12:00 WIB (05:00 UTC)
 * Generates predictions for matches that were selected at 11:00 WIB
 * 
 * Workflow:
 * - 11:00 WIB: auto-select-nba locks 3 matches
 * - 12:00 WIB: auto-predict-nba generates predictions for those locked matches
 * - 13:00 WIB: Window opens, users can buy predictions
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
    console.error('[Auto-Predict] Error reading cache file:', error);
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
      console.warn('[Auto-Predict] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const windowStatus = getNBAWindowStatus(nowUtc);
    console.log(`[Auto-Predict] Called at ${nowUtc.toISOString()} UTC (${windowStatus.wibHour}:00 WIB)`);

    // Check if we're within the auto-predict window (05:00-05:05 UTC = 12:00-12:05 WIB)
    const isValidTime = isAutoPredictTime(nowUtc);
    if (!isValidTime) {
      console.warn(`[Auto-Predict] Called at wrong time. Current UTC hour: ${windowStatus.utcHour}, expected: 5`);
      console.log('[Auto-Predict] Proceeding anyway (manual trigger allowed)');
    }

    // 1. Get selected matches from nba_matches_pending (those with selected_for_date set)
    const d1Date = getD1DateRangeWIB(nowUtc).dateStringWIB;
    console.log(`[Auto-Predict] Looking for selected matches for D+1 date: ${d1Date}`);

    const { data: selectedMatches, error: selectError } = await supabase
      .from('nba_matches_pending')
      .select('event_id')
      .eq('selected_for_date', d1Date)
      .not('event_id', 'is', null);

    if (selectError) {
      console.error('[Auto-Predict] Error fetching selected matches:', selectError.message);
      return NextResponse.json({
        ok: false,
        message: "Failed to fetch selected matches",
        generatedCount: 0
      }, { status: 500 });
    }

    const lockedIds = selectedMatches?.map(m => m.event_id) || [];
    console.log(`[Auto-Predict] Found ${lockedIds.length} selected matches for ${d1Date}:`, lockedIds);

    if (lockedIds.length === 0) {
      console.log('[Auto-Predict] No selected matches found for this D+1 date');
      return NextResponse.json({
        ok: true,
        message: "No selected matches found for this D+1 date",
        generatedCount: 0
      });
    }

    console.log(`[Auto-Predict] Found locked selection: ${lockedIds.join(', ')}`);

    // 2. Get match details from nba_matches_pending
    const { data: allPendingMatches, error: fetchError } = await supabase
      .from('nba_matches_pending')
      .select('*');
    if (fetchError) {
      console.error('[Auto-Predict] Error fetching all match details from Supabase:', fetchError.message);
      return NextResponse.json({ ok: false, error: "Failed to fetch match details" }, { status: 500 });
    }
    const pendingMatches = allPendingMatches?.filter(m => lockedIds.includes(m.event_id)) || [];

    let nbaMatches: any[] = pendingMatches || [];
    console.log(`[Auto-Predict] Found ${nbaMatches.length} matches in nba_matches_pending for IDs:`, lockedIds);
    console.log('[Auto-Predict] Pending matches:', pendingMatches);

    if (nbaMatches.length === 0) {
      console.log('[Auto-Predict] No matches found for IDs:', lockedIds.join(', '));
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
      console.log(`[Auto-Predict] Found existing predictions for: ${Array.from(existingPredictions).join(', ')}`);
    } catch (e) {
      console.warn('[Auto-Predict] Error reading data directory:', e);
    }

    // 4. Generate predictions for matches that don't have any yet
    const matchesToPredict = nbaMatches
      .filter((m: any) => !existingPredictions.has(String(m.event_id)))
      .map((m: any) => ({
        id: m.event_id,
        home: m.home_team,
        away: m.away_team,
        league: "NBA",
        datetime: m.event_date,
        venue: m.venue,
      }));

    if (matchesToPredict.length === 0) {
      console.log('[Auto-Predict] All locked matches already have predictions');
      return NextResponse.json({
        ok: true,
        message: "All locked matches already have predictions",
        timestamp: nowUtc.toISOString(),
        generatedCount: 0,
        matchCount: nbaMatches.length,
        matches: nbaMatches.map((m: any) => `${m.home_team} vs ${m.away_team}`),
      });
    }

    console.log(`[Auto-Predict] Generating predictions for ${matchesToPredict.length} matches:`,
      matchesToPredict.map((m: any) => `${m.home} vs ${m.away}`));


    const generatedCount = await generatePredictionsForMatches(matchesToPredict, { bypassLeagueCheck: true });

    // Store predictions in Supabase
    for (const match of matchesToPredict) {
      console.log(`[Auto-Predict] Processing match ${match.id}: ${match.home} vs ${match.away}`);
      try {
        const prediction = await getPredictionForMatch(match.id);
        console.log(`[Auto-Predict] Got prediction for ${match.id}:`, prediction ? 'yes' : 'no');
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
          console.log(`[Auto-Predict] Upserting to nba_predictions:`, upsertData);
          const { data, error } = await supabase.from('nba_predictions').upsert([upsertData], { onConflict: 'event_id' });
          console.log(`[Auto-Predict] Upsert result for ${match.id}:`, { data, error });
          if (!error) {
            console.log(`[Auto-Predict] Successfully saved prediction for match ${match.id}`);
          } else {
            console.warn(`[Auto-Predict] Upsert error for ${match.id}:`, error.message);
          }
        } else {
          console.warn(`[Auto-Predict] No prediction data for match ${match.id}`);
        }
      } catch (e) {
        console.warn(`[Auto-Predict] Error saving prediction for match ${match.id} to Supabase:`, e);
      }
    }

    console.log(`[Auto-Predict] ✅ Successfully generated ${generatedCount} predictions and stored in Supabase`);

    return NextResponse.json({
      ok: true,
      message: `Generated ${generatedCount} predictions for locked NBA matches and stored in Supabase`,
      timestamp: nowUtc.toISOString(),
      generatedCount,
      matchCount: matchesToPredict.length,
      matches: matchesToPredict.map((m: any) => `${m.home} vs ${m.away}`),
    });

  } catch (err: any) {
    console.error('[Auto-Predict] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

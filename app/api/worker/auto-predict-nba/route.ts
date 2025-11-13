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
import { isAutoPredictTime, getNBAWindowStatus, getLockedNBASelection } from "@/lib/nbaWindowManager";
import { generatePredictionsForMatches } from "@/lib/predictionGenerator";
import { fetchLiveMatchData } from "@/lib/sportsFetcher";
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
    const expectedKey = process.env.WORKER_API_KEY || 'test-key';
    
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

    // 1. Get locked selection from auto-select worker
    const lockedIds = await getLockedNBASelection();
    
    if (!lockedIds || lockedIds.length === 0) {
      console.log('[Auto-Predict] No locked selection found. Was auto-select-nba called at 11:00 WIB?');
      return NextResponse.json({
        ok: false,
        message: "No locked match selection found. Auto-select should have run at 11:00 WIB",
        generatedCount: 0
      }, { status: 400 });
    }

    console.log(`[Auto-Predict] Found locked selection: ${lockedIds.join(', ')}`);

    // 2. Fetch current cache to get match details
    const cachedData = await readCache();
    if (!cachedData) {
      return NextResponse.json({ ok: false, error: "Cache not available" }, { status: 503 });
    }

    // Get details for locked match IDs
    let nbaMatches: any[] = [];
    try {
      const byId = new Map<string, any>();
      
      if (cachedData.nba?.league && Array.isArray(cachedData.nba.league)) {
        cachedData.nba.league.forEach((m: any) => {
          if (m.idEvent) byId.set(String(m.idEvent), m);
        });
      }
      
      if (cachedData.nba?.daily && Array.isArray(cachedData.nba.daily)) {
        cachedData.nba.daily.forEach((m: any) => {
          if (m.idEvent) byId.set(String(m.idEvent), m);
        });
      }
      
      // Only keep locked matches
      const lockedSet = new Set(lockedIds);
      for (const [id, match] of byId) {
        if (lockedSet.has(id)) {
          nbaMatches.push(match);
        }
      }
      
      console.log(`[Auto-Predict] Found ${nbaMatches.length} locked matches in cache`);
    } catch (e) {
      console.warn('[Auto-Predict] Error reading NBA cache:', e);
    }

    if (nbaMatches.length === 0) {
      console.log('[Auto-Predict] No matches found for locked IDs:', lockedIds.join(', '));
      return NextResponse.json({
        ok: false,
        message: "Locked matches not found in cache",
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
      .filter((m: any) => !existingPredictions.has(String(m.idEvent)))
      .map((m: any) => ({
        id: m.idEvent,
        home: m.strHomeTeam,
        away: m.strAwayTeam,
        league: "NBA",
        datetime: m.strTimestamp || (m.dateEvent && m.strTime ? `${m.dateEvent}T${m.strTime}Z` : null),
        venue: m.strVenue,
      }));

    if (matchesToPredict.length === 0) {
      console.log('[Auto-Predict] All locked matches already have predictions');
      return NextResponse.json({
        ok: true,
        message: "All locked matches already have predictions",
        timestamp: nowUtc.toISOString(),
        generatedCount: 0,
        matchCount: nbaMatches.length,
        matches: nbaMatches.map((m: any) => `${m.strHomeTeam} vs ${m.strAwayTeam}`),
      });
    }

    console.log(`[Auto-Predict] Generating predictions for ${matchesToPredict.length} matches:`,
      matchesToPredict.map((m: any) => `${m.home} vs ${m.away}`));

    const generatedCount = await generatePredictionsForMatches(matchesToPredict, { bypassLeagueCheck: true });

    console.log(`[Auto-Predict] ✅ Successfully generated ${generatedCount} predictions`);

    return NextResponse.json({
      ok: true,
      message: `Generated ${generatedCount} predictions for locked NBA matches`,
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

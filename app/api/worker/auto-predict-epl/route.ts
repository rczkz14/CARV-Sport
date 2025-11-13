/**
 * Auto-Predict EPL Worker
 * Triggers at 12:00 AM WIB (17:00 UTC previous day)
 * Generates soccer predictions for matches that were selected
 * 
 * Predictions include:
 * - scorePrediction: realistic score (1-0, 2-1, etc)
 * - prediction: Over/Under (used for scoring)
 * - story: narrative explanation with news context
 */

import { NextResponse } from "next/server";
import { isAutoPredictTimeEPL, getEPLWindowStatus, getLockedEPLSelection } from "@/lib/eplWindowManager";
import { generateSoccerScorePrediction, generateSoccerOverUnder, generateSoccerStory } from "@/lib/predictionGenerator";
import { fetchLiveMatchData } from "@/lib/sportsFetcher";
import { promises as fs } from 'fs';
import path from 'path';

async function readCache(): Promise<any> {
  try {
    const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[EPL Auto-Predict] Error reading cache file:', error);
    return null;
  }
}

async function readPurchases(): Promise<Set<string>> {
  try {
    const purchasesPath = path.join(process.cwd(), 'data/purchases.json');
    const data = await fs.readFile(purchasesPath, 'utf-8');
    const parsed = JSON.parse(data);
    
    const eventIds = new Set<string>();
    if (Array.isArray(parsed.purchases)) {
      parsed.purchases.forEach((p: any) => {
        if (p.eventId) eventIds.add(String(p.eventId));
      });
    }
    
    return eventIds;
  } catch (error) {
    console.warn('[EPL Auto-Predict] Could not read purchases:', error);
    return new Set();
  }
}

async function saveEPLRaffle(
  eventId: string,
  scorePrediction: string,
  overUnder: string,
  story: string,
  matchData: {
    home: string;
    away: string;
    league: string;
    datetime: string | null;
    venue?: string | null;
  }
): Promise<void> {
  try {
    const raffleFile = path.join(process.cwd(), `data/raffle-${eventId}.json`);
    
    const raffleData = {
      eventId,
      league: "EPL",
      matchDetails: {
        home: matchData.home,
        away: matchData.away,
        league: matchData.league,
        datetime: matchData.datetime,
        venue: matchData.venue || null,
      },
      prediction: overUnder,  // Over/Under for scoring
      scorePrediction: scorePrediction,  // Score for display
      story: story,  // Narrative context
      actualWinner: null,
      actualResult: null,
      isCorrect: null,
      actualTotalGoals: null,
      createdAt: new Date().toISOString(),
    };

    await fs.writeFile(raffleFile, JSON.stringify(raffleData, null, 2), 'utf-8');
    console.log(`[EPL Auto-Predict] Saved prediction for event ${eventId}`);
    
    // Also save to predictions.json for consistency with NBA
    try {
      const predictionsFile = path.join(process.cwd(), 'data/predictions.json');
      let predictionsData: any = { predictions: {} };
      
      try {
        const existing = await fs.readFile(predictionsFile, 'utf-8');
        predictionsData = JSON.parse(existing);
      } catch (e) {
        // File doesn't exist or is invalid, start fresh
      }
      
      // Add EPL prediction with full details
      const fullPrediction = `🏟️ ${matchData.home} vs ${matchData.away}\nPredicted Score: ${scorePrediction}\nOver/Under: ${overUnder}\nNarrative: ${story}\n\nGenerated: ${new Date().toLocaleString()}`;
      predictionsData.predictions[eventId] = fullPrediction;
      
      await fs.writeFile(predictionsFile, JSON.stringify(predictionsData, null, 2), 'utf-8');
    } catch (e) {
      console.warn(`[EPL Auto-Predict] Error saving to predictions.json:`, e);
    }
  } catch (error) {
    console.error(`[EPL Auto-Predict] Error saving raffle for ${eventId}:`, error);
  }
}

export async function GET(req: Request) {
  try {
    const nowUtc = new Date();
    
    // Check authorization header
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key');
    const expectedKey = process.env.WORKER_API_KEY || 'test-key';
    
    if (authHeader !== `Bearer ${expectedKey}` && authHeader !== expectedKey) {
      console.warn('[EPL Auto-Predict] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const windowStatus = getEPLWindowStatus(nowUtc);
    console.log(`[EPL Auto-Predict] Called at ${nowUtc.toISOString()} UTC (${windowStatus.wibHour}:00 WIB)`);

    // Check if we're within the auto-predict window (17:00-17:05 UTC = 12:00-12:05 AM WIB)
    const isValidTime = isAutoPredictTimeEPL(nowUtc);
    if (!isValidTime) {
      console.warn(`[EPL Auto-Predict] Called at wrong time. Current UTC hour: ${windowStatus.utcHour}, expected: 17`);
      console.log('[EPL Auto-Predict] Proceeding anyway (manual trigger allowed)');
    }

    // 1. Get locked selection from auto-select worker
    const lockedIds = await getLockedEPLSelection();
    
    if (!lockedIds || lockedIds.length === 0) {
      console.log('[EPL Auto-Predict] No locked selection found. Was auto-select-epl called?');
      return NextResponse.json({
        ok: false,
        message: "No locked EPL match selection found. Auto-select should have run at 11:00 PM WIB",
        generatedCount: 0
      }, { status: 400 });
    }

    console.log(`[EPL Auto-Predict] Found locked selection: ${lockedIds.join(', ')}`);

    // 2. Fetch current cache to get match details
    const cachedData = await readCache();
    if (!cachedData) {
      return NextResponse.json({ ok: false, error: "Cache not available" }, { status: 503 });
    }

    // Get details for locked match IDs
    let eplMatches: any[] = [];
    try {
      const byId = new Map<string, any>();
      
      if (cachedData.epl?.league && Array.isArray(cachedData.epl.league)) {
        cachedData.epl.league.forEach((m: any) => {
          if (m.idEvent) byId.set(String(m.idEvent), m);
        });
      }
      
      if (cachedData.epl?.daily && Array.isArray(cachedData.epl.daily)) {
        cachedData.epl.daily.forEach((m: any) => {
          if (m.idEvent) byId.set(String(m.idEvent), m);
        });
      }
      
      // Only keep locked matches
      const lockedSet = new Set(lockedIds);
      for (const [id, match] of byId) {
        if (lockedSet.has(id)) {
          eplMatches.push(match);
        }
      }
      
      console.log(`[EPL Auto-Predict] Found ${eplMatches.length} locked matches in cache`);
    } catch (e) {
      console.warn('[EPL Auto-Predict] Error reading EPL cache:', e);
    }

    if (eplMatches.length === 0) {
      console.log('[EPL Auto-Predict] No matches found for locked IDs:', lockedIds.join(', '));
      return NextResponse.json({
        ok: false,
        message: "Locked matches not found in cache",
        generatedCount: 0
      }, { status: 404 });
    }

    // 3. Check which matches have purchases
    const purchaseEventIds = await readPurchases();
    console.log(`[EPL Auto-Predict] Found ${purchaseEventIds.size} matches with purchases`);

    // 4. Check if predictions already exist for these matches
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
      console.log(`[EPL Auto-Predict] Found existing predictions for: ${Array.from(existingPredictions).join(', ')}`);
    } catch (e) {
      console.warn('[EPL Auto-Predict] Error reading data directory:', e);
    }

    // 5. Generate predictions for locked matches that have purchases and don't have predictions yet
    let generatedCount = 0;

    for (const match of eplMatches) {
      const matchId = String(match.idEvent);
      
      // Skip if no purchase for this match
      if (!purchaseEventIds.has(matchId)) {
        console.log(`[EPL Auto-Predict] Skipping ${matchId} - no purchases`);
        continue;
      }

      // Skip if prediction already exists
      if (existingPredictions.has(matchId)) {
        console.log(`[EPL Auto-Predict] Skipping ${matchId} - prediction already exists`);
        continue;
      }

      console.log(`[EPL Auto-Predict] Generating prediction for ${match.strHomeTeam} vs ${match.strAwayTeam}...`);

      try {
        const scorePrediction = generateSoccerScorePrediction(match.strHomeTeam, match.strAwayTeam);
        const overUnder = generateSoccerOverUnder();
        const story = generateSoccerStory(match.strHomeTeam, match.strAwayTeam, scorePrediction, overUnder);

        await saveEPLRaffle(
          matchId,
          scorePrediction,
          overUnder,
          story,
          {
            home: match.strHomeTeam,
            away: match.strAwayTeam,
            league: "English Premier League",
            datetime: match.strTimestamp || (match.dateEvent && match.strTime ? `${match.dateEvent}T${match.strTime}Z` : null),
            venue: match.strVenue,
          }
        );

        generatedCount++;
      } catch (error) {
        console.error(`[EPL Auto-Predict] Error generating prediction for ${matchId}:`, error);
      }
    }

    console.log(`[EPL Auto-Predict] ✅ Successfully generated ${generatedCount} predictions`);

    return NextResponse.json({
      ok: true,
      message: `Generated ${generatedCount} predictions for locked EPL matches with purchases`,
      timestamp: nowUtc.toISOString(),
      generatedCount,
      matchCount: eplMatches.length,
      matches: eplMatches.map((m: any) => `${m.strHomeTeam} vs ${m.strAwayTeam}`),
    });

  } catch (err: any) {
    console.error('[EPL Auto-Predict] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

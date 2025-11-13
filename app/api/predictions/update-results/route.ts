// app/api/predictions/update-results/route.ts
/**
 * Updates prediction results based on final match scores
 * Called periodically to mark predictions as correct/incorrect
 */

import { NextResponse } from "next/server";
import { fetchLiveMatchData } from "@/lib/sportsFetcher";
import { getMatchResultsBatch } from "@/lib/footballDataAPI";
import { getNBAMatchResultsBatch } from "@/lib/nbaScoresAPI";
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');

async function readCache(): Promise<any> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function updatePredictionResult(eventId: string, finalMatch: any): Promise<boolean> {
  try {
    const raffleFile = path.join(process.cwd(), `data/raffle-${eventId}.json`);
    
    // Read prediction
    let prediction: any;
    try {
      const data = await fs.readFile(raffleFile, 'utf-8');
      prediction = JSON.parse(data);
    } catch {
      return false; // No prediction for this event
    }

    // Skip if already updated
    if (prediction.actualWinner !== null && prediction.isCorrect !== null) {
      return false;
    }

    // Determine actual winner
    const homeScore = finalMatch.homeScore;
    const awayScore = finalMatch.awayScore;
    const home = finalMatch.home;
    const away = finalMatch.away;

    if (homeScore === null || awayScore === null) {
      return false; // No score yet
    }

    let actualWinner: string;
    if (homeScore > awayScore) {
      actualWinner = home;
    } else if (awayScore > homeScore) {
      actualWinner = away;
    } else {
      actualWinner = "Draw"; // For ties in soccer
    }

    // Check if prediction was correct
    const predictedWinner = prediction.predictedWinner;
    const isCorrect = predictedWinner === actualWinner;

    // Update prediction with scores and status
    prediction.homeScore = homeScore;
    prediction.awayScore = awayScore;
    prediction.status = "FT"; // Full Time - match is finished
    prediction.actualWinner = actualWinner;
    prediction.isCorrect = isCorrect;
    prediction.updatedAt = new Date().toISOString();

    // Save updated prediction
    await fs.writeFile(raffleFile, JSON.stringify(prediction, null, 2), 'utf-8');

    console.log(`[UpdateResults] Event ${eventId}: ${home} ${homeScore}-${awayScore} ${away}, Predicted=${predictedWinner}, Actual=${actualWinner}, Correct=${isCorrect}`);
    return true;
  } catch (error) {
    console.error(`[UpdateResults] Error updating event ${eventId}:`, error);
    return false;
  }
}

export async function GET() {
  try {
    console.log('[UpdateResults] Starting prediction result update...');

    // Get all raffle files that need updating
    const dataDir = path.join(process.cwd(), 'data');
    const files = await fs.readdir(dataDir);
    const raffleFiles = files.filter(f => f.startsWith('raffle-') && f.endsWith('.json'));

    // Collect all unfinished predictions, separated by league
    const nbaMatches: Array<{ eventId: string; homeTeam: string; awayTeam: string }> = [];
    const soccerMatches: Array<{ eventId: string; homeTeam: string; awayTeam: string }> = [];
    
    for (const file of raffleFiles) {
      const eventId = file.replace('raffle-', '').replace('.json', '');
      try {
        const raffleFile = path.join(dataDir, file);
        const data = await fs.readFile(raffleFile, 'utf-8');
        const prediction = JSON.parse(data);

        // Only process if not already updated
        if (prediction.actualWinner === null && prediction.isCorrect === null) {
          const item = {
            eventId,
            homeTeam: prediction.matchDetails?.home || prediction.homeTeam || '',
            awayTeam: prediction.matchDetails?.away || prediction.awayTeam || '',
          };

          // Separate by league
          if (prediction.matchDetails?.league?.toUpperCase() === 'NBA') {
            nbaMatches.push(item);
          } else {
            soccerMatches.push(item);
          }
        }
      } catch (e) {
        // Skip if can't read
      }
    }

    if (nbaMatches.length === 0 && soccerMatches.length === 0) {
      console.log('[UpdateResults] No predictions to update');
      return NextResponse.json({ ok: true, updated: 0 });
    }

    console.log(`[UpdateResults] NBA: ${nbaMatches.length}, Soccer: ${soccerMatches.length}`);

    // Fetch results from appropriate APIs
    const allResults = new Map<string, any>();

    // NBA matches - match by team name only
    if (nbaMatches.length > 0) {
      console.log('[UpdateResults] Fetching NBA scores by team name...');
      const nbaResults = await getNBAMatchResultsBatch(
        nbaMatches.map(item => ({
          id: item.eventId,
          homeTeam: item.homeTeam,
          awayTeam: item.awayTeam,
        }))
      );
      for (const [key, value] of nbaResults) {
        allResults.set(key, value);
      }
    }

    // Soccer matches - use football-data.org (EPL/LaLiga)
    if (soccerMatches.length > 0) {
      console.log('[UpdateResults] Fetching soccer scores from football-data.org...');
      const soccerResults = await getMatchResultsBatch(
        soccerMatches.map(item => ({
          id: item.eventId,
          homeTeam: item.homeTeam,
          awayTeam: item.awayTeam,
        }))
      );
      for (const [key, value] of soccerResults) {
        allResults.set(key, value);
      }
    }

    // Update predictions with results
    let updated = 0;
    const allToUpdate = [...nbaMatches, ...soccerMatches];
    
    for (const item of allToUpdate) {
      const result = allResults.get(item.eventId);
      if (result && result.homeScore !== null && result.awayScore !== null) {
        const wasUpdated = await updatePredictionResult(item.eventId, {
          home: item.homeTeam,
          away: item.awayTeam,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
        });
        if (wasUpdated) updated++;
      }
    }

    console.log(`[UpdateResults] Updated ${updated} predictions`);
    return NextResponse.json({ ok: true, updated });
  } catch (error: any) {
    console.error('[UpdateResults] Error:', error);
    return NextResponse.json({ ok: false, error: String(error?.message ?? error) }, { status: 500 });
  }
}

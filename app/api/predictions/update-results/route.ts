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
import { createClient } from '@supabase/supabase-js';

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
    console.log('[UpdateResults] Starting match result update...');

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

    // Get all NBA matches from history that need result updates
    const { data: nbaHistoryMatches, error: nbaError } = await supabase
      .from('nba_matches_history')
      .select('*')
      .eq('status', 'waiting for result');

    if (nbaError) {
      console.error('[UpdateResults] Error fetching NBA history matches:', nbaError.message);
      return NextResponse.json({ ok: false, error: 'Failed to fetch NBA matches' }, { status: 500 });
    }

    // Get all soccer matches from local history files that need updates
    const soccerMatches: Array<{ eventId: string; homeTeam: string; awayTeam: string; league: string }> = [];

    // Check EPL history
    try {
      const eplHistoryPath = path.join(process.cwd(), 'data/epl_history.json');
      const eplData = JSON.parse(await fs.readFile(eplHistoryPath, 'utf-8'));
      if (eplData.matches) {
        for (const match of eplData.matches) {
          if (match.status === 'waiting for result' || !match.status || match.status === 'TBD') {
            soccerMatches.push({
              eventId: match.id,
              homeTeam: match.home,
              awayTeam: match.away,
              league: 'EPL'
            });
          }
        }
      }
    } catch (e) {
      console.warn('[UpdateResults] Could not read EPL history');
    }

    // Check LaLiga history
    try {
      const laligaHistoryPath = path.join(process.cwd(), 'data/laliga_history.json');
      const laligaData = JSON.parse(await fs.readFile(laligaHistoryPath, 'utf-8'));
      if (laligaData.matches) {
        for (const match of laligaData.matches) {
          if (match.status === 'waiting for result' || !match.status || match.status === 'TBD') {
            soccerMatches.push({
              eventId: match.id,
              homeTeam: match.home,
              awayTeam: match.away,
              league: 'LaLiga'
            });
          }
        }
      }
    } catch (e) {
      console.warn('[UpdateResults] Could not read LaLiga history');
    }

    const nbaMatches = nbaHistoryMatches?.map(match => ({
      eventId: match.event_id,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      league: 'NBA'
    })) || [];

    if (nbaMatches.length === 0 && soccerMatches.length === 0) {
      console.log('[UpdateResults] No matches to update');
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

    // Update matches with results
    let updated = 0;

    // Update NBA matches in Supabase
    for (const item of nbaMatches) {
      const result = allResults.get(item.eventId);
      if (result && result.homeScore !== null && result.awayScore !== null) {
        const { error: updateError } = await supabase
          .from('nba_matches_history')
          .update({
            home_score: result.homeScore,
            away_score: result.awayScore,
            status: 'FT'
          })
          .eq('event_id', item.eventId);

        if (!updateError) {
          console.log(`[UpdateResults] Updated NBA match ${item.eventId}: ${item.homeTeam} ${result.homeScore}-${result.awayScore} ${item.awayTeam}`);
          updated++;

          // Also update local raffle file if it exists
          await updatePredictionResult(item.eventId, {
            home: item.homeTeam,
            away: item.awayTeam,
            homeScore: result.homeScore,
            awayScore: result.awayScore,
          });
        } else {
          console.error(`[UpdateResults] Failed to update NBA match ${item.eventId}:`, updateError.message);
        }
      }
    }

    // Update soccer matches in local files
    for (const item of soccerMatches) {
      const result = allResults.get(item.eventId);
      if (result && result.homeScore !== null && result.awayScore !== null) {
        const historyFile = item.league === 'EPL' ? 'data/epl_history.json' : 'data/laliga_history.json';
        try {
          const historyPath = path.join(process.cwd(), historyFile);
          const historyData = JSON.parse(await fs.readFile(historyPath, 'utf-8'));

          // Find and update the match
          const matchIndex = historyData.matches.findIndex((m: any) => String(m.id) === String(item.eventId));
          if (matchIndex !== -1) {
            historyData.matches[matchIndex].homeScore = result.homeScore;
            historyData.matches[matchIndex].awayScore = result.awayScore;
            historyData.matches[matchIndex].status = 'FT';

            await fs.writeFile(historyPath, JSON.stringify(historyData, null, 2), 'utf-8');
            console.log(`[UpdateResults] Updated ${item.league} match ${item.eventId}: ${item.homeTeam} ${result.homeScore}-${result.awayScore} ${item.awayTeam}`);
            updated++;

            // Also update local raffle file if it exists
            await updatePredictionResult(item.eventId, {
              home: item.homeTeam,
              away: item.awayTeam,
              homeScore: result.homeScore,
              awayScore: result.awayScore,
            });
          }
        } catch (e) {
          console.error(`[UpdateResults] Failed to update ${item.league} match ${item.eventId}:`, e);
        }
      }
    }

    console.log(`[UpdateResults] Updated ${updated} matches with final results`);
    return NextResponse.json({ ok: true, updated });
  } catch (error: any) {
    console.error('[UpdateResults] Error:', error);
    return NextResponse.json({ ok: false, error: String(error?.message ?? error) }, { status: 500 });
  }
}

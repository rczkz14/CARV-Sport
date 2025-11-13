/**
 * Auto-Predict LaLiga Worker
 * Generates soccer predictions for locked LaLiga matches with purchases
 * Saves to both raffle files and predictions.json
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  generateSoccerScorePrediction,
  generateSoccerOverUnder,
  generateSoccerStory,
  getPredictionForMatch,
} from '@/lib/predictionGenerator';

async function saveToLaligaRaffle(
  eventId: string,
  prediction: {
    scorePrediction: string;
    overUnder: string;
    story: string;
  },
  matchData: any
) {
  const raffleFile = path.join(process.cwd(), `data/raffle-${eventId}.json`);

  const raffleData = {
    eventId,
    league: 'LaLiga',
    matchDetails: {
      home: matchData.home,
      away: matchData.away,
      league: 'Spanish La Liga',
      datetime: matchData.datetime,
      venue: matchData.venue || null,
    },
    prediction: prediction.overUnder,
    scorePrediction: prediction.scorePrediction,
    story: prediction.story,
    actualWinner: null,
    actualResult: null,
    isCorrect: null,
    actualTotalGoals: null,
    createdAt: new Date().toISOString(),
  };

  await fs.writeFile(raffleFile, JSON.stringify(raffleData, null, 2), 'utf-8');
  console.log(`[AutoPredictLaLiga] Saved prediction for match ${eventId}`);
}

async function addToPredictionsJSON(
  eventId: string,
  prediction: {
    scorePrediction: string;
    overUnder: string;
    story: string;
  },
  matchData: any
) {
  const predictionsFile = path.join(process.cwd(), 'data/predictions.json');

  let predictions: any[] = [];
  try {
    const content = await fs.readFile(predictionsFile, 'utf-8');
    predictions = JSON.parse(content);
  } catch {
    // File doesn't exist or is empty
    predictions = [];
  }

  const predictionEntry = {
    eventId,
    league: 'LaLiga',
    matchDetails: {
      home: matchData.home,
      away: matchData.away,
      league: 'Spanish La Liga',
      datetime: matchData.datetime,
    },
    prediction: prediction.overUnder,
    scorePrediction: prediction.scorePrediction,
    story: prediction.story,
    createdAt: new Date().toISOString(),
    isCorrect: null,
  };

  // Avoid duplicates
  const exists = predictions.some((p: any) => p.eventId === eventId);
  if (!exists) {
    predictions.push(predictionEntry);
    await fs.writeFile(predictionsFile, JSON.stringify(predictions, null, 2), 'utf-8');
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[AutoPredictLaLiga] Starting LaLiga prediction generation...');

    // Load selected matches
    const selectedPath = path.join(process.cwd(), 'data/selected_matches.json');
    const selectedData = JSON.parse(await fs.readFile(selectedPath, 'utf-8'));

    if (!selectedData.laliga || selectedData.laliga.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No LaLiga matches selected' },
        { status: 400 }
      );
    }

    console.log(`[AutoPredictLaLiga] Found ${selectedData.laliga.length} locked matches`);

    // Load API data
    const apiFetchPath = path.join(process.cwd(), 'data/api_fetch.json');
    const apiData = JSON.parse(await fs.readFile(apiFetchPath, 'utf-8'));

    // Load purchases
    const purchasesPath = path.join(process.cwd(), 'data/purchases.json');
    let purchases: any[] = [];
    try {
      purchases = JSON.parse(await fs.readFile(purchasesPath, 'utf-8'));
    } catch {
      purchases = [];
    }

    let generated = 0;
    const predictions: any[] = [];

    for (const matchId of selectedData.laliga) {
      try {
        // Check if purchase exists for this match
        const hasPurchase = purchases.some((p: any) => p.eventId === matchId);

        if (!hasPurchase) {
          console.log(`[AutoPredictLaLiga] No purchase for ${matchId}, skipping`);
          continue;
        }

        // Check if prediction already exists
        const existing = await getPredictionForMatch(matchId);
        if (existing) {
          console.log(`[AutoPredictLaLiga] Prediction already exists for ${matchId}`);
          continue;
        }

        // Find match in API data
        const match = apiData.laliga?.league?.find((m: any) => m.idEvent === matchId);
        if (!match) {
          console.log(`[AutoPredictLaLiga] Match ${matchId} not found in API data`);
          continue;
        }

        console.log(
          `[AutoPredictLaLiga] Generating prediction for ${match.strHomeTeam} vs ${match.strAwayTeam}...`
        );

        // Generate soccer prediction
        const scorePrediction = generateSoccerScorePrediction(
          match.strHomeTeam,
          match.strAwayTeam
        );
        const overUnder = generateSoccerOverUnder();
        const story = generateSoccerStory(
          match.strHomeTeam,
          match.strAwayTeam,
          scorePrediction,
          overUnder
        );

        const prediction = { scorePrediction, overUnder, story };

        // Save to raffle file
        await saveToLaligaRaffle(matchId, prediction, {
          home: match.strHomeTeam,
          away: match.strAwayTeam,
          datetime: match.dateEvent,
          venue: match.strVenue,
        });

        // Save to predictions.json
        await addToPredictionsJSON(matchId, prediction, {
          home: match.strHomeTeam,
          away: match.strAwayTeam,
          datetime: match.dateEvent,
        });

        predictions.push({
          id: matchId,
          home: match.strHomeTeam,
          away: match.strAwayTeam,
          prediction: overUnder,
        });

        generated++;
      } catch (error) {
        console.error(`[AutoPredictLaLiga] Error for match ${matchId}:`, error);
      }
    }

    console.log(`[AutoPredictLaLiga] Generated ${generated} predictions`);

    return NextResponse.json(
      {
        success: true,
        message: `Generated ${generated} LaLiga predictions`,
        generated,
        predictions,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[AutoPredictLaLiga] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

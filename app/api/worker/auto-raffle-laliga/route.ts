/**
 * Auto-Raffle LaLiga Worker
 * Scores LaLiga predictions based on actual Over/Under vs predicted
 * Marks matches as final (FT) and calculates accuracy
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

function parseOverUnder(prediction: string): number {
  const match = prediction.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 2.5;
}

function scoreOverUnder(
  prediction: string,
  actualTotalGoals: number
): { correct: boolean; reason: string } {
  const threshold = parseOverUnder(prediction);
  const isOver = prediction.toLowerCase().includes('over');

  if (isOver) {
    const correct = actualTotalGoals > threshold;
    return {
      correct,
      reason: correct
        ? `Over ${threshold} hit: ${actualTotalGoals} goals`
        : `Over ${threshold} missed: ${actualTotalGoals} goals`,
    };
  } else {
    const correct = actualTotalGoals < threshold;
    return {
      correct,
      reason: correct
        ? `Under ${threshold} hit: ${actualTotalGoals} goals`
        : `Under ${threshold} missed: ${actualTotalGoals} goals`,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('[AutoRaffleLaLiga] Starting LaLiga raffle scoring...');

    // Load selected matches
    const selectedPath = path.join(process.cwd(), 'data/selected_matches.json');
    const selectedData = JSON.parse(await fs.readFile(selectedPath, 'utf-8'));

    if (!selectedData.laliga || selectedData.laliga.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No LaLiga matches selected' },
        { status: 400 }
      );
    }

    // Load API data for final scores
    const apiFetchPath = path.join(process.cwd(), 'data/api_fetch.json');
    const apiData = JSON.parse(await fs.readFile(apiFetchPath, 'utf-8'));

    let scored = 0;
    let finalized = 0;
    const results: any[] = [];

    for (const matchId of selectedData.laliga) {
      try {
        const raffleFile = path.join(process.cwd(), `data/raffle-${matchId}.json`);

        // Check if raffle file exists
        let raffleData: any;
        try {
          raffleData = JSON.parse(await fs.readFile(raffleFile, 'utf-8'));
        } catch {
          console.log(`[AutoRaffleLaLiga] No raffle file for ${matchId}, skipping`);
          continue;
        }

        // Find match in API data
        const match = apiData.laliga?.league?.find((m: any) => m.idEvent === matchId);
        if (!match) {
          console.log(`[AutoRaffleLaLiga] Match ${matchId} not found in API`);
          continue;
        }

        // Check if match is finished (FT)
        if (match.strStatus !== 'Match Finished' && match.strStatus !== 'FT') {
          console.log(
            `[AutoRaffleLaLiga] Match ${matchId} not finished yet (${match.strStatus})`
          );
          continue;
        }

        // Get actual scores
        const homeScore = parseInt(match.intHomeScore) || 0;
        const awayScore = parseInt(match.intAwayScore) || 0;
        const totalGoals = homeScore + awayScore;

        // Determine actual winner
        let actualWinner: string;
        if (homeScore > awayScore) {
          actualWinner = match.strHomeTeam;
        } else if (awayScore > homeScore) {
          actualWinner = match.strAwayTeam;
        } else {
          actualWinner = 'Draw';
        }

        // Score the prediction based on winner comparison
        let isCorrect = false;
        if (raffleData.prediction && raffleData.prediction.predictedWinner) {
          isCorrect = actualWinner === raffleData.prediction.predictedWinner;
        }

        // Update raffle file
        raffleData.actualWinner = actualWinner;
        raffleData.actualResult = `${homeScore}-${awayScore}`;
        raffleData.isCorrect = isCorrect;
        raffleData.actualTotalGoals = totalGoals;
        raffleData.status = 'FT';

        await fs.writeFile(raffleFile, JSON.stringify(raffleData, null, 2), 'utf-8');

        // Trigger payout to winner (call the payout endpoint)
        try {
          const payoutResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/raffle/payout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.WORKER_API_KEY || 'test-key'}`,
            },
            body: JSON.stringify({
              eventId: matchId,
              winnersCount: 1,
              token: 'CARV'
            })
          });

          if (!payoutResponse.ok) {
            console.error(`[AutoRaffleLaLiga] Payout failed for ${matchId}:`, await payoutResponse.text());
          } else {
            console.log(`[AutoRaffleLaLiga] ✅ Payout triggered for ${matchId}`);
          }
        } catch (payoutErr) {
          console.error(`[AutoRaffleLaLiga] Payout error for ${matchId}:`, payoutErr);
        }

        console.log(
          `[AutoRaffleLaLiga] Scored ${raffleData.matchDetails.home} vs ${raffleData.matchDetails.away}: Predicted ${raffleData.prediction.predictedWinner}, Actual ${actualWinner} = ${isCorrect ? 'WIN' : 'LOSS'}`
        );

        results.push({
          id: matchId,
          home: raffleData.matchDetails.home,
          away: raffleData.matchDetails.away,
          prediction: raffleData.prediction.predictedWinner,
          actual: `${homeScore}-${awayScore}`,
          correct: isCorrect,
        });

        scored++;
        if (isCorrect) finalized++;
      } catch (error) {
        console.error(`[AutoRaffleLaLiga] Error scoring ${matchId}:`, error);
      }
    }

    console.log(`[AutoRaffleLaLiga] Scored ${scored} matches, ${finalized} correct`);

    return NextResponse.json(
      {
        success: true,
        message: `Processed ${scored} LaLiga matches`,
        scored,
        correct: finalized,
        results,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[AutoRaffleLaLiga] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

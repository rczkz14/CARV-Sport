/**
 * Analytics Predictions API
 * Returns prediction accuracy data by comparing predictions vs actual results
 */

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const nba = searchParams.get('nba') === 'true';
    const soccer = searchParams.get('soccer') === 'true';
    const includePending = searchParams.get('includePending') === 'true';

    const results: any[] = [];

    if (nba) {
      // Get NBA predictions
      const { data: nbaPredictions, error: nbaError } = await supabase
        .from('nba_predictions')
        .select('*');

      if (nbaError) {
        console.error('NBA predictions error:', nbaError);
      } else if (nbaPredictions) {
        for (const pred of nbaPredictions) {
          // Get corresponding match result
          const { data: matchHistory, error: historyError } = await supabase
            .from('nba_matches_history')
            .select('*')
            .eq('event_id', pred.event_id)
            .single();

          const hasResult = !historyError && matchHistory && matchHistory.status === 'FT' &&
              matchHistory.home_score !== null && matchHistory.away_score !== null;

          if (includePending || hasResult) {
            let actualWinner: string | null = null;
            let actualScore: string | null = null;
            let isCorrect: boolean | null = null;

            if (hasResult) {
              // Determine actual winner
              if (matchHistory.home_score > matchHistory.away_score) {
                actualWinner = matchHistory.home_team;
              } else if (matchHistory.away_score > matchHistory.home_score) {
                actualWinner = matchHistory.away_team;
              } else {
                actualWinner = 'Draw';
              }

              // Check if prediction was correct
              isCorrect = pred.prediction_winner === actualWinner;
              actualScore = `${matchHistory.home_score}-${matchHistory.away_score}`;
            }

            results.push({
              event_id: pred.event_id,
              league: matchHistory?.league || 'NBA',
              predicted_winner: pred.prediction_winner,
              actual_winner: actualWinner,
              actual_score: actualScore,
              is_correct: isCorrect,
              prediction_text: pred.prediction_text,
              created_at: pred.created_at
            });
          }
        }
      }
    }

    if (soccer) {
      // Get Soccer predictions
      const { data: soccerPredictions, error: soccerError } = await supabase
        .from('soccer_predictions')
        .select('*');

      if (soccerError) {
        console.error('Soccer predictions error:', soccerError);
      } else if (soccerPredictions) {
        for (const pred of soccerPredictions) {
          // Get corresponding match result
          const { data: matchHistory, error: historyError } = await supabase
            .from('soccer_matches_history')
            .select('*')
            .eq('event_id', pred.event_id)
            .single();

          const hasResult = !historyError && matchHistory && matchHistory.status === 'FT' &&
              matchHistory.home_score !== null && matchHistory.away_score !== null;

          if (includePending || hasResult) {
            let actualWinner: string | null = null;
            let actualScore: string | null = null;
            let isCorrect: boolean | null = null;

            if (hasResult) {
              // Determine actual winner
              if (matchHistory.home_score > matchHistory.away_score) {
                actualWinner = matchHistory.home_team;
              } else if (matchHistory.away_score > matchHistory.home_score) {
                actualWinner = matchHistory.away_team;
              } else {
                actualWinner = 'Draw';
              }

              // Check if prediction was correct
              isCorrect = pred.prediction_winner === actualWinner;
              actualScore = `${matchHistory.home_score}-${matchHistory.away_score}`;
            }

            results.push({
              event_id: pred.event_id,
              league: matchHistory?.league || 'Soccer',
              predicted_winner: pred.prediction_winner,
              actual_winner: actualWinner,
              actual_score: actualScore,
              is_correct: isCorrect,
              prediction_text: pred.prediction_text,
              created_at: pred.created_at
            });
          }
        }
      }
    }

    console.log(`Analytics: Returning ${results.length} predictions (${nba ? 'NBA' : ''} ${soccer ? 'Soccer' : ''})`);

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Analytics predictions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prediction analytics' },
      { status: 500 }
    );
  }
}
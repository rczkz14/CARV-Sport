/**
 * Auto-Raffle EPL Worker
 * Triggers at 15:00 WIB (08:00 UTC)
 * Finalizes EPL raffles that have reached FT status
 * 
 * Scoring: Based on Over/Under prediction vs actual total goals
 */

import { NextResponse } from "next/server";
import { isAutoRaffleTimeEPL, getEPLWindowStatus } from "@/lib/eplWindowManager";
import { saveToEPLHistory } from "@/lib/predictionGenerator";
import { promises as fs } from 'fs';
import path from 'path';

async function readCache(): Promise<any> {
  try {
    const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[EPL Auto-Raffle] Error reading cache:', error);
    return null;
  }
}

async function getRaffleData(matchId: string): Promise<any> {
  try {
    const filePath = path.join(process.cwd(), `data/raffle-${matchId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function updateRaffleData(matchId: string, updates: any): Promise<void> {
  try {
    const filePath = path.join(process.cwd(), `data/raffle-${matchId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    
    // Merge updates
    Object.assign(parsed, updates);
    
    await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
    console.log(`[EPL Auto-Raffle] Updated raffle for ${matchId}`);
  } catch (error) {
    console.error(`[EPL Auto-Raffle] Error updating raffle ${matchId}:`, error);
  }
}

export async function GET(req: Request) {
  try {
    const nowUtc = new Date();
    
    // Check authorization header
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key');
    const expectedKey = process.env.WORKER_API_KEY || 'test-key';
    
    if (authHeader !== `Bearer ${expectedKey}` && authHeader !== expectedKey) {
      console.warn('[EPL Auto-Raffle] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const windowStatus = getEPLWindowStatus(nowUtc);
    console.log(`[EPL Auto-Raffle] Called at ${nowUtc.toISOString()} UTC (${windowStatus.wibHour}:00 WIB)`);

    // Check if we're within the auto-raffle window (08:00-08:05 UTC = 15:00-15:05 WIB)
    const isValidTime = isAutoRaffleTimeEPL(nowUtc);
    if (!isValidTime) {
      console.warn(`[EPL Auto-Raffle] Called at wrong time. Current UTC hour: ${windowStatus.utcHour}, expected: 8`);
      console.log('[EPL Auto-Raffle] Proceeding anyway (manual trigger allowed)');
    }

    // 1. Read cache to get match data
    const cachedData = await readCache();
    if (!cachedData) {
      return NextResponse.json({ ok: false, error: "Cache not available" }, { status: 503 });
    }

    // Build match lookup map
    const matchMap = new Map<string, any>();
    if (cachedData.epl?.daily) {
      cachedData.epl.daily.forEach((m: any) => {
        if (m.idEvent) matchMap.set(String(m.idEvent), m);
      });
    }
    if (cachedData.epl?.league) {
      cachedData.epl.league.forEach((m: any) => {
        if (m.idEvent) matchMap.set(String(m.idEvent), m);
      });
    }

    // 2. Find all raffle files with league="EPL"
    let processedCount = 0;
    let finalizedCount = 0;

    try {
      const dataPath = path.join(process.cwd(), 'data');
      const files = await fs.readdir(dataPath);
      const raffleFiles = files.filter(f => f.startsWith('raffle-') && f.endsWith('.json'));

      console.log(`[EPL Auto-Raffle] Found ${raffleFiles.length} raffle files`);

      for (const file of raffleFiles) {
        const matchId = file.replace('raffle-', '').replace('.json', '');
        const raffleData = await getRaffleData(matchId);

        // Only process EPL raffles
        if (raffleData?.league !== 'EPL') continue;

        processedCount++;
        console.log(`[EPL Auto-Raffle] Processing raffle for ${matchId}...`);

        // Skip if already finalized
        if (raffleData.isCorrect !== null && raffleData.actualWinner) {
          console.log(`[EPL Auto-Raffle] Already finalized: ${matchId}`);
          continue;
        }

        // Get match data
        const matchData = matchMap.get(String(matchId));
        if (!matchData) {
          console.warn(`[EPL Auto-Raffle] Match data not found: ${matchId}`);
          continue;
        }

        // Check if match has FT status
        const status = String(matchData.strStatus || '').toUpperCase();
        if (status !== 'FT') {
          console.log(`[EPL Auto-Raffle] Match ${matchId} not FT yet (status: ${status})`);
          continue;
        }

        // Get actual score
        const homeScore = matchData.intHomeScore !== null ? parseInt(matchData.intHomeScore) : null;
        const awayScore = matchData.intAwayScore !== null ? parseInt(matchData.intAwayScore) : null;

        if (homeScore === null || awayScore === null) {
          console.warn(`[EPL Auto-Raffle] No final score for ${matchId}`);
          continue;
        }

        const totalGoals = homeScore + awayScore;
        console.log(`[EPL Auto-Raffle] ${matchData.strHomeTeam} ${homeScore}-${awayScore} ${matchData.strAwayTeam} (total: ${totalGoals})`);

        // Determine actual winner
        let actualWinner: string;
        if (homeScore > awayScore) {
          actualWinner = matchData.strHomeTeam;
        } else if (awayScore > homeScore) {
          actualWinner = matchData.strAwayTeam;
        } else {
          actualWinner = 'Draw';
        }

        // Score the raffle based on winner prediction vs actual winner
        const prediction = raffleData.prediction;
        let isCorrect = false;

        if (prediction && prediction.predictedWinner) {
          isCorrect = actualWinner === prediction.predictedWinner;
          console.log(`[EPL Auto-Raffle] Predicted: ${prediction.predictedWinner}, Actual: ${actualWinner} = ${isCorrect ? 'WIN' : 'LOSS'}`);
        }

        // Update raffle with results
        await updateRaffleData(matchId, {
          actualWinner,
          actualResult: `${homeScore}-${awayScore}`,
          actualTotalGoals: totalGoals,
          isCorrect,
          finalizedAt: new Date().toISOString(),
        });

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
            console.error(`[EPL Auto-Raffle] Payout failed for ${matchId}:`, await payoutResponse.text());
          } else {
            console.log(`[EPL Auto-Raffle] ✅ Payout triggered for ${matchId}`);
          }
        } catch (payoutErr) {
          console.error(`[EPL Auto-Raffle] Payout error for ${matchId}:`, payoutErr);
        }

        // Save to history
        await saveToEPLHistory({
          id: matchId,
          home: matchData.strHomeTeam,
          away: matchData.strAwayTeam,
          league: 'EPL',
          datetime: matchData.strTimestamp,
          venue: matchData.strVenue,
          homeScore,
          awayScore,
          status: 'FT',
        });

        finalizedCount++;
      }
    } catch (e) {
      console.error('[EPL Auto-Raffle] Error processing raffles:', e);
    }

    console.log(`[EPL Auto-Raffle] ✅ Processed ${processedCount} EPL raffles, finalized ${finalizedCount}`);

    return NextResponse.json({
      ok: true,
      message: `Processed ${processedCount} EPL raffles, finalized ${finalizedCount}`,
      timestamp: nowUtc.toISOString(),
      processedCount,
      finalizedCount,
    });

  } catch (err: any) {
    console.error('[EPL Auto-Raffle] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

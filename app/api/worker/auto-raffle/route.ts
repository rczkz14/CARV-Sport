/**
 * Auto-Raffle Worker
 * Triggers at 15:00 WIB (08:00 UTC)
 * Automatically finalizes and runs raffle for matches with FT status
 */

import { NextResponse } from "next/server";
import { promises as fs } from 'fs';
import path from 'path';

async function readCache(): Promise<any> {
  try {
    const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Auto-Raffle] Error reading cache:', error);
    return null;
  }
}

async function readRaffleFile(matchId: string): Promise<any> {
  try {
    const filePath = path.join(process.cwd(), `data/raffle-${matchId}.json`);
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

async function saveRaffleFile(matchId: string, data: any): Promise<void> {
  const filePath = path.join(process.cwd(), `data/raffle-${matchId}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET(req: Request) {
  try {
    const nowUtc = new Date();
    
    // Check authorization
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key');
    const expectedKey = process.env.WORKER_API_KEY || 'test-key';
    
    if (authHeader !== `Bearer ${expectedKey}` && authHeader !== expectedKey) {
      console.warn('[Auto-Raffle] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const utcHour = nowUtc.getUTCHours();
    const utcMinute = nowUtc.getUTCMinutes();
    const wibHour = (utcHour + 7) % 24;
    
    console.log(`[Auto-Raffle] Called at ${nowUtc.toISOString()} UTC (${wibHour}:00 WIB)`);

    // Check if we're within auto-raffle window (08:00-08:05 UTC = 15:00-15:05 WIB)
    const isValidTime = utcHour === 8 && utcMinute < 5;
    if (!isValidTime) {
      console.warn(`[Auto-Raffle] Called at wrong time. Current UTC hour: ${utcHour}, expected: 8`);
      console.log('[Auto-Raffle] Proceeding anyway (manual trigger allowed)');
    }

    // 1. Get all raffle files
    const dataPath = path.join(process.cwd(), 'data');
    const files = await fs.readdir(dataPath);
    const raffleFiles = files.filter(f => f.startsWith('raffle-') && f.endsWith('.json'));
    
    if (raffleFiles.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No raffle files to finalize",
        finalizedCount: 0
      });
    }

    // 2. Get match data from cache
    const cachedData = await readCache();
    if (!cachedData) {
      return NextResponse.json({ ok: false, error: "Cache not available" }, { status: 503 });
    }

    // Create map of all matches by ID
    const matchMap = new Map<string, any>();
    if (cachedData.nba?.daily && Array.isArray(cachedData.nba.daily)) {
      cachedData.nba.daily.forEach((m: any) => {
        if (m.idEvent) matchMap.set(String(m.idEvent), m);
      });
    }
    if (cachedData.nba?.league && Array.isArray(cachedData.nba.league)) {
      cachedData.nba.league.forEach((m: any) => {
        if (m.idEvent && !matchMap.has(String(m.idEvent))) {
          matchMap.set(String(m.idEvent), m);
        }
      });
    }

    // 3. Process each raffle file
    let finalizedCount = 0;
    const finalizedMatches: string[] = [];

    for (const file of raffleFiles) {
      const matchId = file.replace('raffle-', '').replace('.json', '');
      const raffleData = await readRaffleFile(matchId);
      
      if (!raffleData) continue;

      // Check if already finalized
      if (raffleData.actualWinner || raffleData.finalizedAt) {
        console.log(`[Auto-Raffle] Match ${matchId} already finalized`);
        continue;
      }

      // Get match data
      const matchData = matchMap.get(matchId);
      if (!matchData) {
        console.warn(`[Auto-Raffle] Match ${matchId} not found in cache`);
        continue;
      }

      // Check if match has FT status
      const status = String(matchData.strStatus || '').toLowerCase();
      if (!status.includes('ft') && !status.includes('final') && !status.includes('finished')) {
        console.log(`[Auto-Raffle] Match ${matchId} status: ${status} (not FT yet)`);
        continue;
      }

      // Extract scores
      const homeScore = matchData.intHomeScore;
      const awayScore = matchData.intAwayScore;

      if (homeScore === null || awayScore === null || homeScore === undefined || awayScore === undefined) {
        console.warn(`[Auto-Raffle] Match ${matchId} has no scores yet (homeScore: ${homeScore}, awayScore: ${awayScore})`);
        continue;
      }

      // Determine actual winner
      const homeName = matchData.strHomeTeam;
      const awayName = matchData.strAwayTeam;
      const actualWinner = homeScore > awayScore ? homeName : awayScore > homeScore ? awayName : 'Draw';

      // Update raffle file with results
      raffleData.actualWinner = actualWinner;
      raffleData.actualResult = `${homeScore}-${awayScore}`;
      raffleData.homeScore = homeScore;
      raffleData.awayScore = awayScore;
      raffleData.status = status;
      raffleData.isCorrect = actualWinner === raffleData.prediction.predictedWinner;
      raffleData.finalizedAt = new Date().toISOString();

      await saveRaffleFile(matchId, raffleData);

      // 4. Trigger payout to winner (call the payout endpoint)
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
          console.error(`[Auto-Raffle] Payout failed for ${matchId}:`, await payoutResponse.text());
        } else {
          console.log(`[Auto-Raffle] ✅ Payout triggered for ${matchId}`);
        }
      } catch (payoutErr) {
        console.error(`[Auto-Raffle] Payout error for ${matchId}:`, payoutErr);
      }

      finalizedCount++;
      finalizedMatches.push(`${homeName} ${homeScore}-${awayScore} ${awayName}`);
      console.log(`[Auto-Raffle] ✅ Finalized ${matchId}: ${raffleData.isCorrect ? 'CORRECT' : 'INCORRECT'}`);
    }

    console.log(`[Auto-Raffle] Successfully finalized ${finalizedCount} matches`);

    return NextResponse.json({
      ok: true,
      message: `Finalized ${finalizedCount} matches with FT status`,
      timestamp: nowUtc.toISOString(),
      finalizedCount,
      matches: finalizedMatches,
    });

  } catch (err: any) {
    console.error('[Auto-Raffle] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

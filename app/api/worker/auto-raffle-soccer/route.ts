/**
 * Auto-Raffle Soccer Worker
 * Triggers at 15:00 WIB (08:00 UTC)
 * Processes raffle payouts for soccer matches
 */

import { NextResponse } from "next/server";
import { isAutoRaffleTimeSoccer, getSoccerWindowStatus } from "@/lib/soccerWindowManager";
import { supabase } from "@/lib/supabaseClient";

export async function GET(req: Request) {
  try {
    const nowUtc = new Date();

    // Check authorization header
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key');
    const expectedKey = process.env.WORKER_API_KEY || 'test-key';

    if (authHeader !== `Bearer ${expectedKey}` && authHeader !== expectedKey) {
      console.warn('[Auto-Raffle Soccer] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const windowStatus = getSoccerWindowStatus(nowUtc);
    console.log(`[Auto-Raffle Soccer] Called at ${nowUtc.toISOString()} UTC (${windowStatus.wibHour}:00 WIB)`);

    // Check if we're within the auto-raffle window (08:00-08:05 UTC = 15:00-15:05 WIB)
    const isValidTime = isAutoRaffleTimeSoccer(nowUtc);
    if (!isValidTime) {
      console.warn(`[Auto-Raffle Soccer] Called at wrong time. Current UTC hour: ${windowStatus.utcHour}, expected: 8`);
      console.log('[Auto-Raffle Soccer] Proceeding anyway (manual trigger allowed)');
    }

    // Query FT matches from soccer_matches_history (like NBA)
    const { data: ftMatches, error: matchesError } = await supabase
      .from('soccer_matches_history')
      .select('*')
      .or('status.ilike.%finished%,status.ilike.%final%,status.ilike.%ft%,status.ilike.%completed%,status.ilike.%FT%')
      .or('home_score.not.is.null,away_score.not.is.null');

    if (matchesError) {
      console.error('[Auto-Raffle Soccer] Matches query error:', matchesError);
      return NextResponse.json({ ok: false, error: "Database error" }, { status: 500 });
    }

    if (!ftMatches || ftMatches.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No FT matches to process",
        processedCount: 0
      });
    }

    let processedCount = 0;
    const processedMatches: string[] = [];

    for (const match of ftMatches) {
      const eventId = String(match.event_id);

      // Check if raffle already exists
      const { data: existingRaffle } = await supabase
        .from('soccer_raffle')
        .select('id')
        .eq('event_id', eventId)
        .single();

      if (existingRaffle) {
        console.log(`[Auto-Raffle Soccer] Raffle already exists for ${eventId}`);
        continue;
      }

      // Query purchases for this event (like NBA)
      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases')
        .select('buyer')
        .eq('event_id', eventId);

      if (purchasesError) {
        console.error(`[Auto-Raffle Soccer] Purchases query error for ${eventId}:`, purchasesError);
        continue;
      }

      if (!purchases || purchases.length === 0) {
        console.log(`[Auto-Raffle Soccer] No purchases for ${eventId}`);
        continue;
      }

      const buyers = purchases.map((p: any) => p.buyer);

      // Select random winner (like NBA)
      const winner = buyers[Math.floor(Math.random() * buyers.length)];

      // Calculate prize (like NBA)
      const entryFee = 1;
      const prizePool = buyers.length * entryFee;
      const winnerPayout = prizePool * 0.8;

      // Trigger payout (like NBA)
      try {
        const payoutResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}/api/raffle/payout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.WORKER_API_KEY || 'test-key'}`,
          },
          body: JSON.stringify({
            eventId,
            winner,
            winnersCount: 1,
            token: 'CARV'
          })
        });

        if (!payoutResponse.ok) {
          console.error(`[Auto-Raffle Soccer] Payout failed for ${eventId}:`, await payoutResponse.text());
        } else {
          console.log(`[Auto-Raffle Soccer] ✅ Payout triggered for ${eventId}`);
          processedCount++;
          processedMatches.push(`${match.home_team} vs ${match.away_team}`);
        }
      } catch (payoutErr) {
        console.error(`[Auto-Raffle Soccer] Payout error for ${eventId}:`, payoutErr);
      }
    }

    console.log(`[Auto-Raffle Soccer] ✅ Successfully processed ${processedCount} raffle entries`);

    return NextResponse.json({
      ok: true,
      message: `Processed ${processedCount} soccer raffle entries`,
      timestamp: nowUtc.toISOString(),
      processedCount,
      matchesProcessed: ftMatches.length,
    });

  } catch (err: any) {
    console.error('[Auto-Raffle Soccer] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
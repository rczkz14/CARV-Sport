/**
 * Auto-Raffle Worker
 * Triggers at 15:00 WIB (08:00 UTC)
 * Automatically runs raffle for NBA matches with FT or AOT status
 */

import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

async function processRaffles(historyTable: string, raffleTable: string, league: string) {
  // Query all matches from history table and filter for finished ones
  const { data: allMatches, error: matchesError } = await supabase
    .from(historyTable)
    .select('*');

  if (matchesError) {
    console.error(`[Auto-Raffle ${league}] Matches query error:`, matchesError);
    return { processedCount: 0, matches: [] };
  }

  // Filter for finished matches
  const ftMatches = (allMatches || []).filter(match => {
    const status = String(match.status || '').replace(/\s+/g, '').toLowerCase();
    return status.includes('final') || status === 'ft' || status === 'aot';
  });

  if (!ftMatches || ftMatches.length === 0) {
    console.log(`[Auto-Raffle ${league}] No finished matches to process`);
    return { processedCount: 0, matches: [] };
  }

  let processedCount = 0;
  const processedMatches: string[] = [];

  for (const match of ftMatches) {
    const eventId = String(match.event_id || match.idEvent);

    // Check if raffle already exists
    const { data: existingRaffle } = await supabase
      .from(raffleTable)
      .select('id')
      .eq('event_id', eventId)
      .single();

    if (existingRaffle) {
      console.log(`[Auto-Raffle ${league}] Raffle already exists for ${eventId}`);
      continue;
    }

    // Query purchases for this event
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('buyer')
      .eq('eventid', eventId);

    if (purchasesError) {
      console.error(`[Auto-Raffle ${league}] Purchases query error for ${eventId}:`, purchasesError);
      continue;
    }

    if (!purchases || purchases.length === 0) {
      console.log(`[Auto-Raffle ${league}] No purchases for ${eventId}`);
      continue;
    }

    // Update purchases created_at to raffle start time
    const { error: updateError } = await supabase
      .from('purchases')
      .update({ created_at: new Date().toISOString() })
      .eq('eventid', eventId);

    if (updateError) {
      console.error(`[Auto-Raffle ${league}] Failed to update purchases created_at for ${eventId}:`, updateError);
      // Continue anyway
    }

    const buyers = purchases.map((p: any) => p.buyer);

    // Select random winner
    const winner = buyers[Math.floor(Math.random() * buyers.length)];

    // Calculate prize
    const entryFee = 1;
    const prizePool = buyers.length * entryFee;
    const winnerPayout = prizePool * 0.8;

    // Insert raffle record
    const { error: insertError } = await supabase
      .from(raffleTable)
      .insert({
        event_id: eventId,
        winner,
        buyer_count: buyers.length,
        prize_pool: prizePool,
        winner_payout: winnerPayout,
        home_team: match.home_team,
        away_team: match.away_team,
        match_date: match.event_date,
        league: league,
      });

    if (insertError) {
      console.error(`[Auto-Raffle ${league}] Failed to insert raffle for ${eventId}:`, insertError);
      continue;
    }

    // Trigger payout
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
        console.error(`[Auto-Raffle ${league}] Payout failed for ${eventId}:`, await payoutResponse.text());
      } else {
        console.log(`[Auto-Raffle ${league}] ✅ Payout triggered for ${eventId}`);
        processedCount++;
        processedMatches.push(`${match.home_team} vs ${match.away_team}`);
      }
    } catch (payoutErr) {
      console.error(`[Auto-Raffle ${league}] Payout error for ${eventId}:`, payoutErr);
    }
  }

  return { processedCount, matches: processedMatches };
}

export async function GET(req: Request) {
  try {
    const nowUtc = new Date();
    
    // Check authorization
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key');
    const expectedKey = process.env.WORKER_API_KEY || 'event-asu';
    
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

    // Process NBA raffles
    console.log('[Auto-Raffle] Processing NBA raffles...');
    const nbaResult = await processRaffles('nba_matches_history', 'nba_raffle', 'NBA');

    // Process Soccer raffles
    console.log('[Auto-Raffle] Processing Soccer raffles...');
    const soccerResult = await processRaffles('soccer_matches_history', 'soccer_raffle', 'Soccer');

    const totalProcessed = nbaResult.processedCount + soccerResult.processedCount;
    const allMatches = [...nbaResult.matches, ...soccerResult.matches];

    console.log(`[Auto-Raffle] Successfully processed ${totalProcessed} matches`);

    return NextResponse.json({
      ok: true,
      message: `Processed ${totalProcessed} matches (${nbaResult.processedCount} NBA, ${soccerResult.processedCount} Soccer)`,
      timestamp: nowUtc.toISOString(),
      processedCount: totalProcessed,
      nbaProcessed: nbaResult.processedCount,
      soccerProcessed: soccerResult.processedCount,
      matches: allMatches,
    });

  } catch (err: any) {
    console.error('[Auto-Raffle] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

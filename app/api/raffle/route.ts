import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../../../lib/supabaseClient";

function pickRandom<T>(arr: T[]) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

interface RaffleResult {
  eventid: string;
  matchDetails: {
    home: string;
    away: string;
    league: string;
  };
  winner: string;
  prize: number;
  timestamp: string;
  participantCount: number;
  txHash?: string | null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const eventid = url.searchParams.get('eventid');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    // If eventId is specified, return prediction correctness and match details from Supabase only
    if (eventid) {
      // Try NBA
      let matchDetails = null;
      let predictedWinner = null;
      let isCorrect = null;
      let actualWinner = null;
      // Get match details and winner
      const { data: matchData } = await supabase
        .from('nba_matches_history')
        .select('home_team, away_team, winner, home_score, away_score, status')
        .eq('event_id', eventid)
        .single();
      if (matchData) {
        matchDetails = {
          home: matchData.home_team,
          away: matchData.away_team,
          league: 'NBA',
          homeScore: matchData.home_score,
          awayScore: matchData.away_score,
          status: matchData.status
        };
        // Compute actual winner if missing
        if (matchData.winner) {
          actualWinner = matchData.winner;
        } else if (
          (matchData.status && ["FT", "final"].includes(matchData.status.toLowerCase())) &&
          typeof matchData.home_score === "number" && typeof matchData.away_score === "number"
        ) {
          if (matchData.home_score > matchData.away_score) {
            actualWinner = matchData.home_team;
          } else if (matchData.away_score > matchData.home_score) {
            actualWinner = matchData.away_team;
          } else {
            actualWinner = "Draw";
          }
        }
      } else {
        matchDetails = {
          home: "Unknown Team",
          away: "Unknown Team",
          league: 'NBA'
        };
      }
      // Get prediction winner
      const { data: nbaPred } = await supabase
        .from('nba_predictions')
        .select('prediction_text')
        .eq('event_id', eventid)
        .single();
      if (nbaPred && nbaPred.prediction_text) {
        const lines = nbaPred.prediction_text.split('\n');
        const winnerLine = lines.find((l: string) => l.toLowerCase().includes('predicted winner'));
        if (winnerLine) {
          predictedWinner = winnerLine.split(':')[1]?.trim();
        }
      }
      if (predictedWinner && actualWinner) {
        isCorrect = predictedWinner.toLowerCase() === String(actualWinner).toLowerCase();
      }
      return NextResponse.json({
        ok: true,
        result: {
          matchDetails,
          predictedWinner,
          actualWinner,
          isCorrect
        }
      });
    }

    // Otherwise, return all raffles with pagination
    const { data: nbaRaffles, error: nbaError } = await supabase
      .from('nba_raffle')
      .select('*')
      .order('created_at', { ascending: false });

    const { data: soccerRaffles, error: soccerError } = await supabase
      .from('soccer_raffle')
      .select('*')
      .order('created_at', { ascending: false });

    if (nbaError || soccerError) {
      console.error('Raffles query error:', nbaError || soccerError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Combine and sort all raffles
    const allRaffles = [
      ...(nbaRaffles || []).map(r => ({ ...r, league: 'NBA', matchTable: 'nba_matches_history' })),
      ...(soccerRaffles || []).map(r => ({ ...r, league: 'Soccer', matchTable: 'soccer_matches_history' }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = allRaffles.length;
    const offset = (page - 1) * limit;
    const paginatedRaffles = allRaffles.slice(offset, offset + limit);

    // Enrich with match details
    const enrichedRaffles = [];
    for (const raffle of paginatedRaffles) {
        const { data: match } = await supabase
          .from(raffle.matchTable)
          .select('strHomeTeam, strAwayTeam')
          .eq('event_id', raffle.event_id)
          .single();

      const matchDetails = match ? {
        home: match.strHomeTeam,
        away: match.strAwayTeam,
        league: raffle.league
      } : {
        home: "Unknown Team",
        away: "Unknown Team",
        league: raffle.league
      };

      enrichedRaffles.push({
        ...raffle,
        matchDetails,
        winner: raffle.winner,
        prize: raffle.winner_payout,
        timestamp: raffle.created_at,
        participantCount: raffle.buyer_count,
        txHash: raffle.tx_hash
      });
    }

    return NextResponse.json({
      ok: true,
      raffles: enrichedRaffles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (e) {
    console.error("Error in raffle GET:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const { eventid, winnersCount = 1, token = "CARV" } = body;
    if (!eventid) {
      return NextResponse.json({ error: "eventid required" }, { status: 400 });
    }

    // Check if raffle already exists for this event
    const { data: existingRaffle } = await supabase
      .from('nba_raffle')
      .select('id')
      .eq('event_id', eventid)
      .single();

    if (existingRaffle) {
      return NextResponse.json({
        error: "raffle already completed for this event",
        existing: existingRaffle
      }, { status: 400 });
    }

    // Verify the match is actually finished
    const { data: match } = await supabase
      .from('nba_matches_history')
      .select('event_id, home_team, away_team, status, event_date')
      .eq('event_id', eventid)
      .single();

    if (!match) {
      return NextResponse.json({ error: "match not found" }, { status: 404 });
    }

    const status = String(match.status || '').replace(/\s+/g, '').toLowerCase();
    if (!(status.includes('final') || status === 'ft')) {
      return NextResponse.json({
        error: "match is not finished yet (not FT/final status)"
      }, { status: 400 });
    }

    // Query purchases for this event
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('*')
      .eq('eventid', eventid);

    if (purchasesError) {
      console.error('Purchases query error:', purchasesError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!purchases || purchases.length === 0) {
      return NextResponse.json({ error: "no entries for event" }, { status: 400 });
    }

    // Update purchases created_at to raffle start time
    const { error: updateError } = await supabase
      .from('purchases')
      .update({ created_at: new Date().toISOString() })
      .eq('eventid', eventid);

    if (updateError) {
      console.error('Failed to update purchases created_at:', updateError);
      // Continue anyway
    }

    const entries = purchases;

    // choose unique winners up to winnersCount
    const winners: string[] = [];
    const chosenIndices = new Set<number>();
    const maxW = Math.min(Number(winnersCount) || 1, entries.length);
    while (winners.length < maxW) {
      const idx = Math.floor(Math.random() * entries.length);
      if (chosenIndices.has(idx)) continue;
      chosenIndices.add(idx);
      winners.push(String(entries[idx].buyer));
    }

    // Calculate prize
    const entryFee = 1;
    const prizePool = entries.length * entryFee;
    const winnerPayout = prizePool * 0.8;

    // create raffle record
    const now = new Date().toISOString();
    const rec = {
      id: `${eventid}-${uuidv4()}`,
      eventid: String(eventid),
      date: now.slice(0, 10), // YYYY-MM-DD (UTC)
      winners,
      buyerCount: entries.length,
      entries: entries.map(e => ({ id: e.id, buyer: e.buyer, txid: e.txid, timestamp: e.timestamp })),
      token,
      created_at: now,
      prizePool,
      winnerPayout
    };

    // Insert to raffles table
    // Convert event_date to YYYY-MM-DD string for match_date
    const raffleRecord = {
      event_id: rec.eventid,
      winner: rec.winners[0],
      buyer_count: Number(rec.buyerCount),
      prize_pool: Number(rec.prizePool),
      winner_payout: Number(rec.winnerPayout),
      tx_hash: "", // or actual tx hash if available
      token: rec.token || "CARV",
      league: "NBA",
      home_team: match.home_team,
      away_team: match.away_team,
      created_at: rec.created_at
    };

    const { error: insertError } = await supabase.from('nba_raffle').insert(raffleRecord);
    if (insertError) {
      console.error('Raffle insert error:', insertError);
      return NextResponse.json({ error: "Database insert error" }, { status: 500 });
    }

    // Trigger payout
    let txHash = "";
    try {
      const payoutResponse = await fetch(`http://localhost:3000/api/raffle/payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: eventid,
          winner: rec.winners[0],
          winnersCount: 1,
          token: rec.token
        })
      });

      if (payoutResponse.ok) {
        const payoutData = await payoutResponse.json();
        txHash = payoutData.result?.txHash || "";
      } else {
        console.error('Payout failed:', await payoutResponse.text());
      }
    } catch (payoutErr) {
      console.error('Payout error:', payoutErr);
    }

    // Return record with match details
    const result = {
      ...rec,
      txHash,
      matchDetails: {
        home: match.home_team,
        away: match.away_team,
        league: "NBA"
      }
    };

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("raffle error", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

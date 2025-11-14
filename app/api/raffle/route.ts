import path from "path";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../../../lib/supabaseClient";
import { promises as fs } from "fs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const PURCHASES_FILE = path.join(DATA_DIR, "purchases.json");
const API_FETCH_FILE = path.join(DATA_DIR, "api_fetch.json");
const WINDOW_HISTORY_FILE = path.join(DATA_DIR, "window_history.json");

function pickRandom<T>(arr: T[]) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function getMatchDetailsFromFetch(eventid: string, apiFetchData: any): { home: string; away: string; league: string } | null {
  try {
    // Look in NBA data
    const nbaMatch = apiFetchData?.nba?.daily?.find((m: any) => String(m.idEvent) === String(eventid));
    if (nbaMatch) {
      return {
        home: nbaMatch.strHomeTeam,
        away: nbaMatch.strAwayTeam,
        league: "NBA"
      };
    }

    // Look in EPL data
    const eplMatch = apiFetchData?.epl?.league?.find((m: any) => String(m.idEvent) === String(eventid)) || 
            apiFetchData?.epl?.daily?.find((m: any) => String(m.idEvent) === String(eventid));
    if (eplMatch) {
      return {
        home: eplMatch.strHomeTeam,
        away: eplMatch.strAwayTeam,
        league: "EPL"
      };
    }

    return null;
  } catch (e) {
    console.error("Error getting match details:", e);
    return null;
  }
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

    // If eventId is specified, return just that raffle
    if (eventid) {
      // Try NBA first
      let raffle = null;
      let matchTable = 'nba_matches_history';
      let league = 'NBA';

      const { data: nbaRaffle, error: nbaError } = await supabase
        .from('nba_raffle')
        .select('*')
        .eq('event_id', eventid)
        .single();

      if (nbaRaffle) {
        raffle = nbaRaffle;
      } else {
        // Try EPL
        const { data: eplRaffle, error: eplError } = await supabase
          .from('epl_raffle')
          .select('*')
          .eq('event_id', eventid)
          .single();

        if (eplRaffle) {
          raffle = eplRaffle;
          matchTable = 'epl_matches_history';
          league = 'EPL';
        } else {
          // Try La Liga
          const { data: laligaRaffle, error: laligaError } = await supabase
            .from('laliga_raffle')
            .select('*')
            .eq('event_id', eventid)
            .single();

          if (laligaRaffle) {
            raffle = laligaRaffle;
            matchTable = 'laliga_matches_history';
            league = 'La Liga';
          }
        }
      }

      if (!raffle) {
        return NextResponse.json({ ok: false, raffle: null }, { status: 404 });
      }

      // Get match details
      const { data: match } = await supabase
        .from(matchTable)
        .select('strHomeTeam, strAwayTeam')
        .eq('idEvent', eventid)
        .single();

      const matchDetails = match ? {
        home: match.strHomeTeam,
        away: match.strAwayTeam,
        league
      } : {
        home: "Unknown Team",
        away: "Unknown Team",
        league
      };

      return NextResponse.json({
        ok: true,
        raffle: {
          ...raffle,
          matchDetails,
          winner: raffle.winner,
          prize: raffle.winner_payout,
          timestamp: raffle.created_at,
          participantCount: raffle.buyer_count,
          txHash: raffle.tx_hash
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
        .eq('idEvent', raffle.event_id)
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
      .select('*')
      .eq('idEvent', eventid)
      .single();

    if (!match) {
      return NextResponse.json({ error: "match not found" }, { status: 404 });
    }

    if (match.strStatus !== 'FT') {
      return NextResponse.json({
        error: "match is not finished yet (not FT status)"
      }, { status: 400 });
    }

    // Query purchases for this event
    const { data: purchases, error: purchasesError } = await supabase
      .from('purchases')
      .select('*')
      .eq('event_id', eventid);

    if (purchasesError) {
      console.error('Purchases query error:', purchasesError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!purchases || purchases.length === 0) {
      return NextResponse.json({ error: "no entries for event" }, { status: 400 });
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
    const rec = {
      id: `${eventid}-${uuidv4()}`,
      eventid: String(eventid),
      date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD (UTC)
      winners,
      buyerCount: entries.length,
      entries: entries.map(e => ({ id: e.id, buyer: e.buyer, txid: e.txid, timestamp: e.timestamp })),
      token,
      createdAt: new Date().toISOString(),
      prizePool,
      winnerPayout
    };

    // Insert to raffles table
    const raffleRecord = {
      id: rec.id,
      event_id: rec.eventid,
      winner: rec.winners[0],
      buyer_count: rec.buyerCount,
      prize_pool: rec.prizePool,
      winner_payout: rec.winnerPayout,
      created_at: rec.createdAt,
      token: rec.token,
      home_team: match.strHomeTeam,
      away_team: match.strAwayTeam,
      match_date: match.dateEvent
    };

    const { error: insertError } = await supabase.from('nba_raffle').insert(raffleRecord);
    if (insertError) {
      console.error('Raffle insert error:', insertError);
      return NextResponse.json({ error: "Database insert error" }, { status: 500 });
    }

    // Return record with match details
    const result = {
      ...rec,
      matchDetails: {
        home: match.strHomeTeam,
        away: match.strAwayTeam,
        league: "NBA"
      }
    };

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("raffle error", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

import path from "path";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { readJson, readRaffleData, writeRaffleData, getAllRaffleFiles } from "./utils";
import { promises as fs } from "fs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const PURCHASES_FILE = path.join(DATA_DIR, "purchases.json");
const API_FETCH_FILE = path.join(DATA_DIR, "api_fetch.json");
const WINDOW_HISTORY_FILE = path.join(DATA_DIR, "window_history.json");

function pickRandom<T>(arr: T[]) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function getMatchDetailsFromFetch(eventId: string, apiFetchData: any): { home: string; away: string; league: string } | null {
  try {
    // Look in NBA data
    const nbaMatch = apiFetchData?.nba?.daily?.find((m: any) => String(m.idEvent) === String(eventId));
    if (nbaMatch) {
      return {
        home: nbaMatch.strHomeTeam,
        away: nbaMatch.strAwayTeam,
        league: "NBA"
      };
    }

    // Look in EPL data
    const eplMatch = apiFetchData?.epl?.league?.find((m: any) => String(m.idEvent) === String(eventId)) || 
                    apiFetchData?.epl?.daily?.find((m: any) => String(m.idEvent) === String(eventId));
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
  eventId: string;
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
    const eventId = url.searchParams.get('eventId');
    
    // If eventId is specified, return just that raffle
    if (eventId) {
      const raffle = readRaffleData(eventId);
      if (!raffle) {
        return NextResponse.json({ ok: false, raffle: null }, { status: 404 });
      }
      
      // Enrich with match details if available
      const apiFetchData = readJson(API_FETCH_FILE, {});
      const matchDetails = getMatchDetailsFromFetch(eventId, apiFetchData);
      
      return NextResponse.json({ 
        ok: true, 
        raffle: {
          ...raffle,
          matchDetails: matchDetails || raffle.matchDetails || {
            home: "Unknown Team",
            away: "Unknown Team",
            league: "NBA"
          }
        }
      });
    }
    
    // Otherwise, return all raffles (only files with winners - actual raffle drawings)
    const apiFetchData = readJson(API_FETCH_FILE, {});
    const raffles = [];

    // Read all raffle files
    const raffleFiles = getAllRaffleFiles();
    for (const file of raffleFiles) {
      try {
        const data = readJson(file, null);
        // Only include files that have winners array (actual raffle drawings, not just predictions)
        if (data && Array.isArray(data.winners) && data.winners.length > 0) {
          const matchDetails = getMatchDetailsFromFetch(data.eventId, apiFetchData);
          raffles.push({
            ...data,
            matchDetails: matchDetails || {
              home: "Unknown Team",
              away: "Unknown Team",
              league: "NBA"
            }
          });
        }
      } catch (err) {
        console.error(`Error reading raffle file ${file}:`, err);
      }
    }

    // Sort by timestamp descending (newest first)
    raffles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ ok: true, raffles });
  } catch (e) {
    console.error("Error in raffle GET:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const { eventId, winnersCount = 1, token = "CARV" } = body;
    if (!eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }

    // Check if raffle already exists for this event
    const existingRaffle = readRaffleData(eventId);
    if (existingRaffle) {
      return NextResponse.json({ 
        error: "raffle already completed for this event",
        existing: existingRaffle
      }, { status: 400 });
    }

    // Verify that this event is from a closed window (not currently active)
    try {
      const windowHistoryData = JSON.parse(await fs.readFile(WINDOW_HISTORY_FILE, 'utf-8'));
      const eventIds = new Set<string>();
      
      if (Array.isArray(windowHistoryData.windows)) {
        // Only include events from closed windows (windows with windowClosedAt, not currently open)
        windowHistoryData.windows.forEach((w: any) => {
          if (w.windowClosedAt && Array.isArray(w.eventIds)) {
            w.eventIds.forEach((id: string) => eventIds.add(String(id)));
          }
        });
      }
      
      // Check if this eventId is in a closed window
      if (!eventIds.has(String(eventId))) {
        return NextResponse.json({ 
          error: "event is not from a closed window (still in active window or not found)" 
        }, { status: 400 });
      }
    } catch (e) {
      console.warn("Could not verify event from window history:", e);
      // Continue anyway if file doesn't exist
    }

    // Verify the match is actually finished
    try {
      const apiFetchData = readJson(API_FETCH_FILE, {});
      const allEvents = [];
      
      if (apiFetchData.nba?.daily) allEvents.push(...apiFetchData.nba.daily);
      if (apiFetchData.nba?.league) allEvents.push(...apiFetchData.nba.league);
      if (apiFetchData.epl?.daily) allEvents.push(...apiFetchData.epl.daily);
      if (apiFetchData.epl?.league) allEvents.push(...apiFetchData.epl.league);
      if (apiFetchData.laliga?.daily) allEvents.push(...apiFetchData.laliga.daily);
      if (apiFetchData.laliga?.league) allEvents.push(...apiFetchData.laliga.league);

      const match = allEvents.find((e: any) => String(e.idEvent) === String(eventId));
      if (!match) {
        return NextResponse.json({ error: "match not found" }, { status: 404 });
      }

      const hasScores = match.intHomeScore !== null && match.intAwayScore !== null;
      const isFinished = /finished|final|ft/i.test(match.strStatus || "");
      
      if (!hasScores || !isFinished) {
        return NextResponse.json({ 
          error: "match is not finished yet (no scores or not FT status)"
        }, { status: 400 });
      }
    } catch (e) {
      console.warn("Could not verify match status:", e);
      // Continue anyway
    }

    const purchasesData = readJson(PURCHASES_FILE, { purchases: [] });
    const purchases: any[] = purchasesData.purchases ?? [];

    // Filter purchases for this event
    const entries = purchases.filter(p => String(p.eventId) === String(eventId));
    if (!entries.length) {
      return NextResponse.json({ error: "no entries for event" }, { status: 400 });
    }

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

    // create raffle record
    const rec = {
      id: `${eventId}-${uuidv4()}`,
      eventId: String(eventId),
      date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD (UTC)
      winners,
      buyerCount: entries.length,
      entries: entries.map(e => ({ id: e.id, buyer: e.buyer, txid: e.txid, timestamp: e.timestamp })),
      token,
      createdAt: new Date().toISOString(),
    };

    // Write to individual file
    writeRaffleData(eventId, rec);

    // Return record with match details
    const apiFetchData = readJson(API_FETCH_FILE, {});
    const matchDetails = getMatchDetailsFromFetch(eventId, apiFetchData);
    
    const result = {
      ...rec,
      matchDetails: matchDetails || {
        home: "Unknown Team",
        away: "Unknown Team",
        league: "NBA"
      }
    };

    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("raffle error", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// app/api/matches/route.ts
import { NextResponse } from "next/server";
import { fetchLiveMatchData } from "@/lib/sportsFetcher";
import { getSelectedMatches, isMatchSelected } from "@/lib/matchSelector";
import { filterNBAMatchesToD1, getD1DateRangeWIB, getLockedNBASelection } from "@/lib/nbaWindowManager";
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
const WINDOW_DATES_FILE = path.join(process.cwd(), 'data/window_dates.json');
const NBA_HISTORY_FILE = path.join(process.cwd(), 'data/nba_history.json');
const EPL_HISTORY_FILE = path.join(process.cwd(), 'data/epl_history.json');

async function readWindowDates(): Promise<any[]> {
  try {
    const data = await fs.readFile(WINDOW_DATES_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.windows || [];
  } catch (error) {
    return [];
  }
}

async function readNBAHistory(): Promise<any> {
  try {
    const data = await fs.readFile(NBA_HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { matches: [] };
  }
}

async function readEPLHistory(): Promise<any> {
  try {
    const data = await fs.readFile(EPL_HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return { matches: [] };
  }
}

async function readCache(): Promise<any> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading cache file:', error);
    return null;
  }
}

function pad(n: number) { return String(n).padStart(2, "0"); }

/**
 * Merge live match data from ESPN/TheSportsDB with cached data
 * Priority: Live scores > Cached scores
 */
function mergeWithLiveData(cachedData: any, liveData: any[]): any {
  const merged = JSON.parse(JSON.stringify(cachedData)); // Deep copy
  
  // Map live data by ID for quick lookup
  const liveMap = new Map<string, any>();
  for (const live of liveData) {
    if (live.id) {
      liveMap.set(live.id, live);
    }
  }

  // Update NBA matches with live data
  if (merged.nba?.daily && Array.isArray(merged.nba.daily)) {
    for (const match of merged.nba.daily) {
      const liveMatch = liveMap.get(String(match.idEvent));
      if (liveMatch) {
        if (liveMatch.homeScore !== null) match.intHomeScore = liveMatch.homeScore;
        if (liveMatch.awayScore !== null) match.intAwayScore = liveMatch.awayScore;
        if (liveMatch.status) match.strStatus = liveMatch.status;
      }
    }
  }

  // Update EPL matches with live data
  if (merged.epl?.daily && Array.isArray(merged.epl.daily)) {
    for (const match of merged.epl.daily) {
      const liveMatch = liveMap.get(String(match.idEvent));
      if (liveMatch) {
        if (liveMatch.homeScore !== null) match.intHomeScore = liveMatch.homeScore;
        if (liveMatch.awayScore !== null) match.intAwayScore = liveMatch.awayScore;
        if (liveMatch.status) match.strStatus = liveMatch.status;
      }
    }
  }

  // Update La Liga matches with live data
  if (merged.laliga?.daily && Array.isArray(merged.laliga.daily)) {
    for (const match of merged.laliga.daily) {
      const liveMatch = liveMap.get(String(match.idEvent));
      if (liveMatch) {
        if (liveMatch.homeScore !== null) match.intHomeScore = liveMatch.homeScore;
        if (liveMatch.awayScore !== null) match.intAwayScore = liveMatch.awayScore;
        if (liveMatch.status) match.strStatus = liveMatch.status;
      }
    }
  }

  return merged;
}

/**
 * Compute window status using UTC time.
 *
 * Original windows in WIB (UTC+7):
 *  - NBA: 13:00 (D) — 04:00 (D+1) WIB  => UTC: 06:00 — 21:00 (i.e. open when UTC hour in [6,21))
 *  - EPL: 01:00 — 16:00 (D) WIB         => UTC: 18:00 (prev day) — 09:00 (D) (i.e. open when UTC hour >=18 or <9)
 *
 * We evaluate these using current UTC hour so logic is deterministic server-side.
 */
function getWindowStatusUtc(nowUtc: Date) {
  const hour = nowUtc.getUTCHours();
  const minute = nowUtc.getUTCMinutes();
  const utcMinutes = hour * 60 + minute;
  // NBA window: 06:00–23:30 UTC
  const openNBA = utcMinutes >= 360 && utcMinutes < 1410; // 360 = 6*60, 1410 = 23*60+30
  const openEPL = hour >= 18 || hour < 9;            // 18:00..23:59 OR 00:00..08:59 UTC
  const openLaLiga = hour >= 18 || hour < 9;         // Same as EPL (Spanish league)
  return { openNBA, openEPL, openLaLiga, hour };
}

/** Normalize event and compute startMs & buyable. Use strTimestamp when available. */
function parseEvent(
  e: any,
  nowUtc: Date,
  openNBA: boolean,
  openEPL: boolean,
  openLaLiga: boolean,
  source: "nextleague" | "eventsday" | "other"
) {
  let datetime: string | null = null;
  let startMs: number | null = null;

  // prefer strTimestamp if present (full ISO)
  // TheSportsDB timestamps are in UTC, so append 'Z' to ensure correct parsing
  if (e?.strTimestamp) {
    try {
      let timestamp = String(e.strTimestamp).trim();
      if (!timestamp.endsWith('Z')) {
        timestamp += 'Z';
      }
      const parsed = Date.parse(timestamp);
      if (!Number.isNaN(parsed)) {
        startMs = parsed;
        datetime = new Date(parsed).toISOString();
      }
    } catch { /* ignore */ }
  }

  // fallback: use dateEvent + strTime, parse deterministically with Date.UTC
  if (startMs === null || Number.isNaN(startMs)) {
    try {
      if (e.dateEvent) {
        const datePart = String(e.dateEvent).trim(); // expected "YYYY-MM-DD"
        const timePartRaw = e.strTime ? String(e.strTime).trim() : "00:00:00";
        const t = timePartRaw.split(":").length === 2 ? timePartRaw + ":00" : timePartRaw;
        const [y, m, d] = datePart.split("-").map((x: string) => Number(x));
        const [hh, mm, ss] = t.split(":").map((x: string) => Number(x));
        if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d) && !Number.isNaN(hh)) {
          // treat provided components as UTC components (deterministic)
          const utcMs = Date.UTC(y, m - 1, d, hh || 0, mm || 0, ss || 0);
          startMs = utcMs;
          datetime = new Date(utcMs).toISOString();
        }
      }
    } catch { datetime = null; startMs = null; }
  }

  const nowUtcMs = nowUtc.getTime();
  let buyable = false;
  let buyableFrom: string | null = null;

  if (startMs && !Number.isNaN(startMs)) {
    const buyFromMs = startMs - 24 * 60 * 60 * 1000;
    buyableFrom = new Date(buyFromMs).toISOString();
    const leagueStr = String(e.strLeague ?? e.strSport ?? "").toLowerCase();
    const isNBA = leagueStr.includes("nba");
    const isEPL = /premier league|english premier|english premier league|epl/i.test(leagueStr);
    const isLaLiga = /la liga|laliga/i.test(leagueStr);

    // buyable only if now (UTC) in [buyFrom, start) AND league window is open now (UTC)
    if (nowUtcMs >= buyFromMs && nowUtcMs < startMs) {
      if (isNBA && openNBA) buyable = true;
      if (isEPL && openEPL) buyable = true;
      if (isLaLiga && openLaLiga) buyable = true;
    }
  }

  return {
    id: e.idEvent ?? Math.random().toString(36).slice(2, 10),
    league: e.strLeague ?? e.strSport ?? "",
    home: e.strHomeTeam ?? e.homeTeam ?? "Home",
    away: e.strAwayTeam ?? e.awayTeam ?? "Away",
    datetime,
    venue: e.strVenue ?? null,
    raw: e,
    startMs,
    buyable,
    buyableFrom,
    _source: source,
  };
}

export async function GET(req: Request) {
    const url = new URL(req.url);
    const isHistory = url.searchParams.get('history') === 'true';

    // Determine if NBA window is open (13:00-04:00 WIB, i.e. 06:00-21:00 UTC)
    const nowUtc = new Date();
    const hour = nowUtc.getUTCHours();
    const minute = nowUtc.getUTCMinutes();
    const utcMinutes = hour * 60 + minute;
    const nbaWindowOpen = utcMinutes >= 360 && utcMinutes < 1260; // 06:00–21:00 UTC

    let result: any[] = [];
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

      const table = isHistory ? 'nba_matches_history' : 'nba_matches_pending';

      // Fetch NBA matches from the appropriate table
      let query = supabase.from(table).select('*');

      // For history, only return matches that are actually finished, have results, or are waiting for results
      if (isHistory) {
        // Filter for finished matches, matches with scores, or matches waiting for results
        query = query.or('status.ilike.%finished%,status.ilike.%final%,status.ilike.%ft%,status.ilike.%completed%,status.ilike.%FT%,status.ilike.%Waiting for Result%').or('home_score.not.is.null,away_score.not.is.null');
      }

      const { data, error } = await query;
      if (error) {
        console.warn(`Supabase error fetching NBA matches from ${table}:`, error.message);
      } else if (Array.isArray(data)) {
        result = data.map((e: any) => ({
          id: e.event_id || e.id,
          league: 'NBA',
          home: e.home_team,
          away: e.away_team,
          datetime: e.event_date,
          venue: e.venue || null,
          homeScore: e.home_score,
          awayScore: e.away_score,
          buyable: !isHistory && nbaWindowOpen && (e.status === 'open'), // Buyable only for pending matches when window is open and status is 'open'
          status: e.status || null,
          created_at: e.created_at,
          raw: e,
        }));
      }
    } catch (e) {
      console.warn('Could not fetch NBA matches from Supabase:', e);
    }
    return NextResponse.json({ ok: true, events: result });
}

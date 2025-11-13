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
  try {
    const url = new URL(req.url);

    // UTC context: build a Date that represents current UTC time
    const nowUtc = new Date(); // server time as Date; we'll use getUTC* methods
    const nowUtcMs = nowUtc.getTime();

    // baseDate computed from UTC date components (YYYY-MM-DD)
    const baseDate = `${nowUtc.getUTCFullYear()}-${pad(nowUtc.getUTCMonth() + 1)}-${pad(nowUtc.getUTCDate())}`;

    const dateParam = url.searchParams.get("date") || baseDate;
    const force = url.searchParams.get("force") === "true";
    const history = url.searchParams.get("history") === "true";
    const purchasesOnly = url.searchParams.get("purchasesOnly") === "true";
    const closedWindow = url.searchParams.get("closedWindow") === "true";

    const { openNBA, openEPL, openLaLiga } = getWindowStatusUtc(nowUtc);

    // Read from cache file
    const cachedData = await readCache();
    if (!cachedData) {
      return NextResponse.json({ ok: false, error: "Cache not available" }, { status: 503 });
    }

    // Read NBA history (archived finished matches)
    const nbaHistory = await readNBAHistory();
    
    // Read EPL history (archived finished matches)
    const eplHistory = await readEPLHistory();
    
    // Merge history matches into cache data
    let mergedData = JSON.parse(JSON.stringify(cachedData)); // Deep copy
    
    // Merge NBA history
    if (nbaHistory.matches && Array.isArray(nbaHistory.matches)) {
      if (!mergedData.nba) mergedData.nba = {};
      if (!mergedData.nba.history) mergedData.nba.history = [];
      
      // Add history matches (these are FT matches that are archived)
      for (const historyMatch of nbaHistory.matches) {
        // Only add if not already in daily/league
        const exists = (mergedData.nba.daily || []).some((m: any) => String(m.idEvent) === String(historyMatch.id))
          || (mergedData.nba.league || []).some((m: any) => String(m.idEvent) === String(historyMatch.id));
        
        if (!exists) {
          mergedData.nba.history.push({
            idEvent: historyMatch.id,
            strHomeTeam: historyMatch.home,
            strAwayTeam: historyMatch.away,
            intHomeScore: historyMatch.homeScore,
            intAwayScore: historyMatch.awayScore,
            strStatus: 'FT',
            strTimestamp: historyMatch.datetime,
            strVenue: historyMatch.venue,
          });
        }
      }
    }

    // Merge EPL history
    if (eplHistory.matches && Array.isArray(eplHistory.matches)) {
      if (!mergedData.epl) mergedData.epl = {};
      if (!mergedData.epl.history) mergedData.epl.history = [];
      
      // Add history matches (these are FT matches that are archived)
      for (const historyMatch of eplHistory.matches) {
        // Only add if not already in daily/league
        const exists = (mergedData.epl.daily || []).some((m: any) => String(m.idEvent) === String(historyMatch.id))
          || (mergedData.epl.league || []).some((m: any) => String(m.idEvent) === String(historyMatch.id));
        
        if (!exists) {
          mergedData.epl.history.push({
            idEvent: historyMatch.id,
            strHomeTeam: historyMatch.home,
            strAwayTeam: historyMatch.away,
            intHomeScore: historyMatch.homeScore,
            intAwayScore: historyMatch.awayScore,
            strStatus: 'FT',
            strTimestamp: historyMatch.datetime,
            strVenue: historyMatch.venue,
          });
        }
      }
    }

    // LaLiga data already merged from api_fetch.json (no separate cache needed)

    // === TRY LIVE DATA FIRST (ESPN + TheSportsDB fallback) ===
    let liveData: any[] = [];
    try {
      console.log('[Matches API] Fetching live data from ESPN/TheSportsDB...');
      liveData = await fetchLiveMatchData(mergedData);
      console.log(`[Matches API] Live data fetch returned ${liveData.length} events`);
    } catch (error) {
      console.warn('[Matches API] Live data fetch failed:', error);
    }

    // If we got live data, merge with cache and use it (prioritize live scores)
    let finalData = mergedData;
    if (liveData && liveData.length > 0) {
      console.log(`[Matches API] Merging ${liveData.length} live events with cache...`);
      finalData = mergeWithLiveData(mergedData, liveData);
    }

    // Combine NBA data from final data
    let bskRaw: any[] = [];
    try {
      // Add league events
      if (Array.isArray(finalData.nba?.league)) {
        bskRaw.push(...finalData.nba.league);
      }
      // Add daily events
      if (Array.isArray(finalData.nba?.daily)) {
        bskRaw.push(...finalData.nba.daily);
      }
      // Add history events (archived FT matches)
      if (Array.isArray(finalData.nba?.history)) {
        bskRaw.push(...finalData.nba.history);
      }
      
      // Deduplicate by event ID
      const byId = new Map<string, any>();
      for (const ev of bskRaw) {
        const id = String(ev?.idEvent ?? Math.random().toString(36).slice(2,8));
        if (!byId.has(id)) byId.set(id, ev);
      }
      bskRaw = Array.from(byId.values());
    } catch (e) {
      bskRaw = [];
      console.warn("NBA cache processing failed", e);
    }

    // === EPL / Soccer logic ===
    const soccerAgg: { ev: any; source: "nextleague" | "eventsday" }[] = [];

    try {
      // Add EPL league events
      if (Array.isArray(finalData.epl?.league)) {
        for (const ev of finalData.epl.league) {
          soccerAgg.push({ ev, source: "nextleague" });
        }
      }
      // Add EPL daily events
      if (Array.isArray(finalData.epl?.daily)) {
        for (const ev of finalData.epl.daily) {
          soccerAgg.push({ ev, source: "eventsday" });
        }
      }
      // Add EPL history events
      if (Array.isArray(finalData.epl?.history)) {
        for (const ev of finalData.epl.history) {
          soccerAgg.push({ ev, source: "nextleague" });
        }
      }
    } catch (e) {
      console.warn("EPL cache processing failed", e);
    }

    // === LaLiga logic ===
    try {
      // Add LaLiga league events
      if (finalData.laliga && Array.isArray(finalData.laliga.league)) {
        for (const ev of finalData.laliga.league) {
          soccerAgg.push({ ev, source: "nextleague" });
        }
      }
      // Add LaLiga daily events
      if (finalData.laliga && Array.isArray(finalData.laliga.daily)) {
        for (const ev of finalData.laliga.daily) {
          soccerAgg.push({ ev, source: "eventsday" });
        }
      }
    } catch (e) {
      console.warn("LaLiga cache processing failed", e);
    }

    // Get currently selected matches
    const selectedMatches = await getSelectedMatches();
    
    // Get window dates history
    const windowDates = await readWindowDates();
    
    // Get previous day's matches (for yesterday's window if window is now closed)
    const nowUtcDate = nowUtc.toISOString().split('T')[0]; // YYYY-MM-DD
    const previousDayMatches = new Set<string>();
    const allHistoricalMatches = new Set<string>(); // Track ONLY matches with actual predictions in closed windows
    
    // Collect matches that are in CLOSED windows AND have actual raffle/prediction files
    try {
      const dataDir = path.join(process.cwd(), 'data');
      const files = await fs.readdir(dataDir);
      const raffleFiles = files.filter(f => f.startsWith('raffle-') && f.endsWith('.json'));
      
      // Create a set of all event IDs in closed windows
      const closedWindowMatches = new Set<string>();
      if (windowDates && Array.isArray(windowDates)) {
        for (const window of windowDates) {
          if (window.closed) {
            window.nba?.forEach((id: string) => closedWindowMatches.add(id));
            window.epl?.forEach((id: string) => closedWindowMatches.add(id));
            window.laliga?.forEach((id: string) => closedWindowMatches.add(id));
          }
        }
      }
      
      // Only add matches that have BOTH a raffle file AND are in a closed window
      for (const file of raffleFiles) {
        const eventId = file.replace('raffle-', '').replace('.json', '');
        if (closedWindowMatches.has(eventId)) {
          allHistoricalMatches.add(eventId);
        }
      }
      
      console.log(`[Matches API] Found ${allHistoricalMatches.size} predictions in closed windows for history view`);
    } catch (e) {
      console.warn('[Matches API] Could not read raffle files for history:', e);
    }
    
    // Also track most recent closed window for backward compatibility
    if (windowDates && Array.isArray(windowDates)) {
      let mostRecentClosedWindow = null;
      for (const window of windowDates) {
        if (window.closed && (!mostRecentClosedWindow || window.date > mostRecentClosedWindow.date)) {
          mostRecentClosedWindow = window;
        }
      }
      if (mostRecentClosedWindow) {
        mostRecentClosedWindow.nba?.forEach((id: string) => previousDayMatches.add(id));
        mostRecentClosedWindow.epl?.forEach((id: string) => previousDayMatches.add(id));
        mostRecentClosedWindow.laliga?.forEach((id: string) => previousDayMatches.add(id));
      }
    }

    // dedupe: prefer eventsday (daily) over nextleague (league) for upcoming matches
    // This ensures we show daily upcoming matches instead of historical league matches
    const soccerById = new Map<string, { ev: any; source: "nextleague" | "eventsday" }>();
    for (const item of soccerAgg) {
      const id = String(item.ev?.idEvent ?? "");
      if (!id) continue;
      if (!soccerById.has(id)) soccerById.set(id, item);
      else {
        const existing = soccerById.get(id)!;
        // Prefer daily (eventsday) over league (nextleague)
        if (existing.source === "nextleague" && item.source === "eventsday") soccerById.set(id, item);
      }
    }

    // normalize both lists (use nowUtc & open flags)
    const normalizedSoc = Array.from(soccerById.values()).map((it) => parseEvent(it.ev, nowUtc, openNBA, openEPL, openLaLiga, it.source));
    const normalizedBsk = bskRaw.map((e: any) => parseEvent(e, nowUtc, openNBA, openEPL, openLaLiga, "eventsday"));

    // Filtering:
    // - If closedWindow=true -> return last 3 from each league that were available during the last closed window (all time states)
    // - If purchasesOnly=true -> return ALL (no time filtering), then filter by purchase IDs
    // - If history=true -> return matches from closed windows that have STARTED or FINISHED
    // - Else (upcoming): keep future matches (start > nowUtcMs)
    let socFiltered = normalizedSoc.filter((e: any) => {
      if (closedWindow) return true; // Return all for closed window, will slice to 3 per league
      if (purchasesOnly) return true; // No time filtering for purchases
      if (force) return true;
      if (history) {
        // History mode: show matches from closed windows (regardless of scores)
        // Will be filtered to only closed window matches below
        return true;
      }
      // For both daily and league: only show future matches
      return typeof e.startMs === "number" && e.startMs > nowUtcMs;
    });
    
    // Sort soccer by date (upcoming first)
    socFiltered.sort((a: any, b: any) => (a.startMs ?? 9e15) - (b.startMs ?? 9e15));

    let bskFiltered = normalizedBsk.filter((e: any) => {
      if (closedWindow) return true; // Return all for closed window, will slice to 3
      if (purchasesOnly) return true; // No time filtering for purchases
      if (force) return true;
      if (history) {
        // History mode: show matches from closed windows (regardless of scores)
        // Will be filtered to only closed window matches below
        return true;
      }
      return typeof e.startMs === "number" && e.startMs > nowUtcMs;
    });

    // When NOT in purchasesOnly or force mode, only show selected matches
    if (!purchasesOnly && !force && !closedWindow) {
      if (history) {
        // History mode: show ONLY matches from ALL closed windows
        // If no historical matches exist, show empty list
        bskFiltered = bskFiltered.filter((e: any) => allHistoricalMatches.has(e.id));
        socFiltered = socFiltered.filter((e: any) => allHistoricalMatches.has(e.id));
      } 
      // NOTE: In live mode (when NOT history), we show ALL upcoming matches
      // Users can see all matches, but can only BUY during window time
      // Do NOT filter by selectedMatches - let users see everything
    }

    // selection: up to 3 per sport when normal mode, unlimited for history/purchasesOnly/closedWindow
    // For NBA: filter to D+1 matches only (next calendar day in WIB timezone)
    let nbaMatches = bskFiltered.filter((e: any) => {
      const leagueStr = String(e.league ?? "").toLowerCase();
      const rawLeague = String(e.raw?.strLeague ?? "").toLowerCase();
      const rawSport = String(e.raw?.strSport ?? "").toLowerCase();
      return leagueStr.includes("nba")
        || leagueStr.includes("basketball")
        || rawLeague.includes("nba")
        || rawSport.includes("basketball");
    });

    // For live/upcoming mode, filter NBA to D+1 only (history/purchases/closed show all)
    if (!history && !purchasesOnly && !closedWindow) {
      console.log(`[Matches API] Filtering ${nbaMatches.length} NBA matches to D+1 only...`);
      
      // Build a set of all archived matches (in closed windows)
      const archivedMatches = new Set<string>();
      if (windowDates && Array.isArray(windowDates)) {
        for (const window of windowDates) {
          if (window.closed) {
            window.nba?.forEach((id: string) => archivedMatches.add(id));
          }
        }
      }
      
      // Check if there's a locked selection for this window
      const lockedIds = await getLockedNBASelection();
      
      if (lockedIds && lockedIds.length > 0) {
        // Use locked selection - filter to only those match IDs that are NOT archived
        const lockedSet = new Set(lockedIds);
        nbaMatches = nbaMatches.filter((m: any) => lockedSet.has(String(m.id)) && !archivedMatches.has(String(m.id)));
        console.log(`[Matches API] Using locked selection (excluding archived): ${nbaMatches.map((m: any) => m.id).join(', ')}`);
      } else {
        // No locked selection yet, use D+1 filter (will be locked by auto-predict)
        nbaMatches = filterNBAMatchesToD1(nbaMatches, nowUtc);
        // Also exclude archived matches
        nbaMatches = nbaMatches.filter((m: any) => !archivedMatches.has(String(m.id)));
        console.log(`[Matches API] Using D+1 filter (not yet locked, excluding archived): ${nbaMatches.map((m: any) => m.id).join(', ')}`);
      }
      
      console.log(`[Matches API] After D+1 filter: ${nbaMatches.length} NBA matches`);
    } else {
      // For history/purchases/closed, apply the old 3-match limit
      nbaMatches = nbaMatches.slice(0, 3);
    }

    const outNBA = nbaMatches;

    // Separate soccer by league and limit each to 6 per sport (or unlimited for history/purchases/closed)
    const eplMatches = socFiltered
      .filter((e: any) => {
        const leagueStr = String(e.league ?? "").toLowerCase();
        const rawLeague = String(e.raw?.strLeague ?? "").toLowerCase();
        return leagueStr.includes("premier league") 
          || leagueStr.includes("english premier")
          || leagueStr.includes("epl")
          || rawLeague.includes("premier league") 
          || rawLeague.includes("english premier")
          || rawLeague === "english premier league";
      })
      .slice(0, (purchasesOnly || closedWindow || history) ? undefined : 6);
    
    const laligaMatches = socFiltered
      .filter((e: any) => {
        const leagueStr = String(e.league ?? "").toLowerCase();
        const rawLeague = String(e.raw?.strLeague ?? "").toLowerCase();
        return leagueStr.includes("la liga") 
          || leagueStr.includes("laliga")
          || rawLeague.includes("la liga")
          || rawLeague.includes("spanish la liga");
      })
      .slice(0, (purchasesOnly || closedWindow || history) ? undefined : 6);

    const outSoc = [...eplMatches, ...laligaMatches];

    // combine (already sorted by date above)
    const combined = [...outNBA, ...outSoc];

    const result = combined.map((e: any) => {
      const status = e.raw?.strStatus || null;
      // Hide "NS" (Not Started) status in history view - show as waiting for results instead
      const displayStatus = (history && status === 'NS') ? 'Waiting for results' : status;
      
      return {
        id: e.id,
        league: e.league,
        home: e.home,
        away: e.away,
        datetime: e.datetime,
        venue: e.venue,
        buyable: e.buyable,
        buyableFrom: e.buyableFrom,
        homeScore: e.raw?.intHomeScore !== undefined ? parseInt(e.raw.intHomeScore) : null,
        awayScore: e.raw?.intAwayScore !== undefined ? parseInt(e.raw.intAwayScore) : null,
        status: displayStatus,
        raw: {
          idEvent: e.raw?.idEvent,
          strLeague: e.raw?.strLeague,
          dateEvent: e.raw?.dateEvent,
          strTime: e.raw?.strTime,
          strTimestamp: e.raw?.strTimestamp ?? null,
        },
      };
    });

    // If purchasesOnly is true, filter to only matches with predictions/purchases
    if (purchasesOnly) {
      try {
        const purchasesPath = path.join(process.cwd(), 'data/purchases.json');
        const purchasesData = JSON.parse(await fs.readFile(purchasesPath, 'utf-8'));
        const eventIds = new Set<string>();
        if (Array.isArray(purchasesData.purchases)) {
          purchasesData.purchases.forEach((p: any) => {
            if (p.eventId) eventIds.add(String(p.eventId));
          });
        }
        const filtered = result.filter((r: any) => eventIds.has(String(r.id)));
        return NextResponse.json({ ok: true, events: filtered });
      } catch (e) {
        console.warn("Could not filter by purchases:", e);
        // fallback to all results if purchases file not available
      }
    }

    // If closedWindow is true, return matches from active or closed window based on current time
    if (closedWindow) {
      try {
        const { openNBA, openEPL, openLaLiga } = getWindowStatusUtc(nowUtc);
        let eventIds: string[] = [];

        // Determine which leagues' windows are open right now
        const activeLeagues: string[] = [];
        if (openNBA) activeLeagues.push("NBA");
        if (openEPL) activeLeagues.push("EPL");
        if (openLaLiga) activeLeagues.push("LaLiga");

        if (activeLeagues.length > 0) {
          // Window is OPEN - return from active_window.json
          try {
            const activeWindowPath = path.join(process.cwd(), 'data/active_window.json');
            const activeWindowData = JSON.parse(await fs.readFile(activeWindowPath, 'utf-8'));
            if (Array.isArray(activeWindowData.eventIds)) {
              eventIds = activeWindowData.eventIds;
            }
          } catch (e) {
            console.warn("Could not read active_window.json:", e);
          }
        } else {
          // Window is CLOSED - return from window_history.json
          try {
            const windowHistoryPath = path.join(process.cwd(), 'data/window_history.json');
            const windowHistoryData = JSON.parse(await fs.readFile(windowHistoryPath, 'utf-8'));
            if (Array.isArray(windowHistoryData.windows) && windowHistoryData.windows.length > 0) {
              // Get the LATEST window (last one in the array)
              const latestWindow = windowHistoryData.windows[windowHistoryData.windows.length - 1];
              if (Array.isArray(latestWindow.eventIds)) {
                eventIds = latestWindow.eventIds;
              }
            }
          } catch (e) {
            console.warn("Could not read window_history.json:", e);
          }
        }

        const closedEventIds = new Set(eventIds);
        const filtered = result.filter((r: any) => closedEventIds.has(String(r.id)));
        return NextResponse.json({ ok: true, events: filtered });
      } catch (e) {
        console.warn("Could not filter by window:", e);
        // fallback to all results if files not available
      }
    }

    return NextResponse.json({ ok: true, events: result });
  } catch (err: any) {
    console.error("matches route error:", err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

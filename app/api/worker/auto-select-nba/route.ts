/**
 * Auto-Select NBA Worker
 * Triggers at 11:00 WIB (04:00 UTC)
 * Selects and locks 3 D+1 matches for the upcoming window
 * Does NOT generate predictions yet - that happens at 12:00 WIB
 */

import { NextResponse } from "next/server";
import { isAutoSelectTime, filterNBAMatchesToD1, getNBAWindowStatus, lockNBASelection } from "@/lib/nbaWindowManager";
import { fetchLiveMatchData } from "@/lib/sportsFetcher";
import { promises as fs } from 'fs';
import path from 'path';

async function readCache(): Promise<any> {
  try {
    const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Auto-Select] Error reading cache file:', error);
    return null;
  }
}

export async function GET(req: Request) {
  try {
    const nowUtc = new Date();
    
    // Check authorization header
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key');
    const expectedKey = process.env.WORKER_API_KEY || 'test-key';
    
    if (authHeader !== `Bearer ${expectedKey}` && authHeader !== expectedKey) {
      console.warn('[Auto-Select] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const windowStatus = getNBAWindowStatus(nowUtc);
    console.log(`[Auto-Select] Called at ${nowUtc.toISOString()} UTC (${windowStatus.wibHour}:00 WIB)`);

    // Check if we're within the auto-select window (04:00-04:05 UTC = 11:00-11:05 WIB)
    const isValidTime = isAutoSelectTime(nowUtc);
    if (!isValidTime) {
      console.warn(`[Auto-Select] Called at wrong time. Current UTC hour: ${windowStatus.utcHour}, expected: 4`);
      console.log('[Auto-Select] Proceeding anyway (manual trigger allowed)');
    }

    // 1. Fetch current cache
    const cachedData = await readCache();
    if (!cachedData) {
      return NextResponse.json({ ok: false, error: "Cache not available" }, { status: 503 });
    }

    // 2. Get NBA matches from cache
    console.log('[Auto-Select] Fetching NBA matches...');
    let nbaMatches: any[] = [];
    
    try {
      const byId = new Map<string, any>();
      
      if (cachedData.nba?.league && Array.isArray(cachedData.nba.league)) {
        cachedData.nba.league.forEach((m: any) => {
          if (m.idEvent) byId.set(String(m.idEvent), m);
        });
      }
      
      if (cachedData.nba?.daily && Array.isArray(cachedData.nba.daily)) {
        cachedData.nba.daily.forEach((m: any) => {
          if (m.idEvent) byId.set(String(m.idEvent), m);
        });
      }
      
      nbaMatches = Array.from(byId.values());
      console.log(`[Auto-Select] Got ${nbaMatches.length} unique NBA matches from cache`);
    } catch (e) {
      console.warn('[Auto-Select] Error reading NBA cache:', e);
    }

    // Try to merge with live data for fresher scores
    try {
      const allLiveData = await fetchLiveMatchData(cachedData);
      const liveMap = new Map<string, any>();
      for (const live of allLiveData) {
        if (live.id) {
          liveMap.set(String(live.id), live);
        }
      }
      
      // Update scores from live data
      for (const match of nbaMatches) {
        const liveMatch = liveMap.get(String(match.idEvent));
        if (liveMatch) {
          if (liveMatch.homeScore !== null) match.intHomeScore = liveMatch.homeScore;
          if (liveMatch.awayScore !== null) match.intAwayScore = liveMatch.awayScore;
          if (liveMatch.status) match.strStatus = liveMatch.status;
        }
      }
    } catch (error) {
      console.warn('[Auto-Select] Failed to fetch live data (continuing with cache):', error);
    }

    // Normalize match data format for filtering
    const normalizedMatches = nbaMatches.map((e: any) => {
      let datetime: string | null = null;
      if (e.strTimestamp) {
        let timestamp = String(e.strTimestamp).trim();
        if (!timestamp.endsWith('Z')) timestamp += 'Z';
        datetime = timestamp;
      } else if (e.dateEvent && e.strTime) {
        const datePart = String(e.dateEvent).trim();
        const timePart = String(e.strTime).trim();
        datetime = `${datePart}T${timePart}Z`;
      }
      
      return {
        id: e.idEvent,
        home: e.strHomeTeam,
        away: e.strAwayTeam,
        league: e.strLeague || e.strSport || "NBA",
        datetime: datetime,
        venue: e.strVenue,
        raw: e,
      };
    });

    // 3. Filter to D+1 matches (max 3) and lock them
    const d1Matches = filterNBAMatchesToD1(normalizedMatches, nowUtc);
    console.log(`[Auto-Select] After D+1 filter: ${d1Matches.length} matches`);

    if (d1Matches.length === 0) {
      console.log('[Auto-Select] No NBA matches found for D+1, nothing to select');
      return NextResponse.json({ 
        ok: true, 
        message: "No NBA matches for D+1",
        generatedCount: 0
      });
    }

    // 4. Lock the selected matches (don't generate predictions yet)
    try {
      const selectedIds = d1Matches.map((m: any) => String(m.id));
      await lockNBASelection(selectedIds);
      console.log(`[Auto-Select] 🔒 Locked selection: ${selectedIds.join(', ')}`);
    } catch (e) {
      console.warn('[Auto-Select] Error locking selection:', e);
      return NextResponse.json(
        { ok: false, error: "Failed to lock selection" },
        { status: 500 }
      );
    }

    console.log(`[Auto-Select] ✅ Successfully selected and locked ${d1Matches.length} matches`);
    console.log(`[Auto-Select] Predictions will be generated at 12:00 WIB by auto-predict worker`);

    return NextResponse.json({
      ok: true,
      message: `Selected and locked ${d1Matches.length} NBA matches for D+1`,
      timestamp: nowUtc.toISOString(),
      selectedCount: d1Matches.length,
      matches: d1Matches.map(m => `${m.home} vs ${m.away}`),
      nextStep: "Predictions will generate at 12:00 WIB",
    });

  } catch (err: any) {
    console.error('[Auto-Select] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

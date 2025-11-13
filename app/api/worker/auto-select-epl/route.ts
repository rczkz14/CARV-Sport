/**
 * Auto-Select EPL Worker
 * Triggers at 11:00 PM WIB (23:00 UTC)
 * Selects and locks 6 EPL matches from D to D+16 range
 */

import { NextResponse } from "next/server";
import { isAutoSelectTimeEPL, filterEPLMatchesToDateRange, getEPLWindowStatus, lockEPLSelection } from "@/lib/eplWindowManager";
import { fetchLiveMatchData } from "@/lib/sportsFetcher";
import { promises as fs } from 'fs';
import path from 'path';

async function readCache(): Promise<any> {
  try {
    const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[EPL Auto-Select] Error reading cache file:', error);
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
      console.warn('[EPL Auto-Select] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const windowStatus = getEPLWindowStatus(nowUtc);
    console.log(`[EPL Auto-Select] Called at ${nowUtc.toISOString()} UTC (${windowStatus.wibHour}:00 WIB)`);

    // Check if we're within the auto-select window (23:00-23:05 UTC = 11:00-11:05 PM WIB)
    const isValidTime = isAutoSelectTimeEPL(nowUtc);
    if (!isValidTime) {
      console.warn(`[EPL Auto-Select] Called at wrong time. Current UTC hour: ${windowStatus.utcHour}, expected: 23`);
      console.log('[EPL Auto-Select] Proceeding anyway (manual trigger allowed)');
    }

    // 1. Fetch current cache
    const cachedData = await readCache();
    if (!cachedData) {
      return NextResponse.json({ ok: false, error: "Cache not available" }, { status: 503 });
    }

    // 2. Get EPL matches from cache
    console.log('[EPL Auto-Select] Fetching EPL matches...');
    let eplMatches: any[] = [];
    
    try {
      const byId = new Map<string, any>();
      
      if (cachedData.epl?.league && Array.isArray(cachedData.epl.league)) {
        cachedData.epl.league.forEach((m: any) => {
          if (m.idEvent) byId.set(String(m.idEvent), m);
        });
      }
      
      if (cachedData.epl?.daily && Array.isArray(cachedData.epl.daily)) {
        cachedData.epl.daily.forEach((m: any) => {
          if (m.idEvent) byId.set(String(m.idEvent), m);
        });
      }
      
      eplMatches = Array.from(byId.values());
      console.log(`[EPL Auto-Select] Got ${eplMatches.length} unique EPL matches from cache`);
    } catch (e) {
      console.warn('[EPL Auto-Select] Error reading EPL cache:', e);
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
      for (const match of eplMatches) {
        const liveMatch = liveMap.get(String(match.idEvent));
        if (liveMatch) {
          if (liveMatch.homeScore !== null) match.intHomeScore = liveMatch.homeScore;
          if (liveMatch.awayScore !== null) match.intAwayScore = liveMatch.awayScore;
          if (liveMatch.status) match.strStatus = liveMatch.status;
        }
      }
    } catch (error) {
      console.warn('[EPL Auto-Select] Failed to fetch live data (continuing with cache):', error);
    }

    // Normalize match data format for filtering
    const normalizedMatches = eplMatches.map((e: any) => {
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
        league: e.strLeague || "English Premier League",
        datetime: datetime,
        venue: e.strVenue,
        raw: e,
      };
    });

    // 3. Filter to D to D+16 range and select 6 random minimum
    const dRangeMatches = filterEPLMatchesToDateRange(normalizedMatches, nowUtc);
    console.log(`[EPL Auto-Select] After D to D+16 filter: ${dRangeMatches.length} matches`);

    if (dRangeMatches.length < 6) {
      console.log(`[EPL Auto-Select] Warning: Only ${dRangeMatches.length} matches available, need minimum 6`);
      if (dRangeMatches.length === 0) {
        return NextResponse.json({ 
          ok: true, 
          message: "No EPL matches in D to D+16 range",
          generatedCount: 0
        });
      }
    }

    // Randomly shuffle and pick up to 6 (or fewer if not available)
    for (let i = dRangeMatches.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dRangeMatches[i], dRangeMatches[j]] = [dRangeMatches[j], dRangeMatches[i]];
    }

    const selectedMatches = dRangeMatches.slice(0, 6);

    // 4. Lock the selected matches
    try {
      const selectedIds = selectedMatches.map((m: any) => String(m.id));
      await lockEPLSelection(selectedIds);
      console.log(`[EPL Auto-Select] 🔒 Locked selection: ${selectedIds.join(', ')}`);
    } catch (e) {
      console.warn('[EPL Auto-Select] Error locking selection:', e);
      return NextResponse.json(
        { ok: false, error: "Failed to lock selection" },
        { status: 500 }
      );
    }

    console.log(`[EPL Auto-Select] ✅ Successfully selected and locked ${selectedMatches.length} matches`);
    console.log(`[EPL Auto-Select] Predictions will be generated at 12:00 AM WIB by auto-predict-epl worker`);

    return NextResponse.json({
      ok: true,
      message: `Selected and locked ${selectedMatches.length} EPL matches from D to D+16 (minimum 6)`,
      timestamp: nowUtc.toISOString(),
      selectedCount: selectedMatches.length,
      matches: selectedMatches.map(m => `${m.home} vs ${m.away}`),
      nextStep: "Predictions will generate at 12:00 AM WIB",
    });

  } catch (err: any) {
    console.error('[EPL Auto-Select] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

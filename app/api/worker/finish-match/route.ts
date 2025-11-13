/**
 * Finish Match Handler
 * Called when a match reaches FT (Final) status
 * Moves it from current window to history
 */

import { NextResponse } from "next/server";
import { saveToNBAHistory } from "@/lib/predictionGenerator";
import path from "path";
import { promises as fs } from "fs";

export async function POST(req: Request) {
  try {
    // Verify API key
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key');
    const expectedKey = process.env.WORKER_API_KEY || 'test-key';
    
    if (authHeader !== `Bearer ${expectedKey}` && authHeader !== expectedKey) {
      console.warn('[Finish Match] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      eventId,
      home,
      away,
      league,
      datetime,
      venue,
      homeScore,
      awayScore,
      status,
    } = body;

    if (!eventId || !home || !away) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: eventId, home, away" },
        { status: 400 }
      );
    }

    console.log(`[Finish Match] Processing: ${home} vs ${away} (FT: ${homeScore}-${awayScore})`);

    // Save to NBA history
    await saveToNBAHistory({
      id: eventId,
      home,
      away,
      league: league || "NBA",
      datetime,
      venue,
      homeScore,
      awayScore,
      status: status || "Final",
    });

    return NextResponse.json({
      ok: true,
      message: `Saved ${home} vs ${away} to NBA history`,
      eventId,
    });

  } catch (err: any) {
    console.error('[Finish Match] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check and process finished matches
 * Can be called periodically to update history from live data
 */
export async function GET(req: Request) {
  try {
    // Verify API key
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-api-key');
    const expectedKey = process.env.WORKER_API_KEY || 'test-key';
    
    if (authHeader !== `Bearer ${expectedKey}` && authHeader !== expectedKey) {
      console.warn('[Finish Match Check] Unauthorized access attempt');
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    console.log('[Finish Match Check] Checking for finished NBA matches...');

    // Read current active matches from cache
    const cacheFile = path.join(process.cwd(), 'data/api_fetch.json');
    let cachedData: any = {};
    try {
      const data = await fs.readFile(cacheFile, 'utf-8');
      cachedData = JSON.parse(data);
    } catch (e) {
      console.warn('[Finish Match Check] Could not read cache:', e);
    }

    // Get all NBA matches from cache
    let nbaMatches: any[] = [];
    if (Array.isArray(cachedData.nba?.league)) {
      nbaMatches.push(...cachedData.nba.league);
    }
    if (Array.isArray(cachedData.nba?.daily)) {
      nbaMatches.push(...cachedData.nba.daily);
    }

    // Filter to finished matches
    const finishedMatches = nbaMatches.filter((m: any) => {
      const status = String(m.strStatus || "").toUpperCase();
      return status === "FT" || status === "FINAL" || status.includes("FINAL");
    });

    console.log(`[Finish Match Check] Found ${finishedMatches.length} finished matches in cache`);

    // Save each finished match to history
    let savedCount = 0;
    for (const match of finishedMatches) {
      try {
        await saveToNBAHistory({
          id: match.idEvent,
          home: match.strHomeTeam,
          away: match.strAwayTeam,
          league: "NBA",
          datetime: match.strTimestamp || match.dateEvent,
          venue: match.strVenue,
          homeScore: match.intHomeScore ? parseInt(match.intHomeScore) : null,
          awayScore: match.intAwayScore ? parseInt(match.intAwayScore) : null,
          status: match.strStatus,
        });
        savedCount++;
      } catch (e) {
        console.warn(`[Finish Match Check] Error processing match ${match.idEvent}:`, e);
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Checked ${finishedMatches.length} finished matches, saved ${savedCount}`,
      finishedCount: finishedMatches.length,
      savedCount,
    });

  } catch (err: any) {
    console.error('[Finish Match Check] Error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}

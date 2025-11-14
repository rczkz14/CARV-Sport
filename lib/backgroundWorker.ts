/**
 * Background Worker
 * 
 * Runs periodically to:
 * 1. Fetch latest matches from ESPN API
 * 2. Select random matches for current window
 * 3. Generate predictions for selected matches
 */

import { fetchLiveMatchData, fetchEPLUpcoming, fetchLaLigaUpcoming } from './sportsFetcher';
import { selectMatchesForWindow, selectFootballD1Matches, getSelectedMatches } from './matchSelector';
import { generatePredictionsForMatches } from './predictionGenerator';
import { promises as fs } from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'data/api_fetch.json');

/**
 * Read cached data
 */
async function readCache(): Promise<any> {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[Worker] Error reading cache:', error);
    return null;
  }
}

/**
 * Parse matches into normalized format
 */
function normalizeMatches(
  nbaRaw: any[],
  eplRaw: any[],
  laligaRaw: any[]
): { nba: any[]; epl: any[]; laliga: any[] } {
  const parseMatch = (m: any, league: string) => {
    // Handle ESPN format
    if (m.homeScore !== undefined) {
      return {
        id: m.id,
        home: m.home,
        away: m.away,
        league: league,
        datetime: m.datetime,
        venue: m.venue,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        status: m.status,
        startMs: m.datetime ? new Date(m.datetime).getTime() : null,
      };
    }
    // Handle TheSportsDB format
    return {
      id: m.idEvent,
      home: m.strHomeTeam,
      away: m.strAwayTeam,
      league: league,
      datetime: m.strTimestamp,
      venue: m.strVenue,
      homeScore: m.intHomeScore ? parseInt(m.intHomeScore) : null,
      awayScore: m.intAwayScore ? parseInt(m.intAwayScore) : null,
      status: m.strStatus,
      startMs: m.strTimestamp ? new Date(m.strTimestamp).getTime() : null,
    };
  };

  return {
    nba: nbaRaw.map((m) => parseMatch(m, 'NBA')),
    epl: eplRaw.map((m) => parseMatch(m, 'English Premier League')),
    laliga: laligaRaw.map((m) => parseMatch(m, 'Spanish La Liga')),
  };
}

/**
 * Main worker function - runs every 5 minutes
 */
export async function runWorker() {
  try {
    console.log('[Worker] Starting background worker...');

    // Step 1: Fetch latest matches from API
    console.log('[Worker] Fetching latest matches from ESPN API...');
    const cachedData = await readCache();
    if (!cachedData) {
      console.warn('[Worker] Cache not available, skipping worker');
      return;
    }

    let liveData: any[] = [];
    try {
      liveData = await fetchLiveMatchData(cachedData);
    } catch (error) {
      console.warn('[Worker] Live data fetch failed, using cache:', error);
    }

    // Parse matches - combine both league and daily sections
    const nbaRaw = [
      ...(cachedData.nba?.daily || []),
      ...(cachedData.nba?.league || []),
    ];
    const eplRaw = [
      ...(cachedData.epl?.daily || []),
      ...(cachedData.epl?.league || []),
    ];
    const laligaRaw = [
      ...(cachedData.laliga?.daily || []),
      ...(cachedData.laliga?.league || []),
    ];

    const { nba, epl, laliga } = normalizeMatches(nbaRaw, eplRaw, laligaRaw);

    // Step 1b: Also fetch D-1 football matches (EPL/LaLiga)
    console.log('[Worker] Fetching D-1 football matches from football-data.org...');
    let eplD1: any[] = [];
    let laligaD1: any[] = [];
    try {
      eplD1 = await fetchEPLUpcoming();
      laligaD1 = await fetchLaLigaUpcoming();
      console.log(`[Worker] Fetched ${eplD1.length} EPL D-1, ${laligaD1.length} LaLiga D-1 matches`);
    } catch (error) {
      console.warn('[Worker] Football D-1 fetch failed:', error);
    }

    // Combine with ESPN data
    const eplCombined = [...epl, ...eplD1];
    const laligaCombined = [...laliga, ...laligaD1];

    console.log(`[Worker] Found ${nba.length} NBA, ${eplCombined.length} EPL (combined), ${laligaCombined.length} LaLiga (combined) matches`);

    // Step 2: Select matches for current window
    console.log('[Worker] Selecting matches for current window...');
    const selected = await selectMatchesForWindow(nba, eplCombined, laligaCombined);
    
    // Step 2b: Also select D-1 football matches
    console.log('[Worker] Selecting D-1 football matches...');
    const footballD1 = await selectFootballD1Matches(eplD1, laligaD1);
    console.log(`[Worker] D-1 Football selected - EPL: ${footballD1.epl.length}, LaLiga: ${footballD1.laliga.length}`);
    
    // Step 3: Get all selected matches with full data
    const selectedMatches = [
      ...nba.filter((m) => selected.nba.includes(m.id)),
      ...eplCombined.filter((m) => selected.epl.includes(m.id)),
      ...laligaCombined.filter((m) => selected.laliga.includes(m.id)),
      ...eplD1.filter((m) => footballD1.epl.includes(m.id)),
      ...laligaD1.filter((m) => footballD1.laliga.includes(m.id)),
    ];

    console.log(`[Worker] Selected ${selectedMatches.length} matches total`);

    // Step 4: Auto-generate predictions for selected matches
    // NOTE: For NBA, predictions are generated by auto-predict-nba endpoint only (uses locked selection)
    // Disable all prediction generation in background worker - let dedicated workers handle it
    console.log('[Worker] [AUTO-PREDICT] Skipping prediction generation (handled by dedicated worker endpoints)');


    // Step 5: Update prediction results for finished matches (every 4 hours)
    const now = new Date();
    const shouldUpdateResults = now.getUTCHours() % 4 === 0 && now.getUTCMinutes() < 5; // Every 4 hours for 5 minutes

    if (shouldUpdateResults) {
      console.log('[Worker] Updating prediction results for finished matches...');
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/predictions/update-results`, {
          method: 'GET',
        }).catch(() => null); // Don't fail worker if update fails
      } catch (error) {
        console.warn('[Worker] Failed to update results:', error);
      }
    }

    console.log('[Worker] Worker completed successfully');
  } catch (error) {
    console.error('[Worker] Error running worker:', error);
  }
}

/**
 * Start the worker (runs every 1 hour)
 */
export function startBackgroundWorker() {
  console.log('[Worker] Initializing background worker (runs every 1 hour)...');
  
  // Run immediately on start
  runWorker();
  
  // Then run every 1 hour
  setInterval(() => {
    runWorker().catch((error) => {
      console.error('[Worker] Unhandled error in worker:', error);
    });
  }, 60 * 60 * 1000); // 1 hour
}

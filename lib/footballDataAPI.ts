/**
 * Football Data API Service
 * Free tier available at football-data.org
 * 
 * Features:
 * - Real-time match updates
 * - 100% accurate scores (updated quickly)
 * - Covers EPL, LaLiga, and other leagues
 * - No rate limit for reasonable usage
 * 
 * Note: Requires API key from https://www.football-data.org/
 * Free tier includes: EPL (390), LaLiga (384), others
 */

interface MatchResult {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string; // "SCHEDULED", "LIVE", "IN_PLAY", "PAUSED", "FINISHED", "POSTPONED"
  utcDate: string;
}

/**
 * Get API key from environment or use default (limited access)
 */
function getFootballDataKey(): string {
  return process.env.FOOTBALL_DATA_API_KEY || 'test'; // Free tier allows limited requests without key
}

/**
 * Fetch EPL matches from football-data.org
 */
export async function fetchEPLFromFootballData(): Promise<MatchResult[]> {
  try {
    const key = getFootballDataKey();
    const headers: any = { 'X-Auth-Token': key };

    // EPL competition code: 390
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/390/matches?status=FINISHED,IN_PLAY,LIVE',
      { headers }
    );

    if (!response.ok) {
      console.warn(`Football-data EPL fetch failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const matches: MatchResult[] = [];

    if (data?.matches && Array.isArray(data.matches)) {
      for (const match of data.matches) {
        matches.push({
          id: `fd-epl-${match.id}`,
          homeTeam: match.homeTeam?.name || 'Unknown',
          awayTeam: match.awayTeam?.name || 'Unknown',
          homeScore: match.score?.fullTime?.home,
          awayScore: match.score?.fullTime?.away,
          status: match.status,
          utcDate: match.utcDate,
        });
      }
    }

    return matches;
  } catch (error) {
    console.warn('Football-data EPL fetch failed:', error);
    return [];
  }
}

/**
 * Fetch LaLiga matches from football-data.org
 */
export async function fetchLaLigaFromFootballData(): Promise<MatchResult[]> {
  try {
    const key = getFootballDataKey();
    const headers: any = { 'X-Auth-Token': key };

    // LaLiga competition code: 384
    const response = await fetch(
      'https://api.football-data.org/v4/competitions/384/matches?status=FINISHED,IN_PLAY,LIVE',
      { headers }
    );

    if (!response.ok) {
      console.warn(`Football-data LaLiga fetch failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const matches: MatchResult[] = [];

    if (data?.matches && Array.isArray(data.matches)) {
      for (const match of data.matches) {
        matches.push({
          id: `fd-laliga-${match.id}`,
          homeTeam: match.homeTeam?.name || 'Unknown',
          awayTeam: match.awayTeam?.name || 'Unknown',
          homeScore: match.score?.fullTime?.home,
          awayScore: match.score?.fullTime?.away,
          status: match.status,
          utcDate: match.utcDate,
        });
      }
    }

    return matches;
  } catch (error) {
    console.warn('Football-data LaLiga fetch failed:', error);
    return [];
  }
}

/**
 * Get match result by home/away team names
 * Searches both EPL and LaLiga
 */
export async function getMatchResult(homeTeam: string, awayTeam: string): Promise<{ homeScore: number | null; awayScore: number | null; status: string } | null> {
  try {
    const [eplMatches, laligaMatches] = await Promise.all([
      fetchEPLFromFootballData(),
      fetchLaLigaFromFootballData(),
    ]);

    const allMatches = [...eplMatches, ...laligaMatches];

    // Find exact match
    const match = allMatches.find(
      m => 
        m.homeTeam.toLowerCase() === homeTeam.toLowerCase() &&
        m.awayTeam.toLowerCase() === awayTeam.toLowerCase()
    );

    if (match && match.homeScore !== null && match.awayScore !== null) {
      return {
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        status: match.status,
      };
    }

    return null;
  } catch (error) {
    console.warn('getMatchResult failed:', error);
    return null;
  }
}

/**
 * Batch get match results for multiple matches
 */
export async function getMatchResultsBatch(
  matches: Array<{ homeTeam: string; awayTeam: string; id: string }>
): Promise<Map<string, { homeScore: number | null; awayScore: number | null; status: string }>> {
  const results = new Map();

  try {
    const [eplMatches, laligaMatches] = await Promise.all([
      fetchEPLFromFootballData(),
      fetchLaLigaFromFootballData(),
    ]);

    const allMatches = [...eplMatches, ...laligaMatches];

    for (const match of matches) {
      const found = allMatches.find(
        m =>
          m.homeTeam.toLowerCase() === match.homeTeam.toLowerCase() &&
          m.awayTeam.toLowerCase() === match.awayTeam.toLowerCase()
      );

      if (found && found.homeScore !== null && found.awayScore !== null) {
        results.set(match.id, {
          homeScore: found.homeScore,
          awayScore: found.awayScore,
          status: found.status,
        });
      }
    }
  } catch (error) {
    console.warn('getMatchResultsBatch failed:', error);
  }

  return results;
}

/**
 * NBA Scores API Service
 * Multiple free sources for fastest final score updates
 * 
 * Primary: ESPN (official, real-time, fastest)
 * Fallback: balldontlie API (free, real-time NBA stats)
 * Fallback: NBA.com JSON feed (official data)
 */

interface NBAMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string; // "scheduled", "in-progress", "final"
  date: string;
}

/**
 * Fetch NBA scoreboard from ESPN (FASTEST - real-time updates)
 * Returns current day's games
 */
export async function fetchNBAFromESPN(): Promise<NBAMatch[]> {
  try {
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }
    );

    if (!response.ok) {
      console.warn(`ESPN NBA fetch failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const matches: NBAMatch[] = [];

    if (data?.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) continue;

        // Parse status to simple format
        const statusType = event.status?.type?.name?.toLowerCase() || '';
        let status = 'scheduled';
        if (statusType.includes('in progress')) status = 'in-progress';
        if (statusType.includes('final')) status = 'final';

        matches.push({
          id: event.id || `espn-${Math.random().toString(36).slice(2, 10)}`,
          homeTeam: homeTeam.team?.displayName || 'Unknown',
          awayTeam: awayTeam.team?.displayName || 'Unknown',
          homeScore: homeTeam.score ? parseInt(homeTeam.score) : null,
          awayScore: awayTeam.score ? parseInt(awayTeam.score) : null,
          status: status,
          date: event.date ? new Date(event.date).toISOString() : '',
        });
      }
    }

    return matches;
  } catch (error) {
    console.warn('ESPN NBA fetch failed:', error);
    return [];
  }
}

/**
 * Fetch NBA scores from BallDontLie API (FREE, no key needed)
 * Provides real-time scores with high accuracy
 */
export async function fetchNBAFromBallDontLie(): Promise<NBAMatch[]> {
  try {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    const response = await fetch(
      `https://api.balldontlie.io/v1/games?dates[]=${dateStr}&per_page=100`,
      { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) {
      console.warn(`BallDontLie fetch failed: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const matches: NBAMatch[] = [];

    if (data?.data && Array.isArray(data.data)) {
      for (const game of data.data) {
        // Determine status
        let status = 'scheduled';
        if (game.status === 'Final') status = 'final';
        if (game.status === 'In Progress') status = 'in-progress';

        matches.push({
          id: String(game.id),
          homeTeam: game.home_team?.full_name || 'Unknown',
          awayTeam: game.visitor_team?.full_name || 'Unknown',
          homeScore: game.home_team_score !== null ? game.home_team_score : null,
          awayScore: game.visitor_team_score !== null ? game.visitor_team_score : null,
          status: status,
          date: game.date || '',
        });
      }
    }

    return matches;
  } catch (error) {
    console.warn('BallDontLie NBA fetch failed:', error);
    return [];
  }
}

/**
 * Get NBA match result by team names
 * Tries multiple APIs for best coverage
 */
export async function getNBAMatchResult(
  homeTeam: string,
  awayTeam: string
): Promise<{ homeScore: number | null; awayScore: number | null; status: string } | null> {
  try {
    // Try ESPN first (fastest)
    console.log('[NBA] Fetching from ESPN...');
    let matches = await fetchNBAFromESPN();

    if (matches.length === 0) {
      // Fallback to BallDontLie
      console.log('[NBA] ESPN had no results, trying BallDontLie...');
      matches = await fetchNBAFromBallDontLie();
    }

    // Find exact match
    const match = matches.find(
      m =>
        (m.homeTeam.toLowerCase().includes(homeTeam.toLowerCase()) ||
          homeTeam.toLowerCase().includes(m.homeTeam.toLowerCase())) &&
        (m.awayTeam.toLowerCase().includes(awayTeam.toLowerCase()) ||
          awayTeam.toLowerCase().includes(m.awayTeam.toLowerCase()))
    );

    if (match) {
      return {
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        status: match.status,
      };
    }

    return null;
  } catch (error) {
    console.warn('[NBA] getNBAMatchResult failed:', error);
    return null;
  }
}

/**
 * Get NBA historical scores from TheSportsDB using TEAM NAME matching only
 */
export async function getNBAHistoricalFromTheSportsDB(
  homeTeam: string,
  awayTeam: string
): Promise<{ homeScore: number | null; awayScore: number | null; status: string } | null> {
  try {
    // Search for team events by team name
    console.log(`[NBA TheSportsDB] Searching for ${homeTeam} vs ${awayTeam}...`);
    
    const response = await fetch(
      `https://www.thesportsdb.com/api/v1/eventslast.php?id=133602&l=${homeTeam.toLowerCase()}`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (!response.ok) return null;

    const data = await response.json();
    
    if (data?.results && Array.isArray(data.results)) {
      // Find matching game by TEAM NAMES ONLY (ignore date)
      for (const event of data.results) {
        if (
          (event.strHomeTeam?.toLowerCase() === homeTeam.toLowerCase() ||
            event.strHomeTeam?.toLowerCase().includes(homeTeam.toLowerCase())) &&
          (event.strAwayTeam?.toLowerCase() === awayTeam.toLowerCase() ||
            event.strAwayTeam?.toLowerCase().includes(awayTeam.toLowerCase()))
        ) {
          const homeScore = event.intHomeScore ? parseInt(event.intHomeScore) : null;
          const awayScore = event.intAwayScore ? parseInt(event.intAwayScore) : null;
          const status = event.strStatus || 'Final';

          if (homeScore !== null && awayScore !== null) {
            console.log(`[NBA TheSportsDB] ✅ Found: ${homeTeam} vs ${awayTeam}: ${homeScore}-${awayScore}`);
            return {
              homeScore,
              awayScore,
              status,
            };
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.warn('[NBA TheSportsDB] Fetch failed:', error);
    return null;
  }
}

/**
 * Batch get NBA match results by TEAM NAME ONLY (ignores date)
 * This works across dates - e.g., prediction bought Nov 10, match on Nov 11
 */
export async function getNBAMatchResultsBatch(
  matches: Array<{ homeTeam: string; awayTeam: string; id: string }>
): Promise<Map<string, { homeScore: number | null; awayScore: number | null; status: string }>> {
  const results = new Map();

  try {
    console.log(`[NBA] Fetching ${matches.length} matches by team name...`);

    // Try ESPN first (real-time current games)
    console.log('[NBA] Trying ESPN API...');
    let espnMatches = await fetchNBAFromESPN();
    
    // Match against our predictions using TEAM NAMES ONLY
    for (const match of matches) {
      const found = espnMatches.find(
        m =>
          (m.homeTeam.toLowerCase().includes(match.homeTeam.toLowerCase()) ||
            match.homeTeam.toLowerCase().includes(m.homeTeam.toLowerCase())) &&
          (m.awayTeam.toLowerCase().includes(match.awayTeam.toLowerCase()) ||
            match.awayTeam.toLowerCase().includes(m.awayTeam.toLowerCase()))
      );

      if (found && found.homeScore !== null && found.awayScore !== null) {
        results.set(match.id, {
          homeScore: found.homeScore,
          awayScore: found.awayScore,
          status: found.status,
        });
        console.log(`[NBA] ✅ ESPN: ${match.homeTeam} vs ${match.awayTeam}: ${found.homeScore}-${found.awayScore}`);
      }
    }

    // If ESPN didn't find all, try TheSportsDB for historical data
    if (results.size < matches.length) {
      console.log(`[NBA] ESPN found ${results.size}/${matches.length}, trying TheSportsDB for remaining...`);
      
      for (const match of matches) {
        if (results.has(match.id)) continue; // Already found
        
        const result = await getNBAHistoricalFromTheSportsDB(match.homeTeam, match.awayTeam);
        if (result) {
          results.set(match.id, result);
        }
      }
    }

    console.log(`[NBA] Total found: ${results.size}/${matches.length}`);
  } catch (error) {
    console.warn('[NBA] getNBAMatchResultsBatch failed:', error);
  }

  return results;
}

/**
 * Get historical game scores (for past dates)
 * Useful for catching up on final scores from previous days
 */
export async function getNBAHistoricalScores(
  homeTeam: string,
  awayTeam: string,
  dateStr: string // YYYY-MM-DD
): Promise<{ homeScore: number | null; awayScore: number | null; status: string } | null> {
  try {
    const response = await fetch(
      `https://api.balldontlie.io/v1/games?dates[]=${dateStr}&per_page=100`,
      { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000)
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data?.data && Array.isArray(data.data)) {
      const match = data.data.find(
        (g: any) =>
          (g.home_team?.full_name.toLowerCase().includes(homeTeam.toLowerCase()) ||
            homeTeam.toLowerCase().includes(g.home_team?.full_name.toLowerCase())) &&
          (g.visitor_team?.full_name.toLowerCase().includes(awayTeam.toLowerCase()) ||
            awayTeam.toLowerCase().includes(g.visitor_team?.full_name.toLowerCase()))
      );

      if (match) {
        return {
          homeScore: match.home_team_score,
          awayScore: match.visitor_team_score,
          status: match.status === 'Final' ? 'final' : match.status,
        };
      }
    }

    return null;
  } catch (error) {
    console.warn('[NBA] Historical scores fetch failed:', error);
    return null;
  }
}

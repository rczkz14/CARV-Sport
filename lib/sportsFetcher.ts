/**
 * Sports Data Fetcher
 * Primary: TheSportsDB API (free, reliable, comprehensive soccer data)
 * Fallback: ESPN API (free, no rate limit, fast)
 */

interface SportEvent {
  id: string;
  league: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string | null;
  datetime: string | null;
  venue?: string | null;
}

/**
 * Fetch current and upcoming NBA matches from ESPN (current day + up to 2 days)
 */
async function fetchNBAUpcoming(): Promise<SportEvent[]> {
  try {
    // ESPN API endpoint for NBA scoreboard
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!response.ok) throw new Error(`ESPN NBA API error: ${response.status}`);

    const data = await response.json();
    const events: SportEvent[] = [];
    const now = new Date();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;

    if (data?.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) continue;

        // Filter: matches within 2 days from now
        if (event.date) {
          const matchTime = new Date(event.date).getTime();
          const timeUntilMatch = matchTime - now.getTime();
          if (timeUntilMatch > 0 && timeUntilMatch <= twoDaysMs) {
            events.push({
              id: event.id || `espn-nba-${Math.random().toString(36).slice(2, 10)}`,
              league: 'NBA',
              home: homeTeam.team?.displayName || 'Unknown',
              away: awayTeam.team?.displayName || 'Unknown',
              homeScore: homeTeam.score ? parseInt(homeTeam.score) : null,
              awayScore: awayTeam.score ? parseInt(awayTeam.score) : null,
              status: event.status?.type?.description || null,
              datetime: new Date(event.date).toISOString(),
              venue: competition.venue?.fullName || undefined,
            });
          }
        }
      }
    }

    return events;
  } catch (error) {
    console.warn('ESPN NBA fetch failed:', error);
    return [];
  }
}

/**
 * Fetch NBA matches from ESPN
 */
async function fetchNBAFromESPN(): Promise<SportEvent[]> {
  try {
    // ESPN API endpoint for NBA scoreboard
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!response.ok) throw new Error(`ESPN NBA API error: ${response.status}`);

    const data = await response.json();
    const events: SportEvent[] = [];

    if (data?.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) continue;

        events.push({
          id: event.id || `espn-nba-${Math.random().toString(36).slice(2, 10)}`,
          league: 'NBA',
          home: homeTeam.team?.displayName || 'Unknown',
          away: awayTeam.team?.displayName || 'Unknown',
          homeScore: homeTeam.score ? parseInt(homeTeam.score) : null,
          awayScore: awayTeam.score ? parseInt(awayTeam.score) : null,
          status: event.status?.type?.description || null,
          datetime: event.date ? new Date(event.date).toISOString() : null,
          venue: competition.venue?.fullName || undefined,
        });
      }
    }

    return events;
  } catch (error) {
    console.warn('ESPN NBA fetch failed:', error);
    return [];
  }
}

/**
 * Fetch Premier League matches from ESPN
 */
async function fetchEPLFromESPN(): Promise<SportEvent[]> {
  try {
    // ESPN API endpoint for Premier League
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!response.ok) throw new Error(`ESPN EPL API error: ${response.status}`);

    const data = await response.json();
    const events: SportEvent[] = [];

    if (data?.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) continue;

        events.push({
          id: event.id || `espn-epl-${Math.random().toString(36).slice(2, 10)}`,
          league: 'English Premier League',
          home: homeTeam.team?.displayName || 'Unknown',
          away: awayTeam.team?.displayName || 'Unknown',
          homeScore: homeTeam.score ? parseInt(homeTeam.score) : null,
          awayScore: awayTeam.score ? parseInt(awayTeam.score) : null,
          status: event.status?.type?.description || null,
          datetime: event.date ? new Date(event.date).toISOString() : null,
          venue: competition.venue?.fullName || undefined,
        });
      }
    }

    return events;
  } catch (error) {
    console.warn('ESPN EPL fetch failed:', error);
    return [];
  }
}

/**
 * Fetch La Liga matches from ESPN
 */
async function fetchLaLigaFromESPN(): Promise<SportEvent[]> {
  try {
    // ESPN API endpoint for La Liga (Spain)
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    if (!response.ok) throw new Error(`ESPN La Liga API error: ${response.status}`);

    const data = await response.json();
    const events: SportEvent[] = [];

    if (data?.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) continue;

        events.push({
          id: event.id || `espn-laliga-${Math.random().toString(36).slice(2, 10)}`,
          league: 'Spanish La Liga',
          home: homeTeam.team?.displayName || 'Unknown',
          away: awayTeam.team?.displayName || 'Unknown',
          homeScore: homeTeam.score ? parseInt(homeTeam.score) : null,
          awayScore: awayTeam.score ? parseInt(awayTeam.score) : null,
          status: event.status?.type?.description || null,
          datetime: event.date ? new Date(event.date).toISOString() : null,
          venue: competition.venue?.fullName || undefined,
        });
      }
    }

    return events;
  } catch (error) {
    console.warn('ESPN La Liga fetch failed:', error);
    return [];
  }
}

/**
 * Fetch all sports from ESPN (primary)
 */
export async function fetchAllFromESPN(): Promise<SportEvent[]> {
  const [nba, epl, laliga] = await Promise.all([
    fetchNBAFromESPN(),
    fetchEPLFromESPN(),
    fetchLaLigaFromESPN(),
  ]);

  return [...nba, ...epl, ...laliga];
}

/**
 * Fetch from TheSportsDB as fallback
 * This reads from your cached data file
 */
export async function fetchAllFromTheSportsDB(cachedData: any): Promise<SportEvent[]> {
  const events: SportEvent[] = [];

  try {
    // NBA
    if (cachedData?.nba?.daily && Array.isArray(cachedData.nba.daily)) {
      for (const ev of cachedData.nba.daily) {
        events.push({
          id: ev.idEvent,
          league: 'NBA',
          home: ev.strHomeTeam,
          away: ev.strAwayTeam,
          homeScore: ev.intHomeScore ? parseInt(ev.intHomeScore) : null,
          awayScore: ev.intAwayScore ? parseInt(ev.intAwayScore) : null,
          status: ev.strStatus || null,
          datetime: ev.strTimestamp ? new Date(ev.strTimestamp).toISOString() : null,
          venue: ev.strVenue || undefined,
        });
      }
    }

    // EPL
    if (cachedData?.epl?.daily && Array.isArray(cachedData.epl.daily)) {
      for (const ev of cachedData.epl.daily) {
        events.push({
          id: ev.idEvent,
          league: 'English Premier League',
          home: ev.strHomeTeam,
          away: ev.strAwayTeam,
          homeScore: ev.intHomeScore ? parseInt(ev.intHomeScore) : null,
          awayScore: ev.intAwayScore ? parseInt(ev.intAwayScore) : null,
          status: ev.strStatus || null,
          datetime: ev.strTimestamp ? new Date(ev.strTimestamp).toISOString() : null,
          venue: ev.strVenue || undefined,
        });
      }
    }

    // La Liga
    if (cachedData?.laliga?.daily && Array.isArray(cachedData.laliga.daily)) {
      for (const ev of cachedData.laliga.daily) {
        events.push({
          id: ev.idEvent,
          league: 'Spanish La Liga',
          home: ev.strHomeTeam,
          away: ev.strAwayTeam,
          homeScore: ev.intHomeScore ? parseInt(ev.intHomeScore) : null,
          awayScore: ev.intAwayScore ? parseInt(ev.intAwayScore) : null,
          status: ev.strStatus || null,
          datetime: ev.strTimestamp ? new Date(ev.strTimestamp).toISOString() : null,
          venue: ev.strVenue || undefined,
        });
      }
    }
  } catch (error) {
    console.warn('TheSportsDB fallback parsing failed:', error);
  }

  return events;
}

/**
 * Main fetcher with TheSportsDB primary + ESPN fallback
 */
export async function fetchLiveMatchData(cachedData: any): Promise<SportEvent[]> {
  try {
    console.log('Attempting TheSportsDB API fetch...');
    const thesportsdbData = await fetchAllFromTheSportsDB(cachedData);

    if (thesportsdbData && thesportsdbData.length > 0) {
      console.log(`✅ TheSportsDB API successful: ${thesportsdbData.length} events`);
      return thesportsdbData;
    }
  } catch (error) {
    console.warn('❌ TheSportsDB API failed, falling back to ESPN:', error);
  }

  try {
    console.log('Attempting ESPN fallback...');
    const espnData = await Promise.race([
      fetchAllFromESPN(),
      new Promise<SportEvent[]>((_, reject) =>
        setTimeout(() => reject(new Error('ESPN timeout')), 10000) // 10 second timeout
      )
    ]);

    if (espnData && espnData.length > 0) {
      console.log(`✅ ESPN fallback successful: ${espnData.length} events`);
      return espnData;
    }
  } catch (error) {
    console.error('❌ ESPN fallback also failed:', error);
  }

  console.warn('⚠️ All fetchers failed, returning empty array');
  return [];
}

/**
 * Read cached data from api_fetch.json
 */
async function readCachedData(): Promise<any> {
  try {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');
    const cacheFile = path.join(process.cwd(), 'data/api_fetch.json');
    const data = await fs.readFile(cacheFile, 'utf-8');
    const parsed = JSON.parse(data);
    console.log(`[SportsFetcher] Cached data loaded - EPL: ${parsed.epl?.league?.length || 0}, LaLiga: ${parsed.laliga?.league?.length || 0}`);
    return parsed;
  } catch (error) {
    console.warn('[SportsFetcher] Could not read cached data:', error);
    return null;
  }
}

/**
 * Fetch EPL matches - using TheSportsDB cached data + ESPN fallback
 */
export async function fetchEPLUpcoming(): Promise<SportEvent[]> {
  try {
    console.log('[SportsFetcher] Fetching EPL upcoming matches...');
    
    // First try cached data from TheSportsDB
    const cachedData = await readCachedData();
    if (cachedData?.epl?.league && Array.isArray(cachedData.epl.league)) {
      const now = new Date();
      const futureLimit = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      
      console.log(`[SportsFetcher] EPL cache has ${cachedData.epl.league.length} total matches, filtering for future matches...`);
      
      const events: SportEvent[] = [];
      for (const match of cachedData.epl.league) {
        if (!match.strTimestamp) {
          console.warn(`[SportsFetcher] EPL match missing timestamp: ${match.strEvent}`);
          continue;
        }
        
        const matchTime = new Date(match.strTimestamp);
        if (matchTime > now && matchTime <= futureLimit) {
          console.log(`[SportsFetcher] EPL Match OK: ${match.strHomeTeam} vs ${match.strAwayTeam} at ${match.strTimestamp}`);
          events.push({
            id: match.idEvent,
            league: 'English Premier League',
            home: match.strHomeTeam,
            away: match.strAwayTeam,
            homeScore: match.intHomeScore ? parseInt(match.intHomeScore) : null,
            awayScore: match.intAwayScore ? parseInt(match.intAwayScore) : null,
            status: match.strStatus,
            datetime: new Date(match.strTimestamp).toISOString(),
            venue: match.strVenue,
          });
        } else if (matchTime <= now) {
          console.log(`[SportsFetcher] EPL Match too old: ${match.strHomeTeam} vs ${match.strAwayTeam} at ${match.strTimestamp}`);
        }
      }
      
      console.log(`[SportsFetcher] Fetched ${events.length} EPL matches from cached data (out of ${cachedData.epl.league.length})`);
      if (events.length > 0) return events;
    }
    
    // Fallback to ESPN
    console.log('[SportsFetcher] No cached EPL data, falling back to ESPN...');
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) throw new Error(`ESPN EPL API error: ${response.status}`);

    const data = await response.json();
    const events: SportEvent[] = [];

    if (data?.events && Array.isArray(data.events)) {
      const now = new Date();
      const futureLimit = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

      for (const event of data.events) {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) continue;

        if (event.date) {
          const eventTime = new Date(event.date);
          if (eventTime > now && eventTime <= futureLimit) {
            events.push({
              id: event.id || `espn-epl-${Math.random().toString(36).slice(2, 10)}`,
              league: 'English Premier League',
              home: homeTeam.team?.displayName || 'Unknown',
              away: awayTeam.team?.displayName || 'Unknown',
              homeScore: homeTeam.score ? parseInt(homeTeam.score) : null,
              awayScore: awayTeam.score ? parseInt(awayTeam.score) : null,
              status: event.status?.type?.description || null,
              datetime: event.date ? new Date(event.date).toISOString() : null,
              venue: competition.venue?.fullName || undefined,
            });
          }
        }
      }
    }

    console.log(`[SportsFetcher] Fetched ${events.length} EPL matches from ESPN`);
    return events;
  } catch (error) {
    console.warn('[SportsFetcher] EPL upcoming fetch failed:', error);
    return [];
  }
}

/**
 * Fetch LaLiga matches - using TheSportsDB cached data + ESPN fallback
 */
export async function fetchLaLigaUpcoming(): Promise<SportEvent[]> {
  try {
    console.log('[SportsFetcher] Fetching LaLiga upcoming matches...');
    
    // First try cached data from TheSportsDB
    const cachedData = await readCachedData();
    if (cachedData?.laliga?.league && Array.isArray(cachedData.laliga.league)) {
      const now = new Date();
      const futureLimit = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
      
      console.log(`[SportsFetcher] LaLiga cache has ${cachedData.laliga.league.length} total matches, filtering for future matches...`);
      
      const events: SportEvent[] = [];
      for (const match of cachedData.laliga.league) {
        if (!match.strTimestamp) {
          console.warn(`[SportsFetcher] LaLiga match missing timestamp: ${match.strEvent}`);
          continue;
        }
        
        const matchTime = new Date(match.strTimestamp);
        if (matchTime > now && matchTime <= futureLimit) {
          console.log(`[SportsFetcher] LaLiga Match OK: ${match.strHomeTeam} vs ${match.strAwayTeam} at ${match.strTimestamp}`);
          events.push({
            id: match.idEvent,
            league: 'Spanish La Liga',
            home: match.strHomeTeam,
            away: match.strAwayTeam,
            homeScore: match.intHomeScore ? parseInt(match.intHomeScore) : null,
            awayScore: match.intAwayScore ? parseInt(match.intAwayScore) : null,
            status: match.strStatus,
            datetime: new Date(match.strTimestamp).toISOString(),
            venue: match.strVenue,
          });
        } else if (matchTime <= now) {
          console.log(`[SportsFetcher] LaLiga Match too old: ${match.strHomeTeam} vs ${match.strAwayTeam} at ${match.strTimestamp}`);
        }
      }
      
      console.log(`[SportsFetcher] Fetched ${events.length} LaLiga matches from cached data (out of ${cachedData.laliga.league.length})`);
      if (events.length > 0) return events;
    }
    
    // Fallback to ESPN
    console.log('[SportsFetcher] No cached LaLiga data, falling back to ESPN...');
    const response = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) }
    );

    if (!response.ok) throw new Error(`ESPN LaLiga API error: ${response.status}`);

    const data = await response.json();
    const events: SportEvent[] = [];

    if (data?.events && Array.isArray(data.events)) {
      const now = new Date();
      const futureLimit = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

      for (const event of data.events) {
        const competition = event.competitions?.[0];
        if (!competition) continue;

        const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home');
        const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) continue;

        if (event.date) {
          const eventTime = new Date(event.date);
          if (eventTime > now && eventTime <= futureLimit) {
            events.push({
              id: event.id || `espn-laliga-${Math.random().toString(36).slice(2, 10)}`,
              league: 'Spanish La Liga',
              home: homeTeam.team?.displayName || 'Unknown',
              away: awayTeam.team?.displayName || 'Unknown',
              homeScore: homeTeam.score ? parseInt(homeTeam.score) : null,
              awayScore: awayTeam.score ? parseInt(awayTeam.score) : null,
              status: event.status?.type?.description || null,
              datetime: event.date ? new Date(event.date).toISOString() : null,
              venue: competition.venue?.fullName || undefined,
            });
          }
        }
      }
    }

    console.log(`[SportsFetcher] Fetched ${events.length} LaLiga matches from ESPN`);
    return events;
  } catch (error) {
    console.warn('[SportsFetcher] LaLiga upcoming fetch failed:', error);
    return [];
  }
}

/**
 * Export NBA upcoming matches - 2 days lookahead, all matches within window
 */
export { fetchNBAUpcoming };

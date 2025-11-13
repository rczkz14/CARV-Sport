const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');

async function fetchRealEPLMatches() {
  const nodeFetch = await import('node-fetch').then(m => m.default);
  try {
    console.log('Fetching real EPL matches from football-data.org...');
    
    // EPL competition code: 390
    const response = await nodeFetch(
      'https://api.football-data.org/v4/competitions/390/matches?status=SCHEDULED,LIVE,IN_PLAY',
      { 
        headers: { 
          'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY || 'demo'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Got ${data.matches?.length || 0} matches from API`);

    if (!data.matches || data.matches.length === 0) {
      console.warn('No matches returned from API. Might need valid API key.');
      return [];
    }

    // Convert to our format
    const matches = data.matches.map(m => ({
      idEvent: String(m.id),
      strHomeTeam: m.homeTeam.name,
      strAwayTeam: m.awayTeam.name,
      strTimestamp: m.utcDate,
      strVenue: m.venue || 'TBD',
      strLeague: 'English Premier League',
      strStatus: m.status === 'FINISHED' ? 'FT' : (m.status === 'LIVE' ? 'LIVE' : 'Not Started'),
      intHomeScore: m.score.fullTime.home,
      intAwayScore: m.score.fullTime.away,
    }));

    console.log('Converted matches:');
    matches.slice(0, 5).forEach(m => {
      console.log(`  - ${m.strHomeTeam} vs ${m.strAwayTeam} (${m.strTimestamp})`);
    });

    return matches;
  } catch (error) {
    console.error('Error fetching from football-data.org:', error.message);
    return [];
  }
}

async function main() {
  const matches = await fetchRealEPLMatches();
  
  if (matches.length === 0) {
    console.log('\n⚠️  No matches fetched. You need a valid API key from https://www.football-data.org/');
    console.log('Free tier available - register and set FOOTBALL_DATA_API_KEY environment variable');
    return;
  }

  // Update cache
  const cache = JSON.parse(fs.readFileSync('data/api_fetch.json', 'utf-8'));
  cache.epl = cache.epl || {};
  cache.epl.league = matches;
  cache.epl.daily = [];

  fs.writeFileSync('data/api_fetch.json', JSON.stringify(cache, null, 2));
  console.log(`\n✅ Updated cache with ${matches.length} real EPL matches`);
}

main();

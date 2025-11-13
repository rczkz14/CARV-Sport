const fs = require('fs').promises;
const path = require('path');

const SPORTSDB_KEY = process.env.SPORTSDB_KEY || "123";
const BASE = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}`;
const CACHE_FILE = path.join(__dirname, '../data/laliga_cache.json');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`  Fetching: ${url}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      console.log(`  ✓ Success`);
      return data;
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
      if (i === retries - 1) throw error;
      await delay(1000 * (i + 1));
    }
  }
}

async function fetchLaligaData() {
  const data = {
    matches: [],
    lastFetched: new Date().toISOString()
  };

  try {
    console.log('📺 Fetching upcoming La Liga matches...');
    const laligaUpcoming = await fetchWithRetry(`${BASE}/eventsnextleague.php?id=4335`);
    
    if (laligaUpcoming?.events && Array.isArray(laligaUpcoming.events)) {
      console.log(`  Found ${laligaUpcoming.events.length} upcoming events`);
      
      for (const match of laligaUpcoming.events) {
        if (match.idEvent) {
          // 2.5 second delay for rate limiting (30 requests/minute max)
          await delay(2500);
          
          console.log(`  📝 Looking up event ${match.idEvent}...`);
          const liveData = await fetchWithRetry(`${BASE}/lookupevent.php?id=${match.idEvent}`);
          
          if (liveData?.events?.[0]) {
            const evt = liveData.events[0];
            data.matches.push({
              id: evt.idEvent,
              league: 'Spanish La Liga',
              home: evt.strHomeTeam || evt.strHome,
              away: evt.strAwayTeam || evt.strAway,
              datetime: evt.dateEvent ? `${evt.dateEvent}T${evt.strTime || '15:00:00'}Z` : null,
              venue: evt.strVenue,
              homeScore: evt.intHomeScore !== null && evt.intHomeScore !== undefined ? parseInt(evt.intHomeScore) : null,
              awayScore: evt.intAwayScore !== null && evt.intAwayScore !== undefined ? parseInt(evt.intAwayScore) : null,
              status: evt.strStatus || 'NS'
            });
          }
        }
      }
    }

    console.log(`\n✅ Total La Liga matches fetched: ${data.matches.length}`);
    return data;
  } catch (error) {
    console.error('❌ Error fetching La Liga data:', error.message);
    throw error;
  }
}

async function updateCache() {
  try {
    console.log('🔄 Fetching upcoming La Liga matches from TheSportsDB API...\n');
    const data = await fetchLaligaData();
    
    // Ensure data directory exists
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    
    // Write to cache file
    await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
    console.log(`\n💾 Cache saved to ${CACHE_FILE}`);
    
    if (data.matches.length > 0) {
      console.log('\n📋 La Liga Matches:');
      data.matches.slice(0, 5).forEach(m => {
        console.log(`  • ${m.home} vs ${m.away} on ${m.datetime}`);
      });
    }
  } catch (error) {
    console.error('Error updating cache:', error);
    process.exit(1);
  }
}

// Run immediately
updateCache();

const fs = require('fs').promises;
const path = require('path');

const SPORTSDB_KEY = process.env.SPORTSDB_KEY || "123";
const BASE = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}`;
const CACHE_FILE = path.join(__dirname, '../data/api_fetch.json');
const ONE_HOUR = 60 * 60 * 1000; // 1 hour in milliseconds

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pad(n) {
  return String(n).padStart(2, "0");
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await delay(1000 * (i + 1)); // Exponential backoff
    }
  }
}

async function getDates(days = 3) {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    const dateStr = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
    dates.push(dateStr);
  }
  return dates;
}

async function fetchAllData() {
  const data = {
    nba: {
      league: [],
      daily: []
    },
    epl: {
      league: [],
      daily: []
    },
    laliga: {
      league: [],
      daily: []
    },
    lastFetched: new Date().toISOString()
  };

  try {
    // Fetch NBA league data
    console.log('Fetching NBA league data...');
    const nbaLeague = await fetchWithRetry(`${BASE}/eventsnextleague.php?id=4387`);
    if (nbaLeague?.events) {
      data.nba.league = nbaLeague.events;
    }
    await delay(2000); // Delay between requests

    // Fetch EPL league data - use eventsseason to get current round
    console.log('Fetching EPL league data...');
    const eplLeague = await fetchWithRetry(`${BASE}/eventsseason.php?id=4328&s=2025-2026`);
    if (eplLeague?.events) {
      // Get upcoming and recent matches (filter last 15 events which cover current round)
      const sortedEvents = eplLeague.events
        .filter(e => e.dateEvent)
        .sort((a, b) => new Date(b.dateEvent) - new Date(a.dateEvent))
        .slice(0, 20);
      data.epl.league = sortedEvents;
    }
    await delay(2000);

    // Fetch LaLiga league data
    console.log('Fetching LaLiga league data...');
    const laligaLeague = await fetchWithRetry(`${BASE}/eventsseason.php?id=4335&s=2025-2026`);
    if (laligaLeague?.events) {
      // Get upcoming and recent matches
      const sortedEvents = laligaLeague.events
        .filter(e => e.dateEvent)
        .sort((a, b) => new Date(b.dateEvent) - new Date(a.dateEvent))
        .slice(0, 20);
      data.laliga.league = sortedEvents;
    }
    await delay(2000);

    // Fetch daily data for next 3 days
    const dates = await getDates(3);
    
    for (const date of dates) {
      console.log(`Fetching daily data for ${date}...`);
      
      // NBA daily with scores
      const nbaDaily = await fetchWithRetry(`${BASE}/eventsday.php?d=${date}&s=Basketball&l=NBA`);
      if (nbaDaily?.events) {
        // Fetch live scores for each event
        for (const event of nbaDaily.events) {
          if (event.idEvent) {
            const liveData = await fetchWithRetry(`${BASE}/lookupevent.php?id=${event.idEvent}`);
            if (liveData?.events?.[0]) {
              event.intHomeScore = liveData.events[0].intHomeScore;
              event.intAwayScore = liveData.events[0].intAwayScore;
              event.strStatus = liveData.events[0].strStatus;
            }
          }
        }
        data.nba.daily.push(...nbaDaily.events);
      }
      await delay(2000);

      // EPL daily
      const eplDaily = await fetchWithRetry(`${BASE}/eventsday.php?d=${date}&s=Soccer&l=English%20Premier%20League`);
      if (eplDaily?.events) {
        data.epl.daily.push(...eplDaily.events);
      }
      await delay(2000);

      // LaLiga daily
      const laligaDaily = await fetchWithRetry(`${BASE}/eventsday.php?d=${date}&s=Soccer&l=La%20Liga`);
      if (laligaDaily?.events) {
        data.laliga.daily.push(...laligaDaily.events);
      }
      await delay(2000);
    }

    return data;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

async function updateCache() {
  try {
    // Check if cache exists and is less than 1 hour old
    try {
      const stats = await fs.stat(CACHE_FILE);
      const cacheContent = await fs.readFile(CACHE_FILE, 'utf-8');
      const cache = JSON.parse(cacheContent);
      
      if (cache.lastFetched && new Date().getTime() - new Date(cache.lastFetched).getTime() < ONE_HOUR) {
        console.log('Cache is still fresh, skipping update');
        return;
      }
    } catch (e) {
      // File doesn't exist or is invalid, proceed with fetch
    }

    console.log('Fetching fresh data...');
    const data = await fetchAllData();
    
    // Ensure data directory exists
    await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
    
    // Write to cache file
    await fs.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
    console.log('Cache updated successfully');
  } catch (error) {
    console.error('Error updating cache:', error);
  }
}

// Run immediately and then every hour
updateCache();
setInterval(updateCache, ONE_HOUR);

// Handle process termination
process.on('SIGINT', () => {
  console.log('Gracefully shutting down...');
  process.exit(0);
});
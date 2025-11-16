

require('dotenv').config({ path: '.env.local' });
const fs = require('fs').promises;
const path = require('path');

const SPORTSDB_KEY = process.env.SPORTSDB_KEY || "123";
const BASE = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}`;
const CACHE_FILE = path.join(__dirname, '../data/nba_matches.json');

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
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

async function fetchNBAMatchesForToday() {
  // --- PATCH: Search for matches on 17 Nov and 18 Nov WIB ---
  const targetDates = [
    { day: 17, month: 10, year: 2025 }, // 17 Nov 2025
    { day: 18, month: 10, year: 2025 }  // 18 Nov 2025
  ];
  const WIB_OFFSET = 7 * 60 * 60 * 1000;

  // We'll fetch for a range of UTC dates to cover both WIB dates
  // Let's try today, tomorrow, and yesterday in UTC to cover all possible matches
  const now = new Date();
  const utcDates = [
    new Date(now.getTime()),
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    new Date(now.getTime() - 24 * 60 * 60 * 1000)
  ];

  let allMatches = [];
  for (const utcDateObj of utcDates) {
    const utcYear = utcDateObj.getUTCFullYear();
    const utcMonth = pad(utcDateObj.getUTCMonth() + 1);
    const utcDay = pad(utcDateObj.getUTCDate());
    const dateStr = `${utcYear}-${utcMonth}-${utcDay}`;
    console.log(`Fetching NBA matches for ${dateStr} from SportDB...`);
    const nbaDaily = await fetchWithRetry(`${BASE}/eventsday.php?d=${dateStr}&s=Basketball&l=NBA`);
    if (nbaDaily?.events) {
      allMatches = allMatches.concat(nbaDaily.events);
    }
  }

  // Only keep matches where WIB date matches either target date
  let filteredMatches = allMatches.filter(m => {
    if (!m.strTimestamp) return false;
    const utcDateObj = new Date(m.strTimestamp);
    const wibDateObj = new Date(utcDateObj.getTime() + WIB_OFFSET);
    return targetDates.some(target =>
      wibDateObj.getDate() === target.day &&
      wibDateObj.getMonth() === target.month &&
      wibDateObj.getFullYear() === target.year
    );
  });
  // Filter to max 5 per day
  let matchesByDate = {};
  for (const target of targetDates) {
    const key = `${target.year}-${pad(target.month + 1)}-${pad(target.day)}`;
    matchesByDate[key] = filteredMatches.filter(m => {
      const utcDateObj = new Date(m.strTimestamp);
      const wibDateObj = new Date(utcDateObj.getTime() + WIB_OFFSET);
      return (
        wibDateObj.getDate() === target.day &&
        wibDateObj.getMonth() === target.month &&
        wibDateObj.getFullYear() === target.year
      );
    }).slice(0, 5);
  }

  // Insert matches into Supabase
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    for (const key in matchesByDate) {
      const matches = matchesByDate[key];
      const rows = matches.map(m => ({
        event_id: m.idEvent,
        home_team: m.strHomeTeam,
        away_team: m.strAwayTeam,
        event_date: m.strTimestamp || null,
        status: 'open',
        created_at: new Date().toISOString(),
        venue: m.strVenue || null,
        home_score: null,
        away_score: null,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from('nba_matches_pending').upsert(rows, { onConflict: 'event_id' });
        if (error) {
          console.error(`Error inserting NBA matches for ${key} into Supabase:`, error.message);
        } else {
          console.log(`Inserted ${rows.length} NBA matches for ${key} into Supabase nba_matches_pending.`);
        }
      } else {
        console.log(`No NBA matches to insert for ${key}.`);
      }
    }
  } catch (e) {
    console.error('Supabase insert error:', e);
  }

}

function scheduleAt(hourUTC, minuteUTC, task) {
  // Schedule the task to run at a specific UTC time every day
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setUTCHours(hourUTC, minuteUTC, 0, 0);
  if (nextRun <= now) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }
  const delay = nextRun.getTime() - now.getTime();
  setTimeout(async () => {
    await task();
    scheduleAt(hourUTC, minuteUTC, task); // Reschedule for next day
  }, delay);
  console.log(`Scheduled NBA fetch at ${nextRun.toISOString()} (UTC)`);
}

// Check if --schedule flag is provided
const shouldSchedule = process.argv.includes('--schedule');

// Run immediately for testing
(async () => {
  await fetchNBAMatchesForToday();

  if (shouldSchedule) {
    console.log('Scheduling daily NBA fetch at 04:00 UTC...');
    scheduleAt(4, 0, fetchNBAMatchesForToday);
  } else {
    console.log('NBA fetch completed. Use --schedule flag to run continuously.');
    process.exit(0);
  }
})();
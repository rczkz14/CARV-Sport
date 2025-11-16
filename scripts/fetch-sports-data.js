

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
  // --- PATCH: Filter for specific WIB date ---
  // Set your target WIB date here (e.g., 17 Nov)
  const targetDay = 17; // day of month
  const targetMonth = 10; // November (0-based: Jan=0)
  const targetYear = 2025; // set year if needed, or use current year
  const WIB_OFFSET = 7 * 60 * 60 * 1000;

  // Get today's date in UTC (SportDB expects UTC)
  const now = new Date();
  const utcYear = now.getUTCFullYear();
  const utcMonth = pad(now.getUTCMonth() + 1);
  const utcDate = pad(now.getUTCDate());
  const dateStr = `${utcYear}-${utcMonth}-${utcDate}`;

  console.log(`Fetching NBA matches for ${dateStr} from SportDB...`);
  const nbaDaily = await fetchWithRetry(`${BASE}/eventsday.php?d=${dateStr}&s=Basketball&l=NBA`);
  let matches = nbaDaily?.events || [];

  // Only keep matches where WIB date matches target
  matches = matches.filter(m => {
    if (!m.strTimestamp) return false;
    const utcDateObj = new Date(m.strTimestamp);
    const wibDateObj = new Date(utcDateObj.getTime() + WIB_OFFSET);
    return (
      wibDateObj.getDate() === targetDay &&
      wibDateObj.getMonth() === targetMonth &&
      wibDateObj.getFullYear() === targetYear
    );
  });
  // Filter to max 5, min 1
  if (matches.length > 5) {
    matches = matches.slice(0, 5);
  }
  if (matches.length < 1) {
    console.warn('No NBA matches found for target WIB date!');
    matches = [];
  }

  // Insert matches into Supabase
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Prepare rows for nba_matches_pending
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
        console.error('Error inserting NBA matches into Supabase:', error.message);
      } else {
        console.log(`Inserted ${rows.length} NBA matches into Supabase nba_matches_pending.`);
      }
    } else {
      console.log('No NBA matches to insert into Supabase.');
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

// Run immediately for testing, then schedule
(async () => {
  await fetchNBAMatchesForToday();
  scheduleAt(4, 0, fetchNBAMatchesForToday);
})();
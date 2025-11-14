require('dotenv').config({ path: '.env.local' });
const fs = require('fs').promises;
const path = require('path');

const SPORTSDB_KEY = process.env.SPORTSDB_KEY || "123";
const BASE = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}`;

function pad(n) {
  return String(n).padStart(2, "0");
}

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

async function fetchSoccerMatches() {
  const matches = [];

  try {
    // Fetch EPL matches (league ID: 4328)
    console.log('📺 Fetching upcoming EPL matches...');
    const eplUpcoming = await fetchWithRetry(`${BASE}/eventsnextleague.php?id=4328`);

    if (eplUpcoming?.events && Array.isArray(eplUpcoming.events)) {
      console.log(`  Found ${eplUpcoming.events.length} EPL events`);

      for (const match of eplUpcoming.events.slice(0, 10)) { // Limit to 10
        if (match.idEvent) {
          await delay(2500); // Rate limiting

          console.log(`  📝 Looking up EPL event ${match.idEvent}...`);
          const liveData = await fetchWithRetry(`${BASE}/lookupevent.php?id=${match.idEvent}`);

          if (liveData?.events?.[0]) {
            const evt = liveData.events[0];
            matches.push({
              event_id: evt.idEvent,
              home_team: evt.strHomeTeam || evt.strHome,
              away_team: evt.strAwayTeam || evt.strAway,
              league: 'EPL',
              event_date: evt.dateEvent ? `${evt.dateEvent}T${evt.strTime || '15:00:00'}Z` : null,
              venue: evt.strVenue,
              status: 'pending'
            });
          }
        }
      }
    }

    // Fetch La Liga matches (league ID: 4335)
    console.log('📺 Fetching upcoming La Liga matches...');
    const laligaUpcoming = await fetchWithRetry(`${BASE}/eventsnextleague.php?id=4335`);

    if (laligaUpcoming?.events && Array.isArray(laligaUpcoming.events)) {
      console.log(`  Found ${laligaUpcoming.events.length} La Liga events`);

      for (const match of laligaUpcoming.events.slice(0, 10)) { // Limit to 10
        if (match.idEvent) {
          await delay(2500); // Rate limiting

          console.log(`  📝 Looking up La Liga event ${match.idEvent}...`);
          const liveData = await fetchWithRetry(`${BASE}/lookupevent.php?id=${match.idEvent}`);

          if (liveData?.events?.[0]) {
            const evt = liveData.events[0];
            matches.push({
              event_id: evt.idEvent,
              home_team: evt.strHomeTeam || evt.strHome,
              away_team: evt.strAwayTeam || evt.strAway,
              league: 'LaLiga',
              event_date: evt.dateEvent ? `${evt.dateEvent}T${evt.strTime || '15:00:00'}Z` : null,
              venue: evt.strVenue,
              status: 'pending'
            });
          }
        }
      }
    }

    console.log(`\n✅ Total soccer matches fetched: ${matches.length}`);
    return matches;
  } catch (error) {
    console.error('❌ Error fetching soccer data:', error.message);
    throw error;
  }
}

async function insertSoccerMatches(matches) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    if (matches.length > 0) {
      const { error } = await supabase.from('soccer_matches_pending').upsert(matches, { onConflict: 'event_id' });
      if (error) {
        console.error('Error inserting soccer matches into Supabase:', error.message);
      } else {
        console.log(`Inserted ${matches.length} soccer matches into Supabase soccer_matches_pending.`);
      }
    } else {
      console.log('No soccer matches to insert into Supabase.');
    }
  } catch (e) {
    console.error('Supabase insert error:', e);
  }
}

async function main() {
  try {
    console.log('🔄 Fetching upcoming soccer matches from TheSportsDB API...\n');
    const matches = await fetchSoccerMatches();

    await insertSoccerMatches(matches);

    if (matches.length > 0) {
      console.log('\n📋 Soccer Matches:');
      matches.slice(0, 5).forEach(m => {
        console.log(`  • ${m.home_team} vs ${m.away_team} (${m.league}) on ${m.event_date}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run immediately
main();
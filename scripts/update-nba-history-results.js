import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SPORTSDB_KEY = process.env.SPORTSDB_KEY || "123";
const BASE = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}`;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function updateResults() {
  // Get all matches in history with status 'waiting for result'
  const { data: historyMatches, error } = await supabase
    .from('nba_matches_history')
    .select('*')
    .eq('status', 'waiting for result');
  if (error) {
    console.error('Error fetching history matches:', error.message);
    return;
  }
  if (!historyMatches || historyMatches.length === 0) {
    console.log('No matches to update.');
    return;
  }

  for (const match of historyMatches) {
    try {
      // Fetch match result from SportDB
      const eventId = match.event_id;
      const url = `${BASE}/lookupevent.php?id=${eventId}`;
      const response = await fetch(url);
      const result = await response.json();
      const event = result?.events?.[0];
      if (!event) {
        console.warn(`No event found for id ${eventId}`);
        continue;
      }
      // Check if match is finished (FT, AOT)
      const status = event.strStatus || '';
      const homeScore = event.intHomeScore !== undefined ? parseInt(event.intHomeScore) : null;
      const awayScore = event.intAwayScore !== undefined ? parseInt(event.intAwayScore) : null;
      if (['ft', 'final', 'aot', 'after overtime'].includes(status.toLowerCase())) {
        // Determine winner
        let winner = null;
        if (homeScore !== null && awayScore !== null) {
          if (homeScore > awayScore) {
            winner = event.strHomeTeam || 'home';
          } else if (awayScore > homeScore) {
            winner = event.strAwayTeam || 'away';
          } else {
            winner = 'draw';
          }
        }
        // Set status for AOT
        let finalStatus = (status.toLowerCase() === 'aot' || status.toLowerCase() === 'after overtime') ? 'AOT' : 'final';
        // Update match in history
        const { error: updateError } = await supabase
          .from('nba_matches_history')
          .update({
            home_score: homeScore,
            away_score: awayScore,
            status: finalStatus,
            winner: winner,
          })
          .eq('event_id', eventId);
        if (updateError) {
          console.error(`Error updating match ${eventId}:`, updateError.message);
        } else {
          console.log(`Updated match ${eventId} with final score: ${homeScore}-${awayScore}, winner: ${winner}, status: ${finalStatus}`);
        }
      } else {
        console.log(`Match ${eventId} not finished yet. Status: ${status}`);
      }
    } catch (e) {
      console.error(`Error processing match ${match.event_id}:`, e);
    }
  }
}

// Run every 15 minutes (or as needed)
updateResults();

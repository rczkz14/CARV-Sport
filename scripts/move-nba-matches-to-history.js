// Script to move NBA matches from pending to history at 04:00 WIB (21:00 UTC)
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function moveMatchesToHistory() {
  // Get today's date in YYYY-MM-DD (WIB)
  const now = new Date();
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const wibDate = new Date(now.getTime() + wibOffsetMs);
  const wibDateStr = wibDate.toISOString().slice(0, 10); // YYYY-MM-DD

  // Fetch only pending NBA matches for today's WIB date
  const { data: pendingMatches, error } = await supabase
    .from('nba_matches_pending')
    .select('*')
    .eq('wib_time', wibDateStr);
  if (error) {
    console.error('Error fetching pending matches:', error.message);
    return;
  }
  if (!pendingMatches || pendingMatches.length === 0) {
    console.log('No pending NBA matches to move for WIB date', wibDateStr);
    return;
  }

  // Prepare history entries with all columns, set status and scores
  const historyEntries = pendingMatches.map(match => ({
    id: match.id,
    event_id: match.event_id,
    home_team: match.home_team,
    away_team: match.away_team,
    event_date: match.event_date,
    venue: match.venue || null,
    status: 'waiting for result',
    created_at: match.created_at,
    home_score: match.home_score || null,
    away_score: match.away_score || null,
    wib_time: match.wib_time,
  }));

  // Insert into history table
  const { error: insertError } = await supabase
    .from('nba_matches_history')
    .upsert(historyEntries, { onConflict: ['event_id'] });
  if (insertError) {
    console.error('Error inserting into history:', insertError.message);
    return;
  }

  // Delete from pending table
  const eventIds = pendingMatches.map(m => m.event_id);
  const { error: deleteError } = await supabase
    .from('nba_matches_pending')
    .delete()
    .in('event_id', eventIds);
  if (deleteError) {
    console.error('Error deleting from pending:', deleteError.message);
    return;
  }

  console.log(`Moved ${pendingMatches.length} NBA matches to history for WIB date ${wibDateStr} with status 'waiting for result'.`);
}

moveMatchesToHistory();

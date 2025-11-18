// app/api/matches/route.ts
import { NextResponse } from "next/server";
import { getNBAWindowStatus } from "@/lib/nbaWindowManager";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isHistory = url.searchParams.get('history') === 'true';

  let result: any[] = [];
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

    if (isHistory) {
      // History view: show completed matches from history tables
      const { data: nbaData, error: nbaError } = await supabase
        .from('nba_matches_history')
        .select('*');

      if (!nbaError && Array.isArray(nbaData)) {
        const nbaMatches = nbaData.map((e: any) => ({
          id: e.event_id || e.id,
          league: 'NBA',
          home: e.home_team,
          away: e.away_team,
          datetime: e.event_date,
          venue: e.venue || null,
          homeScore: e.home_score,
          awayScore: e.away_score,
          status: e.status || null,
          created_at: e.created_at,
          raw: e,
        }));
        result.push(...nbaMatches);
      }

      const { data: soccerData, error: soccerError } = await supabase
        .from('soccer_matches_history')
        .select('*')
        .or('status.ilike.%finished%,status.ilike.%final%,status.ilike.%ft%,status.ilike.%completed%,status.ilike.%FT%,status.ilike.%Waiting for Result%')
        .or('home_score.not.is.null,away_score.not.is.null');

      if (!soccerError && Array.isArray(soccerData)) {
        const soccerMatches = soccerData.map((e: any) => ({
          id: e.event_id || e.id,
          league: e.league || 'Soccer',
          home: e.home_team,
          away: e.away_team,
          datetime: e.event_date,
          venue: e.venue || null,
          homeScore: e.home_score,
          awayScore: e.away_score,
          status: e.status || null,
          created_at: e.created_at,
          raw: e,
        }));
        result.push(...soccerMatches);
      }
    } else {
      // Matches view: show pending matches for buying
      const { data: nbaData, error: nbaError } = await supabase
        .from('nba_matches_pending')
        .select('*');

      if (!nbaError && Array.isArray(nbaData)) {
        const windowStatus = getNBAWindowStatus();
        const nbaMatches = nbaData.map((e: any) => {
          // Check if match is within 24 hours and upcoming
          const eventTime = new Date(e.event_date);
          const now = new Date();
          const timeDiff = eventTime.getTime() - now.getTime();
          const isWithin24h = timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000;
          const isUpcoming = eventTime > now;

          let buyableFrom: string | null = null;
          if (!windowStatus.isOpen) {
            buyableFrom = "Available when window open";
          } else if (!isWithin24h) {
            buyableFrom = "Available 24 Hours before Match";
          }

          return {
            id: e.event_id || e.id,
            league: 'NBA',
            home: e.home_team,
            away: e.away_team,
            datetime: e.event_date,
            venue: e.venue || null,
            homeScore: e.home_score,
            awayScore: e.away_score,
            buyable: isUpcoming && isWithin24h && windowStatus.isOpen,
            buyableFrom,
            status: e.status || null,
            created_at: e.created_at,
            raw: e,
          };
        });
        result.push(...nbaMatches);
      }

      const { data: soccerData, error: soccerError } = await supabase
        .from('soccer_matches_pending')
        .select('*');

      if (!soccerError && Array.isArray(soccerData)) {
        const soccerMatches = soccerData.map((e: any) => ({
          id: e.event_id || e.id,
          league: e.league || 'Soccer',
          home: e.home_team,
          away: e.away_team,
          datetime: e.event_date,
          venue: e.venue || null,
          homeScore: e.home_score,
          awayScore: e.away_score,
          buyable: e.status === 'open',
          status: e.status || null,
          created_at: e.created_at,
          raw: e,
        }));
        result.push(...soccerMatches);
      }
    }

  } catch (e) {
    console.warn('Could not fetch matches from Supabase:', e);
  }
  return NextResponse.json({ ok: true, events: result });
}

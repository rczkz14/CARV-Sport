/**
 * API endpoint to fetch EPL and LaLiga matches from football-data.org
 * This ensures the API key is used from server-side environment
 */

export async function GET() {
  try {
    const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
    
    if (!API_KEY) {
      return Response.json(
        { error: 'FOOTBALL_DATA_API_KEY not configured' },
        { status: 500 }
      );
    }

    console.log(`[fetch-football] API Key available: ${API_KEY.substring(0, 10)}...`);

    // Fetch EPL
    console.log('[fetch-football] Fetching EPL matches...');
    const eplRes = await fetch(
      `https://api.football-data.org/v4/competitions/PL/matches`,
      {
        headers: { 'X-Auth-Token': API_KEY },
      }
    );

    const eplData = eplRes.ok ? await eplRes.json() : null;
    console.log(`[fetch-football] EPL response status: ${eplRes.status}, matches: ${eplData?.matches?.length || 0}`);

    // Fetch LaLiga
    console.log('[fetch-football] Fetching LaLiga matches...');
    const laligaRes = await fetch(
      `https://api.football-data.org/v4/competitions/LA_LIGA/matches`,
      {
        headers: { 'X-Auth-Token': API_KEY },
      }
    );

    const laligaData = laligaRes.ok ? await laligaRes.json() : null;
    console.log(`[fetch-football] LaLiga response status: ${laligaRes.status}, matches: ${laligaData?.matches?.length || 0}`);

    return Response.json({
      epl: {
        status: eplRes.status,
        matches: eplData?.matches?.length || 0,
        data: eplData,
      },
      laliga: {
        status: laligaRes.status,
        matches: laligaData?.matches?.length || 0,
        data: laligaData,
      },
    });
  } catch (error) {
    console.error('[fetch-football] Error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

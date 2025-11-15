import type { NextApiRequest, NextApiResponse } from 'next';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '@/lib/supabaseClient';

async function generatePrediction(match: any) {
  try {
    const homeScore = Math.floor(Math.random() * 30) + 95;
    const awayScore = Math.floor(Math.random() * 30) + 95;
    const totalScore = homeScore + awayScore;
    const predictedWinner = homeScore > awayScore ? match.home : match.away;
    const losingTeam = homeScore > awayScore ? match.away : match.home;
    const confidence = Math.floor(Math.random() * 21) + 55;
    const stories = [
      `In an epic clash, ${predictedWinner} comes into this matchup with exceptional momentum. Their recent performances have showcased dominant defensive schemes that will test ${losingTeam}'s offensive capabilities. The battle of tempo and rhythm will be crucial—${predictedWinner} has consistently controlled the pace of games, forcing opponents into uncomfortable positions. This strategic advantage, combined with their shooting accuracy, makes them strong favorites. ${losingTeam} will need to execute flawlessly to keep up.`,
      `${predictedWinner} enters this contest riding a wave of confidence. Their offensive efficiency in recent games has been remarkable, with ball movement that creates wide-open scoring opportunities. Meanwhile, ${losingTeam} has shown defensive vulnerabilities that ${predictedWinner} will look to exploit. The key matchup lies in ${predictedWinner}'s perimeter defense containing ${losingTeam}'s key scorers. If they can achieve this, victory becomes inevitable.`,
      `This is a story of depth versus expertise. ${predictedWinner} brings a well-rounded roster with contributions across the board, while ${losingTeam} relies heavily on star power. In today's game, ${predictedWinner}'s balanced attack should overwhelm ${losingTeam}'s defensive scheme. Look for ${predictedWinner} to establish dominance early and coast to a comfortable victory.`,
      `The narrative heading into this game favors ${predictedWinner}. Their recent adjustments have made them one of the most resilient teams in the league. ${losingTeam} will try to counter with aggressive play, but ${predictedWinner}'s experience and composure should prevail. This could be a statement win for ${predictedWinner}.`,
    ];
    const review = stories[Math.floor(Math.random() * stories.length)];
    const text = `Prediction\n\n🏀 ${match.home} vs ${match.away}\nPredicted Score: ${homeScore}-${awayScore}\nTotal Score: ${totalScore}\nPredicted Winner: ${predictedWinner}\nConfidence: ${confidence}%\n\nReview:\n${review}\n\nGenerated: ${new Date().toLocaleString()}`.trim();
    return { text, winner: predictedWinner, confidence };
  } catch (error) {
    console.error('Prediction generation failed:', error);
    return { text: 'Prediction generation failed. Please try again later.', winner: '', confidence: 0 };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Debug: Log every API call
  console.log('[API] /api/purchases called', req.method, req.body || req.query);
  try {
    // GET /api/purchases/count?eventid=xxx
    if (req.method === 'GET' && req.url?.includes('/count')) {
      const { eventid } = req.query;
      if (!eventid) {
        return res.status(400).json({ error: 'eventid required' });
      }
      const { count, error } = await supabase
        .from('purchases')
        .select('buyer', { count: 'exact', head: true })
        .eq('eventid', eventid);
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ count });
    }

    // GET /api/purchases?eventid=xxx&buyer=yyy
    if (req.method === 'GET') {
      const { eventid, buyer } = req.query;
      let query = supabase.from('purchases').select('*');
      if (eventid && buyer) {
        query = query.eq('eventid', eventid).eq('buyer', buyer);
      } else if (eventid) {
        query = query.eq('eventid', eventid);
      } else if (buyer) {
        query = query.eq('buyer', buyer);
      }
      const { data, error } = await query;
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ purchases: data });
    }

    if (req.method === 'POST') {
      const { eventid, buyer, txid, amount, token, prediction } = req.body;
    if (!eventid || !buyer) {
      return res.status(400).json({ error: 'eventid and buyer required' });
    }
      const { data: existing, error: existingError } = await supabase
        .from('purchases')
        .select('*')
        .eq('eventid', eventid)
        .eq('buyer', buyer);
      if (existingError) {
        console.error('[API] Supabase select error:', existingError.message);
        return res.status(500).json({ error: existingError.message });
      }
      if (existing && existing.length > 0) {
        console.warn('[API] Already purchased:', { eventid, buyer });
        return res.status(409).json({ error: 'Already purchased this event by this wallet' });
      }
    let finalPrediction = prediction;
    // Fetch match to check league
    const origin = req.headers['origin'] || `http://${req.headers['host']}`;
    const matchRes = await fetch(`${origin}/api/matches`);
    const matchData = await matchRes.json();
    const match = matchData.events?.find((e: any) => String(e.id) === String(eventid));
    const isNBA = match ? (match.league?.toLowerCase().includes('nba') || match.league?.toLowerCase().includes('basketball')) : false;
    const isSoccer = match ? (match.league?.toLowerCase().includes('premier league') || match.league?.toLowerCase().includes('english premier') || match.league?.toLowerCase().includes('epl') || match.league?.toLowerCase().includes('la liga') || match.league?.toLowerCase().includes('laliga') || match.league?.toLowerCase().includes('spanish')) : false;
    console.log('[API] Match league:', match?.league, 'isNBA:', isNBA, 'isSoccer:', isSoccer, 'eventid:', eventid);

    if (!finalPrediction) {
      if (match) {
        if (isNBA) {
          // Check if prediction exists in nba_predictions
          const { data: existingPred, error: predError } = await supabase
            .from('nba_predictions')
            .select('prediction_text')
            .eq('event_id', eventid)
            .single();
          console.log('[API] NBA check result:', { existingPred, predError });
          if (!predError && existingPred) {
            finalPrediction = existingPred.prediction_text;
            console.log('[API] Using existing NBA prediction');
          } else {
            // Generate and store
            console.log('[API] Generating new NBA prediction');
            const predData = await generatePrediction(match);
            finalPrediction = predData.text;
            // Store in nba_predictions
            const { error: insertPredError } = await supabase.from('nba_predictions').upsert([{
              event_id: eventid,
              prediction_winner: predData.winner,
              prediction_time: new Date().toISOString(),
              status: 'pending',
              prediction_text: predData.text,
              created_at: new Date().toISOString(),
            }], { onConflict: 'event_id' });
            if (insertPredError) {
              console.error('[API] Failed to store NBA prediction:', insertPredError.message);
            } else {
              console.log('[API] Stored NBA prediction');
            }
          }
        } else if (isSoccer) {
          // Check if prediction exists in soccer_predictions
          const { data: existingPred, error: predError } = await supabase
            .from('soccer_predictions')
            .select('prediction_text')
            .eq('event_id', eventid)
            .single();
          console.log('[API] Soccer check result:', { existingPred, predError });
          if (!predError && existingPred) {
            finalPrediction = existingPred.prediction_text;
            console.log('[API] Using existing soccer prediction');
          } else {
            // Generate and store
            console.log('[API] Generating new soccer prediction');
            const predData = await generatePrediction(match);
            finalPrediction = predData.text;
            // Store in soccer_predictions
            const { error: insertPredError } = await supabase.from('soccer_predictions').upsert([{
              event_id: eventid,
              prediction_winner: predData.winner,
              prediction_time: new Date().toISOString(),
              status: 'pending',
              prediction_text: predData.text,
              created_at: new Date().toISOString(),
            }], { onConflict: 'event_id' });
            if (insertPredError) {
              console.error('[API] Failed to store soccer prediction:', insertPredError.message);
            } else {
              console.log('[API] Stored soccer prediction');
            }
          }
        } else {
          // Other leagues, generate per purchase
          console.log('[API] Generating other league prediction');
          finalPrediction = (await generatePrediction(match)).text;
        }
      } else {
        finalPrediction = 'Match details not found. Prediction unavailable.';
      }
    }
            const rec = {
          eventid,
        buyer,
        txid: txid ?? null,
        amount: amount ?? null,
        token: token ?? null,
        prediction: (isNBA || isSoccer) ? null : finalPrediction, // Don't store prediction for NBA/Soccer in purchases
        timestamp: new Date().toISOString(),
      };
      const { error: insertError } = await supabase.from('purchases').insert([rec]);
      if (insertError) {
        console.error('[API] Supabase insert error:', insertError.message);
        return res.status(500).json({ error: insertError.message });
      }
      console.log('[API] Purchase inserted:', rec);
      return res.status(200).json({ ok: true, purchase: rec });
  }

    res.status(405).end();
  } catch (err) {
    console.error('[API] Unexpected error:', err);
    res.status(500).json({ error: 'Unexpected server error', details: String(err) });
  }
}

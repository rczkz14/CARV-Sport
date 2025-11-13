// app/api/purchases/route.ts

import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabaseClient";

async function generatePrediction(match: any) {
  try {
    // Generate prediction with Predicted Score, Total Score, Winner
    const homeScore = Math.floor(Math.random() * 30) + 95; // 95-125 for NBA
    const awayScore = Math.floor(Math.random() * 30) + 95; // 95-125 for NBA
    const totalScore = homeScore + awayScore;
    const predictedWinner = homeScore > awayScore ? match.home : match.away;
    const losingTeam = homeScore > awayScore ? match.away : match.home;
    const confidence = Math.floor(Math.random() * 21) + 55; // 55-75%
    
    const stories = [
      `In an epic clash, ${predictedWinner} comes into this matchup with exceptional momentum. Their recent performances have showcased dominant defensive schemes that will test ${losingTeam}'s offensive capabilities. The battle of tempo and rhythm will be crucial—${predictedWinner} has consistently controlled the pace of games, forcing opponents into uncomfortable positions. This strategic advantage, combined with their shooting accuracy, makes them strong favorites. ${losingTeam} will need to execute flawlessly to keep up.`,
      
      `${predictedWinner} enters this contest riding a wave of confidence. Their offensive efficiency in recent games has been remarkable, with ball movement that creates wide-open scoring opportunities. Meanwhile, ${losingTeam} has shown defensive vulnerabilities that ${predictedWinner} will look to exploit. The key matchup lies in ${predictedWinner}'s perimeter defense containing ${losingTeam}'s key scorers. If they can achieve this, victory becomes inevitable.`,
      
      `This is a story of depth versus expertise. ${predictedWinner} brings a well-rounded roster with contributions across the board, while ${losingTeam} relies heavily on star power. In today's game, ${predictedWinner}'s balanced attack should overwhelm ${losingTeam}'s defensive scheme. Look for ${predictedWinner} to establish dominance early and coast to a comfortable victory.`,
      
      `The narrative heading into this game favors ${predictedWinner}. Their recent adjustments have made them one of the most resilient teams in the league. ${losingTeam} will try to counter with aggressive play, but ${predictedWinner}'s experience and composure should prevail. This could be a statement win for ${predictedWinner}.`,
    ];
    
    const review = stories[Math.floor(Math.random() * stories.length)];
    
    return `
Prediction

🏀 ${match.home} vs ${match.away}
Predicted Score: ${homeScore}-${awayScore}
Total Score: ${totalScore}
Predicted Winner: ${predictedWinner}
Confidence: ${confidence}%

Review:
${review}

Generated: ${new Date().toLocaleString()}
    `.trim();
  } catch (error) {
    console.error("Prediction generation failed:", error);
    return "Prediction generation failed. Please try again later.";
  }
}

  // support optional query: ?eventId=...&buyer=...
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  const buyer = url.searchParams.get("buyer");

  let query = supabase.from("purchases").select("*");
  if (eventId && buyer) {
    query = query.eq("eventId", eventId).eq("buyer", buyer);
  } else if (eventId) {
    query = query.eq("eventId", eventId);
  } else if (buyer) {
    query = query.eq("buyer", buyer);
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ purchases: data });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { eventId, buyer, txid, amount, token, prediction } = body;

  if (!eventId || !buyer) {
    return NextResponse.json({ error: "eventId and buyer required" }, { status: 400 });
  }

  // enforce one purchase per buyer per event
  const { data: existing, error: existingError } = await supabase
    .from("purchases")
    .select("*")
    .eq("eventId", eventId)
    .eq("buyer", buyer);
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Already purchased this event by this wallet" }, { status: 409 });
  }

  // Use provided prediction or fallback
  let finalPrediction = prediction;
  if (!finalPrediction) {
    // Get match details from the matches API
    const matchRes = await fetch(`${request.headers.get("origin")}/api/matches`);
    const matchData = await matchRes.json();
    const match = matchData.events?.find((e: any) => String(e.id) === String(eventId));
    if (match) {
      finalPrediction = await generatePrediction(match);
    } else {
      finalPrediction = "Match details not found. Prediction unavailable.";
    }
  }

  const rec = {
    id: `${eventId}-${uuidv4()}`,
    eventId,
    buyer,
    txid: txid ?? null,
    amount: amount ?? null,
    token: token ?? null,
    prediction: finalPrediction,
    timestamp: new Date().toISOString(),
  };

  const { error: insertError } = await supabase.from("purchases").insert([rec]);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, purchase: rec });
}

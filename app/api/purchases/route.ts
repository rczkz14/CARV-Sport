// app/api/purchases/route.ts
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

const DATA_DIR = path.resolve(process.cwd(), "data");
const PURCHASES_FILE = path.join(DATA_DIR, "purchases.json");

function readPurchases() {
  if (!fs.existsSync(PURCHASES_FILE)) return { purchases: [] };
  try {
    return JSON.parse(fs.readFileSync(PURCHASES_FILE, "utf-8"));
  } catch {
    return { purchases: [] };
  }
}
function writePurchases(obj: any) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PURCHASES_FILE, JSON.stringify(obj, null, 2));
}

const PREDICTIONS_FILE = path.join(DATA_DIR, "predictions.json");

function readPredictions() {
  if (!fs.existsSync(PREDICTIONS_FILE)) return { predictions: {} };
  try {
    return JSON.parse(fs.readFileSync(PREDICTIONS_FILE, "utf-8"));
  } catch {
    return { predictions: {} };
  }
}

function writePredictions(obj: any) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(PREDICTIONS_FILE, JSON.stringify(obj, null, 2));
}

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

export async function GET(request: Request) {
  // support optional query: ?eventId=...&buyer=...
  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  const buyer = url.searchParams.get("buyer");

  const data = readPurchases();
  if (!eventId && !buyer) {
    return NextResponse.json(data);
  }

  const filtered = (data.purchases ?? []).filter((p: any) => {
    if (eventId && buyer) return p.eventId === eventId && p.buyer === buyer;
    if (eventId) return p.eventId === eventId;
    if (buyer) return p.buyer === buyer;
    return false;
  });

  return NextResponse.json({ purchases: filtered });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { eventId, buyer, txid, amount, token, prediction } = body;

  if (!eventId || !buyer) {
    return NextResponse.json({ error: "eventId and buyer required" }, { status: 400 });
  }

  const data = readPurchases();
  data.purchases = data.purchases ?? [];
  const predictionData = readPredictions();

  // enforce one purchase per buyer per event
  if (data.purchases.some((p: any) => p.eventId === eventId && p.buyer === buyer)) {
    return NextResponse.json({ error: "Already purchased this event by this wallet" }, { status: 409 });
  }

  // Check if we already have a prediction for this event
  let finalPrediction = predictionData.predictions[eventId];

  // If no prediction exists yet, generate one for the first buyer
  if (!finalPrediction) {
    // Get match details from the matches API
    const matchRes = await fetch(`${request.headers.get("origin")}/api/matches`);
    const matchData = await matchRes.json();
    const match = matchData.events?.find((e: any) => String(e.id) === String(eventId));
    
    if (match) {
      finalPrediction = await generatePrediction(match);
      predictionData.predictions[eventId] = finalPrediction;
      writePredictions(predictionData);
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

  data.purchases.push(rec);
  writePurchases(data);

  return NextResponse.json({ ok: true, purchase: rec });
}

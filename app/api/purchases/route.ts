
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/lib/supabaseClient";

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
    return `Prediction\n\n🏀 ${match.home} vs ${match.away}\nPredicted Score: ${homeScore}-${awayScore}\nTotal Score: ${totalScore}\nPredicted Winner: ${predictedWinner}\nConfidence: ${confidence}%\n\nReview:\n${review}\n\nGenerated: ${new Date().toLocaleString()}`.trim();
  } catch (error) {
    console.error("Prediction generation failed:", error);
    // This file is intentionally commented out to prevent build errors. Use pages/api/purchases.ts for your API handler.
  }

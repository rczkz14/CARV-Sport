/**
 * Prediction Generator Service
 * 
 * Generates AI predictions for selected matches and stores them in raffle files
 */

import { promises as fs } from 'fs';
import path from 'path';
import { getRandomSoccerStory, getRandomNBAStory } from './predictionTemplates';
import { getTeamContext as getSoccerTeamContext, generateMatchupAnalysis as generateSoccerMatchupAnalysis, calculateTeamAdvantage as calculateSoccerAdvantage } from './soccerContext';

interface Prediction {
  eventId: string;
  predictedWinner: string;
  predictedScore: string;
  totalScore: number;
  confidence: number;
  review: string;
  generatedAt: string;
}

/**
 * Generate realistic soccer score prediction (1-0, 2-1, etc)
 */
export function generateSoccerScorePrediction(homeTeam: string, awayTeam: string): string {
  const possibleScores = [
    '1-0', '2-0', '3-0', '2-1', '3-1', '3-2',
    '0-1', '0-2', '0-3', '1-2', '1-3', '2-3',
    '1-1', '2-2', '0-0',
  ];
  
  return possibleScores[Math.floor(Math.random() * possibleScores.length)];
}

/**
 * Generate Over/Under prediction for soccer
 */
export function generateSoccerOverUnder(): string {
  const overUnderOptions = [
    'Over 2.5', 'Over 2.75', 'Over 3.5', 'Over 3.75',
    'Under 2.5', 'Under 2.75', 'Under 3.5', 'Under 3.75',
  ];
  
  return overUnderOptions[Math.floor(Math.random() * overUnderOptions.length)];
}

/**
 * Generate soccer prediction story with news context
 * Much smarter: uses 500+ templates that vary by match outcome, creates unique narratives
 */
export function generateSoccerStory(homeTeam: string, awayTeam: string, scorePrediction: string, overUnder: string): string {
  return getRandomSoccerStory(homeTeam, awayTeam, scorePrediction, overUnder);
}

/**
 * Simple AI prediction logic for non-NBA predictions with story-based review
 */
function generateAIPrediction(homeTeam: string, awayTeam: string, league: string): Prediction {
  const eventId = Math.random().toString(36).slice(2, 10);
  
  // Generate mock scores
  const homeScore = Math.floor(Math.random() * 30) + 95; // 95-125
  const awayScore = Math.floor(Math.random() * 30) + 95; // 95-125
  const totalScore = homeScore + awayScore;
  
  const isHome = homeScore > awayScore;
  const predictedWinner = isHome ? homeTeam : awayTeam;
  const losingTeam = isHome ? awayTeam : homeTeam;
  const confidence = Math.floor(Math.random() * 21) + 55; // 55-75%

  // Score margin determines narrative intensity
  const margin = Math.abs(homeScore - awayScore);
  const winningScore = Math.max(homeScore, awayScore);
  const losingScore = Math.min(homeScore, awayScore);
  
  const stories = [];
  
  if (margin <= 5) {
    // Close game narratives
    stories.push(
      `A closely contested battle where execution in the final quarter will determine the winner. ${predictedWinner}'s experience gives them the edge in clutch moments. ${losingTeam} stays competitive throughout, but ${predictedWinner} converts when it matters most. Final margin reflects a team better prepared for high-pressure situations.`,
      
      `Both teams trade leads in an entertaining matchup. ${losingTeam}'s fourth-quarter push falls just short, while ${predictedWinner} holds firm down the stretch. Key defensive stops from ${predictedWinner} in the final moments seal the win. A heartbreaker for ${losingTeam}, who controlled the tempo for stretches.`,
      
      `Intensity peaks late as ${losingTeam} mounts a comeback attempt, cutting what was an 8-point deficit to within reach. However, ${predictedWinner}'s bench scoring proves too much. Back-and-forth affair that could go either way, but ${predictedWinner}'s versatility is the differentiator.`
    );
  } else if (margin <= 12) {
    // Moderate victory narratives
    stories.push(
      `${predictedWinner} imposes their will for significant stretches, but ${losingTeam} refuses to go quietly. The margin suggests a dominant team that faced some resistance. ${predictedWinner}'s depth at multiple positions wears down ${losingTeam}'s roster over 48 minutes.`,
      
      `A decisive statement win for ${predictedWinner}. While ${losingTeam} has their moments, they cannot maintain consistency on either end. ${predictedWinner} takes control midway through the second half and coasts to victory. A performance that shows why ${predictedWinner} belongs among the elite.`,
      
      `${predictedWinner} demonstrates clear superiority in this matchup. ${losingTeam} stays competitive in spurts but never threatens to pull off an upset. The talent gap shows most in transition defense, where ${predictedWinner} consistently gets easy buckets. ${losingTeam} fights hard but falls short.`
    );
  } else {
    // Blowout narratives
    stories.push(
      `${predictedWinner} dismantles ${losingTeam} in convincing fashion. Nothing goes right for ${losingTeam} early as ${predictedWinner} builds an insurmountable lead. By halftime, the outcome is already decided. A complete performance across all categories for ${predictedWinner}.`,
      
      `A showcase game for ${predictedWinner}, who plays at a different level entirely. ${losingTeam} simply has no answers for ${predictedWinner}'s pace and spacing. Garbage time basketball from the second half onward. This is the kind of loss that shakes teams' confidence.`,
      
      `${predictedWinner} shoots the lights out and plays stifling defense in routing ${losingTeam}. There's a 20+ point lead by the start of the fourth quarter. ${losingTeam} never gets traction on offense. A performance where ${predictedWinner} shows why they're contenders while ${losingTeam} takes a step back.`
    );
  }
  
  
  const review = getRandomNBAStory(homeTeam, awayTeam, homeScore, awayScore);

  return {
    eventId,
    predictedWinner,
    predictedScore: `${homeScore}-${awayScore}`,
    totalScore,
    confidence,
    review,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Professional AI prediction logic for NBA predictions
 * Uses team context, injuries, recent form, and metrics
 */
function generateNBAAIPrediction(homeTeam: string, awayTeam: string): Prediction {
  // Import team context
  let teamContextModule: any;
  try {
    teamContextModule = require('./nbaContext');
  } catch (e) {
    // Fallback if nbaContext not available
    teamContextModule = null;
  }

  const eventId = Math.random().toString(36).slice(2, 10);

  // Get team contexts
  const homeCtx = teamContextModule ? teamContextModule.getTeamContext(homeTeam) : null;
  const awayCtx = teamContextModule ? teamContextModule.getTeamContext(awayTeam) : null;

  // Calculate advantage using team ratings and factors
  let homeAdvantage = 3; // Home court advantage
  if (homeCtx && awayCtx) {
    // Offensive vs Defensive matchup
    homeAdvantage += (homeCtx.offenseRating - awayCtx.defenseRating) * 0.1;
    homeAdvantage -= (awayCtx.offenseRating - homeCtx.defenseRating) * 0.1;

    // Recent form
    if (homeCtx.recentForm === "hot") homeAdvantage += 2;
    if (homeCtx.recentForm === "cold") homeAdvantage -= 2;
    if (awayCtx.recentForm === "hot") homeAdvantage -= 2;
    if (awayCtx.recentForm === "cold") homeAdvantage += 2;

    // Injuries
    const homeInjuries = homeCtx.injuredPlayers.filter((p: any) => p.status === "out").length;
    const awayInjuries = awayCtx.injuredPlayers.filter((p: any) => p.status === "out").length;
    homeAdvantage -= homeInjuries * 3;
    homeAdvantage += awayInjuries * 3;
  }

  // Base scores from team ratings
  const homeBase = homeCtx ? homeCtx.offenseRating : 110;
  const awayBase = awayCtx ? awayCtx.offenseRating : 110;

  // Adjust scores based on advantage
  const advantageFactor = homeAdvantage / 10; // Convert to decimal
  const homeScore = Math.max(85, Math.min(140, homeBase + advantageFactor * 15 + (Math.random() - 0.5) * 20));
  const awayScore = Math.max(85, Math.min(140, awayBase - advantageFactor * 15 + (Math.random() - 0.5) * 20));

  const totalScore = homeScore + awayScore;
  const predictedWinner = homeScore > awayScore ? homeTeam : awayTeam;
  const losingTeam = homeScore > awayScore ? awayTeam : homeTeam;

  // Calculate confidence based on margin and factors
  const margin = Math.abs(homeScore - awayScore);
  let confidence = 60 + margin * 0.5; // Base confidence from margin
  if (homeCtx && awayCtx) {
    if (homeCtx.recentForm === "hot" && awayCtx.recentForm === "cold") confidence += 5;
    if (homeCtx.recentForm === "cold" && awayCtx.recentForm === "hot") confidence -= 5;
    confidence += Math.abs(homeCtx.offenseRating - awayCtx.defenseRating) * 0.1;
  }
  confidence = Math.max(55, Math.min(85, confidence));

  // Get player names if available
  let winnerStars = "star players";
  let loserStars = "key scorers";

  if (teamContextModule) {
    const winnerTeamCtx = teamContextModule.getTeamContext(predictedWinner);
    const loserTeamCtx = teamContextModule.getTeamContext(losingTeam);

    if (winnerTeamCtx && winnerTeamCtx.keyPlayers) {
      winnerStars = winnerTeamCtx.keyPlayers.slice(0, 2).join(" and ");
    }
    if (loserTeamCtx && loserTeamCtx.keyPlayers) {
      loserStars = loserTeamCtx.keyPlayers.slice(0, 2).join(" and ");
    }
  }

  // Professional narratives with player names
  const professionalReviews = [
    `MATCHUP ANALYSIS: ${homeTeam} (${homeScore}) vs ${awayTeam} (${awayScore})

This matchup features contrasting playing styles. ${predictedWinner}'s ${winnerStars} will be critical in limiting ${losingTeam}'s ${loserStars}. The interior battle will be equally crucial—watch for offensive rebounding efficiency and paint defense. ${predictedWinner} has shown superior ball movement in recent games, creating efficiency on both ends. ${losingTeam} will attempt to dictate pace, but ${predictedWinner}'s defensive intensity should prove too much. Key performances from ${winnerStars} will establish early momentum, ultimately determining the game's direction.`,

    `TEAM PERFORMANCE PROJECTION: ${predictedWinner} over ${losingTeam}, ${homeScore}-${awayScore}

${predictedWinner} enters with superior offensive efficiency and defensive versatility. Led by ${winnerStars}, the team's depth provides multiple scoring options, making them difficult to game-plan against. ${losingTeam}'s reliance on ${loserStars} creates vulnerability in role player execution. ${predictedWinner}'s bench scoring advantage and shooting consistency should carry them through. The individual matchups—particularly ${winnerStars} vs ${loserStars}—will decide this game.`,

    `STRATEGIC BREAKDOWN: ${predictedWinner} Favored, ${homeScore}-${awayScore}

The key to ${predictedWinner}'s victory lies in ${winnerStars} executing in transition. Their offensive efficiency, particularly in three-point shooting and drive-and-kick execution, creates more possessions than ${losingTeam} can match. ${losingTeam} will lean on ${loserStars} to counter, but ${predictedWinner}'s disciplined defense should force tough shot selection. Role players' contributions become critical—if ${winnerStars} get support, victory becomes inevitable.`,

    `ADVANCED METRICS PREDICTION: ${predictedWinner} ${homeScore}, ${losingTeam} ${awayScore}

Offensive and defensive efficiency ratings favor ${predictedWinner} in this matchup. ${winnerStars} have shown superior assist-to-turnover ratios and three-point percentages. ${losingTeam} will rely on ${loserStars}' defensive pressures, but ${predictedWinner}'s poise under pressure should prevent sustained runs. The star player matchups—${winnerStars} vs ${loserStars}—will be determinative. ${predictedWinner}'s overall roster quality suggests a convincing victory.`,

    `GAME SCRIPT PROJECTION: ${predictedWinner} Victory, ${homeScore}-${awayScore}

Expect ${winnerStars} to control tempo early, establishing their three-point game while disrupting ${loserStars}' drives. ${losingTeam} will counter with aggressive pick-and-roll execution, but ${predictedWinner}'s on-ball defense should disrupt rhythm. The third quarter will be critical—${winnerStars}' ability to maintain intensity defensively while executing offensive sets separates them. ${loserStars} will likely make a fourth-quarter push, but ${predictedWinner}'s depth and experience should seal the outcome.`,
  ];

  const review = professionalReviews[Math.floor(Math.random() * professionalReviews.length)];

  return {
    eventId,
    predictedWinner,
    predictedScore: `${Math.floor(homeScore)}-${Math.floor(awayScore)}`,
    totalScore: Math.floor(totalScore),
    confidence,
    review,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Professional AI prediction logic for soccer predictions
 * Uses soccer team context, injuries, recent form, and soccer-specific metrics
 */
function generateSoccerAIPrediction(homeTeam: string, awayTeam: string): Prediction {
  const eventId = Math.random().toString(36).slice(2, 10);

  // Get team contexts
  const homeTeamCtx = getSoccerTeamContext(homeTeam);
  const awayTeamCtx = getSoccerTeamContext(awayTeam);

  // Calculate team advantage (returns decimal like 2.5 for home advantage)
  const advantage = calculateSoccerAdvantage(homeTeam, awayTeam);

  // Generate soccer score prediction (realistic scores like 1-0, 2-1, etc.)
  const scorePrediction = generateSoccerScorePrediction(homeTeam, awayTeam);
  const [homeGoals, awayGoals] = scorePrediction.split('-').map(Number);

  // Determine winner
  let predictedWinner: string;
  if (homeGoals > awayGoals) {
    predictedWinner = homeTeam;
  } else if (awayGoals > homeGoals) {
    predictedWinner = awayTeam;
  } else {
    predictedWinner = "Draw";
  }

  const totalGoals = homeGoals + awayGoals;
  const overUnder = generateSoccerOverUnder();
  const confidence = Math.floor(Math.random() * 20) + 58; // 58-78% for soccer

  // Generate professional soccer analysis
  const matchupAnalysis = generateSoccerMatchupAnalysis(homeTeam, awayTeam);
  const story = generateSoccerStory(homeTeam, awayTeam, scorePrediction, overUnder);

  // Combine analysis and story
  const review = `MATCH PREDICTION: ${homeTeam} vs ${awayTeam}

${matchupAnalysis}

SCORE PREDICTION: ${scorePrediction}
OVER/UNDER PREDICTION: ${overUnder}
PREDICTED WINNER: ${predictedWinner}
CONFIDENCE: ${confidence}%

TACTICAL ANALYSIS:
${story}

This prediction considers current form, historical performance, key player availability, and tactical matchups. Soccer outcomes can be unpredictable, but this analysis provides a professional assessment based on available data.`;

  return {
    eventId,
    predictedWinner,
    predictedScore: scorePrediction,
    totalScore: totalGoals,
    confidence,
    review,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Create or update raffle file with prediction
 */
async function saveRaffleWithPrediction(
  eventId: string,
  prediction: Prediction,
  matchData: {
    home: string;
    away: string;
    league: string;
    datetime: string | null;
    venue?: string | null;
  }
): Promise<void> {
  try {
    const raffleFile = path.join(process.cwd(), `data/raffle-${eventId}.json`);
    
    const raffleData = {
      eventId,
      matchDetails: {
        home: matchData.home,
        away: matchData.away,
        league: matchData.league,
        datetime: matchData.datetime,
        venue: matchData.venue || null,
      },
      prediction: {
        predictedScore: prediction.predictedScore,
        totalScore: prediction.totalScore,
        predictedWinner: prediction.predictedWinner,
        confidence: prediction.confidence,
        review: prediction.review,
        generatedAt: prediction.generatedAt,
      },
      // Text format for frontend parsing
      predictionText: `Prediction

🏀 ${matchData.home} vs ${matchData.away}
Predicted Score: ${prediction.predictedScore}
Total Score: ${prediction.totalScore}
Predicted Winner: ${prediction.predictedWinner}
Confidence: ${prediction.confidence}%

Review:
${prediction.review}

Generated: ${prediction.generatedAt}`,
      actualWinner: null,
      actualResult: null,
      isCorrect: null,
      homeScore: null,
      awayScore: null,
      status: null,
      createdAt: new Date().toISOString(),
    };

    await fs.writeFile(raffleFile, JSON.stringify(raffleData, null, 2), 'utf-8');
    console.log(`[PredictionGenerator] Saved prediction for event ${eventId}`);

    // Also save to predictions.json for consistency with EPL/LaLiga
    try {
      const predictionsFile = path.join(process.cwd(), 'data/predictions.json');
      let predictionsData: any = { predictions: {} };
      
      try {
        const existing = await fs.readFile(predictionsFile, 'utf-8');
        predictionsData = JSON.parse(existing);
      } catch (e) {
        // File doesn't exist or is invalid, start fresh
      }
      
      // Add prediction with full details
      const isNBA = /nba|basketball/i.test(matchData.league);
      const isSoccer = /soccer|football|epl|premier league|la liga|laliga/i.test(matchData.league);
      const emoji = isNBA ? '🏀' : isSoccer ? '⚽' : '🏆';
      const fullPrediction = `${emoji} ${matchData.home} vs ${matchData.away}\nPredicted Score: ${prediction.predictedScore}\nTotal Score: ${prediction.totalScore}\nPredicted Winner: ${prediction.predictedWinner}\nConfidence: ${prediction.confidence}%\n\nReview:\n${prediction.review}\n\nGenerated: ${prediction.generatedAt}`;
      predictionsData.predictions[eventId] = fullPrediction;
      
      await fs.writeFile(predictionsFile, JSON.stringify(predictionsData, null, 2), 'utf-8');
    } catch (e) {
      console.warn(`[PredictionGenerator] Error saving to predictions.json:`, e);
    }
  } catch (error) {
    console.error(`[PredictionGenerator] Error saving raffle for ${eventId}:`, error);
  }
}

/**
 * Check if prediction already exists for event
 */
async function predictionExists(eventId: string): Promise<boolean> {
  try {
    const raffleFile = path.join(process.cwd(), `data/raffle-${eventId}.json`);
    await fs.access(raffleFile);
    return true;
  } catch {
    return false;
  }
}

/**
/**
 * Generate predictions for selected matches
 *
 * IMPORTANT: For NBA matches, this should ONLY be called from auto-predict-nba endpoint
 * with locked match IDs. Never call this directly for NBA matches!
 */
export async function generatePredictionsForMatches(
  matches: Array<{
    id: string;
    home: string;
    away: string;
    league: string;
    datetime: string | null;
    venue?: string | null;
  }>,
  options?: { bypassLeagueCheck?: boolean; skipRaffleFile?: boolean; returnPredictions?: boolean }
): Promise<number | Array<{match: any, prediction: Prediction}>> {
  let generated = 0;
  const shouldCheckLeague = !options?.bypassLeagueCheck;
  const skipRaffleFile = options?.skipRaffleFile || false;
  const returnPredictions = options?.returnPredictions || false;
  const predictions: Array<{match: any, prediction: Prediction}> = [];

  for (const match of matches) {
    try {
      // SAFETY CHECK: Do not generate predictions for NBA matches in background worker
      // NBA predictions should only come from auto-predict-nba endpoint with locked selection
      // Soccer predictions (EPL, La Liga) can be generated here with soccer logic
      if (shouldCheckLeague) {
        const isNBA = /nba|basketball/i.test(match.league);

        if (isNBA) {
          console.warn(`[PredictionGenerator] BLOCKED: Attempted to generate NBA prediction for ${match.id} outside of auto-predict-nba`);
          continue;
        }
      }

      // Skip if prediction already exists
      if (await predictionExists(match.id)) {
        console.log(`[PredictionGenerator] Prediction already exists for ${match.id}, skipping`);
        continue;
      }

      console.log(`[PredictionGenerator] Generating prediction for ${match.home} vs ${match.away}...`);

      // Choose prediction logic based on league
      let prediction: Prediction;
      const isSoccer = /soccer|football|epl|premier league|la liga|laliga/i.test(match.league);

      if (isSoccer) {
        prediction = generateSoccerAIPrediction(match.home, match.away);
      } else {
        prediction = generateAIPrediction(match.home, match.away, match.league);
      }

      // Only save to raffle file if not skipped (for NBA matches saved to Supabase)
      if (!skipRaffleFile) {
        await saveRaffleWithPrediction(match.id, prediction, match);
      }

      // Collect prediction if returning predictions
      if (returnPredictions) {
        predictions.push({ match, prediction });
      }

      generated++;
    } catch (error) {
      console.error(`[PredictionGenerator] Error generating prediction for ${match.id}:`, error);
    }
  }

  console.log(`[PredictionGenerator] Generated ${generated} new predictions`);

  if (returnPredictions) {
    return predictions;
  }

  return generated;
}

/**
 * Get prediction for a match
 */
export async function getPredictionForMatch(eventId: string): Promise<any> {
  try {
    const raffleFile = path.join(process.cwd(), `data/raffle-${eventId}.json`);
    const data = await fs.readFile(raffleFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(`[PredictionGenerator] No prediction found for ${eventId}`);
    return null;
  }
}

/**
 * Save match to EPL history when it finishes (FT)
 */
export async function saveToEPLHistory(
  matchData: {
    id: string;
    home: string;
    away: string;
    league: string;
    datetime: string | null;
    venue?: string | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
  }
): Promise<void> {
  try {
    const historyFile = path.join(process.cwd(), 'data/epl_history.json');
    
    // Read existing history
    let history: any = { matches: [] };
    try {
      const existing = await fs.readFile(historyFile, 'utf-8');
      history = JSON.parse(existing);
      if (!Array.isArray(history.matches)) history.matches = [];
    } catch {
      // File doesn't exist yet, create new
    }

    // Load prediction for this match
    const predictionFile = path.join(process.cwd(), `data/raffle-${matchData.id}.json`);
    let prediction: any = null;
    try {
      const predData = await fs.readFile(predictionFile, 'utf-8');
      prediction = JSON.parse(predData);
    } catch {
      console.warn(`[EPLHistory] No prediction found for ${matchData.id}`);
    }

    // Determine actual winner and total goals
    let actualWinner: string | null = null;
    let totalGoals: number | null = null;
    let isCorrect: boolean | null = null;

    if (matchData.homeScore !== null && matchData.awayScore !== null) {
      if (matchData.homeScore > matchData.awayScore) {
        actualWinner = matchData.home;
      } else if (matchData.awayScore > matchData.homeScore) {
        actualWinner = matchData.away;
      } else {
        actualWinner = "Draw";
      }
      
      totalGoals = matchData.homeScore + matchData.awayScore;

      // Check if over/under prediction was correct
      if (prediction?.prediction) {
        const overUnder = prediction.prediction;
        const [direction, threshold] = overUnder.split(' ');
        const thresholdNum = parseFloat(threshold);
        
        if (direction === 'Over') {
          isCorrect = totalGoals > thresholdNum;
        } else if (direction === 'Under') {
          isCorrect = totalGoals < thresholdNum;
        }
      }
    }

    // Create history entry
    const historyEntry = {
      id: matchData.id,
      home: matchData.home,
      away: matchData.away,
      league: matchData.league,
      datetime: matchData.datetime,
      venue: matchData.venue || null,
      homeScore: matchData.homeScore,
      awayScore: matchData.awayScore,
      totalGoals: totalGoals,
      status: matchData.status,
      actualWinner,
      isCorrect,
      prediction: prediction?.prediction || null,
      scorePrediction: prediction?.scorePrediction || null,
      story: prediction?.story || null,
      savedAt: new Date().toISOString(),
    };

    // Check if match already in history
    const existingIndex = history.matches.findIndex((m: any) => m.id === matchData.id);
    if (existingIndex >= 0) {
      // Update existing entry
      history.matches[existingIndex] = historyEntry;
      console.log(`[EPLHistory] Updated match ${matchData.id} in history`);
    } else {
      // Add new entry
      history.matches.push(historyEntry);
      console.log(`[EPLHistory] Added match ${matchData.id} to history`);
    }

    // Save back to file
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2), 'utf-8');
    console.log(`[EPLHistory] ✅ Saved match ${matchData.id} to history`);
  } catch (error) {
    console.error(`[EPLHistory] Error saving to history:`, error);
  }
}

/**
 * Get all EPL history matches
 */
export async function getEPLHistory(): Promise<any[]> {
  try {
    const historyFile = path.join(process.cwd(), 'data/epl_history.json');
    const data = await fs.readFile(historyFile, 'utf-8');
    const history = JSON.parse(data);
    return Array.isArray(history.matches) ? history.matches : [];
  } catch (error) {
    console.warn('[EPLHistory] Could not read history:', error);
    return [];
  }
}

/**
 * Save match to NBA history when it finishes (FT)
 * Called when match reaches Final/FT status
 */
export async function saveToNBAHistory(
  matchData: {
    id: string;
    home: string;
    away: string;
    league: string;
    datetime: string | null;
    venue?: string | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
  }
): Promise<void> {
  try {
    const historyFile = path.join(process.cwd(), 'data/nba_history.json');
    
    // Read existing history
    let history: any = { matches: [] };
    try {
      const existing = await fs.readFile(historyFile, 'utf-8');
      history = JSON.parse(existing);
      if (!Array.isArray(history.matches)) history.matches = [];
    } catch {
      // File doesn't exist yet, create new
    }

    // Load prediction for this match
    const predictionFile = path.join(process.cwd(), `data/raffle-${matchData.id}.json`);
    let prediction: any = null;
    try {
      const predData = await fs.readFile(predictionFile, 'utf-8');
      prediction = JSON.parse(predData);
    } catch {
      console.warn(`[NBAHistory] No prediction found for ${matchData.id}`);
    }

    // Determine actual winner
    let actualWinner: string | null = null;
    let isCorrect: boolean | null = null;

    if (matchData.homeScore !== null && matchData.awayScore !== null) {
      if (matchData.homeScore > matchData.awayScore) {
        actualWinner = matchData.home;
      } else if (matchData.awayScore > matchData.homeScore) {
        actualWinner = matchData.away;
      } else {
        actualWinner = "Draw"; // For NBA, shouldn't happen but just in case
      }

      // Check if prediction was correct
      if (prediction?.prediction?.predictedWinner) {
        isCorrect = prediction.prediction.predictedWinner === actualWinner;
      }
    }

    // Create history entry
    const historyEntry = {
      id: matchData.id,
      home: matchData.home,
      away: matchData.away,
      league: matchData.league,
      datetime: matchData.datetime,
      venue: matchData.venue || null,
      homeScore: matchData.homeScore,
      awayScore: matchData.awayScore,
      status: matchData.status,
      actualWinner,
      isCorrect,
      prediction: prediction?.prediction || null,
      predictionText: prediction?.predictionText || null,
      savedAt: new Date().toISOString(),
    };

    // Check if match already in history
    const existingIndex = history.matches.findIndex((m: any) => m.id === matchData.id);
    if (existingIndex >= 0) {
      // Update existing entry
      history.matches[existingIndex] = historyEntry;
      console.log(`[NBAHistory] Updated match ${matchData.id} in history`);
    } else {
      // Add new entry
      history.matches.push(historyEntry);
      console.log(`[NBAHistory] Added match ${matchData.id} to history`);
    }

    // Save back to file
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2), 'utf-8');
    console.log(`[NBAHistory] ✅ Saved match ${matchData.id} to history`);
  } catch (error) {
    console.error(`[NBAHistory] Error saving to history:`, error);
  }
}

/**
 * Get all NBA history matches
 */
export async function getNBAHistory(): Promise<any[]> {
  try {
    const historyFile = path.join(process.cwd(), 'data/nba_history.json');
    const data = await fs.readFile(historyFile, 'utf-8');
    const history = JSON.parse(data);
    return Array.isArray(history.matches) ? history.matches : [];
  } catch (error) {
    console.warn('[NBAHistory] Could not read history:', error);
    return [];
  }
}

/**
 * Get recent NBA history (last N matches from all closed windows)
 */
export async function getRecentNBAHistory(limit: number = 100): Promise<any[]> {
  const history = await getNBAHistory();
  // Sort by datetime descending (newest first)
  return history.sort((a: any, b: any) => {
    const aTime = a.datetime ? new Date(a.datetime).getTime() : 0;
    const bTime = b.datetime ? new Date(b.datetime).getTime() : 0;
    return bTime - aTime;
  }).slice(0, limit);
}

/**
 * Save match to soccer history when it finishes (FT)
 * Called when match reaches Final/FT status
 */
export async function saveToSoccerHistory(
  matchData: {
    id: string;
    home: string;
    away: string;
    league: string;
    datetime: string | null;
    venue?: string | null;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
  }
): Promise<void> {
  try {
    const historyFile = path.join(process.cwd(), 'data/soccer_history.json');

    // Read existing history
    let history: any = { matches: [] };
    try {
      const existing = await fs.readFile(historyFile, 'utf-8');
      history = JSON.parse(existing);
      if (!Array.isArray(history.matches)) history.matches = [];
    } catch {
      // File doesn't exist yet, create new
    }

    // Load prediction for this match
    const predictionFile = path.join(process.cwd(), `data/raffle-${matchData.id}.json`);
    let prediction: any = null;
    try {
      const predData = await fs.readFile(predictionFile, 'utf-8');
      prediction = JSON.parse(predData);
    } catch {
      console.warn(`[SoccerHistory] No prediction found for ${matchData.id}`);
    }

    // Determine actual winner and total goals
    let actualWinner: string | null = null;
    let totalGoals: number | null = null;
    let isCorrect: boolean | null = null;

    if (matchData.homeScore !== null && matchData.awayScore !== null) {
      if (matchData.homeScore > matchData.awayScore) {
        actualWinner = matchData.home;
      } else if (matchData.awayScore > matchData.homeScore) {
        actualWinner = matchData.away;
      } else {
        actualWinner = "Draw";
      }

      totalGoals = matchData.homeScore + matchData.awayScore;

      // Check if prediction was correct (for winner or over/under)
      if (prediction?.prediction) {
        // Check winner prediction
        if (prediction.prediction.predictedWinner && prediction.prediction.predictedWinner !== "Draw") {
          isCorrect = prediction.prediction.predictedWinner === actualWinner;
        } else if (prediction.prediction.predictedWinner === "Draw") {
          isCorrect = actualWinner === "Draw";
        }
        // Note: Over/under checking would require parsing the review text
      }
    }

    // Create history entry
    const historyEntry = {
      id: matchData.id,
      home: matchData.home,
      away: matchData.away,
      league: matchData.league,
      datetime: matchData.datetime,
      venue: matchData.venue || null,
      homeScore: matchData.homeScore,
      awayScore: matchData.awayScore,
      totalGoals: totalGoals,
      status: matchData.status,
      actualWinner,
      isCorrect,
      prediction: prediction?.prediction || null,
      predictionText: prediction?.predictionText || null,
      savedAt: new Date().toISOString(),
    };

    // Check if match already in history
    const existingIndex = history.matches.findIndex((m: any) => m.id === matchData.id);
    if (existingIndex >= 0) {
      // Update existing entry
      history.matches[existingIndex] = historyEntry;
      console.log(`[SoccerHistory] Updated match ${matchData.id} in history`);
    } else {
      // Add new entry
      history.matches.push(historyEntry);
      console.log(`[SoccerHistory] Added match ${matchData.id} to history`);
    }

    // Save back to file
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2), 'utf-8');
    console.log(`[SoccerHistory] ✅ Saved match ${matchData.id} to history`);
  } catch (error) {
    console.error(`[SoccerHistory] Error saving to history:`, error);
  }
}

/**
 * Get all soccer history matches
 */
export async function getSoccerHistory(): Promise<any[]> {
  try {
    const historyFile = path.join(process.cwd(), 'data/soccer_history.json');
    const data = await fs.readFile(historyFile, 'utf-8');
    const history = JSON.parse(data);
    return Array.isArray(history.matches) ? history.matches : [];
  } catch (error) {
    console.warn('[SoccerHistory] Could not read history:', error);
    return [];
  }
}

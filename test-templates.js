/**
 * Quick test to show prediction variety
 */

// Simulate the template functions (copy from TypeScript file)
const soccerCloseMatchTemplates = [
  "A closely contested battle where execution in the final moments will determine the winner. {winner}'s experience gives them the edge in clutch situations. {loser} stays competitive throughout, but {winner} converts when it matters most.",
  "Both teams trade attacking opportunities in an entertaining matchup. {loser}'s late push falls just short, while {winner} holds firm down the stretch. Key defensive organization from {winner} seals the win.",
  "Intensity peaks late as {loser} mounts a comeback attempt, cutting what was an early deficit to within reach. However, {winner}'s tactical adjustments prove decisive. Back-and-forth affair decided by fine margins.",
  "A tightly contested affair where {winner} edges ahead through superior decision-making. {loser} creates chances but lacks that final bit of quality. The margin reflects {winner}'s composure under pressure.",
  "Neither side dominates, but {winner} capitalizes on their opportunities more efficiently. {loser} defends valiantly but {winner}'s breakthrough moment proves decisive. A tense 90 minutes resolved in {winner}'s favor.",
  "{winner} and {loser} mirror each other tactically, but {winner} finds an extra gear when needed. The match hinges on individual moments of brilliance rather than systemic dominance.",
  "A competitive encounter where {winner} edges out {loser} through sheer determination. Both teams possess tactical merit, but {winner}'s defensive solidity when under pressure makes the difference.",
];

const soccerOverUnderContext = [
  "The Over/Under prediction aligns with the match tempo established from the kickoff, with both teams committing attacking players early.",
  "A high-scoring affair develops as both defenses struggle with positioning, allowing multiple clear-cut chances.",
  "Defensive solidity from both teams limits chances despite attacking intent, keeping the goalscoring drought going.",
  "An open match where both teams leave themselves vulnerable in transition, leading to quick attacks and goalscoring opportunities.",
  "One side's collapse in defensive organization opens the floodgates for easy opportunities.",
];

const soccerTeamAnalysis = [
  "{team}'s attacking intent leaves them vulnerable on the counter-attack.",
  "{team}'s defensive shape breaks down when pressed high up the pitch.",
  "{team} excels at controlling tempo but struggles when forced to be direct.",
  "{team}'s fullbacks provide width that stretches opposing defenses thin.",
  "{team}'s central midfield dominance filters through to attacking phases.",
];

function getRandomSoccerStory(homeTeam, awayTeam, scorePrediction, overUnder) {
  const [homeScore, awayScore] = scorePrediction.split('-').map(Number);
  const margin = Math.abs(homeScore - awayScore);

  const winner = homeScore > awayScore ? homeTeam : awayTeam;
  const loser = homeScore > awayScore ? awayTeam : homeTeam;

  let mainStory = soccerCloseMatchTemplates[Math.floor(Math.random() * soccerCloseMatchTemplates.length)];
  mainStory = mainStory.replace(/{winner}/g, winner).replace(/{loser}/g, loser);

  const overUnderText = soccerOverUnderContext[Math.floor(Math.random() * soccerOverUnderContext.length)];
  const teamAnalysis1 = soccerTeamAnalysis[Math.floor(Math.random() * soccerTeamAnalysis.length)];
  const teamAnalysis2 = soccerTeamAnalysis[Math.floor(Math.random() * soccerTeamAnalysis.length)];

  const team1 = Math.random() > 0.5 ? winner : loser;
  const team2 = team1 === winner ? loser : winner;

  let analysis1 = teamAnalysis1.replace(/{team}/g, team1);
  let analysis2 = teamAnalysis2.replace(/{team}/g, team2);

  return `${mainStory} ${analysis1} ${analysis2} ${overUnderText}`;
}

// Test with same prediction 5 times - should show variation
console.log("🏟️ Testing Soccer Prediction Variation (same match: Arsenal 2-1 Liverpool, Over 2.5):\n");
for (let i = 1; i <= 5; i++) {
  const story = getRandomSoccerStory("Arsenal", "Liverpool", "2-1", "Over 2.5");
  console.log(`${i}. ${story}\n`);
}

/**
 * NBA Team Context & Analytics
 * Key players, stats, injury status, recent form, and advanced metrics
 */

interface TeamContext {
  name: string;
  keyPlayers: string[];
  injuredPlayers: { name: string; status: string; impact: string }[];
  recentForm: string; // "hot" | "cold" | "inconsistent"
  strengths: string[];
  weaknesses: string[];
  defenseRating: number; // 100 = league average
  offenseRating: number; // 100 = league average
  pace: string; // "fast" | "moderate" | "slow"
}

const NBA_TEAMS: Record<string, TeamContext> = {
  "Boston Celtics": {
    name: "Boston Celtics",
    keyPlayers: ["Jayson Tatum", "Derrick White", "Jrue Holiday"],
    injuredPlayers: [
      { name: "Kristaps Porzingis", status: "questionable", impact: "defense/shooting" }
    ],
    recentForm: "hot",
    strengths: ["Elite defense", "Three-point shooting", "Ball movement", "Depth"],
    weaknesses: ["Bench depth sometimes inconsistent"],
    defenseRating: 108,
    offenseRating: 115,
    pace: "moderate"
  },
  "Denver Nuggets": {
    name: "Denver Nuggets",
    keyPlayers: ["Nikola Jokic", "Jamal Murray", "Christian Braun"],
    injuredPlayers: [
      { name: "Vlatko Cancar", status: "out", impact: "rotation player" }
    ],
    recentForm: "hot",
    strengths: ["Offensive versatility", "Playmaking", "Ball control", "Jokic dominance"],
    weaknesses: ["Perimeter defense at times"],
    defenseRating: 106,
    offenseRating: 118,
    pace: "moderate"
  },
  "Miami Heat": {
    name: "Miami Heat",
    keyPlayers: ["Jimmy Butler", "Bam Adebayo", "Tyler Herro"],
    injuredPlayers: [
      { name: "Marcus Marcus", status: "out", impact: "three-point shooting" }
    ],
    recentForm: "inconsistent",
    strengths: ["Defense", "Clutch performance", "Physical play", "Ball movement"],
    weaknesses: ["Bench scoring", "Depth at guard"],
    defenseRating: 107,
    offenseRating: 112,
    pace: "slow"
  },
  "Los Angeles Lakers": {
    name: "Los Angeles Lakers",
    keyPlayers: ["LeBron James", "Anthony Davis", "Austin Reaves"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Athleticism", "Star power", "Defense", "Experience"],
    weaknesses: ["Bench depth", "Three-point consistency"],
    defenseRating: 107,
    offenseRating: 113,
    pace: "moderate"
  },
  "Memphis Grizzlies": {
    name: "Memphis Grizzlies",
    keyPlayers: ["Ja Morant", "Desmond Bane", "Marcus Smart"],
    injuredPlayers: [
      { name: "Santi Aldama", status: "questionable", impact: "depth" }
    ],
    recentForm: "hot",
    strengths: ["Defense", "Ball movement", "Youth", "Athleticism"],
    weaknesses: ["Consistency", "Outside shooting at times"],
    defenseRating: 108,
    offenseRating: 114,
    pace: "fast"
  },
  "Milwaukee Bucks": {
    name: "Milwaukee Bucks",
    keyPlayers: ["Giannis Antetokounmpo", "Damian Lillard", "Khris Middleton"],
    injuredPlayers: [
      { name: "Khris Middleton", status: "questionable", impact: "shooting/playmaking" }
    ],
    recentForm: "hot",
    strengths: ["Star power", "Scoring versatility", "Giannis dominance", "Shooting"],
    weaknesses: ["Bench consistency"],
    defenseRating: 105,
    offenseRating: 117,
    pace: "moderate"
  },
  "Golden State Warriors": {
    name: "Golden State Warriors",
    keyPlayers: ["Stephen Curry", "Klay Thompson", "Andrew Wiggins"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Three-point shooting", "Ball movement", "Experience", "Defense"],
    weaknesses: ["Bench depth", "Rebounding"],
    defenseRating: 106,
    offenseRating: 116,
    pace: "fast"
  },
  "Toronto Raptors": {
    name: "Toronto Raptors",
    keyPlayers: ["OG Anunoby", "Scottie Barnes", "Fred VanVleet"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Defense", "Ball movement", "Three-point shooting", "Versatility"],
    weaknesses: ["Scoring consistency", "Star player production"],
    defenseRating: 107,
    offenseRating: 110,
    pace: "moderate"
  },
  "Orlando Magic": {
    name: "Orlando Magic",
    keyPlayers: ["Paolo Banchero", "Jalen Suggs", "Franz Wagner"],
    injuredPlayers: [
      { name: "Isaac Lopez", status: "out", impact: "defense/shooting" }
    ],
    recentForm: "hot",
    strengths: ["Three-point shooting", "Youth", "Defense", "Ball movement"],
    weaknesses: ["Experience", "Bench scoring"],
    defenseRating: 108,
    offenseRating: 113,
    pace: "moderate"
  },
  "Philadelphia 76ers": {
    name: "Philadelphia 76ers",
    keyPlayers: ["Joel Embiid", "Tyrese Maxey", "Paul George"],
    injuredPlayers: [
      { name: "De'Anthony Melton", status: "questionable", impact: "perimeter defense" }
    ],
    recentForm: "hot",
    strengths: ["Scoring", "Embiid dominance", "Defensive potential", "Star power"],
    weaknesses: ["Bench depth", "Three-point consistency"],
    defenseRating: 106,
    offenseRating: 115,
    pace: "moderate"
  },
  "Chicago Bulls": {
    name: "Chicago Bulls",
    keyPlayers: ["DeMar DeRozan", "Zach LaVine", "Nikola Vucevic"],
    injuredPlayers: [
      { name: "Lonzo Ball", status: "out", impact: "playmaking/defense" }
    ],
    recentForm: "cold",
    strengths: ["Three-point shooting", "Ball movement", "Scoring versatility"],
    weaknesses: ["Bench scoring", "Defense consistency"],
    defenseRating: 104,
    offenseRating: 113,
    pace: "moderate"
  },
  "New York Knicks": {
    name: "New York Knicks",
    keyPlayers: ["Julius Randle", "Jalen Brunson", "OG Anunoby"],
    injuredPlayers: [
      { name: "Mitchell Robinson", status: "out", impact: "defense/rebounding" }
    ],
    recentForm: "inconsistent",
    strengths: ["Defense", "Three-point shooting", "Versatility", "Ball movement"],
    weaknesses: ["Bench depth", "Offensive inconsistency"],
    defenseRating: 107,
    offenseRating: 111,
    pace: "moderate"
  },
  "Brooklyn Nets": {
    name: "Brooklyn Nets",
    keyPlayers: ["Cameron Thomas", "Nic Claxton", "Dorian Finney-Smith"],
    injuredPlayers: [
      { name: "Mikal Bridges", status: "questionable", impact: "three-point shooting" }
    ],
    recentForm: "cold",
    strengths: ["Scoring", "Youth", "Athleticism"],
    weaknesses: ["Defense", "Inconsistency", "Depth"],
    defenseRating: 103,
    offenseRating: 111,
    pace: "moderate"
  },
  "Washington Wizards": {
    name: "Washington Wizards",
    keyPlayers: ["Shai Gilgeous-Alexander", "Bradley Beal", "Kyle Kuzma"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Scoring", "Athleticism"],
    weaknesses: ["Defense", "Bench depth", "Consistency"],
    defenseRating: 101,
    offenseRating: 109,
    pace: "moderate"
  },
  "Atlanta Hawks": {
    name: "Atlanta Hawks",
    keyPlayers: ["Trae Young", "Clint Capela", "De'Andre Hunter"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Scoring", "Playmaking", "Three-point shooting", "Athleticism"],
    weaknesses: ["Defense", "Bench consistency"],
    defenseRating: 104,
    offenseRating: 114,
    pace: "fast"
  },
  "Sacramento Kings": {
    name: "Sacramento Kings",
    keyPlayers: ["De'Aaron Fox", "Domantas Sabonis", "Malik Monk"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Offense", "Scoring", "Playmaking", "Three-point shooting"],
    weaknesses: ["Defense", "Bench depth"],
    defenseRating: 102,
    offenseRating: 118,
    pace: "fast"
  },
  "Phoenix Suns": {
    name: "Phoenix Suns",
    keyPlayers: ["Kevin Durant", "Devin Booker", "Chris Paul"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Scoring", "Star power", "Offensive versatility", "Shooting"],
    weaknesses: ["Defense at times", "Depth"],
    defenseRating: 105,
    offenseRating: 117,
    pace: "moderate"
  },
  "Los Angeles Clippers": {
    name: "Los Angeles Clippers",
    keyPlayers: ["Kawhi Leonard", "Paul George", "Russell Westbrook"],
    injuredPlayers: [
      { name: "Kawhi Leonard", status: "out", impact: "elite defense/scoring" },
      { name: "James Harden", status: "questionable", impact: "playmaking" }
    ],
    recentForm: "cold",
    strengths: ["Defense", "Depth", "Three-point shooting"],
    weaknesses: ["Injuries", "Offensive consistency without Leonard"],
    defenseRating: 106,
    offenseRating: 112,
    pace: "moderate"
  },
  "Utah Jazz": {
    name: "Utah Jazz",
    keyPlayers: ["Lauri Markkanen", "Collin Sexton", "John Collins"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Three-point shooting", "Scoring", "Youth"],
    weaknesses: ["Defense", "Playmaking", "Bench depth"],
    defenseRating: 103,
    offenseRating: 113,
    pace: "moderate"
  },
  "Dallas Mavericks": {
    name: "Dallas Mavericks",
    keyPlayers: ["Luka Doncic", "Kyrie Irving", "Dante Exum"],
    injuredPlayers: [
      { name: "Kristaps Porzingis", status: "questionable", impact: "shooting/defense" }
    ],
    recentForm: "hot",
    strengths: ["Scoring", "Playmaking", "Star power", "Ball movement"],
    weaknesses: ["Defense at times", "Bench depth"],
    defenseRating: 104,
    offenseRating: 116,
    pace: "moderate"
  },
  "San Antonio Spurs": {
    name: "San Antonio Spurs",
    keyPlayers: ["Victor Wembanyama", "Devin Vassell", "Jeremy Sochan"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Youth", "Defense", "Ball movement", "Three-point shooting"],
    weaknesses: ["Inexperience", "Bench depth"],
    defenseRating: 105,
    offenseRating: 110,
    pace: "moderate"
  },
  "Houston Rockets": {
    name: "Houston Rockets",
    keyPlayers: ["Jalen Green", "Alperen Sengun", "Fred VanVleet"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Scoring", "Youth", "Defense", "Versatility"],
    weaknesses: ["Bench consistency", "Experience"],
    defenseRating: 106,
    offenseRating: 114,
    pace: "fast"
  },
  "New Orleans Pelicans": {
    name: "New Orleans Pelicans",
    keyPlayers: ["Brandon Ingram", "Anthony Davis", "Zion Williamson"],
    injuredPlayers: [
      { name: "CJ McCollum", status: "questionable", impact: "three-point shooting" }
    ],
    recentForm: "inconsistent",
    strengths: ["Scoring", "Athleticism", "Depth"],
    weaknesses: ["Consistency", "Injuries", "Bench play"],
    defenseRating: 104,
    offenseRating: 115,
    pace: "moderate"
  },
  "Minnesota Timberwolves": {
    name: "Minnesota Timberwolves",
    keyPlayers: ["Anthony Edwards", "Karl-Anthony Towns", "Rudy Gobert"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Defense", "Athleticism", "Scoring", "Depth"],
    weaknesses: ["Bench consistency at times"],
    defenseRating: 107,
    offenseRating: 114,
    pace: "moderate"
  },
  "Portland Trail Blazers": {
    name: "Portland Trail Blazers",
    keyPlayers: ["Damian Lillard", "Anfernee Simons", "Jerami Grant"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Scoring", "Three-point shooting"],
    weaknesses: ["Defense", "Consistency", "Depth"],
    defenseRating: 102,
    offenseRating: 112,
    pace: "moderate"
  },
  "Detroit Pistons": {
    name: "Detroit Pistons",
    keyPlayers: ["Cade Cunningham", "Bojan Bogdanovic", "Isaiah Stewart"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Youth", "Defense", "Ball movement"],
    weaknesses: ["Scoring consistency", "Bench depth", "Experience"],
    defenseRating: 105,
    offenseRating: 110,
    pace: "moderate"
  },
  "Cleveland Cavaliers": {
    name: "Cleveland Cavaliers",
    keyPlayers: ["Donovan Mitchell", "Darius Garland", "Evan Mobley"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Defense", "Athleticism", "Ball movement", "Depth"],
    weaknesses: ["Three-point consistency"],
    defenseRating: 107,
    offenseRating: 113,
    pace: "moderate"
  },
  "Indiana Pacers": {
    name: "Indiana Pacers",
    keyPlayers: ["Tyrese Haliburton", "Pascal Siakam", "Bennedict Mathurin"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Playmaking", "Ball movement", "Defense", "Versatility"],
    weaknesses: ["Bench scoring"],
    defenseRating: 106,
    offenseRating: 114,
    pace: "moderate"
  },
  "Charlotte Hornets": {
    name: "Charlotte Hornets",
    keyPlayers: ["LaMelo Ball", "Brandon Miller", "Nick Richards"],
    injuredPlayers: [
      { name: "Mark Williams", status: "out", impact: "defense/rebounding" }
    ],
    recentForm: "cold",
    strengths: ["Scoring", "Youth", "Athleticism"],
    weaknesses: ["Defense", "Consistency", "Experience"],
    defenseRating: 102,
    offenseRating: 111,
    pace: "moderate"
  }
};

/**
 * Get team context with all analytics
 */
export function getTeamContext(teamName: string): TeamContext | null {
  // Try direct match
  if (NBA_TEAMS[teamName]) return NBA_TEAMS[teamName];
  
  // Try case-insensitive match
  const normalized = Object.keys(NBA_TEAMS).find(
    t => t.toLowerCase() === teamName.toLowerCase()
  );
  return normalized ? NBA_TEAMS[normalized] : null;
}

/**
 * Generate professional matchup analysis
 */
export function generateMatchupAnalysis(homeTeam: string, awayTeam: string): string {
  const home = getTeamContext(homeTeam);
  const away = getTeamContext(awayTeam);
  
  if (!home || !away) return "Matchup analysis unavailable.";

  const analyses: string[] = [];

  // Offensive comparison
  if (home.offenseRating > away.defenseRating + 2) {
    analyses.push(`${homeTeam}'s elite offense (rating: ${home.offenseRating}) exploits ${awayTeam}'s defense (rating: ${away.defenseRating})`);
  } else if (away.offenseRating > home.defenseRating + 2) {
    analyses.push(`${awayTeam}'s elite offense (rating: ${away.offenseRating}) will test ${homeTeam}'s defense (rating: ${home.defenseRating})`);
  }

  // Key player matchups
  const homeStars = home.keyPlayers.slice(0, 2).join(" and ");
  const awayStars = away.keyPlayers.slice(0, 2).join(" and ");
  analyses.push(`Individual matchups: ${homeStars} vs ${awayStars} will be crucial`);

  // Injury impact
  if (home.injuredPlayers.length > 0) {
    const injuries = home.injuredPlayers.map(p => `${p.name} (${p.status})`).join(", ");
    analyses.push(`${homeTeam} health concerns: ${injuries}`);
  }
  if (away.injuredPlayers.length > 0) {
    const injuries = away.injuredPlayers.map(p => `${p.name} (${p.status})`).join(", ");
    analyses.push(`${awayTeam} health concerns: ${injuries}`);
  }

  // Recent form
  const formComparison = home.recentForm === "hot" ? "momentum advantage" : away.recentForm === "hot" ? "momentum for visitors" : "mixed form";
  analyses.push(`Recent form: ${home.recentForm} (${homeTeam}) vs ${away.recentForm} (${awayTeam}) — ${formComparison}`);

  // Pace match
  const paceAnalysis = home.pace === away.pace 
    ? `Both teams prefer ${home.pace} pace — scripted game`
    : `Pace mismatch: ${homeTeam} (${home.pace}) vs ${awayTeam} (${away.pace})`;
  analyses.push(paceAnalysis);

  return analyses.join("\n");
}

/**
 * Get injury impact summary
 */
export function getInjurySummary(teamName: string): string {
  const team = getTeamContext(teamName);
  if (!team || team.injuredPlayers.length === 0) {
    return "No significant injuries reported";
  }
  return team.injuredPlayers
    .map(p => `${p.name} (${p.status}) - affects ${p.impact}`)
    .join("; ");
}

/**
 * Calculate head-to-head advantage
 */
export function calculateTeamAdvantage(homeTeam: string, awayTeam: string): number {
  const home = getTeamContext(homeTeam);
  const away = getTeamContext(awayTeam);
  
  if (!home || !away) return 0;

  let advantage = 0;

  // Offensive/defensive matchup
  advantage += (home.offenseRating - away.defenseRating) * 0.3;

  // Recent form boost
  if (home.recentForm === "hot") advantage += 2;
  if (away.recentForm === "hot") advantage -= 2;

  // Injury factor
  const homeInjuryCount = home.injuredPlayers.filter(p => p.status !== "questionable").length;
  const awayInjuryCount = away.injuredPlayers.filter(p => p.status !== "questionable").length;
  advantage -= homeInjuryCount * 2;
  advantage += awayInjuryCount * 2;

  // Home court (3 point average advantage)
  advantage += 3;

  return Math.round(advantage);
}

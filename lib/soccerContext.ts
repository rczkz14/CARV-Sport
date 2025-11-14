/**
 * Soccer Team Context & Analytics
 * Key players, stats, injury status, recent form, and advanced metrics for EPL and La Liga
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
  league: "EPL" | "LaLiga";
}

const SOCCER_TEAMS: Record<string, TeamContext> = {
  // EPL Teams
  "Arsenal": {
    name: "Arsenal",
    keyPlayers: ["Bukayo Saka", "Martin Odegaard", "Gabriel Jesus"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Attacking flair", "Young talent", "Set pieces", "Defensive organization"],
    weaknesses: ["Injury concerns", "Depth at fullback"],
    defenseRating: 110,
    offenseRating: 118,
    pace: "fast",
    league: "EPL"
  },
  "Manchester City": {
    name: "Manchester City",
    keyPlayers: ["Kevin De Bruyne", "Erling Haaland", "Phil Foden"],
    injuredPlayers: [
      { name: "Kevin De Bruyne", status: "questionable", impact: "creative midfield" }
    ],
    recentForm: "hot",
    strengths: ["Elite possession", "Clinical finishing", "Tactical flexibility", "Depth"],
    weaknesses: ["Over-reliance on key players"],
    defenseRating: 115,
    offenseRating: 125,
    pace: "moderate",
    league: "EPL"
  },
  "Liverpool": {
    name: "Liverpool",
    keyPlayers: ["Mohamed Salah", "Virgil van Dijk", "Trent Alexander-Arnold"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Counter-attacking", "Set pieces", "Experience", "Mental resilience"],
    weaknesses: ["Injury-prone squad", "Defensive vulnerabilities"],
    defenseRating: 108,
    offenseRating: 116,
    pace: "fast",
    league: "EPL"
  },
  "Aston Villa": {
    name: "Aston Villa",
    keyPlayers: ["Ollie Watkins", "John McGinn", "Emiliano Martinez"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Attacking threat", "Goalkeeper quality", "Youth", "Physical presence"],
    weaknesses: ["Defensive consistency", "Midfield depth"],
    defenseRating: 105,
    offenseRating: 112,
    pace: "moderate",
    league: "EPL"
  },
  "Tottenham Hotspur": {
    name: "Tottenham Hotspur",
    keyPlayers: ["Harry Kane", "Son Heung-min", "Cristian Romero"],
    injuredPlayers: [
      { name: "Harry Kane", status: "questionable", impact: "striking" }
    ],
    recentForm: "inconsistent",
    strengths: ["Individual brilliance", "Attacking width", "Youth development"],
    weaknesses: ["Defensive organization", "Inconsistency"],
    defenseRating: 103,
    offenseRating: 114,
    pace: "fast",
    league: "EPL"
  },
  "Chelsea": {
    name: "Chelsea",
    keyPlayers: ["Enzo Fernandez", "Raheem Sterling", "Thiago Silva"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Squad depth", "Technical quality", "Financial resources"],
    weaknesses: ["Form inconsistency", "Tactical identity"],
    defenseRating: 106,
    offenseRating: 111,
    pace: "moderate",
    league: "EPL"
  },
  "Newcastle United": {
    name: "Newcastle United",
    keyPlayers: ["Alexander Isak", "Bruno Guimaraes", "Kieran Trippier"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Financial backing", "Attacking intent", "Set pieces"],
    weaknesses: ["Defensive solidity", "Away form"],
    defenseRating: 104,
    offenseRating: 113,
    pace: "moderate",
    league: "EPL"
  },
  "Manchester United": {
    name: "Manchester United",
    keyPlayers: ["Bruno Fernandes", "Marcus Rashford", "Casemiro"],
    injuredPlayers: [
      { name: "Casemiro", status: "out", impact: "defensive midfield" }
    ],
    recentForm: "inconsistent",
    strengths: ["Brand power", "Attacking talent", "Experience"],
    weaknesses: ["Defensive frailties", "Managerial stability"],
    defenseRating: 102,
    offenseRating: 109,
    pace: "moderate",
    league: "EPL"
  },
  "Brighton & Hove Albion": {
    name: "Brighton & Hove Albion",
    keyPlayers: ["Kaoru Mitoma", "Pascal Gross", "Robert Sanchez"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Youth development", "Tactical flexibility", "Goalkeeper"],
    weaknesses: ["Scoring consistency", "Physical presence"],
    defenseRating: 107,
    offenseRating: 105,
    pace: "moderate",
    league: "EPL"
  },
  "Fulham": {
    name: "Fulham",
    keyPlayers: ["Aleksandar Mitrovic", "Andreas Pereira", "Tim Ream"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Set pieces", "Counter-attacking", "Organization"],
    weaknesses: ["Scoring drought", "Depth"],
    defenseRating: 106,
    offenseRating: 103,
    pace: "moderate",
    league: "EPL"
  },
  "Crystal Palace": {
    name: "Crystal Palace",
    keyPlayers: ["Wilfried Zaha", "Michael Olise", "Marc Guehi"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Defensive resilience", "Counter-attacking", "Experience"],
    weaknesses: ["Attacking creativity", "Injury concerns"],
    defenseRating: 108,
    offenseRating: 104,
    pace: "moderate",
    league: "EPL"
  },
  "Brentford": {
    name: "Brentford",
    keyPlayers: ["Ivan Toney", "Christian Norgaard", "Bryan Mbeumo"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Set pieces", "Youth", "Tactical discipline"],
    weaknesses: ["Away form", "Depth"],
    defenseRating: 109,
    offenseRating: 107,
    pace: "moderate",
    league: "EPL"
  },
  "Wolverhampton Wanderers": {
    name: "Wolverhampton Wanderers",
    keyPlayers: ["Ruben Neves", "Matheus Cunha", "Raul Jimenez"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Counter-attacking", "Physicality", "Youth"],
    weaknesses: ["Consistency", "Finishing"],
    defenseRating: 105,
    offenseRating: 106,
    pace: "fast",
    league: "EPL"
  },
  "West Ham United": {
    name: "West Ham United",
    keyPlayers: ["Jarrod Bowen", "Michail Antonio", "Declan Rice"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Set pieces", "Physical presence", "London derby experience"],
    weaknesses: ["Defensive organization", "Away performances"],
    defenseRating: 104,
    offenseRating: 108,
    pace: "moderate",
    league: "EPL"
  },
  "Bournemouth": {
    name: "Bournemouth",
    keyPlayers: ["Dominic Solanke", "Philip Billing", "Jefferson Lerma"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Attacking flair", "Youth", "Counter-attacking"],
    weaknesses: ["Defensive solidity", "Relegation battle"],
    defenseRating: 101,
    offenseRating: 105,
    pace: "fast",
    league: "EPL"
  },
  "Nottingham Forest": {
    name: "Nottingham Forest",
    keyPlayers: ["Chris Wood", "Callum Hudson-Odoi", "Steve Cooper"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Physicality", "Counter-attacking", "Youth"],
    weaknesses: ["Defensive frailties", "Consistency"],
    defenseRating: 99,
    offenseRating: 102,
    pace: "moderate",
    league: "EPL"
  },
  "Everton": {
    name: "Everton",
    keyPlayers: ["Dominic Calvert-Lewin", "Abdoulaye Doucoure", "Jordan Pickford"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Goalkeeper quality", "Set pieces", "Experience"],
    weaknesses: ["Attacking output", "Defensive issues"],
    defenseRating: 100,
    offenseRating: 101,
    pace: "moderate",
    league: "EPL"
  },
  "Luton Town": {
    name: "Luton Town",
    keyPlayers: ["Elijah Adebayo", "Carlton Morris", "Tom Lockyer"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Physical presence", "Counter-attacking", "Resilience"],
    weaknesses: ["Quality depth", "Away form"],
    defenseRating: 98,
    offenseRating: 99,
    pace: "moderate",
    league: "EPL"
  },
  "Burnley": {
    name: "Burnley",
    keyPlayers: ["Josh Brownhill", "Jay Rodriguez", "James Trafford"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Set pieces", "Physicality", "Organization"],
    weaknesses: ["Attacking creativity", "Depth"],
    defenseRating: 97,
    offenseRating: 98,
    pace: "slow",
    league: "EPL"
  },
  "Sheffield United": {
    name: "Sheffield United",
    keyPlayers: ["Oliver McBurnie", "Ben Osborn", "Iliman Ndiaye"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Defensive organization", "Counter-attacking", "Resilience"],
    weaknesses: ["Attacking output", "Quality"],
    defenseRating: 96,
    offenseRating: 97,
    pace: "slow",
    league: "EPL"
  },

  // La Liga Teams
  "Barcelona": {
    name: "Barcelona",
    keyPlayers: ["Pedri", "Robert Lewandowski", "Gavi"],
    injuredPlayers: [
      { name: "Gavi", status: "out", impact: "midfield creativity" }
    ],
    recentForm: "inconsistent",
    strengths: ["Technical quality", "Youth academy", "Possession play"],
    weaknesses: ["Financial issues", "Injury concerns", "Defensive stability"],
    defenseRating: 109,
    offenseRating: 117,
    pace: "moderate",
    league: "LaLiga"
  },
  "Real Madrid": {
    name: "Real Madrid",
    keyPlayers: ["Vinicius Junior", "Karim Benzema", "Luka Modric"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Star power", "Experience", "Tactical flexibility", "Depth"],
    weaknesses: ["Inconsistency", "Over-reliance on individuals"],
    defenseRating: 112,
    offenseRating: 120,
    pace: "moderate",
    league: "LaLiga"
  },
  "Atletico Madrid": {
    name: "Atletico Madrid",
    keyPlayers: ["Antoine Griezmann", "Jan Oblak", "Koke"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Defensive solidity", "Counter-attacking", "Mental toughness"],
    weaknesses: ["Attacking creativity", "Injury concerns"],
    defenseRating: 118,
    offenseRating: 108,
    pace: "moderate",
    league: "LaLiga"
  },
  "Real Sociedad": {
    name: "Real Sociedad",
    keyPlayers: ["Mikel Oyarzabal", "Alexander Isak", "Martin Zubimendi"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Attacking flair", "Youth", "Tactical discipline"],
    weaknesses: ["Defensive depth", "Away form"],
    defenseRating: 107,
    offenseRating: 113,
    pace: "moderate",
    league: "LaLiga"
  },
  "Villarreal": {
    name: "Villarreal",
    keyPlayers: ["Gerard Moreno", "Dani Parejo", "Samuel Chukwueze"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Technical quality", "Set pieces", "Experience"],
    weaknesses: ["Consistency", "Depth"],
    defenseRating: 106,
    offenseRating: 110,
    pace: "moderate",
    league: "LaLiga"
  },
  "Real Betis": {
    name: "Real Betis",
    keyPlayers: ["Nabil Fekir", "Sergio Canales", "Borja Iglesias"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Attacking talent", "Youth", "Counter-attacking"],
    weaknesses: ["Defensive organization", "Inconsistency"],
    defenseRating: 104,
    offenseRating: 109,
    pace: "moderate",
    league: "LaLiga"
  },
  "Sevilla": {
    name: "Sevilla",
    keyPlayers: ["Ivan Rakitic", "Youssef En-Nesyri", "Jesus Navas"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["European experience", "Set pieces", "Depth"],
    weaknesses: ["Recent form", "Youth"],
    defenseRating: 105,
    offenseRating: 107,
    pace: "moderate",
    league: "LaLiga"
  },
  "Athletic Bilbao": {
    name: "Athletic Bilbao",
    keyPlayers: ["Iker Muniain", "Inaki Williams", "Nico Williams"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Local talent", "Physicality", "Basque identity"],
    weaknesses: ["Ageing squad", "Depth"],
    defenseRating: 108,
    offenseRating: 106,
    pace: "moderate",
    league: "LaLiga"
  },
  "Valencia": {
    name: "Valencia",
    keyPlayers: ["Carlos Soler", "Hugo Duro", "Jose Luis Gayà"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Youth development", "Technical quality", "Stadium atmosphere"],
    weaknesses: ["Financial issues", "Consistency"],
    defenseRating: 103,
    offenseRating: 105,
    pace: "moderate",
    league: "LaLiga"
  },
  "Osasuna": {
    name: "Osasuna",
    keyPlayers: ["Chimy Avila", "Pablo Ibanez", "Darko Brasanac"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Defensive organization", "Counter-attacking", "Resilience"],
    weaknesses: ["Attacking output", "Depth"],
    defenseRating: 110,
    offenseRating: 102,
    pace: "moderate",
    league: "LaLiga"
  },
  "Girona": {
    name: "Girona",
    keyPlayers: ["Cristhian Stuani", "Yan Couto", "Aleix Garcia"],
    injuredPlayers: [],
    recentForm: "hot",
    strengths: ["Attacking flair", "Youth", "Tactical innovation"],
    weaknesses: ["Experience", "Depth"],
    defenseRating: 107,
    offenseRating: 111,
    pace: "fast",
    league: "LaLiga"
  },
  "Rayo Vallecano": {
    name: "Rayo Vallecano",
    keyPlayers: ["Randy Nteka", "Oscar Trejo", "Isi Palazon"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Physicality", "Counter-attacking", "Resilience"],
    weaknesses: ["Quality depth", "Consistency"],
    defenseRating: 102,
    offenseRating: 104,
    pace: "moderate",
    league: "LaLiga"
  },
  "Celta Vigo": {
    name: "Celta Vigo",
    keyPlayers: ["Iago Aspas", "Gabri Veiga", "Joseph Aidoo"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Attacking creativity", "Youth", "Technical quality"],
    weaknesses: ["Defensive solidity", "Consistency"],
    defenseRating: 101,
    offenseRating: 108,
    pace: "moderate",
    league: "LaLiga"
  },
  "Mallorca": {
    name: "Mallorca",
    keyPlayers: ["Vedat Muriqi", "Antonio Sanchez", "Pablo Maffeo"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Counter-attacking", "Resilience", "Experience"],
    weaknesses: ["Attacking output", "Depth"],
    defenseRating: 100,
    offenseRating: 103,
    pace: "moderate",
    league: "LaLiga"
  },
  "Almeria": {
    name: "Almeria",
    keyPlayers: ["Largie Ramazani", "Luis Suarez", "Fernando Martinez"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Youth", "Physicality", "Resilience"],
    weaknesses: ["Quality", "Depth", "Relegation battle"],
    defenseRating: 98,
    offenseRating: 101,
    pace: "moderate",
    league: "LaLiga"
  },
  "Cadiz": {
    name: "Cadiz",
    keyPlayers: ["Ruben Sobrino", "Alvaro Negredo", "Fali"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Defensive organization", "Set pieces", "Resilience"],
    weaknesses: ["Attacking creativity", "Depth"],
    defenseRating: 99,
    offenseRating: 100,
    pace: "slow",
    league: "LaLiga"
  },
  "Getafe": {
    name: "Getafe",
    keyPlayers: ["Enes Unal", "Carles Alena", "Djené"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Defensive solidity", "Counter-attacking", "Experience"],
    weaknesses: ["Attacking output", "Consistency"],
    defenseRating: 104,
    offenseRating: 99,
    pace: "moderate",
    league: "LaLiga"
  },
  "Alaves": {
    name: "Alaves",
    keyPlayers: ["Joselu", "Luis Rioja", "Victor Laguardia"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Resilience", "Counter-attacking", "Organization"],
    weaknesses: ["Attacking quality", "Depth"],
    defenseRating: 103,
    offenseRating: 98,
    pace: "moderate",
    league: "LaLiga"
  },
  "Las Palmas": {
    name: "Las Palmas",
    keyPlayers: ["Kirian Rodriguez", "Jonathan Viera", "Micael Gonzalez"],
    injuredPlayers: [],
    recentForm: "inconsistent",
    strengths: ["Attacking flair", "Youth", "Canary Islands spirit"],
    weaknesses: ["Defensive consistency", "Depth"],
    defenseRating: 102,
    offenseRating: 106,
    pace: "moderate",
    league: "LaLiga"
  },
  "Granada": {
    name: "Granada",
    keyPlayers: ["Lucas Boye", "Gerard Gumbau", "Antonio Puertas"],
    injuredPlayers: [],
    recentForm: "cold",
    strengths: ["Youth development", "Technical quality", "Resilience"],
    weaknesses: ["Consistency", "Depth", "Relegation concerns"],
    defenseRating: 97,
    offenseRating: 99,
    pace: "moderate",
    league: "LaLiga"
  }
};

/**
 * Get team context with all analytics
 */
export function getTeamContext(teamName: string): TeamContext | null {
  // Try direct match
  if (SOCCER_TEAMS[teamName]) return SOCCER_TEAMS[teamName];

  // Try case-insensitive match
  const normalized = Object.keys(SOCCER_TEAMS).find(
    t => t.toLowerCase() === teamName.toLowerCase()
  );
  return normalized ? SOCCER_TEAMS[normalized] : null;
}

/**
 * Generate professional matchup analysis for soccer
 */
export function generateMatchupAnalysis(homeTeam: string, awayTeam: string): string {
  const home = getTeamContext(homeTeam);
  const away = getTeamContext(awayTeam);

  if (!home || !away) return "Matchup analysis unavailable.";

  const analyses: string[] = [];

  // Style comparison (possession vs counter-attack)
  if (home.pace === "fast" && away.pace === "slow") {
    analyses.push(`${homeTeam} can exploit ${awayTeam}'s slower pace with quick transitions`);
  } else if (away.pace === "fast" && home.pace === "slow") {
    analyses.push(`${awayTeam}'s pace could trouble ${homeTeam}'s slower defensive setup`);
  }

  // Defensive vs Offensive matchup
  if (home.defenseRating > away.offenseRating + 3) {
    analyses.push(`${homeTeam}'s solid defense (rating: ${home.defenseRating}) can contain ${awayTeam}'s attack (rating: ${away.offenseRating})`);
  } else if (away.defenseRating > home.offenseRating + 3) {
    analyses.push(`${awayTeam}'s defense (rating: ${away.defenseRating}) poses challenges for ${homeTeam}'s offense (rating: ${home.offenseRating})`);
  }

  // Key player matchups
  const homeStars = home.keyPlayers.slice(0, 2).join(" and ");
  const awayStars = away.keyPlayers.slice(0, 2).join(" and ");
  analyses.push(`Key battles: ${homeStars} vs ${awayStars} could decide the game`);

  // Injury impact
  if (home.injuredPlayers.length > 0) {
    const injuries = home.injuredPlayers.map(p => `${p.name} (${p.status})`).join(", ");
    analyses.push(`${homeTeam} concerns: ${injuries}`);
  }
  if (away.injuredPlayers.length > 0) {
    const injuries = away.injuredPlayers.map(p => `${p.name} (${p.status})`).join(", ");
    analyses.push(`${awayTeam} concerns: ${injuries}`);
  }

  // Recent form
  const formComparison = home.recentForm === "hot" ? "momentum advantage for home" : away.recentForm === "hot" ? "visitors in form" : "both sides inconsistent";
  analyses.push(`Current form: ${home.recentForm} (${homeTeam}) vs ${away.recentForm} (${awayTeam}) — ${formComparison}`);

  // League context
  if (home.league !== away.league) {
    analyses.push(`Cross-league matchup: ${homeTeam} (${home.league}) vs ${awayTeam} (${away.league}) adds unpredictability`);
  }

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
 * Calculate head-to-head advantage for soccer
 */
export function calculateTeamAdvantage(homeTeam: string, awayTeam: string): number {
  const home = getTeamContext(homeTeam);
  const away = getTeamContext(awayTeam);

  if (!home || !away) return 0;

  let advantage = 0;

  // Style advantage (possession teams get home advantage boost)
  if (home.pace === "moderate" && away.pace === "fast") advantage += 1;
  if (away.pace === "moderate" && home.pace === "fast") advantage -= 1;

  // Offensive/defensive matchup
  advantage += (home.offenseRating - away.defenseRating) * 0.4;

  // Recent form boost
  if (home.recentForm === "hot") advantage += 3;
  if (away.recentForm === "hot") advantage -= 3;

  // Injury factor
  const homeInjuryCount = home.injuredPlayers.filter(p => p.status !== "questionable").length;
  const awayInjuryCount = away.injuredPlayers.filter(p => p.status !== "questionable").length;
  advantage -= homeInjuryCount * 3;
  advantage += awayInjuryCount * 3;

  // Home advantage (typically 2-3 goals in soccer)
  advantage += 2.5;

  // League familiarity
  if (home.league === away.league) advantage += 0.5;

  return Math.round(advantage * 10) / 10; // Round to 1 decimal
}
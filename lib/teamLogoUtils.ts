/**
 * Team Logo Utility
 * Maps team names to their logo images
 */

const TEAM_LOGOS: Record<string, string> = {
  // NBA Teams
  'New York Knicks': '/images/New-York-Knicks.png',
  'Knicks': '/images/New-York-Knicks.png',
  'Orlando Magic': '/images/Orlando-Magic.png',
  'Magic': '/images/Orlando-Magic.png',
  'Boston Celtics': '/images/boston-celtics.png',
  'Celtics': '/images/boston-celtics.png',
  'Memphis Grizzlies': '/images/memphis-grizzlies.png',
  'Grizzlies': '/images/memphis-grizzlies.png',
  'Los Angeles Clippers': '/images/los-angeles-clippers.png',
  'Clippers': '/images/los-angeles-clippers.png',
  'Denver Nuggets': '/images/Denver-Nuggets.png',
  'Nuggets': '/images/Denver-Nuggets.png',
  'Brooklyn Nets': '/images/Brooklyn-Nets.png',
  'Nets': '/images/Brooklyn-Nets.png',
  'Toronto Raptors': '/images/toronto-raptors.png',
  'Raptors': '/images/toronto-raptors.png',
  'Atlanta Hawks': '/images/Atlanta-Hawks.png',
  'Hawks': '/images/Atlanta-Hawks.png',
  'New Orleans Pelicans': '/images/new-orleans-pelicans.png',
  'Pelicans': '/images/new-orleans-pelicans.png',
  'Philadelphia 76ers': '/images/Philadelphia-76ers.png',
  '76ers': '/images/Philadelphia-76ers.png',
  'Phoenix Suns': '/images/phoenix-suns.png',
  'Suns': '/images/phoenix-suns.png',
  'Cleveland Cavaliers': '/images/cleveland-cavaliers.png',
  'Cavaliers': '/images/cleveland-cavaliers.png',
  'Indiana Pacers': '/images/Indiana-Pacers.png',
  'Pacers': '/images/Indiana-Pacers.png',
  'Utah Jazz': '/images/Utah-Jazz.png',
  'Jazz': '/images/Utah-Jazz.png',
  'Charlotte Hornets': '/images/Charlotte-Hornets.png',
  'Hornets': '/images/Charlotte-Hornets.png',
  'Dallas Mavericks': '/images/Dallas-Mavericks.png',
  'Mavericks': '/images/Dallas-Mavericks.png',
  'Detroit Pistons': '/images/detroit-pistons.png',
  'Pistons': '/images/detroit-pistons.png',
  'Miami Heat': '/images/miami-heat.png',
  'Heat': '/images/miami-heat.png',
  'Milwaukee Bucks': '/images/Milwaukee-Bucks.png',
  'Bucks': '/images/Milwaukee-Bucks.png',
  'Golden State Warriors': '/images/Golden-State-Warriors.png',
  'Warriors': '/images/Golden-State-Warriors.png',
  'Los Angeles Lakers': '/images/Los-Angeles-Lakers.png',
  'Lakers': '/images/Los-Angeles-Lakers.png',
  'Sacramento Kings': '/images/sacramento-kings.png',
  'Kings': '/images/sacramento-kings.png',
  'San Antonio Spurs': '/images/san-antonio-spurs.png',
  'Spurs': '/images/san-antonio-spurs.png',
  'Oklahoma City Thunder': '/images/Oklahoma-City-Thunder.png',
  'Thunder': '/images/Oklahoma-City-Thunder.png',
  'Portland Trail Blazers': '/images/Portland-Trail-Blazers.png',
  'Trail Blazers': '/images/Portland-Trail-Blazers.png',
  'Blazers': '/images/Portland-Trail-Blazers.png',

  // EPL Teams
  'Arsenal': '/images/Brentford.png',
  'Bournemouth': '/images/Bournemouth.png',
  'Brentford': '/images/brentford.png',
  'Brighton': '/images/brighton.png',
  'Brighton and Hove Albion': '/images/brighton.png',
  'West Ham United': '/images/West-Ham-United.png',
  'West Ham': '/images/West-Ham-United.png',

  // LaLiga Teams
  'Barcelona': '/images/barcelona.png',
  'Valencia': '/images/Valencia.png',
  'Levante': '/images/Levante.png',
};

const TEAM_COLORS: Record<string, string> = {
  'New York Knicks': '#F58426',
  'Knicks': '#F58426',
  'Orlando Magic': '#0077B6',
  'Magic': '#0077B6',
  'Boston Celtics': '#007A33',
  'Celtics': '#007A33',
  'Memphis Grizzlies': '#12173F',
  'Grizzlies': '#12173F',
  'Los Angeles Clippers': '#C4CED4',
  'Clippers': '#C4CED4',
  'Denver Nuggets': '#0E2240',
  'Nuggets': '#0E2240',
  'Brooklyn Nets': '#000000',
  'Nets': '#000000',
  'Toronto Raptors': '#CE1141',
  'Raptors': '#CE1141',
  'Atlanta Hawks': '#E03C28',
  'Hawks': '#E03C28',
  'Cleveland Cavaliers': '#6F263D',
  'Cavaliers': '#6F263D',
  'Indiana Pacers': '#002D62',
  'Pacers': '#002D62',
  'Utah Jazz': '#002B5C',
  'Jazz': '#002B5C',
};

/**
 * Get team logo URL by team name
 * Also accepts optional league parameter for better detection
 */
export function getTeamLogo(teamName: string, league?: string): string {
  const normalized = teamName.trim();
  const logoPath = TEAM_LOGOS[normalized];
  
  if (logoPath) {
    return logoPath;
  }
  
  // Check if it's a soccer team (by league or team name)
  if (isSoccerTeam(normalized, league)) {
    return '/images/no-logo-bro.png';
  }
  
  // Default fallback for NBA and other leagues
  return '/images/CARV-Logo.png';
}

/**
 * Check if team name or league suggests it's a soccer team
 */
function isSoccerTeam(teamName: string, league?: string): boolean {
  // Check league first if provided
  if (league) {
    const lowerLeague = league.toLowerCase();
    if (lowerLeague.includes('premier') || lowerLeague.includes('epl') || 
        lowerLeague.includes('liga') || lowerLeague.includes('spanish') ||
        lowerLeague.includes('english') || lowerLeague.includes('soccer')) {
      return true;
    }
  }
  
  const lowerName = teamName.toLowerCase();
  
  // Common soccer team indicators
  const soccerIndicators = [
    'fc', 'united', 'city', 'town', 'rovers', 'wanderers', 'athletic', 'albion',
    'arsenal', 'chelsea', 'liverpool', 'manchester', 'tottenham', 'leicester',
    'everton', 'newcastle', 'aston', 'villa', 'crystal', 'palace', 'wolves',
    'southampton', 'burnley', 'sheffield', 'norwich', 'watford', 'leeds',
    'fulham', 'brentford', 'brighton', 'bournemouth', 'nottingham', 'forest',
    'west ham', 'real', 'barcelona', 'atletico', 'valencia', 'sevilla',
    'villarreal', 'sociedad', 'betis', 'getafe', 'granada', 'levante',
    'osasuna', 'cadiz', 'elche', 'alaves', 'eibar', 'huesca', 'valladolid',
    'madrid', 'espanyol', 'athletic bilbao', 'celta', 'mallorca'
  ];
  
  // Check if any soccer indicator is in the team name
  return soccerIndicators.some(indicator => lowerName.includes(indicator));
}

/**
 * Get team color by team name
 */
export function getTeamColor(teamName: string): string {
  const normalized = teamName.trim();
  return TEAM_COLORS[normalized] || '#666666'; // Fallback to gray
}

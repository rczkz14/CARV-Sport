/**
 * Team Logo Utility
 * Maps team names to their logo images
 */

const TEAM_LOGOS: Record<string, string> = {
  // NBA Teams
  'new york knicks': '/images/new-york-knicks.png',
  'orlando magic': '/images/orlando-magic.png',
  'boston celtics': '/images/boston-celtics.png',
  'memphis grizzlies': '/images/memphis-grizzlies.png',
  'los angeles clippers': '/images/los-angeles-clippers.png',
  'denver nuggets': '/images/denver-nuggets.png',
  'brooklyn nets': '/images/brooklyn-nets.png',
  'toronto raptors': '/images/toronto-raptors.png',
  'atlanta hawks': '/images/atlanta-hawks.png',
  'new orleans pelicans': '/images/new-orleans-pelicans.png',
  'philadelphia 76ers': '/images/philadelphia-76ers.png',
  'phoenix suns': '/images/phoenix-suns.png',
  'cleveland cavaliers': '/images/cleveland-cavaliers.png',
  'indiana pacers': '/images/indiana-pacers.png',
  'utah jazz': '/images/utah-jazz.png',
  'charlotte hornets': '/images/charlotte-hornets.png',
  'dallas mavericks': '/images/dallas-mavericks.png',
  'detroit pistons': '/images/detroit-pistons.png',
  'miami heat': '/images/miami-heat.png',
  'milwaukee bucks': '/images/milwaukee-bucks.png',
  'golden state warriors': '/images/golden-state-warriors.png',
  'los angeles lakers': '/images/los-angeles-lakers.png',
  'sacramento kings': '/images/sacramento-kings.png',
  'san antonio spurs': '/images/san-antonio-spurs.png',
  'oklahoma city thunder': '/images/oklahoma-city-thunder.png',
  'portland trail blazers': '/images/portland-trail-blazers.png',
  'houston rockets': '/images/houston-rockets.png',

  // EPL Teams
  'arsenal': '/images/arsenal.png',
  'bournemouth': '/images/bournemouth.png',
  'brentford': '/images/brentford.png',
  'brighton': '/images/brighton.png',
  'brighton and hove albion': '/images/brighton.png',
  'west ham united': '/images/west-ham-united.png',

  // LaLiga Teams
  'barcelona': '/images/barcelona.png',
  'valencia': '/images/valencia.png',
  'levante': '/images/levante.png',
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
  // Normalize: lowercase and trim only (no hyphens)
  const normalized = teamName.trim().toLowerCase();
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

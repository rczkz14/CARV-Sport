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
};

/**
 * Get team logo URL by team name
 */
export function getTeamLogo(teamName: string): string {
  const normalized = teamName.trim();
  return TEAM_LOGOS[normalized] || '/images/CARV-Logo.png'; // Fallback to CARV logo
}

/**
 * Get team color by team name
 */
export function getTeamColor(teamName: string): string {
  const normalized = teamName.trim();
  return TEAM_COLORS[normalized] || '#666666'; // Fallback to gray
}

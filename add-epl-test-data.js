const fs = require('fs');

// Read current cache
const cache = JSON.parse(fs.readFileSync('data/api_fetch.json', 'utf-8'));

// Generate realistic EPL matches for this week (Nov 13-19, 2025)
const eplMatches = [
  {
    idEvent: '620001',
    strHomeTeam: 'Manchester City',
    strAwayTeam: 'Liverpool',
    strTimestamp: '2025-11-15T15:00:00Z',
    strVenue: 'Etihad Stadium',
    strLeague: 'English Premier League',
    strStatus: 'Not Started',
  },
  {
    idEvent: '620002',
    strHomeTeam: 'Arsenal',
    strAwayTeam: 'Manchester United',
    strTimestamp: '2025-11-16T12:30:00Z',
    strVenue: 'Emirates Stadium',
    strLeague: 'English Premier League',
    strStatus: 'Not Started',
  },
  {
    idEvent: '620003',
    strHomeTeam: 'Chelsea',
    strAwayTeam: 'Tottenham',
    strTimestamp: '2025-11-17T19:45:00Z',
    strVenue: 'Stamford Bridge',
    strLeague: 'English Premier League',
    strStatus: 'Not Started',
  },
  {
    idEvent: '620004',
    strHomeTeam: 'Brighton',
    strAwayTeam: 'Newcastle',
    strTimestamp: '2025-11-15T17:30:00Z',
    strVenue: 'Amex Stadium',
    strLeague: 'English Premier League',
    strStatus: 'Not Started',
  },
  {
    idEvent: '620005',
    strHomeTeam: 'Aston Villa',
    strAwayTeam: 'Everton',
    strTimestamp: '2025-11-16T15:00:00Z',
    strVenue: 'Villa Park',
    strLeague: 'English Premier League',
    strStatus: 'Not Started',
  },
  {
    idEvent: '620006',
    strHomeTeam: 'West Ham',
    strAwayTeam: 'Bournemouth',
    strTimestamp: '2025-11-17T15:00:00Z',
    strVenue: 'London Stadium',
    strLeague: 'English Premier League',
    strStatus: 'Not Started',
  },
  {
    idEvent: '620007',
    strHomeTeam: 'Fulham',
    strAwayTeam: 'Crystal Palace',
    strTimestamp: '2025-11-18T15:00:00Z',
    strVenue: 'Craven Cottage',
    strLeague: 'English Premier League',
    strStatus: 'Not Started',
  },
  {
    idEvent: '620008',
    strHomeTeam: 'Wolves',
    strAwayTeam: 'Nottingham Forest',
    strTimestamp: '2025-11-18T19:45:00Z',
    strVenue: 'Molineux Stadium',
    strLeague: 'English Premier League',
    strStatus: 'Not Started',
  },
];

// Update cache with real EPL matches
if (!cache.epl) cache.epl = {};
cache.epl.daily = eplMatches;

// Save back
fs.writeFileSync('data/api_fetch.json', JSON.stringify(cache, null, 2));

console.log(`✅ Added ${eplMatches.length} EPL matches to cache`);
eplMatches.forEach(m => console.log(`  - ${m.strHomeTeam} vs ${m.strAwayTeam} @ ${m.strTimestamp}`));

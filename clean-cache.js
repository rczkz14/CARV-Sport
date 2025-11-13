const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data/api_fetch.json', 'utf-8'));

// Filter out mock/fake matches - keep only real matches from actual APIs
// Mock indicators: missing crucial fields, duplicate teams, unrealistic data

function isRealMatch(match) {
  // Must have essential fields
  if (!match.idEvent || !match.strHomeTeam || !match.strAwayTeam) return false;
  if (!match.strTimestamp && (!match.dateEvent || !match.strTime)) return false;
  
  // Filter out obvious mocks (empty teams, test data)
  const homeTeam = String(match.strHomeTeam || '').toLowerCase().trim();
  const awayTeam = String(match.strAwayTeam || '').toLowerCase().trim();
  
  if (!homeTeam || !awayTeam) return false;
  if (homeTeam === awayTeam) return false; // Same team vs same team
  if (homeTeam.includes('test') || awayTeam.includes('test')) return false;
  if (homeTeam.includes('mock') || awayTeam.includes('mock')) return false;
  
  return true;
}

// Clean EPL
if (data.epl?.daily) {
  const before = data.epl.daily.length;
  data.epl.daily = data.epl.daily.filter(isRealMatch);
  console.log(`EPL daily: ${before} → ${data.epl.daily.length}`);
}
if (data.epl?.league) {
  const before = data.epl.league.length;
  data.epl.league = data.epl.league.filter(isRealMatch);
  console.log(`EPL league: ${before} → ${data.epl.league.length}`);
}

// Clean LaLiga
if (data.laliga?.daily) {
  const before = data.laliga.daily.length;
  data.laliga.daily = data.laliga.daily.filter(isRealMatch);
  console.log(`LaLiga daily: ${before} → ${data.laliga.daily.length}`);
}
if (data.laliga?.league) {
  const before = data.laliga.league.length;
  data.laliga.league = data.laliga.league.filter(isRealMatch);
  console.log(`LaLiga league: ${before} → ${data.laliga.league.length}`);
}

// Write cleaned data
fs.writeFileSync('data/api_fetch.json', JSON.stringify(data, null, 2));
console.log('✅ Cache cleaned');

#!/usr/bin/env node

// Quick test of D+1 filtering logic
const fs = require('fs');

function getD1DateRangeWIB(nowUtc = new Date()) {
  // Get tomorrow in WIB by adding 1 day to current UTC, then converting
  const tomorrowUtc = new Date(nowUtc);
  tomorrowUtc.setUTCDate(tomorrowUtc.getUTCDate() + 1);
  
  // Convert tomorrow UTC to WIB date components
  const tomorrowWIBString = tomorrowUtc.toLocaleString('en-US', { 
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const [month, day, year] = tomorrowWIBString.split('/');
  const dateStringWIB = `${year}-${month}-${day}`;

  // D+1 start: 00:00:00 WIB on that date
  const d1StartWIB = new Date(`${dateStringWIB}T00:00:00Z`);
  const startUTC = new Date(d1StartWIB.getTime() - 7 * 60 * 60 * 1000);

  // D+1 end: 23:59:59 WIB on that date
  const d1EndWIB = new Date(`${dateStringWIB}T23:59:59Z`);
  const endUTC = new Date(d1EndWIB.getTime() - 7 * 60 * 60 * 1000);

  return {
    startUTC: startUTC.getTime(),
    endUTC: endUTC.getTime(),
    dateStringWIB,
  };
}

function filterNBAMatchesToD1(matches, nowUtc = new Date()) {
  const { startUTC, endUTC, dateStringWIB } = getD1DateRangeWIB(nowUtc);

  console.log(`\n[D1 Filter] Current UTC: ${nowUtc.toISOString()}`);
  console.log(`[D1 Filter] D+1 WIB date: ${dateStringWIB}`);
  console.log(`[D1 Filter] UTC range: ${new Date(startUTC).toISOString()} to ${new Date(endUTC).toISOString()}`);

  const d1Matches = matches.filter((match) => {
    if (!match.datetime) return false;
    const matchTime = new Date(match.datetime).getTime();
    const isInRange = matchTime >= startUTC && matchTime <= endUTC;
    console.log(`  [Match] ${match.id} (${match.home} vs ${match.away}) at ${match.datetime}`);
    console.log(`    → UTC timestamp: ${matchTime} ${isInRange ? '✓ IN RANGE' : '✗ OUT OF RANGE'}`);
    return isInRange;
  });

  console.log(`\n[D1 Filter] Filtered: ${d1Matches.length} matches`);
  return d1Matches.slice(0, 3);
}

// Load test data
const data = JSON.parse(fs.readFileSync('./data/api_fetch.json', 'utf-8'));

// Extract NBA matches
const matches = [];
if (data.nba && data.nba.daily) {
  data.nba.daily.forEach(m => {
    matches.push({
      id: m.idEvent,
      home: m.strHomeTeam,
      away: m.strAwayTeam,
      datetime: m.strTimestamp,
    });
  });
}

console.log(`\n📊 Testing D+1 Filter with ${matches.length} NBA matches\n`);

// Test at the time the auto-predict ran (Nov 12, 14:52 UTC)
const testTime = new Date('2025-11-12T14:52:27Z');
const result = filterNBAMatchesToD1(matches, testTime);

console.log(`\n✅ Final result: ${result.length} matches to predict`);
result.forEach(m => {
  console.log(`  - ${m.id}: ${m.home} vs ${m.away}`);
});

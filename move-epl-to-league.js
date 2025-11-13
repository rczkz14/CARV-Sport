const fs = require('fs');

const cache = JSON.parse(fs.readFileSync('data/api_fetch.json', 'utf-8'));

// Move daily EPL matches to league (so they appear first)
const eplDaily = cache.epl?.daily || [];
const eplLeague = cache.epl?.league || [];

// Combine: put daily first, then league
cache.epl.league = [...eplDaily, ...eplLeague];
cache.epl.daily = [];

fs.writeFileSync('data/api_fetch.json', JSON.stringify(cache, null, 2));
console.log('✅ Moved EPL daily matches to league section');
console.log(`   Total EPL league matches now: ${cache.epl.league.length}`);

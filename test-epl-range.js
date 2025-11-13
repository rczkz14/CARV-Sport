const now = new Date('2025-11-12T17:36:00Z');

// Get WIB date
const nowWIB = new Date(now.getTime() + 7*60*60*1000);
const s = nowWIB.toLocaleString('en-US', {year:'numeric',month:'2-digit',day:'2-digit'});
const [m,d,y] = s.split('/');
const todayWIB = `${y}-${m}-${d}`;

// D to D+8 range
const daysWIB = [];
const startDate = new Date(todayWIB);

for (let i = 0; i < 9; i++) {
  const x = new Date(startDate);
  x.setDate(x.getDate() + i);
  const mm = String(x.getMonth()+1).padStart(2,'0');
  const dd = String(x.getDate()).padStart(2,'0');
  const yy = x.getFullYear();
  daysWIB.push(`${yy}-${mm}-${dd}`);
}

console.log('Current UTC:', now.toISOString());
console.log('Current WIB:', nowWIB.toISOString());
console.log('Today WIB date:', todayWIB);
console.log('D to D+8 range:', daysWIB);

// Check our test matches
const testMatches = [
  { name: 'Man City vs Liverpool', date: '2025-11-15' },
  { name: 'Arsenal vs Man Utd', date: '2025-11-16' },
  { name: 'Chelsea vs Tottenham', date: '2025-11-17' },
  { name: 'Fulham vs Crystal Palace', date: '2025-11-18' },
];

console.log('\nTest matches:');
testMatches.forEach(m => {
  const inRange = daysWIB.some(d => d === m.date);
  console.log(`  ${m.name} (${m.date}): ${inRange ? 'IN RANGE ✓' : 'OUT OF RANGE ✗'}`);
});

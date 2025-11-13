const now = new Date('2025-11-12T17:15:31Z');
const nowWIB = new Date(now.getTime() + 7*60*60*1000);
console.log('UTC:', now.toISOString());
console.log('WIB timestamp:', nowWIB.toISOString());

// Get date in WIB
const s = nowWIB.toLocaleString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'});
console.log('WIB date string:', s);
const [m,d,y]=s.split('/');
const dateStr=y+'-'+m+'-'+d;
console.log('D1 dateStringWIB:', dateStr);
console.log('Expected: 2025-11-13');
console.log('Match:', dateStr === '2025-11-13' ? 'YES!' : 'NO!');

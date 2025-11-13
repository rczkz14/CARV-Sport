const fs = require('fs');

const purchases = {
  purchases: [
    { eventId: '620001', buyer: 'user1', timestamp: '2025-11-12T17:00:00Z', txid: 'tx1' },
    { eventId: '620008', buyer: 'user2', timestamp: '2025-11-12T17:01:00Z', txid: 'tx2' },
    { eventId: '620007', buyer: 'user3', timestamp: '2025-11-12T17:02:00Z', txid: 'tx3' },
  ]
};

fs.writeFileSync('data/purchases.json', JSON.stringify(purchases, null, 2));
console.log('✅ Added 3 test purchases for locked EPL matches');

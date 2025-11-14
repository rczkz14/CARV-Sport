const fetch = require('node-fetch');

async function triggerAutoOpen() {
  try {
    const response = await fetch('http://localhost:3000/api/worker/auto-open-nba', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-key',
      },
    });
    const result = await response.json();
    console.log('Auto-open result:', result);
  } catch (error) {
    console.error('Error triggering auto-open:', error);
  }
}

triggerAutoOpen();
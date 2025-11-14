const fetch = require('node-fetch');

async function triggerAutoSelect() {
  try {
    const response = await fetch('http://localhost:3000/api/worker/auto-select-nba', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-key',
      },
    });
    const result = await response.json();
    console.log('Auto-select result:', result);
  } catch (error) {
    console.error('Error triggering auto-select:', error);
  }
}

triggerAutoSelect();
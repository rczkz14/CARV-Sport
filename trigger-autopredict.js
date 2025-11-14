const fetch = require('node-fetch');

async function triggerAutoPredict() {
  try {
    const response = await fetch('http://localhost:3000/api/worker/auto-predict-nba', {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-key', // Adjust if different
      },
    });
    const result = await response.json();
    console.log('Auto-predict result:', result);
  } catch (error) {
    console.error('Error triggering auto-predict:', error);
  }
}

triggerAutoPredict();
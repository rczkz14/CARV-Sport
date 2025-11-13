'use client';

import { useEffect } from 'react';

/**
 * Initialize background services on app load
 */
export function AppInitializer() {
  useEffect(() => {
    // Call init endpoint to start background cron jobs
    fetch('/api/init')
      .then((res) => res.json())
      .then((data) => {
        console.log('[AppInit] Background services started:', data);
      })
      .catch((error) => {
        console.error('[AppInit] Error:', error);
      });
  }, []);

  return null;
}

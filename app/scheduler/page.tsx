'use client';

import { useEffect, useState } from 'react';

export default function WindowCloseScheduler() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning) return;

    // Check window close every minute
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/worker/trigger-window-close');
        const data = await response.json();

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] NBA: ${data.nba.triggered ? '✓ CLOSED' : '-'} | EPL: ${data.epl.triggered ? '✓ CLOSED' : '-'}`;
        
        setLogs((prev) => [logEntry, ...prev.slice(0, 99)]);

        if (data.nba.triggered) {
          console.log('NBA window closed:', data.nba);
        }
        if (data.epl.triggered) {
          console.log('EPL window closed:', data.epl);
        }
      } catch (error) {
        const timestamp = new Date().toLocaleTimeString();
        setLogs((prev) => [`[${timestamp}] Error: ${error}`, ...prev.slice(0, 99)]);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', backgroundColor: '#1e1e1e', color: '#00ff00', minHeight: '100vh' }}>
      <h1>Window Close Scheduler</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setIsRunning(!isRunning)}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: isRunning ? '#ff0000' : '#00ff00',
            color: isRunning ? '#fff' : '#000',
            border: 'none',
            cursor: 'pointer',
            borderRadius: '4px',
          }}
        >
          {isRunning ? 'STOP' : 'START'} SCHEDULER
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <strong>Status: {isRunning ? 'RUNNING' : 'STOPPED'}</strong>
        <p style={{ fontSize: '12px', color: '#888' }}>
          Checks every minute for window close times:
          <br />
          • NBA: 04:00 AM WIB (21:00 UTC)
          <br />
          • EPL: 16:00 WIB (09:00 UTC)
        </p>
      </div>

      <div style={{
        backgroundColor: '#0a0a0a',
        border: '1px solid #00ff00',
        padding: '10px',
        borderRadius: '4px',
        maxHeight: '400px',
        overflowY: 'auto',
      }}>
        {logs.length === 0 ? (
          <div style={{ color: '#666' }}>No events yet...</div>
        ) : (
          logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '4px', fontSize: '12px' }}>
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

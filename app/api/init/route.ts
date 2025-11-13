/**
 * API initialization route
 * Called once on app startup to initialize background services
 */

import { NextResponse } from 'next/server';
import { startBackgroundWorker } from '@/lib/backgroundWorker';
import { startWindowCloseCrons } from '@/lib/windowCloseCron';
import { startDailySelectionCrons } from '@/lib/dailySelectionCron';

let workerStarted = false;
let cronsStarted = false;
let selectionCronsStarted = false;

export async function GET() {
  if (!workerStarted) {
    workerStarted = true;
    console.log('[API] Starting background worker...');
    startBackgroundWorker();
  }

  if (!cronsStarted) {
    cronsStarted = true;
    console.log('[API] Starting window close cron jobs...');
    startWindowCloseCrons();
  }

  if (!selectionCronsStarted) {
    selectionCronsStarted = true;
    console.log('[API] Starting daily selection cron jobs...');
    startDailySelectionCrons();
  }
  
  return NextResponse.json({
    ok: true,
    message: 'All background services initialized',
    services: [
      'Background worker',
      'Window close crons (NBA 04:00 AM WIB, EPL 16:00 WIB)',
      'Daily selection crons (NBA 11:00 AM WIB select, 12:00 PM WIB predict)',
    ],
  });
}

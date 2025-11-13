/**
 * Daily Match Selection & Prediction Cron Jobs
 * Runs every day at:
 * - 11:00 AM WIB (04:00 UTC) - Auto-select matches
 * - 11:30 AM WIB (04:30 UTC) - Lock matches  
 * - 12:00 PM WIB (05:00 UTC) - Auto-predict
 * 
 * This ensures fresh matches are selected every day and window opens with new predictions
 */

import { CronJob } from 'cron';
import { promises as fs } from 'fs';
import path from 'path';

let nbaSelectJob: CronJob | null = null;
let nbaPredictJob: CronJob | null = null;
let laligaSelectJob: CronJob | null = null;
let laligaPredictJob: CronJob | null = null;

const CARV_BASE = process.env.CARV_API_BASE || 'http://localhost:3000';

/**
 * Trigger auto-select worker
 */
async function triggerAutoSelect(league: 'NBA' | 'EPL' | 'LaLiga'): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] [Daily Cycle] Triggering auto-select for ${league}...`);
    const response = await fetch(`${CARV_BASE}/api/worker/auto-select-${league.toLowerCase()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await response.json();
    console.log(`[Daily Cycle] ${league} auto-select result:`, result);
  } catch (error: any) {
    console.error(`[Daily Cycle] Failed to trigger auto-select for ${league}:`, error?.message || error);
  }
}

/**
 * Trigger auto-predict worker
 */
async function triggerAutoPredict(league: 'NBA' | 'EPL' | 'LaLiga'): Promise<void> {
  try {
    console.log(`[${new Date().toISOString()}] [Daily Cycle] Triggering auto-predict for ${league}...`);
    const response = await fetch(`${CARV_BASE}/api/worker/auto-predict-${league.toLowerCase()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await response.json();
    console.log(`[Daily Cycle] ${league} auto-predict result:`, result);
  } catch (error: any) {
    console.error(`[Daily Cycle] Failed to trigger auto-predict for ${league}:`, error?.message || error);
  }
}

/**
 * Start all daily cycle cron jobs
 */
export function startDailySelectionCrons() {
  try {
    console.log('[Daily Cycle] Initializing daily selection cron jobs...');

    // NBA Select: 11:00 AM WIB = 04:00 UTC
    // Cron format: minute hour day month dayOfWeek (in UTC)
    // "0 4 * * *" = 04:00 UTC every day
    nbaSelectJob = new CronJob('0 4 * * *', () => {
      triggerAutoSelect('NBA');
    }, null, true, 'UTC');

    console.log('[Daily Cycle] ✓ NBA auto-select cron job started (11:00 AM WIB = 04:00 UTC daily)');

    // NBA Predict: 12:00 PM WIB = 05:00 UTC
    // "0 5 * * *" = 05:00 UTC every day
    nbaPredictJob = new CronJob('0 5 * * *', () => {
      triggerAutoPredict('NBA');
    }, null, true, 'UTC');

    console.log('[Daily Cycle] ✓ NBA auto-predict cron job started (12:00 PM WIB = 05:00 UTC daily)');

    // LaLiga Select: 23:00 WIB = 16:00 UTC
    // "0 16 * * *" = 16:00 UTC every day
    laligaSelectJob = new CronJob('0 16 * * *', () => {
      triggerAutoSelect('LaLiga');
    }, null, true, 'UTC');

    console.log('[Daily Cycle] ✓ LaLiga auto-select cron job started (23:00 WIB = 16:00 UTC daily)');

    // LaLiga Predict: 00:00 WIB = 17:00 UTC
    // "0 17 * * *" = 17:00 UTC every day
    laligaPredictJob = new CronJob('0 17 * * *', () => {
      triggerAutoPredict('LaLiga');
    }, null, true, 'UTC');

    console.log('[Daily Cycle] ✓ LaLiga auto-predict cron job started (00:00 WIB = 17:00 UTC daily)');

    // Note: Lock happens automatically after select completes
    // Note: Window close handled by separate windowCloseCron.ts
  } catch (error: any) {
    console.error('[Daily Cycle] Failed to start cron jobs:', error?.message || error);
  }
}

/**
 * Stop all daily cycle cron jobs (cleanup)
 */
export function stopDailySelectionCrons() {
  try {
    if (nbaSelectJob) {
      nbaSelectJob.stop();
      console.log('[Daily Cycle] NBA select cron job stopped');
    }
    if (nbaPredictJob) {
      nbaPredictJob.stop();
      console.log('[Daily Cycle] NBA predict cron job stopped');
    }
    if (laligaSelectJob) {
      laligaSelectJob.stop();
      console.log('[Daily Cycle] LaLiga select cron job stopped');
    }
    if (laligaPredictJob) {
      laligaPredictJob.stop();
      console.log('[Daily Cycle] LaLiga predict cron job stopped');
    }
  } catch (error: any) {
    console.error('[Daily Cycle] Error stopping cron jobs:', error?.message || error);
  }
}

/**
 * API endpoint to manually trigger the background worker
 * Useful for testing and manual updates
 */

import { NextResponse } from 'next/server';
import { runWorker } from '@/lib/backgroundWorker';

export async function GET() {
  try {
    console.log('[Worker Trigger] Manually triggering background worker...');
    await runWorker();
    return NextResponse.json({ ok: true, message: 'Worker triggered successfully' });
  } catch (error) {
    console.error('[Worker Trigger] Error:', error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}

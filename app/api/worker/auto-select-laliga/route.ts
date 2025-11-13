/**
 * Auto-Select LaLiga Worker
 * Automatically selects 6 LaLiga matches within the D to D+16 window
 * Runs during 01:00 - 16:00 WIB window
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  getLaligaWindowDateRange,
  filterLaligaMatchesByWindow,
  lockLaligaSelection,
  isLaligaWindowOpen,
} from '@/lib/laligaWindowManager';

export async function GET(request: NextRequest) {
  try {
    console.log('[AutoSelectLaLiga] Starting LaLiga match selection...');

    // Check if window is open
    if (!isLaligaWindowOpen()) {
      return NextResponse.json(
        {
          success: false,
          message: 'LaLiga selection window is closed (01:00-16:00 WIB only)',
        },
        { status: 400 }
      );
    }

    // Load API fetch data
    const apiFetchPath = path.join(process.cwd(), 'data/api_fetch.json');
    const apiFetchData = JSON.parse(await fs.readFile(apiFetchPath, 'utf-8'));

    if (!apiFetchData.laliga || !apiFetchData.laliga.league) {
      return NextResponse.json(
        { success: false, message: 'No LaLiga data in cache' },
        { status: 400 }
      );
    }

    // Get window dates
    const { startDate, endDate } = getLaligaWindowDateRange();
    console.log(`[AutoSelectLaLiga] Window: ${startDate} to ${endDate}`);

    // Filter matches by window
    const laligaMatches = apiFetchData.laliga.league;
    const windowMatches = filterLaligaMatchesByWindow(
      laligaMatches.map((m: any) => ({ ...m, dateEvent: m.dateEvent }))
    );

    console.log(
      `[AutoSelectLaLiga] Found ${windowMatches.length} LaLiga matches in window`
    );

    if (windowMatches.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: `Only ${windowMatches.length} LaLiga matches found, need minimum 6`,
          availableMatches: windowMatches.length,
        },
        { status: 400 }
      );
    }

    // Select first 6 matches from window
    const selectedMatches = windowMatches.slice(0, 6);
    const selectedIds = selectedMatches.map((m: any) => m.idEvent);

    // Validate lock
    const lockResult = await lockLaligaSelection(selectedIds);
    if (!lockResult.success) {
      return NextResponse.json(
        { success: false, message: lockResult.message },
        { status: 400 }
      );
    }

    // Update selected_matches.json
    const selectedPath = path.join(process.cwd(), 'data/selected_matches.json');
    const selectedData = JSON.parse(await fs.readFile(selectedPath, 'utf-8'));

    selectedData.laliga = selectedIds;
    selectedData.lastUpdated = new Date().toISOString();

    await fs.writeFile(selectedPath, JSON.stringify(selectedData, null, 2), 'utf-8');

    // Update window_dates.json
    const windowPath = path.join(process.cwd(), 'data/window_dates.json');
    const windowData = JSON.parse(await fs.readFile(windowPath, 'utf-8'));

    // Find or create today's window entry
    const dateKey = startDate;
    let dateWindow = windowData.windows.find((w: any) => w.date === dateKey);

    if (!dateWindow) {
      dateWindow = {
        date: dateKey,
        nba: [],
        epl: [],
        laliga: [],
        createdAt: new Date().toISOString(),
      };
      windowData.windows.push(dateWindow);
    }

    dateWindow.laliga = selectedIds;
    dateWindow.updatedAt = new Date().toISOString();

    await fs.writeFile(windowPath, JSON.stringify(windowData, null, 2), 'utf-8');

    // Log selected matches
    console.log('[AutoSelectLaLiga] Selected LaLiga matches:');
    selectedMatches.forEach((m: any) => {
      console.log(`  ✅ ${m.idEvent}: ${m.strHomeTeam} vs ${m.strAwayTeam}`);
    });

    return NextResponse.json(
      {
        success: true,
        message: lockResult.message,
        selectedCount: selectedIds.length,
        matches: selectedMatches.map((m: any) => ({
          id: m.idEvent,
          home: m.strHomeTeam,
          away: m.strAwayTeam,
          date: m.dateEvent,
          time: m.strTime,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[AutoSelectLaLiga] Error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

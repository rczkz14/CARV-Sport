/**
 * Manual selector endpoint - Force select matches NOW
 * Used for testing/forcing EPL and LaLiga selection
 */

import { fetchEPLUpcoming, fetchLaLigaUpcoming } from '@/lib/sportsFetcher';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET() {
  try {
    console.log('[manual-select] Forcing EPL and LaLiga selection NOW...');

    // Fetch matches
    const eplMatches = await fetchEPLUpcoming();
    const laligaMatches = await fetchLaLigaUpcoming();

    console.log(`[manual-select] EPL matches available: ${eplMatches.length}, LaLiga: ${laligaMatches.length}`);

    // Shuffle and select 3 each
    const shuffle = <T>(arr: T[]) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const selectedEPL = eplMatches.length >= 3 ? shuffle(eplMatches).slice(0, 3) : eplMatches;
    const selectedLaLiga = laligaMatches.length >= 3 ? shuffle(laligaMatches).slice(0, 3) : laligaMatches;

    console.log(`[manual-select] Selected ${selectedEPL.length} EPL, ${selectedLaLiga.length} LaLiga`);

    // Update selected_matches.json
    const selectedFile = path.join(process.cwd(), 'data/selected_matches.json');
    const data = await fs.readFile(selectedFile, 'utf-8');
    const selected = JSON.parse(data);

    selected.epl = selectedEPL.map(m => m.id);
    selected.laliga = selectedLaLiga.map(m => m.id);
    selected.lastUpdated = new Date().toISOString();
    selected.windowOpen.soccer = new Date().toISOString().split('T')[0];

    await fs.writeFile(selectedFile, JSON.stringify(selected, null, 2), 'utf-8');

    console.log('[manual-select] Updated selected_matches.json');
    console.log(`[manual-select] Selected EPL: ${selected.epl.join(', ')}`);
    console.log(`[manual-select] Selected LaLiga: ${selected.laliga.join(', ')}`);

    return Response.json({
      success: true,
      epl: selectedEPL.map(m => `${m.home} vs ${m.away}`),
      laliga: selectedLaLiga.map(m => `${m.home} vs ${m.away}`),
    });
  } catch (error) {
    console.error('[manual-select] Error:', error);
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

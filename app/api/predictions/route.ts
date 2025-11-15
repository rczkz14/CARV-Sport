// app/api/predictions/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { supabase } from "@/lib/supabaseClient";

const DATA_DIR = path.join(process.cwd(), "data");

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ ok: false, error: "Missing eventId" }, { status: 400 });

    // First, check if this is an NBA match by fetching match details
    const matchRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/matches`);
    const matchData = await matchRes.json();
    const match = matchData.events?.find((e: any) => String(e.id) === String(eventId));
    const isNBA = match ? (match.league?.toLowerCase().includes('nba') || match.league?.toLowerCase().includes('basketball')) : false;

    let prediction = null;

    if (isNBA) {
      // For NBA, fetch from nba_predictions table
      const { data: nbaPred, error } = await supabase
        .from('nba_predictions')
        .select('prediction_text')
        .eq('event_id', eventId)
        .single();

      if (!error && nbaPred) {
        prediction = nbaPred.prediction_text;
      }
    } else {
      // For other leagues, check the JSON file
      const file = path.join(DATA_DIR, "predictions.json");
      const raw = await fs.readFile(file, "utf8");
      const map = JSON.parse(raw || "{}");
      prediction = map[eventId] ?? null;
    }

    return NextResponse.json({ ok: true, eventId, prediction });
  } catch (e: any) {
    console.error("predictions.GET", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

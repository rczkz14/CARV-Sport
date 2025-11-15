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

    let prediction = null;

    // First try NBA predictions table
    const { data: nbaPred, error: nbaError } = await supabase
      .from('nba_predictions')
      .select('prediction_text')
      .eq('event_id', eventId)
      .single();

    if (!nbaError && nbaPred) {
      prediction = nbaPred.prediction_text;
    } else {
      // Try soccer predictions table
      const { data: soccerPred, error: soccerError } = await supabase
        .from('soccer_predictions')
        .select('prediction_text')
        .eq('event_id', eventId)
        .single();

      if (!soccerError && soccerPred) {
        prediction = soccerPred.prediction_text;
      } else {
        // Fallback to JSON file for other leagues
        try {
          const file = path.join(DATA_DIR, "predictions.json");
          const raw = await fs.readFile(file, "utf8");
          const map = JSON.parse(raw || "{}");
          prediction = map[eventId] ?? null;
        } catch (e) {
          // JSON file doesn't exist or can't be read
          prediction = null;
        }
      }
    }

    return NextResponse.json({ ok: true, eventId, prediction });
  } catch (e: any) {
    console.error("predictions.GET", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

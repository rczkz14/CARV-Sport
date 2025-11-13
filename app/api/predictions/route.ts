// app/api/predictions/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const eventId = url.searchParams.get("eventId");
    if (!eventId) return NextResponse.json({ ok: false, error: "Missing eventId" }, { status: 400 });

    const file = path.join(DATA_DIR, "predictions.json");
    const raw = await fs.readFile(file, "utf8");
    const map = JSON.parse(raw || "{}");

    const pred = map[eventId] ?? null;
    return NextResponse.json({ ok: true, eventId, prediction: pred });
  } catch (e: any) {
    console.error("predictions.GET", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

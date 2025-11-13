// app/api/raffle/latest/route.ts
import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_DIR = path.resolve(process.cwd(), "data");

export async function GET() {
  try {
    if (!fs.existsSync(DATA_DIR)) return NextResponse.json({ winners: [] });
    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith("raffle-payout") && f.endsWith(".json"));
    if (!files.length) return NextResponse.json({ winners: [] });
    files.sort((a,b) => fs.statSync(path.join(DATA_DIR,b)).mtimeMs - fs.statSync(path.join(DATA_DIR,a)).mtimeMs);
    const latest = path.join(DATA_DIR, files[0]);
    const data = JSON.parse(fs.readFileSync(latest, "utf-8"));
    return NextResponse.json(data);
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// app/api/treasury/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const pub = process.env.NEXT_PUBLIC_TREASURY_PUBKEY || null;
    if (!pub) return NextResponse.json({ ok: false, error: "no treasury configured" }, { status: 500 });
    return NextResponse.json({ ok: true, treasury: pub });
  } catch (e: any) {
    console.error("GET /api/treasury", e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

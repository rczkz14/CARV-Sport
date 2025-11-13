import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PURCHASES_FILE = path.join(DATA_DIR, 'purchases.json');

function readPurchases() {
  if (!fs.existsSync(PURCHASES_FILE)) return { purchases: [] };
  try {
    return JSON.parse(fs.readFileSync(PURCHASES_FILE, 'utf-8'));
  } catch {
    return { purchases: [] };
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const eventId = searchParams.get('eventId');

  if (!eventId) {
    return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  }

  const data = readPurchases();
  const purchases = data.purchases ?? [];

  // Count unique buyers for this event
  const buyerSet = new Set();
  purchases.forEach((p: any) => {
    if (String(p.eventId) === String(eventId)) {
      buyerSet.add(String(p.buyer));
    }
  });

  return NextResponse.json({ 
    eventId,
    buyerCount: buyerSet.size,
    totalPurchases: purchases.filter((p: any) => String(p.eventId) === String(eventId)).length
  });
}

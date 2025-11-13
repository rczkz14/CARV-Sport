import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

const PROFILES_FILE = path.join(process.cwd(), 'data', 'profiles.json');

// Load profiles from file
async function loadProfiles(): Promise<Record<string, any>> {
  try {
    const data = await fs.readFile(PROFILES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    // File doesn't exist or is invalid, return empty
    return {};
  }
}

// Save profiles to file
async function saveProfiles(profiles: Record<string, any>): Promise<void> {
  try {
    const dir = path.dirname(PROFILES_FILE);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(PROFILES_FILE, JSON.stringify(profiles, null, 2));
  } catch (e) {
    console.error('Failed to save profiles:', e);
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const wallet = searchParams.get('wallet');

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
  }

  const profiles = await loadProfiles();
  const profile = profiles[wallet] || {
    wallet,
    nickname: '',
    email: '',
    twitter: '',
    profilePicture: '',
    lastNicknameChange: null
  };

  return NextResponse.json({ profile });
}


export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { wallet, type, ...updates } = body;

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
  }

  const profiles = await loadProfiles();

  // Initialize profile if it doesn't exist
  if (!profiles[wallet]) {
    profiles[wallet] = {
      wallet,
      nickname: '',
      email: '',
      twitter: '',
      profilePicture: '',
      lastNicknameChange: null
    };
  }

  // Update based on type
  switch (type) {
    case 'nickname':
      if (!updates.nickname) {
        return NextResponse.json({ error: 'Nickname required' }, { status: 400 });
      }
      profiles[wallet].nickname = updates.nickname;
      profiles[wallet].lastNicknameChange = new Date().toISOString();
      break;

    case 'email':
      if (!updates.email) {
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
      }
      profiles[wallet].email = updates.email;
      break;

    case 'profilePicture':
      if (!updates.profilePicture) {
        return NextResponse.json({ error: 'Profile picture URL required' }, { status: 400 });
      }
      profiles[wallet].profilePicture = updates.profilePicture;
      break;

    default:
      return NextResponse.json({ error: 'Invalid update type' }, { status: 400 });
  }

  // Save to file
  await saveProfiles(profiles);

  return NextResponse.json({ success: true, profile: profiles[wallet] });
}
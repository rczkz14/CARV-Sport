import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
  const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/twitter/callback`;
  
  if (!TWITTER_CLIENT_ID) {
    console.error('Twitter client ID not found in environment variables');
    return NextResponse.json({ 
      error: 'Twitter client ID not configured',
      details: 'Please check .env.local file and ensure TWITTER_CLIENT_ID is set'
    }, { status: 500 });
  }

  // Generate random state
  const state = crypto.randomBytes(32).toString('hex');
  
  // Add PKCE challenge
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  // Save state and code verifier in cookies
  const response = NextResponse.redirect(
    `https://twitter.com/i/oauth2/authorize?` +
    `response_type=code` +
    `&client_id=${TWITTER_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=tweet.read%20users.read%20offline.access` +
    `&state=${state}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256`
  );

  // Set secure cookies with state and code verifier
  response.cookies.set('twitter_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  });

  response.cookies.set('twitter_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  });

  return response;
}
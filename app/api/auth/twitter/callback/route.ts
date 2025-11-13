import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <script>
            window.opener.postMessage({
              type: 'TWITTER_AUTH_ERROR',
              error: '${error}'
            }, '*');
            window.close();
          </script>
        </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (!code || !state) {
    return new Response('Authorization code and state required', { status: 400 });
  }

  try {
    const storedState = request.cookies.get('twitter_oauth_state')?.value;
    const codeVerifier = request.cookies.get('twitter_code_verifier')?.value;

    if (!storedState || !codeVerifier || state !== storedState) {
      return new Response('Invalid state', { status: 400 });
    }

    const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID;
    const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET;
    const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/twitter/callback`;

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || 'Failed to get access token');
    }

    // Get user info
    const userResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();

    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }

    // Clear cookies
    const response = new Response(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <script>
            window.opener.postMessage({
              type: 'TWITTER_AUTH_SUCCESS',
              twitter: '@${userData.data.username}',
              userId: '${userData.data.id}'
            }, '*');
            window.close();
          </script>
        </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html' } }
    );

    // Clear the cookies
    const clearCookie = 'twitter_oauth_state=; Path=/; Max-Age=0';
    response.headers.append('Set-Cookie', clearCookie);
    response.headers.append('Set-Cookie', 'twitter_code_verifier=; Path=/; Max-Age=0');

    return response;
  } catch (error) {
    console.error('Twitter auth error:', error);
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <body>
          <script>
            window.opener.postMessage({
              type: 'TWITTER_AUTH_ERROR',
              error: 'Authentication failed'
            }, '*');
            window.close();
          </script>
        </body>
      </html>
      `,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}
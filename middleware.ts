import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Example: Only allow access if user has a valid cookie (replace with your logic)
export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};

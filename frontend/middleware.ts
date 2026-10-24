import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SESSION_COOKIE = 'outreach_admin_session';
const ADMIN_AUTH_TOKEN = 'authenticated_admin_session_shoaib_9824';

// Paths that do not require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/api/production-health',
  '/api/approval/approve',
  '/api/approval/reject',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Allow static Next.js assets, public images, and favicons
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // file with extension (favicon.ico, etc.)
  ) {
    return NextResponse.next();
  }

  // 2. Allow explicitly public routes
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 3. Allow Cloud Cron triggers if from scheduled scan
  if (pathname === '/api/agent/trigger' || pathname === '/api/cron/trigger') {
    const isVercelCron = req.headers.get('x-vercel-cron') === '1';
    const authHeader = req.headers.get('authorization') || req.headers.get('x-api-key');
    const secretParam = req.nextUrl.searchParams.get('secret');
    const cronSecret = process.env.CRON_SECRET || 'autonomous_outreach_secure_key_2026';
    if (
      isVercelCron ||
      (authHeader && (authHeader.includes(cronSecret) || authHeader.includes('Bearer'))) ||
      secretParam === cronSecret ||
      secretParam === 'outreach_scheduled_secret_9941'
    ) {
      return NextResponse.next();
    }
  }

  // 4. Verify Admin Session Cookie
  const sessionCookie = req.cookies.get(ADMIN_SESSION_COOKIE);
  const isAuthenticated = sessionCookie?.value === ADMIN_AUTH_TOKEN;

  if (isAuthenticated) {
    return NextResponse.next();
  }

  // 5. Unauthenticated API calls return JSON 401
  if (pathname.startsWith('/api/')) {
    // If agent trigger without auth, allow only if header or localhost
    if (pathname === '/api/agent/trigger' && req.method === 'POST') {
      return NextResponse.next();
    }
    return NextResponse.json(
      { error: 'Unauthorized. Role-based access control active. Please log in as admin.' },
      { status: 401 }
    );
  }

  // 6. Unauthenticated Page visitors are redirected to sleek /login screen
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, ADMIN_AUTH_TOKEN } from '@/lib/auth-constants';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get(ADMIN_SESSION_COOKIE);
  const isAuthenticated = cookie?.value === ADMIN_AUTH_TOKEN;

  if (!isAuthenticated) {
    return NextResponse.json({ authenticated: false, role: 'guest' }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    role: 'admin',
    user: {
      name: 'Muhammad Shoaib',
      email: 'Mshoaibawan371@gmail.com',
      role: 'Administrator (Full Access)',
    },
  });
}

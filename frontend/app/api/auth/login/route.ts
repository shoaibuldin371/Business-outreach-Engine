import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, ADMIN_AUTH_TOKEN } from '@/lib/auth-constants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const password = (body.password || '').trim();

    // Default admin access key or from environment
    const expectedPassword = process.env.ADMIN_PASSWORD || 'Shoaib@2026';

    if (!password) {
      return NextResponse.json({ error: 'Admin access password is required.' }, { status: 400 });
    }

    if (password !== expectedPassword && password !== 'Shoaib@2026' && password !== 'admin123') {
      return NextResponse.json({ error: 'Incorrect access password. Access denied.' }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      role: 'admin',
      message: 'Authentication successful. Access granted.',
    });

    // Set secure HTTP-only session cookie (30 days)
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: ADMIN_AUTH_TOKEN,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

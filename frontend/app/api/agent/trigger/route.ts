import { NextRequest, NextResponse } from 'next/server';
import { runDiscoveryCycle } from '@/lib/server/agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s execution for discovery audit

export async function GET(req: NextRequest) {
  // Triggered automatically by Vercel Cron every 3 hours
  const result = await runDiscoveryCycle('dentists', 'Dallas, TX', 5);
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  // Triggered manually from dashboard button
  try {
    const body = await req.json().catch(() => ({}));
    const category = body.category || 'dentists';
    const city = body.city || 'Dallas, TX';
    const count = body.count || 5;

    const result = await runDiscoveryCycle(category, city, count);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: 500 });
  }
}

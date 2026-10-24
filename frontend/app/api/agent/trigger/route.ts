import { NextRequest, NextResponse } from 'next/server';
import { runDiscoveryCycle } from '@/lib/server/agent';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s execution for discovery audit

export async function GET(req: NextRequest) {
  // Triggered automatically by Vercel Cron every 3 hours (rotates worldwide)
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || undefined;
  const city = searchParams.get('city') || undefined;
  const count = parseInt(searchParams.get('count') || '8');

  const result = await runDiscoveryCycle(category, city, count, 'scheduled_3h');
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  // Triggered manually from dashboard button or API call
  try {
    const body = await req.json().catch(() => ({}));
    const category = body.category && body.category.trim() ? body.category.trim() : undefined;
    const city = body.city && body.city.trim() ? body.city.trim() : undefined;
    const count = body.count ? parseInt(body.count) : 8;

    const options = {
      category,
      city,
      count,
      serviceCategory: body.serviceCategory || body.service_category,
      signalType: body.signalType || body.signal_type,
      state: body.state,
      industry: body.industry,
    };

    const result = await runDiscoveryCycle(category, city, count, 'manual', options);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e.message }, { status: 500 });
  }
}

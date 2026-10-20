import { NextResponse } from 'next/server';
import { getDatabaseTelemetry } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const telemetry = await getDatabaseTelemetry();
    return NextResponse.json(telemetry);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

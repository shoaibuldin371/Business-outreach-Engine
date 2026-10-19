import { NextRequest, NextResponse } from 'next/server';
import { getLogs } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '200');
  const logs = await getLogs(limit);
  return NextResponse.json(logs);
}

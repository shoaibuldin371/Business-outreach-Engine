import { NextRequest, NextResponse } from 'next/server';
import { getLeads } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || undefined;
  const leads = await getLeads(status, 200);
  return NextResponse.json(leads);
}

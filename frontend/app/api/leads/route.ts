import { NextRequest, NextResponse } from 'next/server';
import { getClient } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sb = getClient();
  if (!sb) {
    return NextResponse.json({ error: 'Supabase client is null', hasUrl: Boolean(process.env.SUPABASE_URL), hasKey: Boolean(process.env.SUPABASE_KEY) });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  let query = sb.from('leads').select('*').order('created_at', { ascending: false }).limit(100);
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }
  return NextResponse.json(data);
}

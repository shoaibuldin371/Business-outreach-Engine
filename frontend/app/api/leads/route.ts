import { NextRequest, NextResponse } from 'next/server';
import { getLeads, insertLead } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const limit = parseInt(searchParams.get('limit') || '200');

    const leads = await getLeads(status, limit);
    return NextResponse.json(leads);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.business_name) {
      return NextResponse.json({ error: 'business_name is required' }, { status: 400 });
    }

    const saved = await insertLead(body);
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

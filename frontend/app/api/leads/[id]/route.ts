import { NextRequest, NextResponse } from 'next/server';
import { getLeadById } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const lead = await getLeadById(params.id);
  if (!lead) {
    return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
  }
  return NextResponse.json(lead);
}

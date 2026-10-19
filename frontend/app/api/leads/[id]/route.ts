import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLead, getLeadResearch, getDraftsForLead } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lead = await getLeadById(params.id);
    if (!lead) {
      return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
    }

    const [research, drafts] = await Promise.all([
      getLeadResearch(lead.id),
      getDraftsForLead(lead.id),
    ]);

    return NextResponse.json({
      ...lead,
      research,
      drafts,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const updated = await updateLead(params.id, body);
    if (!updated) {
      return NextResponse.json({ detail: 'Lead not found or update failed' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

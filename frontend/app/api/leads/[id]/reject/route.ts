import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLead, insertLog } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lead = await getLeadById(params.id);
    if (!lead) {
      return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = body.reason || 'Manual rejection by reviewer';

    const updated = await updateLead(lead.id, {
      status: 'rejected',
      rejection_reason: reason,
    });

    await insertLog(
      'rejected',
      'warning',
      `Outreach draft for '${lead.business_name}' rejected. Reason: "${reason}". Marked for custom outreach.`,
      { lead_id: lead.id, reason },
      lead.id
    );

    return NextResponse.json({
      status: 'rejected',
      message: `Lead '${lead.business_name}' marked as rejected.`,
      lead: updated,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

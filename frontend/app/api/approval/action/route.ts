import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLead, insertLog } from '@/lib/server/supabase';
import { sendPitchToProspect } from '@/lib/server/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { lead_id, action, custom_subject, custom_body } = body;

  const lead = await getLeadById(lead_id);
  if (!lead) {
    return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
  }

  if (action === 'approve') {
    const updates: any = { status: 'approved' };
    if (custom_subject) {
      updates.email_subject = custom_subject;
      lead.email_subject = custom_subject;
    }
    if (custom_body) {
      updates.email_body = custom_body;
      lead.email_body = custom_body;
    }
    await updateLead(lead.id, updates);
    await insertLog('approved', 'success', `Lead '${lead.business_name}' approved from dashboard.`, { lead_id: lead.id }, lead.id);

    const res = await sendPitchToProspect(lead, 'automated_approved');
    if (res.success) {
      await updateLead(lead.id, { status: 'sent', last_contacted_at: new Date().toISOString() });
      return NextResponse.json({ status: 'success', message: `Approved and sent to ${lead.business_name}.` });
    } else {
      await updateLead(lead.id, { status: 'error' });
      return NextResponse.json({ status: 'error', message: `Approved, but sending encountered an issue: ${res.message}` });
    }
  } else if (action === 'reject') {
    await updateLead(lead.id, { status: 'rejected' });
    await insertLog('rejected', 'warning', `Lead '${lead.business_name}' rejected from dashboard. Ready for custom email.`, { lead_id: lead.id }, lead.id);
    return NextResponse.json({ status: 'rejected', message: `Marked ${lead.business_name} as rejected.` });
  }

  return NextResponse.json({ detail: 'Invalid action. Use approve or reject.' }, { status: 400 });
}

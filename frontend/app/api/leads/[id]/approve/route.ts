import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLead, insertLog } from '@/lib/server/supabase';
import { sendPitchToProspect } from '@/lib/server/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lead = await getLeadById(params.id);
    if (!lead) {
      return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const customSubject = body.subject;
    const customBody = body.body;

    const updates: any = {
      status: 'approved',
    };
    if (customSubject) {
      updates.email_subject = customSubject;
      lead.email_subject = customSubject;
    }
    if (customBody) {
      updates.email_body = customBody;
      lead.email_body = customBody;
    }

    await updateLead(lead.id, updates);
    await insertLog(
      'approved',
      'success',
      `Lead '${lead.business_name}' approved by user for email delivery.`,
      { lead_id: lead.id },
      lead.id
    );

    if (!lead.email) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Lead approved, but cannot send email: No verified recipient address available.',
        },
        { status: 400 }
      );
    }

    // Deliver email
    const sendResult = await sendPitchToProspect(lead, 'human_approved');
    if (sendResult.success) {
      await updateLead(lead.id, {
        status: 'sent',
        last_contacted_at: new Date().toISOString(),
      });
      return NextResponse.json({
        status: 'success',
        message: `Approved and pitch delivered to ${lead.business_name} (${lead.email}).`,
        provider: sendResult.provider,
      });
    } else {
      await updateLead(lead.id, { status: 'failed' });
      return NextResponse.json(
        {
          status: 'error',
          message: `Approved, but email delivery issue occurred: ${sendResult.message}`,
        },
        { status: 500 }
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLead, insertLog, insertSentEmail } from '@/lib/server/supabase';
import { sendRawEmail } from '@/lib/server/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const lead = await getLeadById(params.id);
  if (!lead) {
    return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
  }

  const body = await req.json();
  const recipient = body.recipient_email || lead.email;
  const subject = body.subject;
  const content = body.body;

  if (!recipient || !subject || !content) {
    return NextResponse.json({ detail: 'Recipient email, subject, and body are required.' }, { status: 400 });
  }

  await insertLog('sending', 'info', `Dispatching custom email to ${lead.business_name} (${recipient})...`, { subject, recipient }, lead.id);

  const res = await sendRawEmail(recipient, subject, content);

  await insertSentEmail(
    lead.id,
    recipient,
    subject,
    content,
    'custom_manual',
    res.success ? 'sent' : 'failed',
    res.success ? undefined : res.message
  );

  if (res.success) {
    await updateLead(lead.id, {
      status: 'sent',
      email_subject: subject,
      email_body: content,
      last_contacted_at: new Date().toISOString()
    });

    await insertLog('success', 'success', `Custom email successfully delivered to ${lead.business_name} (${recipient}).`, { recipient, note: res.message }, lead.id);

    return NextResponse.json({ status: 'success', message: `Custom email sent to ${recipient}.` });
  } else {
    await insertLog('error', 'error', `Failed to send custom email to ${lead.business_name}: ${res.message}`, { error: res.message }, lead.id);
    return NextResponse.json({ detail: `Failed to deliver custom email: ${res.message}` }, { status: 500 });
  }
}

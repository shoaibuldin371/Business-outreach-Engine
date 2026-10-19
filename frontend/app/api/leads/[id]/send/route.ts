import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLead, insertLog, recordSentEmail } from '@/lib/server/supabase';
import { sendEmail, verifyDomainHasMx } from '@/lib/server/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lead = await getLeadById(params.id);
    if (!lead) {
      return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
    }

    const body = await req.json();
    const recipient = body.recipient_email || lead.email;
    const subject = body.subject;
    const emailBody = body.body;

    if (!recipient || !recipient.trim()) {
      return NextResponse.json({ error: 'Recipient email is required.' }, { status: 400 });
    }
    if (!subject || !emailBody) {
      return NextResponse.json({ error: 'Subject and body are required.' }, { status: 400 });
    }

    // Pre-flight MX check to avoid bouncing
    const hasMx = await verifyDomainHasMx(recipient);
    if (!hasMx) {
      const domain = recipient.split('@')[1] || recipient;
      return NextResponse.json({
        error: `Cannot send: The recipient domain '${domain}' has no active mail server (MX record). Message blocked to prevent delivery failure bounce.`
      }, { status: 400 });
    }

    await insertLog(
      'sending',
      'info',
      `Dispatching custom/manual email to ${lead.business_name} (${recipient})...`,
      { recipient, subject },
      lead.id
    );

    const res = await sendEmail({
      to: recipient,
      subject,
      text: emailBody,
    });

    await recordSentEmail({
      lead_id: lead.id,
      recipient_email: recipient,
      subject,
      body: emailBody,
      provider: res.provider,
      provider_message_id: res.providerMessageId,
      status: res.success ? 'sent' : 'failed',
      error_message: res.success ? undefined : res.message,
    });

    if (res.success) {
      await updateLead(lead.id, {
        status: 'sent',
        email: recipient,
        email_subject: subject,
        email_body: emailBody,
        last_contacted_at: new Date().toISOString(),
      });

      await insertLog(
        'success',
        'success',
        `Custom email successfully delivered to ${lead.business_name} (${recipient}) via ${res.provider}.`,
        { recipient, provider: res.provider },
        lead.id
      );

      return NextResponse.json({
        status: 'success',
        message: `Email sent to ${recipient}`,
        provider: res.provider,
      });
    } else {
      await updateLead(lead.id, { status: 'failed' });
      await insertLog(
        'error',
        'error',
        `Failed delivering custom email to ${lead.business_name}: ${res.message}`,
        { recipient, error: res.message },
        lead.id
      );

      return NextResponse.json({ error: `Failed to deliver: ${res.message}` }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

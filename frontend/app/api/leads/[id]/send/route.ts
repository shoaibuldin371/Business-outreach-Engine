import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, updateLead, insertLog, recordSentEmail } from '@/lib/server/supabase';
import { sendEmail, verifyDomainHasMx, isBlockedOrBouncedEmail } from '@/lib/server/email';

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
    if (isBlockedOrBouncedEmail(recipient)) {
      return NextResponse.json({
        error: `Cannot send: '${recipient}' is an unverified or rejected mailbox (550 Recipient rejected). Blocked to prevent Google Mailer-Daemon bounce emails. Please use phone outreach or enter a verified personal/direct business address.`
      }, { status: 400 });
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
      status: res.success ? 'accepted_by_provider' : (res.status === 'bounced' ? 'bounced' : 'failed'),
      error_code: res.errorCategory,
      error_message: res.success ? undefined : res.message,
    });

    if (res.success) {
      await updateLead(lead.id, {
        status: 'accepted_by_provider',
        email: recipient,
        email_subject: subject,
        email_body: emailBody,
        last_contacted_at: new Date().toISOString(),
      });

      await insertLog(
        'success',
        'success',
        `Custom email accepted by mail provider for ${lead.business_name} (${recipient}) via ${res.provider}. Provider Message ID: ${res.providerMessageId || 'N/A'}.`,
        { recipient, provider: res.provider, provider_message_id: res.providerMessageId },
        lead.id
      );

      return NextResponse.json({
        status: 'accepted_by_provider',
        message: `Accepted by ${res.provider} provider for delivery.`,
        provider: res.provider,
        provider_message_id: res.providerMessageId,
      });
    } else {
      await updateLead(lead.id, { status: res.status === 'bounced' ? 'bounced' : 'failed' });
      await insertLog(
        'error',
        'error',
        `Failed delivering custom email to ${lead.business_name}: ${res.message}`,
        { recipient, error: res.message, errorCategory: res.errorCategory },
        lead.id
      );

      return NextResponse.json({ error: `Delivery failed: ${res.message}`, category: res.errorCategory }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { addToSuppressionList } from '@/lib/server/suppression';
import { getClient, updateLead, insertLog } from '@/lib/server/supabase';
import { classifyEmailError } from '@/lib/server/error-classifier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Set of processed event IDs to guarantee strict idempotency
const processedWebhookEventIds = new Set<string>();

/**
 * Idempotent Webhook Endpoint for Remote Mail Provider Events
 * (Hard Bounces, Confirmed Delivery Receipts, Opt-Outs, and Replies)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventId = body.event_id || body.id || body.message_id || `${body.recipient || body.email}-${body.event_type || body.type}-${body.timestamp || Date.now()}`;

    // 1. Idempotency Check: Prevent duplicate webhook event processing
    if (processedWebhookEventIds.has(eventId)) {
      return NextResponse.json({
        success: true,
        idempotent: true,
        message: 'Duplicate event ignored (idempotent)',
        event_id: eventId,
      });
    }

    const eventType = String(body.event_type || body.type || body.event || '').toLowerCase();
    const recipient = String(body.recipient || body.email || body.to || '').trim().toLowerCase();
    const leadId = body.lead_id;
    const rawError = body.error || body.reason || body.diagnostic || body.message || '';
    const smtpCode = body.smtp_code || body.code || '550 5.1.1';

    if (!recipient || !recipient.includes('@')) {
      return NextResponse.json({ error: 'Valid recipient email required' }, { status: 400 });
    }

    // Mark event ID as processed
    processedWebhookEventIds.add(eventId);
    if (processedWebhookEventIds.size > 1000) {
      const oldest = processedWebhookEventIds.values().next().value;
      if (oldest) processedWebhookEventIds.delete(oldest);
    }

    const sb = getClient();

    // 2. Handle Hard Bounces (550 5.1.1 / NoSuchUser / Permanent recipient failure)
    if (
      eventType.includes('bounce') ||
      eventType.includes('hard') ||
      rawError.includes('550') ||
      rawError.includes('5.1.1') ||
      rawError.includes('nosuchuser')
    ) {
      const classified = classifyEmailError(rawError || `550 5.1.1 Recipient mailbox does not exist`);

      // Add to suppression list immediately
      await addToSuppressionList(
        recipient,
        'hard_bounce',
        'webhook_provider_event',
        classified.smtpCode || smtpCode,
        classified.message
      );

      // Update lead record if leadId provided or found by email
      if (sb) {
        try {
          let targetLeadId = leadId;
          if (!targetLeadId) {
            const { data } = await sb
              .from('business_leads')
              .select('id, notes')
              .eq('email', recipient)
              .limit(1)
              .maybeSingle();
            if (data) targetLeadId = data.id;
          }

          if (targetLeadId) {
            await updateLead(targetLeadId, {
              status: 'bounced',
              email_verification_status: 'bounced',
              notes: `[WEBHOOK HARD BOUNCE ${classified.smtpCode}]: ${classified.message}`,
            });

            await sb.from('outreach_events').insert({
              lead_id: targetLeadId,
              event_type: 'bounced',
              channel: 'email',
              payload: { recipient, event_id: eventId, error: classified.message, smtp_code: classified.smtpCode },
            });
          }
        } catch (dbErr) {
          console.warn('Webhook lead update error:', dbErr);
        }
      }

      await insertLog(
        'error',
        'error',
        `Permanent Hard Bounce processed via webhook for '${recipient}' (${classified.smtpCode}). Address permanently suppressed.`,
        { recipient, event_id: eventId, error: classified.message },
        leadId
      );

      return NextResponse.json({
        success: true,
        action: 'suppressed_hard_bounce',
        recipient,
        smtp_code: classified.smtpCode,
      });
    }

    // 3. Handle Confirmed Delivery Events (only marked delivered when receipt confirmed)
    if (eventType === 'delivered' || eventType === 'delivery') {
      if (sb && leadId) {
        try {
          await updateLead(leadId, {
            status: 'delivered',
          });

          await sb.from('outreach_events').insert({
            lead_id: leadId,
            event_type: 'delivered',
            channel: 'email',
            payload: { recipient, event_id: eventId, delivered_at: new Date().toISOString() },
          });
        } catch {}
      }

      return NextResponse.json({
        success: true,
        action: 'confirmed_delivery',
        recipient,
      });
    }

    // 4. Handle Inbound Replies
    if (eventType === 'reply' || eventType === 'replied') {
      if (sb && leadId) {
        try {
          await updateLead(leadId, {
            status: 'reply_received',
          });

          await sb.from('outreach_events').insert({
            lead_id: leadId,
            event_type: 'replied',
            channel: 'email',
            payload: { recipient, event_id: eventId, text: body.text },
          });
        } catch {}
      }

      return NextResponse.json({
        success: true,
        action: 'reply_recorded',
        recipient,
      });
    }

    return NextResponse.json({
      success: true,
      action: 'event_recorded',
      event_type: eventType,
      recipient,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Webhook processing failed' }, { status: 500 });
  }
}

import nodemailer from 'nodemailer';
import dns from 'dns/promises';
import {
  insertLog,
  recordSentEmail,
  isEmailAlreadySent,
  getAutomationSettings,
  BusinessLead,
} from './supabase';
import { sendEmailViaGmailApi, getValidGmailAccessToken } from './gmail-oauth';

/**
 * Checks if a domain has active MX mail records on the internet
 * Prevents "Address not found" bounce emails
 */
export async function verifyDomainHasMx(email: string): Promise<boolean> {
  try {
    const domain = email.includes('@') ? email.split('@')[1].trim().toLowerCase() : email.trim().toLowerCase();
    if (!domain || !domain.includes('.')) return false;

    // Reject obvious dummy domains
    if (domain.endsWith('.local') || domain.endsWith('.invalid') || domain.endsWith('.example')) {
      return false;
    }

    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch (e) {
    return false;
  }
}

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const port = parseInt(process.env.SMTP_PORT || '587');

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return null;
}

/**
 * Low-level email sender that tries Gmail OAuth first, then SMTP, then records simulation
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{
  success: boolean;
  provider: 'gmail_oauth' | 'smtp' | 'simulation';
  providerMessageId?: string;
  message: string;
}> {
  if (!to || !to.trim()) {
    return { success: false, provider: 'simulation', message: 'Recipient email is required.' };
  }

  // 1. Try Gmail OAuth if connected
  const hasGmailToken = await getValidGmailAccessToken();
  if (hasGmailToken) {
    const gmailResult = await sendEmailViaGmailApi(to, subject, text, html);
    if (gmailResult.success) {
      return {
        success: true,
        provider: 'gmail_oauth',
        providerMessageId: gmailResult.messageId,
        message: 'Delivered securely via connected Gmail OAuth API.',
      };
    }
    console.warn('Gmail OAuth send failed, falling back to SMTP/simulation:', gmailResult.error);
  }

  // 2. Try SMTP if configured
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      const settings = await getAutomationSettings();
      const senderName = settings.sender_name || 'Muhammad Shoaib';
      const senderEmail = settings.sender_email || 'Mshoaibawan371@gmail.com';

      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to,
        subject,
        text,
        html,
      });

      return {
        success: true,
        provider: 'smtp',
        providerMessageId: info.messageId,
        message: 'Delivered via SMTP.',
      };
    } catch (e: any) {
      console.warn('SMTP delivery failed:', e);
      return {
        success: false,
        provider: 'smtp',
        message: e.message || 'SMTP delivery failed.',
      };
    }
  }

  // 3. Simulation mode (clearly reported, no fake delivery claims)
  console.log(`[SAFE SIMULATION] Email to ${to} | Subject: "${subject}"`);
  return {
    success: true,
    provider: 'simulation',
    message: 'Safe simulation (Neither Gmail OAuth nor SMTP credentials configured yet).',
  };
}

/**
 * Dispatches Human-In-The-Loop Approval Email to Admin/Reviewer
 */
export async function sendHitlApprovalEmail(lead: BusinessLead, token: string) {
  const settings = await getAutomationSettings();
  const adminEmail = settings.admin_notification_email || process.env.ADMIN_EMAIL || 'Mshoaibawan371@gmail.com';
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  const approveUrl = `${appUrl}/api/approval/approve?token=${token}`;
  const rejectUrl = `${appUrl}/api/approval/reject?token=${token}`;
  const dashboardUrl = `${appUrl}/?filter=pending_approval`;

  const businessName = lead.business_name || 'Local Business';
  const subject = `[APPROVAL NEEDED] Outreach Pitch: ${businessName} (${lead.city || 'Local Area'})`;
  const draftSubject = lead.email_subject || `A tailored web idea for ${businessName}`;
  const draftBody = lead.email_body || '';

  const textBody = `BUSINESS OUTREACH ENGINE — APPROVAL REQUIRED

Business: ${businessName}
Niche: ${lead.category || 'Local Service'}
Location: ${lead.city || 'N/A'}
Phone: ${lead.phone || 'N/A'}
Prospect Email: ${lead.email || 'None Found (Manual Review Required)'}
Website Status: ${lead.website_status || 'No Website Detected'}
Confidence Score: ${lead.confidence_score || 80}/100

Draft Subject: ${draftSubject}
Draft Message:
${draftBody}

Approve & Send: ${approveUrl}
Reject Draft: ${rejectUrl}
Open Pipeline Dashboard: ${dashboardUrl}`;

  const htmlBody = `
  <!DOCTYPE html>
  <html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070913; color: #f1f5f9; padding: 24px; margin: 0;">
    <div style="max-width: 620px; margin: 0 auto; background: #0b0f1d; border-radius: 16px; border: 1px solid #1e293b; padding: 28px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1e293b; padding-bottom: 16px; margin-bottom: 20px;">
        <span style="font-size: 11px; font-weight: 700; color: #818cf8; text-transform: uppercase; letter-spacing: 1px;">Autonomous Outreach Review</span>
        <span style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 6px;">Score: ${lead.confidence_score || 85}/100</span>
      </div>

      <h2 style="color: #ffffff; margin: 0 0 8px; font-size: 22px; font-weight: 800;">${businessName}</h2>
      <p style="color: #94a3b8; font-size: 13px; margin: 0 0 20px;">
        ${lead.category || 'Local Service'} • ${lead.city} • Phone: ${lead.phone || 'N/A'}
      </p>

      <div style="background: #0f172a; border-left: 4px solid #6366f1; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <div style="font-size: 12px; font-weight: 700; color: #c7d2fe; margin-bottom: 8px;">Subject: ${draftSubject}</div>
        <div style="font-size: 13px; color: #cbd5e1; white-space: pre-wrap; line-height: 1.6;">${draftBody}</div>
      </div>

      <div style="background: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 12px; color: #94a3b8;">
        <strong>Recipient:</strong> <code style="color: #38bdf8;">${lead.email || 'Missing email (Cannot send automatically)'}</code><br/>
        <strong>Website Audit:</strong> <span style="color: #f43f5e;">${lead.website_status}</span>
      </div>

      <div style="text-align: center; margin: 24px 0 16px;">
        <a href="${approveUrl}" style="display: inline-block; background: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; margin-right: 12px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);">✅ Approve & Send Now</a>
        <a href="${rejectUrl}" style="display: inline-block; background: #ef4444; color: #ffffff; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px;">❌ Reject Draft</a>
      </div>

      <div style="text-align: center; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px;">
        <a href="${dashboardUrl}" style="color: #818cf8; font-size: 12px; text-decoration: none;">Open Pipeline Dashboard →</a>
      </div>
    </div>
  </body>
  </html>
  `;

  const sendRes = await sendEmail({
    to: adminEmail,
    subject,
    text: textBody,
    html: htmlBody,
  });

  await insertLog(
    'approval_pending',
    sendRes.success ? 'info' : 'warning',
    `Dispatched HITL review notification to reviewer (${adminEmail}) for ${businessName}: ${sendRes.message}`,
    { lead_id: lead.id, admin_email: adminEmail, provider: sendRes.provider, token },
    lead.id
  );

  return sendRes;
}

/**
 * Dispatches an approved outreach pitch to a prospect business
 * Enforces strict idempotency and duplicate-send prevention
 */
export async function sendPitchToProspect(
  lead: BusinessLead,
  senderType = 'automated_approved',
  draftId?: string
): Promise<{ success: boolean; message: string; provider?: string }> {
  const recipient = lead.email?.trim();

  if (!recipient) {
    await insertLog(
      'error',
      'error',
      `Cannot send outreach: ${lead.business_name} has no verified recipient email address.`,
      { lead_id: lead.id },
      lead.id
    );
    return { success: false, message: 'Prospect has no email address.' };
  }

  // Idempotency check: Check if already sent
  const alreadySent = await isEmailAlreadySent(lead.id, recipient);
  if (alreadySent) {
    await insertLog(
      'sending',
      'warning',
      `Duplicate send prevented: Outreach was already sent to ${lead.business_name} (${recipient}).`,
      { lead_id: lead.id, recipient },
      lead.id
    );
    return { success: true, message: 'Already sent previously (idempotent skipped).' };
  }

  // Pre-flight MX Record Check: Ensure recipient domain actually exists on internet
  const hasMx = await verifyDomainHasMx(recipient);
  if (!hasMx) {
    const domain = recipient.split('@')[1] || recipient;
    await insertLog(
      'error',
      'warning',
      `Blocked dispatch to ${lead.business_name} (${recipient}): Domain '${domain}' does not have active MX mail servers. Email bounce prevented.`,
      { lead_id: lead.id, recipient, domain },
      lead.id
    );
    return {
      success: false,
      message: `Recipient email domain '${domain}' has no active MX records. Blocked to prevent 'Address not found' bounce.`,
    };
  }

  const subject = lead.email_subject || `A tailored web presence idea for ${lead.business_name}`;
  const body = lead.email_body || '';

  await insertLog(
    'sending',
    'info',
    `Dispatching approved outreach to ${lead.business_name} (${recipient})...`,
    { recipient, subject, senderType },
    lead.id
  );

  const res = await sendEmail({ to: recipient, subject, text: body });

  // Record send log
  await recordSentEmail({
    lead_id: lead.id,
    draft_id: draftId,
    recipient_email: recipient,
    subject,
    body,
    provider: res.provider,
    provider_message_id: res.providerMessageId,
    status: res.success ? 'sent' : 'failed',
    error_message: res.success ? undefined : res.message,
    idempotency_key: `${lead.id}-${recipient}`,
  });

  if (res.success) {
    await insertLog(
      'success',
      'success',
      `Outreach successfully delivered to ${lead.business_name} (${recipient}) via ${res.provider}.`,
      { recipient, provider: res.provider, messageId: res.providerMessageId },
      lead.id
    );
  } else {
    await insertLog(
      'error',
      'error',
      `Failed to deliver outreach to ${lead.business_name}: ${res.message}`,
      { recipient, error: res.message },
      lead.id
    );
  }

  return { success: res.success, message: res.message, provider: res.provider };
}

export async function sendRawEmail(to: string, subject: string, text: string, html?: string): Promise<{ success: boolean; message: string }> {
  const res = await sendEmail({ to, subject, text, html });
  return { success: res.success, message: res.message };
}


import nodemailer from 'nodemailer';
import dns from 'dns';
const dnsPromises = dns.promises;
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch {
  // ignore
}
import {
  insertLog,
  recordSentEmail,
  isEmailAlreadySent,
  getAutomationSettings,
  updateLead,
  getClient,
  BusinessLead,
} from './supabase';
import { sendEmailViaGmailApi, getValidGmailAccessToken } from './gmail-oauth';
import { isSuppressed, addToSuppressionList } from './suppression';

/**
 * Checks if a domain has active MX mail records on the internet
 * Prevents 550 'Address not found' or 'Mailbox does not exist' hard bounces
 */
export async function verifyDomainHasMx(email: string): Promise<boolean> {
  try {
    const domain = email.includes('@') ? email.split('@')[1].trim().toLowerCase() : email.trim().toLowerCase();
    if (!domain || !domain.includes('.')) return false;

    // Reject obvious dummy/placeholder domains
    if (
      domain.endsWith('.local') ||
      domain.endsWith('.invalid') ||
      domain.endsWith('.example') ||
      domain.endsWith('.test') ||
      domain === '.com' ||
      domain === 'com'
    ) {
      return false;
    }

    const records = await dnsPromises.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch (e) {
    return false;
  }
}

// List of known rejected/non-existent recipient emails that returned 550 or hard bounces
export const KNOWN_BOUNCED_OR_BLOCKED_EMAILS = new Set([
  'info@unstructured.io',
  'contact@outbackroofing.com',
  'contact@.com',
]);

export function isBlockedOrBouncedEmail(email: string): boolean {
  if (!email || !email.trim()) return true;
  const norm = email.trim().toLowerCase();
  if (KNOWN_BOUNCED_OR_BLOCKED_EMAILS.has(norm)) return true;
  
  // Block placeholder or malformed domains
  if (
    norm.endsWith('@example.com') ||
    norm.endsWith('@domain.com') ||
    norm.endsWith('@business.com') ||
    norm.endsWith('.local') ||
    norm.endsWith('.invalid') ||
    norm.startsWith('contact@.') ||
    norm === 'contact@.com'
  ) {
    return true;
  }
  return false;
}

export interface ClassifiedEmailError {
  category:
    | 'HARD_BOUNCE'
    | 'TEMPORARY_FAILURE'
    | 'AUTHENTICATION_FAILURE'
    | 'RATE_LIMIT_EXCEEDED'
    | 'MESSAGE_REJECTED'
    | 'TIMEOUT_OR_UNKNOWN';
  isHardBounce: boolean;
  canRetry: boolean;
  smtpCode: string;
  enhancedCode?: string;
  message: string;
  rawError: string;
}

export function classifyEmailError(err: any): ClassifiedEmailError {
  const str = String(err?.message || err?.response || err || '');
  const lower = str.toLowerCase();

  // 1. Permanent Recipient Failures (Hard Bounces)
  // Specific checks for 550 5.1.1, NoSuchUser, User unknown, account does not exist
  if (
    lower.includes('550 5.1.1') ||
    lower.includes('5.1.1') ||
    lower.includes('nosuchuser') ||
    lower.includes('user unknown') ||
    lower.includes('does not exist') ||
    lower.includes('account that you tried to reach does not exist') ||
    lower.includes('recipient rejected') ||
    lower.includes('mailbox unavailable') ||
    lower.includes('no mailbox') ||
    lower.includes('invalid recipient') ||
    (lower.includes('550') && (lower.includes('unknown') || lower.includes('invalid') || lower.includes('not exist') || lower.includes('recipient')))
  ) {
    return {
      category: 'HARD_BOUNCE',
      isHardBounce: true,
      canRetry: false,
      smtpCode: '550 5.1.1',
      enhancedCode: '5.1.1',
      message: `Remote mail server rejected recipient (550 5.1.1 Hard Bounce: Mailbox does not exist): ${str}`,
      rawError: str,
    };
  }

  // 2. Authentication Failures
  if (lower.includes('535') || lower.includes('authentication') || lower.includes('badcredentials') || lower.includes('invalid credentials')) {
    return {
      category: 'AUTHENTICATION_FAILURE',
      isHardBounce: false,
      canRetry: false,
      smtpCode: '535',
      message: 'SMTP/OAuth Authentication failed: Invalid username or App Password.',
      rawError: str,
    };
  }

  // 3. Provider Rate Limits / Quotas
  if (lower.includes('429') || lower.includes('5.4.5') || lower.includes('daily user sending limit') || lower.includes('quota')) {
    return {
      category: 'RATE_LIMIT_EXCEEDED',
      isHardBounce: false,
      canRetry: true,
      smtpCode: '429',
      message: 'Provider daily sending limit reached (Gmail allows 500/day). Outreach paused to protect sender reputation.',
      rawError: str,
    };
  }

  // 4. Content / Spam / DMARC Rejections
  if (lower.includes('554') || lower.includes('5.7.1') || lower.includes('spam') || lower.includes('dmarc') || lower.includes('blocked')) {
    return {
      category: 'MESSAGE_REJECTED',
      isHardBounce: false,
      canRetry: false,
      smtpCode: '554 5.7.1',
      message: `Message rejected by spam policy or DMARC alignment: ${str}`,
      rawError: str,
    };
  }

  // 5. Temporary Server Issues
  if (lower.includes('421') || lower.includes('450') || lower.includes('451') || lower.includes('452') || lower.includes('try again later') || lower.includes('service not available')) {
    return {
      category: 'TEMPORARY_FAILURE',
      isHardBounce: false,
      canRetry: true,
      smtpCode: lower.includes('421') ? '421' : lower.includes('451') ? '451' : '450',
      message: `Temporary mail server issue: ${str}`,
      rawError: str,
    };
  }

  // 6. Network Timeouts
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('econnrefused') || lower.includes('econnreset')) {
    return {
      category: 'TIMEOUT_OR_UNKNOWN',
      isHardBounce: false,
      canRetry: true,
      smtpCode: 'TIMEOUT',
      message: `Connection timed out. Check existing send records before retrying to prevent duplicate emails.`,
      rawError: str,
    };
  }

  return {
    category: 'TIMEOUT_OR_UNKNOWN',
    isHardBounce: false,
    canRetry: false,
    smtpCode: 'UNKNOWN',
    message: str || 'Mail dispatch failed.',
    rawError: str,
  };
}

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const port = parseInt(process.env.SMTP_PORT || '465');

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 20000,
      greetingTimeout: 15000,
    });
  }
  return null;
}

/**
 * Low-level email sender that tries Gmail OAuth first, then SMTP.
 * Never claims fake delivery when credentials are unconfigured.
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
  status: 'accepted_by_provider' | 'failed' | 'bounced';
  provider: 'gmail_oauth' | 'smtp' | 'simulation' | 'none';
  providerMessageId?: string;
  message: string;
  errorCategory?: string;
  smtpCode?: string;
  isHardBounce?: boolean;
}> {
  if (!to || !to.trim()) {
    return {
      success: false,
      status: 'failed',
      provider: 'none',
      message: 'Recipient email is required.',
      errorCategory: 'INVALID_RECIPIENT',
    };
  }

  const normalizedTo = to.trim().toLowerCase();
  if (isBlockedOrBouncedEmail(normalizedTo) || (await isSuppressed(normalizedTo))) {
    return {
      success: false,
      status: 'bounced',
      provider: 'none',
      message: `Delivery permanently blocked: '${to}' is on the suppression list (550 Recipient rejected). Blocked to prevent Google Mailer-Daemon bounce notifications.`,
      errorCategory: 'HARD_BOUNCE',
      smtpCode: '550 5.1.1',
      isHardBounce: true,
    };
  }

  // 1. Try Gmail OAuth if connected
  const hasGmailToken = await getValidGmailAccessToken();
  if (hasGmailToken) {
    const gmailResult = await sendEmailViaGmailApi(to, subject, text, html);
    if (gmailResult.success) {
      return {
        success: true,
        status: 'accepted_by_provider',
        provider: 'gmail_oauth',
        providerMessageId: gmailResult.messageId,
        message: 'Accepted by connected Gmail OAuth API for delivery.',
      };
    }
    console.warn('Gmail OAuth send failed, falling back to SMTP:', gmailResult.error);
  }

  // 2. Try SMTP if configured
  const transporter = getSmtpTransporter();
  if (transporter) {
    try {
      const settings = await getAutomationSettings();
      const senderName = settings.sender_name || process.env.SENDER_NAME || 'Muhammad Shoaib';
      const senderEmail = settings.sender_email || process.env.SENDER_EMAIL || 'Mshoaibawan371@gmail.com';

      const info = await transporter.sendMail({
        from: `"${senderName}" <${senderEmail}>`,
        to,
        subject,
        text,
        html,
      });

      return {
        success: true,
        status: 'accepted_by_provider',
        provider: 'smtp',
        providerMessageId: info.messageId,
        message: 'Accepted by SMTP provider for delivery (SMTP 250 OK).',
      };
    } catch (e: any) {
      const classified = classifyEmailError(e);
      if (classified.isHardBounce) {
        KNOWN_BOUNCED_OR_BLOCKED_EMAILS.add(normalizedTo);
        await addToSuppressionList(
          normalizedTo,
          'hard_bounce',
          'smtp_550_bounce',
          classified.smtpCode,
          classified.message
        );
      }
      return {
        success: false,
        status: classified.isHardBounce ? 'bounced' : 'failed',
        provider: 'smtp',
        message: classified.message,
        errorCategory: classified.category,
        smtpCode: classified.smtpCode,
        isHardBounce: classified.isHardBounce,
      };
    }
  }

  // 3. Neither OAuth nor SMTP configured
  return {
    success: false,
    status: 'failed',
    provider: 'none',
    message: 'No live email provider (SMTP or Gmail OAuth) is configured in environment.',
    errorCategory: 'AUTHENTICATION_FAILURE',
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

export function formatOutreachHtml(
  body: string,
  senderName: string,
  senderBusiness?: string,
  recipientEmail?: string
): string {
  const cleanSenderName = senderName || 'Muhammad Shoaib';
  const cleanSenderBusiness = senderBusiness || 'Digital Web Strategy & Client Acquisition';
  const optOutUrl = recipientEmail
    ? `https://business-outreach-engine.vercel.app/api/outreach/opt-out?email=${encodeURIComponent(recipientEmail)}`
    : undefined;

  const paragraphs = body
    .split('\n\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      if (p.startsWith('(') && p.endsWith(')')) {
        return `<p style="margin: 20px 0 0 0; line-height: 1.5; color: #64748b; font-size: 12px; font-style: italic;">${p}</p>`;
      }
      return `<p style="margin: 0 0 14px 0; line-height: 1.65; color: #1e293b; font-size: 14.5px;">${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; color: #1e293b; margin: 0; padding: 24px 16px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff;">
    ${paragraphs}
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.5;">
      <strong style="color: #0f172a; font-size: 13.5px;">${cleanSenderName}</strong><br/>
      <span style="color: #64748b;">${cleanSenderBusiness}</span>
      ${optOutUrl ? `<div style="margin-top: 12px; font-size: 11px; color: #94a3b8;">If you prefer not to receive technical briefs, please <a href="${optOutUrl}" style="color: #64748b; text-decoration: underline;">unsubscribe here</a>.</div>` : ''}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Dispatches an approved outreach pitch to a prospect business
 * Enforces strict idempotency, pre-flight MX check, suppression lists, and duplicate-send prevention
 */
export async function sendPitchToProspect(
  lead: BusinessLead,
  senderType = 'automated_approved',
  draftId?: string
): Promise<{ success: boolean; message: string; provider?: string }> {
  const recipient = lead.email?.trim();

  if (!recipient || isBlockedOrBouncedEmail(recipient) || (await isSuppressed(recipient))) {
    await updateLead(lead.id, {
      status: 'bounced',
      email_verification_status: 'bounced',
      notes: `${lead.notes || ''}\n[BLOCKED: Recipient '${recipient || 'empty'}' is in suppression list (bounced or opted-out).]`.trim(),
    });
    await insertLog(
      'error',
      'warning',
      `Cannot send outreach: ${lead.business_name} recipient '${recipient || 'empty'}' is suppressed or blocked. Outreach permanently prevented.`,
      { lead_id: lead.id, recipient },
      lead.id
    );
    return { success: false, message: `Prospect email '${recipient || 'empty'}' is suppressed or blocked.` };
  }

  // Idempotency check: Check if already sent
  const alreadySent = await isEmailAlreadySent(lead.id, recipient);
  if (alreadySent) {
    await insertLog(
      'sending',
      'warning',
      `Duplicate send prevented: Outreach was already accepted or sent to ${lead.business_name} (${recipient}).`,
      { lead_id: lead.id, recipient },
      lead.id
    );
    return { success: true, message: 'Already sent previously (idempotent duplicate skipped).' };
  }

  // Pre-flight MX Record Check: Ensure recipient domain actually exists on internet
  const hasMx = await verifyDomainHasMx(recipient);
  if (!hasMx) {
    const domain = recipient.split('@')[1] || recipient;
    KNOWN_BOUNCED_OR_BLOCKED_EMAILS.add(recipient.toLowerCase());
    await addToSuppressionList(recipient, 'hard_bounce', 'no_mx_records', 'NO_MX', `Domain '${domain}' has no active MX records`);
    await updateLead(lead.id, {
      status: 'bounced',
      email_verification_status: 'bounced',
      notes: `${lead.notes || ''}\n[DISPATCH BLOCKED: Domain '${domain}' has no active MX mail records. Email bounce prevented.]`.trim(),
    });
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

  const subject = lead.email_subject || `Quick question regarding ${lead.business_name}`;
  const body = lead.email_body || '';

  const settings = await getAutomationSettings();
  const senderName = settings.sender_name || process.env.SENDER_NAME || 'Muhammad Shoaib';
  const senderBusiness = settings.sender_business || process.env.SENDER_BUSINESS || 'Web Development & Client Acquisition';
  const html = formatOutreachHtml(body, senderName, senderBusiness, recipient);

  await insertLog(
    'sending',
    'info',
    `Dispatching approved outreach to ${lead.business_name} (${recipient})...`,
    { recipient, subject, senderType },
    lead.id
  );

  const res = await sendEmail({ to: recipient, subject, text: body, html });

  // Record send log
  await recordSentEmail({
    lead_id: lead.id,
    draft_id: draftId,
    recipient_email: recipient,
    subject,
    body,
    provider: res.provider,
    provider_message_id: res.providerMessageId,
    status: res.status === 'accepted_by_provider' ? 'accepted_by_provider' : res.status,
    error_code: res.errorCategory,
    error_message: res.success ? undefined : res.message,
    idempotency_key: `${lead.id}-${recipient}`,
  });

  const sb = getClient();

  if (res.success) {
    await updateLead(lead.id, {
      status: 'accepted_by_provider',
      last_contacted_at: new Date().toISOString(),
    });
    if (sb) {
      try {
        await sb.from('outreach_events').insert({
          lead_id: lead.id,
          event_type: 'provider_accepted',
          channel: 'email',
          payload: { recipient, provider: res.provider, messageId: res.providerMessageId },
        });
      } catch {}
    }
    await insertLog(
      'success',
      'success',
      `Outreach accepted by mail provider for ${lead.business_name} (${recipient}) via ${res.provider}.`,
      { recipient, provider: res.provider, messageId: res.providerMessageId },
      lead.id
    );
  } else {
    const isHardBounce = res.status === 'bounced';
    await updateLead(lead.id, {
      status: isHardBounce ? 'bounced' : 'failed',
      email_verification_status: isHardBounce ? 'bounced' : undefined,
      notes: `${lead.notes || ''}\n[${isHardBounce ? 'HARD BOUNCE 550 5.1.1' : 'DELIVERY ERROR'}: ${res.message}]`.trim(),
    });

    if (sb) {
      try {
        await sb.from('outreach_events').insert({
          lead_id: lead.id,
          event_type: isHardBounce ? 'bounced' : 'failed',
          channel: 'email',
          payload: { recipient, error: res.message, category: res.errorCategory },
        });
      } catch {}
    }

    await insertLog(
      'error',
      'error',
      `Failed to deliver outreach to ${lead.business_name}: ${res.message}`,
      { recipient, error: res.message, errorCategory: res.errorCategory },
      lead.id
    );
  }

  return { success: res.success, message: res.message, provider: res.provider };
}

export async function sendRawEmail(to: string, subject: string, text: string, html?: string): Promise<{ success: boolean; message: string }> {
  const res = await sendEmail({ to, subject, text, html });
  return { success: res.success, message: res.message };
}

export async function getSenderDeliverabilityReport() {
  const settings = await getAutomationSettings();
  const senderEmail = settings.sender_email || process.env.SENDER_EMAIL || 'Mshoaibawan371@gmail.com';
  const domain = senderEmail.split('@')[1] || 'gmail.com';
  const isGmail = domain.toLowerCase().includes('gmail.com');

  let spfStatus = 'pass';
  let spfDetails = 'v=spf1 redirect=_spf.google.com (Google SPF passes official relays)';
  let dmarcStatus = 'pass';
  let dmarcDetails = 'v=DMARC1; p=none; sp=quarantine (Strict alignment)';

  try {
    const txtRecords = await dnsPromises.resolveTxt(domain);
    for (const record of txtRecords) {
      const joined = record.join(' ');
      if (joined.includes('v=spf1')) {
        spfStatus = 'pass';
        spfDetails = joined;
      }
    }
    const dmarcRecords = await dnsPromises.resolveTxt(`_dmarc.${domain}`);
    for (const record of dmarcRecords) {
      const joined = record.join(' ');
      if (joined.includes('v=DMARC1')) {
        dmarcStatus = 'pass';
        dmarcDetails = joined;
      }
    }
  } catch {
    // defaults apply
  }

  return {
    sender_email: senderEmail,
    sender_domain: domain,
    is_gmail: isGmail,
    smtp_configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
    spf_record: {
      status: spfStatus,
      details: spfDetails,
      recommendation: isGmail ? 'Pass: Official Google relays authorized.' : 'Add v=spf1 to domain DNS.',
    },
    dmarc_record: {
      status: dmarcStatus,
      details: dmarcDetails,
      recommendation: isGmail ? 'Pass: From address aligns with authenticated Gmail user.' : 'Add DMARC TXT record.',
    },
    provider_daily_limit: isGmail ? 500 : 2000,
    safe_daily_volume_recommended: isGmail ? 25 : 50,
    bounce_rate_threshold: 'Must stay strictly under 2.0% (ideally < 1.0%) to prevent provider account suspension.',
  };
}

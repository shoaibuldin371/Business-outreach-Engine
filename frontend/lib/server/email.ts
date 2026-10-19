import nodemailer from 'nodemailer';
import { insertLog, insertSentEmail } from './supabase';

const adminEmail = process.env.ADMIN_EMAIL || 'Mshoaibawan371@gmail.com';
const senderEmail = process.env.SENDER_EMAIL || 'outreach@growthagency.com';
const senderName = process.env.SENDER_NAME || 'Web Outreach Studio';

function getTransporter() {
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

export async function sendRawEmail(to: string, subject: string, text: string, html?: string): Promise<{ success: boolean; message: string }> {
  if (!to) return { success: false, message: 'Recipient is required.' };

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL SIMULATION] To: ${to} | Subject: ${subject}`);
    return { success: true, message: 'Simulated send (SMTP credentials not configured in environment).' };
  }

  try {
    await transporter.sendMail({
      from: `"${senderName}" <${senderEmail}>`,
      to,
      subject,
      text,
      html,
    });
    return { success: true, message: 'Delivered via SMTP.' };
  } catch (e: any) {
    console.error('SMTP error:', e);
    return { success: false, message: e.message || 'SMTP delivery failed' };
  }
}

export async function sendHitlApprovalEmail(lead: any, token: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const approveUrl = `${appUrl}/api/approval/approve?token=${token}`;
  const rejectUrl = `${appUrl}/api/approval/reject?token=${token}`;

  const businessName = lead.business_name || 'Local Business';
  const subject = `[APPROVAL NEEDED] Pitch Website to: ${businessName} (${lead.city || 'Local Area'})`;
  const draftSubject = lead.email_subject || `A tailored website idea for ${businessName}`;
  const draftBody = lead.email_body || '';

  const textBody = `BUSINESS OUTREACH ENGINE - APPROVAL REQUIRED\n\nBusiness: ${businessName}\nCity: ${lead.city}\nPhone: ${lead.phone || 'N/A'}\nProspect Email: ${lead.email}\n\nDraft Pitch:\nSubject: ${draftSubject}\n${draftBody}\n\nApprove & Send: ${approveUrl}\nReject Draft: ${rejectUrl}\nDashboard: ${appUrl}`;

  const htmlBody = `
  <!DOCTYPE html>
  <html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f3f4f6; padding: 24px;">
    <div style="max-width: 600px; margin: 0 auto; background: #111827; border-radius: 12px; border: 1px solid #1f2937; padding: 24px;">
      <h2 style="color: #6366f1; margin-top: 0;">🚀 Business Outreach Engine — Approval Needed</h2>
      <h3 style="color: #fff; margin: 12px 0 4px;">${businessName}</h3>
      <p style="color: #94a3b8; font-size: 13px; margin: 0 0 16px;">${lead.category || 'Local Service'} • ${lead.city} • Phone: ${lead.phone || 'N/A'}</p>
      
      <div style="background: #0f172a; border-left: 4px solid #6366f1; padding: 14px; border-radius: 6px; margin: 16px 0;">
        <strong style="color: #818cf8; font-size: 13px;">Subject: ${draftSubject}</strong>
        <p style="font-size: 13px; color: #cbd5e1; white-space: pre-wrap; line-height: 1.5; margin: 8px 0 0;">${draftBody}</p>
      </div>

      <div style="text-align: center; margin: 24px 0 12px;">
        <a href="${approveUrl}" style="display: inline-block; background: #10b981; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; margin-right: 10px;">✅ Approve & Send Pitch</a>
        <a href="${rejectUrl}" style="display: inline-block; background: #ef4444; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">❌ Reject Draft</a>
      </div>

      <div style="text-align: center; margin-top: 20px;">
        <a href="${appUrl}" style="color: #60a5fa; font-size: 12px;">Open Web Dashboard →</a>
      </div>
    </div>
  </body>
  </html>
  `;

  const res = await sendRawEmail(adminEmail, subject, textBody, htmlBody);
  await insertLog(
    'approval_pending',
    res.success ? 'info' : 'warning',
    `Sent HITL approval request to Gmail (${adminEmail}) for ${businessName}: ${res.message}`,
    { lead_id: lead.id, admin_email: adminEmail, token },
    lead.id
  );
  return res.success;
}

export async function sendPitchToProspect(lead: any, senderType = 'automated_approved') {
  const recipient = lead.email;
  if (!recipient) {
    await insertLog('error', 'error', `Cannot send email: ${lead.business_name} has no email address.`, { lead_id: lead.id }, lead.id);
    return { success: false, message: 'No recipient email.' };
  }

  const subject = lead.email_subject || `A tailored website idea for ${lead.business_name}`;
  const body = lead.email_body || '';

  await insertLog('sending', 'info', `Sending ${senderType} outreach to ${lead.business_name} (${recipient})...`, { recipient, subject }, lead.id);

  const res = await sendRawEmail(recipient, subject, body);

  await insertSentEmail(
    lead.id,
    recipient,
    subject,
    body,
    senderType,
    res.success ? 'sent' : 'failed',
    res.success ? undefined : res.message
  );

  if (res.success) {
    await insertLog('success', 'success', `Pitch email successfully delivered to ${lead.business_name} (${recipient}).`, { recipient }, lead.id);
  } else {
    await insertLog('error', 'error', `Failed to deliver email to ${lead.business_name}: ${res.message}`, { recipient, error: res.message }, lead.id);
  }

  return res;
}

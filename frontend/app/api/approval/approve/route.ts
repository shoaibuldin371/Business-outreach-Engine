import { NextRequest, NextResponse } from 'next/server';
import { getLeadByToken, updateLead, insertLog } from '@/lib/server/supabase';
import { sendPitchToProspect } from '@/lib/server/email';

export const dynamic = 'force-dynamic';

function renderHtml(title: string, badge: string, color: string, message: string, btnText: string, btnUrl: string) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>${title} • Business Outreach Engine</title>
    <style>
      body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at top right, #1e1e38, #0a0a14); font-family: -apple-system, sans-serif; color: #f1f5f9; padding: 20px; }
      .card { background: rgba(18, 22, 34, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 18px; padding: 36px 32px; max-width: 520px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
      .badge { display: inline-block; padding: 6px 14px; border-radius: 9999px; background: ${color}; color: #fff; font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 18px; }
      h1 { font-size: 24px; margin: 0 0 16px; color: #fff; }
      p { font-size: 15px; line-height: 1.6; color: #94a3b8; margin: 0 0 28px; }
      .btn { display: inline-block; padding: 14px 28px; border-radius: 10px; background: linear-gradient(135deg, #6366f1, #3b82f6); color: #fff; font-size: 15px; font-weight: 700; text-decoration: none; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">${badge}</div>
      <h1>${title}</h1>
      <p>${message}</p>
      <a href="${btnUrl}" class="btn">${btnText}</a>
    </div>
  </body>
  </html>
  `;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '/');

  if (!token) {
    return new Response(renderHtml('Invalid Token', 'Error', '#ef4444', 'No verification token provided in request.', 'Open Dashboard', appUrl), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const lead = await getLeadByToken(token);
  if (!lead) {
    return new Response(
      renderHtml(
        'Legacy Proposal Link Expired',
        'Notice: Purged Test Lead',
        '#f59e0b',
        'This approval link belonged to a previously purged test lead. All test data was removed from the database so only <strong>100% verified real businesses</strong> are reached.<br><br>Please visit your live dashboard to review and approve proposals for real businesses in your active pipeline.',
        'Open Active Pipelines Dashboard →',
        appUrl
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }

  if (lead.status === 'sent' || lead.status === 'approved') {
    return new Response(renderHtml('Already Approved & Sent', 'Completed', '#3b82f6', `The proposal for <strong>${lead.business_name}</strong> was already approved and sent.`, 'Open Web Dashboard', appUrl), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  await updateLead(lead.id, { status: 'approved' });
  await insertLog('approved', 'success', `HITL Approval granted via Gmail link for ${lead.business_name}.`, { token, lead_id: lead.id }, lead.id);

  const res = await sendPitchToProspect(lead, 'automated_approved');
  if (res.success) {
    await updateLead(lead.id, { status: 'accepted_by_provider', last_contacted_at: new Date().toISOString() });
    return new Response(renderHtml('✅ Approved & Delivered to Mail Provider!', 'Outreach Accepted', '#10b981', `The proposal for <strong>${lead.business_name}</strong> was accepted by the email provider for delivery to <code>${lead.email}</code> and archived in Supabase.`, 'Open Web Dashboard', appUrl), {
      headers: { 'Content-Type': 'text/html' },
    });
  } else {
    const isBlocked = (res.message || '').includes('blocked') || (res.message || '').includes('rejected') || (res.message || '').includes('550');
    await updateLead(lead.id, { status: isBlocked ? 'bounced' : 'failed' });
    return new Response(renderHtml('Approved with Delivery Issue', 'Dispatch Issue', '#f59e0b', `Approval was recorded, but sending had an issue: ${res.message}. You can retry from your dashboard.`, 'Open Web Dashboard', appUrl), {
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

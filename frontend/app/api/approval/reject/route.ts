import { NextRequest, NextResponse } from 'next/server';
import { getLeadByToken, updateLead, insertLog } from '@/lib/server/supabase';

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
    return new Response(renderHtml('Invalid Link', 'Error', '#ef4444', 'No token provided.', 'Open Dashboard', appUrl), {
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
        'This link belonged to a previously purged test lead. All test data was removed from the database so only <strong>100% verified real businesses</strong> are reached.<br><br>Please visit your live dashboard to review real businesses in your active pipeline.',
        'Open Active Pipelines Dashboard →',
        appUrl
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }

  await updateLead(lead.id, { status: 'rejected' });
  await insertLog('rejected', 'warning', `Outreach draft for '${lead.business_name}' was REJECTED via Gmail link. Marked for custom outreach.`, { lead_id: lead.id }, lead.id);

  const customUrl = `${appUrl}/custom-email?lead_id=${lead.id}`;

  return new Response(renderHtml('❌ Draft Rejected', 'Status: Rejected', '#ef4444', `Outreach draft for <strong>${lead.business_name}</strong> has been rejected.<br><br>It is now marked as <strong>Rejected</strong> on your dashboard so you can send a custom email through the website.`, 'Send Custom Email Now →', customUrl), {
    headers: { 'Content-Type': 'text/html' },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { addToSuppressionList } from '@/lib/server/suppression';
import { getClient } from '@/lib/server/supabase';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');

  if (!email || !email.includes('@')) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head><title>Invalid Request</title></head>
        <body style="font-family:sans-serif;background:#0d1117;color:#c9d1d9;padding:40px;text-align:center;">
          <h2>Invalid Opt-Out Request</h2>
          <p>Please provide a valid email address.</p>
        </body>
      </html>`,
      { status: 400, headers: { 'Content-Type': 'text/html' } }
    );
  }

  await addToSuppressionList(email, 'user_opt_out', 'email_unsubscribe_link');

  // Log outreach event if lead exists
  const sb = getClient();
  if (sb) {
    try {
      const { data } = await sb.from('business_leads').select('id').eq('email', email.trim().toLowerCase()).limit(1).single();
      if (data) {
        await sb.from('outreach_events').insert({
          lead_id: data.id,
          event_type: 'opt_out',
          channel: 'email',
          payload: { email },
        });
      }
    } catch {}
  }

  return new NextResponse(
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Opt-Out Confirmation</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #080c14;
            color: #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .card {
            background: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 12px;
            max-width: 480px;
            padding: 36px 32px;
            text-align: center;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
          }
          .icon {
            width: 48px;
            height: 48px;
            background: #064e3b;
            color: #34d399;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 16px;
          }
          h1 { font-size: 20px; margin: 0 0 10px; color: #fff; }
          p { font-size: 14px; color: #94a3b8; line-height: 1.5; margin: 0 0 16px; }
          .email-box {
            background: #020617;
            border: 1px solid #1e293b;
            border-radius: 6px;
            padding: 10px;
            font-family: monospace;
            font-size: 13px;
            color: #38bdf8;
            margin-bottom: 20px;
          }
          .footer {
            font-size: 12px;
            color: #64748b;
            border-top: 1px solid #1e293b;
            padding-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h1>Successfully Unsubscribed</h1>
          <p>You will receive no further communications from Muhammad Shoaib regarding technical advisory or development services.</p>
          <div class="email-box">${email}</div>
          <p>Your preference has been registered in our permanent suppression system.</p>
          <div class="footer">
            Technical Advisory · Privacy & CAN-SPAM Compliant
          </div>
        </div>
      </body>
    </html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}

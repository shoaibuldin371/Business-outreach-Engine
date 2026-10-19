import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let runtimeSettings = {
  admin_email: process.env.ADMIN_EMAIL || 'Mshoaibawan371@gmail.com',
  default_category: 'dentists',
  default_city: 'Dallas, TX',
  interval_hours: 3,
};

export async function GET() {
  const supabaseSet = Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const smtpSet = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

  return NextResponse.json({
    ...runtimeSettings,
    backend_url: 'Vercel Serverless (All-in-One)',
    supabase_configured: supabaseSet,
    smtp_configured: smtpSet,
    cron_schedule: 'Every 3 hours via Vercel Cron (0 */3 * * *)'
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.admin_email) runtimeSettings.admin_email = body.admin_email;
  if (body.default_category) runtimeSettings.default_category = body.default_category;
  if (body.default_city) runtimeSettings.default_city = body.default_city;

  return NextResponse.json({ status: 'success', message: 'Settings updated.' });
}

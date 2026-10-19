import { NextResponse } from 'next/server';
import { getClient, getLatestAutomationRun, getAutomationSettings } from '@/lib/server/supabase';
import { getProviderConnection } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sb = getClient();
  const gmailConn = await getProviderConnection('gmail');
  const settings = await getAutomationSettings();
  const lastRun = await getLatestAutomationRun();

  return NextResponse.json({
    status: 'healthy',
    runtime: 'Vercel Serverless (Next.js App Router All-in-One)',
    admin_email: settings.admin_notification_email || process.env.ADMIN_EMAIL || 'Mshoaibawan371@gmail.com',
    supabase_connected: Boolean(sb),
    gmail_oauth_connected: Boolean(gmailConn?.is_connected),
    smtp_configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
    scheduler: {
      schedule: `Every ${settings.interval_hours} Hours (${settings.batch_size} leads/cycle)`,
      is_paused: settings.is_paused,
      last_run_at: lastRun?.started_at || null,
      last_run_status: lastRun?.status || null,
    },
    timestamp: new Date().toISOString(),
  });
}

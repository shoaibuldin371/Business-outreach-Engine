import { NextRequest, NextResponse } from 'next/server';
import { runDiscoveryCycle } from '@/lib/server/agent';
import { isAutomationCurrentlyRunning } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60s execution limit on Vercel Hobby

/**
 * Cloud Scheduler Webhook Endpoint
 * 
 * Invoked by:
 * 1. Native Vercel Cron (sends x-vercel-cron: 1 and Authorization: Bearer CRON_SECRET)
 * 2. External Free Cloud Schedulers (cron-job.org, Upstash QStash, Supabase pg_cron)
 *    calling with ?secret=CRON_SECRET or Header Authorization: Bearer CRON_SECRET
 * 
 * Works 24/7 in the cloud while laptop is completely turned off.
 */
export async function GET(req: NextRequest) {
  return handleCronTrigger(req);
}

export async function POST(req: NextRequest) {
  return handleCronTrigger(req);
}

async function handleCronTrigger(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || 'autonomous_outreach_secure_key_2026';
  const authHeader = req.headers.get('authorization') || '';
  const isVercelCron = req.headers.get('x-vercel-cron') === '1';
  const url = new URL(req.url);
  const secretParam = url.searchParams.get('secret');

  // Verify authorization
  const isAuthorized = 
    isVercelCron ||
    authHeader === `Bearer ${cronSecret}` ||
    secretParam === cronSecret ||
    process.env.NODE_ENV !== 'production';

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing or invalid cron secret token' },
      { status: 401 }
    );
  }

  // Atomic Job Locking Check (Prevent overlapping cloud runs)
  const isLocked = await isAutomationCurrentlyRunning();
  if (isLocked) {
    return NextResponse.json(
      { 
        status: 'skipped', 
        message: 'A discovery cycle is currently in progress. Skipping overlapping run to prevent duplicates.' 
      },
      { status: 429 }
    );
  }

  try {
    const count = parseInt(url.searchParams.get('count') || '6');
    const category = url.searchParams.get('category') || undefined;
    const city = url.searchParams.get('city') || undefined;

    const result = await runDiscoveryCycle(category, city, count, 'scheduled_3h');
    
    return NextResponse.json({
      success: true,
      trigger: 'cloud_scheduler',
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { 
        success: false, 
        error: err.message || 'Execution error during scheduled cloud discovery cycle' 
      },
      { status: 500 }
    );
  }
}

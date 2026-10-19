import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    runtime: 'Vercel Serverless (All-in-One)',
    admin_email: process.env.ADMIN_EMAIL || 'Mshoaibawan371@gmail.com',
    supabase_connected: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    scheduler: 'Vercel Cron (Every 3 Hours)',
    timestamp: new Date().toISOString()
  });
}

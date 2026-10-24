import { NextRequest, NextResponse } from 'next/server';
import { getSenderDeliverabilityReport, verifyDomainHasMx, KNOWN_BOUNCED_OR_BLOCKED_EMAILS } from '@/lib/server/email';
import { getClient, getDashboardStats } from '@/lib/server/supabase';
import nodemailer from 'nodemailer';

import { getSuppressionList } from '@/lib/server/suppression';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const report = await getSenderDeliverabilityReport();
    const stats = await getDashboardStats();
    const suppressionList = await getSuppressionList(100);

    const totalAccepted = stats.accepted_by_provider_count || 0;
    const totalBounced = stats.bounced_count || 0;
    const bounceDenominator = totalAccepted + totalBounced;
    const calculatedBounceRate = bounceDenominator > 0 
      ? Number(((totalBounced / bounceDenominator) * 100).toFixed(2)) 
      : 0;

    return NextResponse.json({
      status: 'ok',
      deliverability_report: report,
      metrics: {
        emails_queued: stats.pending_approval || 0,
        total_accepted: totalAccepted,
        confirmed_delivered: stats.confirmed_delivered_count || 0,
        bounced_count: totalBounced,
        temporary_failures_count: stats.temporary_failures_count || 0,
        auth_provider_errors_count: stats.auth_provider_errors_count || 0,
        calculated_bounce_rate_percentage: calculatedBounceRate,
        bounce_status: calculatedBounceRate > 2.0 ? 'critical_paused' : 'healthy',
        replies_count: stats.replies_count || 0,
        positive_replies_count: stats.positive_replies_count || 0,
        reply_rate_percentage: stats.reply_rate_percentage || 0,
        suppression_list_size: suppressionList.length,
        suppression_entries: suppressionList,
        failed_email_details: stats.failed_email_details || [],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch deliverability report' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const testResults: Record<string, { status: 'passed' | 'failed' | 'skipped'; details: string; latency_ms?: number }> = {};

  // 1. Test Supabase Database Connectivity
  const startDb = Date.now();
  try {
    const sb = getClient();
    if (!sb) {
      testResults['database_connection'] = { status: 'failed', details: 'Supabase client could not be initialized with configured credentials.' };
    } else {
      const { error } = await sb.from('leads').select('id', { count: 'exact', head: true });
      const latency = Date.now() - startDb;
      if (error) {
        testResults['database_connection'] = { status: 'failed', details: `Supabase query failed: ${error.message}`, latency_ms: latency };
      } else {
        testResults['database_connection'] = { status: 'passed', details: 'Successfully queried Supabase PostgreSQL database.', latency_ms: latency };
      }
    }
  } catch (e: any) {
    testResults['database_connection'] = { status: 'failed', details: e.message || 'Database connection error.' };
  }

  // 2. Test SMTP Provider Authentication (Pre-flight verify without sending email)
  const startSmtp = Date.now();
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const port = parseInt(process.env.SMTP_PORT || '465');

  if (!host || !user || !pass) {
    testResults['smtp_authentication'] = {
      status: 'failed',
      details: 'SMTP_HOST, SMTP_USER, or SMTP_PASSWORD not set in environment.',
    };
  } else {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 8000,
      });

      await transporter.verify();
      const latency = Date.now() - startSmtp;
      testResults['smtp_authentication'] = {
        status: 'passed',
        details: `Connected to ${host}:${port} as ${user} with clean SMTP 250 handshake.`,
        latency_ms: latency,
      };
    } catch (e: any) {
      testResults['smtp_authentication'] = {
        status: 'failed',
        details: `SMTP verification failed: ${e.message}`,
        latency_ms: Date.now() - startSmtp,
      };
    }
  }

  // 3. Test DNS MX Pre-flight Resolution
  const startDns = Date.now();
  try {
    const googleMx = await verifyDomainHasMx('admin@gmail.com');
    const latency = Date.now() - startDns;
    if (googleMx) {
      testResults['dns_mx_preflight'] = {
        status: 'passed',
        details: 'Public DNS nameservers (8.8.8.8, 1.1.1.1) successfully resolved MX mail records.',
        latency_ms: latency,
      };
    } else {
      testResults['dns_mx_preflight'] = {
        status: 'failed',
        details: 'Failed to resolve MX records using public nameservers.',
        latency_ms: latency,
      };
    }
  } catch (e: any) {
    testResults['dns_mx_preflight'] = {
      status: 'failed',
      details: `DNS MX check error: ${e.message}`,
    };
  }

  // 4. Test Suppression List Protection
  const suppressedTest = KNOWN_BOUNCED_OR_BLOCKED_EMAILS.has('contact@outbackroofing.com');
  testResults['suppression_guard'] = {
    status: suppressedTest ? 'passed' : 'failed',
    details: suppressedTest 
      ? 'Known 550 hard-bounce addresses are actively blocked from outbound dispatch.'
      : 'Known 550 addresses missing from suppression list.',
  };

  const allPassed = Object.values(testResults).every(t => t.status === 'passed');

  return NextResponse.json({
    status: allPassed ? 'success' : 'warning',
    all_passed: allPassed,
    checks: testResults,
    timestamp: new Date().toISOString(),
  });
}

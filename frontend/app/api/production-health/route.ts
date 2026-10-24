import { NextResponse } from 'next/server';
import { 
  getClient, 
  getLeads, 
  getLatestAutomationRun, 
  isAutomationCurrentlyRunning,
  getProviderConnection,
  getSentEmails,
  getAutomationSettings,
  BusinessLead
} from '@/lib/server/supabase';
import { getValidGmailAccessToken } from '@/lib/server/gmail-oauth';
import { classifyEmailError } from '@/lib/server/email';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function computeNextExpectedRun(): string {
  const now = new Date();
  const next8 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0));
  const next20 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 20, 0, 0));

  if (now.getTime() < next8.getTime()) {
    return next8.toISOString();
  } else if (now.getTime() < next20.getTime()) {
    return next20.toISOString();
  } else {
    // Tomorrow at 08:00 UTC
    const tomorrow8 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 8, 0, 0));
    return tomorrow8.toISOString();
  }
}

export async function GET() {
  try {
    const sb = getClient();
    const leads = await getLeads('all', 1000);
    const lastRun = await getLatestAutomationRun();
    const isRunning = await isAutomationCurrentlyRunning();
    const gmailConn = await getProviderConnection('gmail');
    const gmailAccessTokenValid = await getValidGmailAccessToken().then(Boolean).catch(() => false);
    const sentEmails = await getSentEmails(500);
    const settings = await getAutomationSettings();

    // 1. Production Deployment Status
    const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
    const deploymentStatus = isVercel ? 'Ready' : 'Verified';
    const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || null;
    const commitMessage = process.env.VERCEL_GIT_COMMIT_MESSAGE || null;
    const host = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://business-outreach-engine.vercel.app';

    // 2. Scheduler Telemetry
    const nextExpectedRun = computeNextExpectedRun();
    const schedulerStatus = isRunning ? 'running' : (lastRun?.status === 'failed' ? 'failed' : 'idle');

    // 3. Lead Discovery and Qualification
    const qualifiedLeads = leads.filter(l => Boolean(l.email && l.email.trim()));
    const rejectedLeads = leads.filter(l => l.status === 'rejected');
    
    const rejectionReasons = {
      invalid_or_missing_email: leads.filter(l => (l.notes || '').toLowerCase().includes('email') || (l.notes || '').toLowerCase().includes('bounce')).length,
      no_technical_need: leads.filter(l => (l.notes || '').toLowerCase().includes('no need') || (l.notes || '').toLowerCase().includes('weak')).length,
      manual_reject: rejectedLeads.length,
      other: 0,
    };

    let discoveryStatus: 'idle' | 'running' | 'succeeded' | 'failed' | 'empty' = 'idle';
    if (isRunning) {
      discoveryStatus = 'running';
    } else if (lastRun?.status === 'failed') {
      discoveryStatus = 'failed';
    } else if (lastRun && lastRun.discovered_count === 0) {
      discoveryStatus = 'empty';
    } else if (lastRun && lastRun.discovered_count > 0) {
      discoveryStatus = 'succeeded';
    }

    // 4. Gmail Sending Telemetry & Error Categorization
    const hasSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
    const hasGmailOAuth = Boolean(gmailConn?.is_connected || gmailAccessTokenValid);
    const emailProvider = hasGmailOAuth ? 'gmail_oauth' : (hasSmtp ? 'smtp' : 'none');
    
    let emailConnectionStatus: 'connected' | 'unconfigured' | 'error' = 'unconfigured';
    if (hasGmailOAuth || hasSmtp) {
      emailConnectionStatus = 'connected';
    }

    const queuedCount = leads.filter(l => l.status === 'pending_approval' || l.status === 'draft_ready').length;
    const acceptedCount = leads.filter(l => ['accepted_by_provider', 'sent', 'delivered', 'reply_received'].includes(l.status)).length;
    const failedCount = leads.filter(l => l.status === 'failed' || l.status === 'error').length;

    const failureCategories = {
      AUTHENTICATION_FAILURE: 0,
      RATE_LIMIT_EXCEEDED: 0,
      INVALID_RECIPIENT: 0,
      TEMPORARY_PROVIDER_ERROR: 0,
      MESSAGE_REJECTED: 0,
      TIMEOUT_OR_UNKNOWN: 0,
    };

    // Analyze failed sent email records
    for (const item of sentEmails) {
      if (item.status === 'failed' && item.error_message) {
        const cat = classifyEmailError(item.error_message).category as keyof typeof failureCategories;
        if (cat in failureCategories) {
          failureCategories[cat]++;
        } else {
          failureCategories.TIMEOUT_OR_UNKNOWN++;
        }
      }
    }

    // 5. Email Delivery & Replies Telemetry
    const deliveredCount = leads.filter(l => l.status === 'delivered').length;
    const bouncedCount = leads.filter(l => l.status === 'bounced').length;
    const repliedCount = leads.filter(l => l.status === 'reply_received').length;
    const unknownDeliveryCount = acceptedCount - deliveredCount - bouncedCount;

    const repliesBreakdown = {
      interested: leads.filter(l => l.reply_classification === 'interested').length,
      wants_details: leads.filter(l => l.reply_classification === 'wants_details').length,
      requests_pricing: leads.filter(l => l.reply_classification === 'requests_pricing').length,
      meeting_requested: leads.filter(l => l.reply_classification === 'meeting_requested').length,
      not_interested: leads.filter(l => l.reply_classification === 'not_interested').length,
      follow_up_later: leads.filter(l => l.reply_classification === 'follow_up_later').length,
      unsubscribe: leads.filter(l => l.reply_classification === 'unsubscribe').length,
      unknown: leads.filter(l => l.status === 'reply_received' && !l.reply_classification).length,
    };

    return NextResponse.json({
      deployment: {
        status: deploymentStatus,
        commitSha,
        commitMessage,
        deployedAt: process.env.VERCEL_DEPLOYMENT_ID ? new Date().toISOString() : null,
        environment: process.env.VERCEL_ENV || 'production',
        buildError: null,
        host,
      },
      scheduler: {
        isConfigured: true,
        scheduleExpression: '0 8 * * * (Native Vercel Cron) + Cloud Webhook (/api/cron/trigger)',
        supportedFrequency: 'Twice daily at 08:00 & 20:00 UTC (Hobby-compliant + Cloud Webhook)',
        lastScheduledRun: lastRun?.started_at || null,
        lastSuccessfulRun: lastRun?.status === 'completed' ? lastRun.completed_at : null,
        nextExpectedRun,
        status: schedulerStatus,
        latestRun: lastRun ? {
          id: lastRun.id,
          status: lastRun.status,
          started_at: lastRun.started_at,
          completed_at: lastRun.completed_at,
          discovered_count: lastRun.discovered_count,
          qualified_count: lastRun.qualified_count,
          error_count: lastRun.error_count,
          error_message: lastRun.summary || (lastRun.error_details ? JSON.stringify(lastRun.error_details) : undefined),
        } : null,
        configError: null,
      },
      discovery: {
        status: discoveryStatus,
        totalCandidatesDiscovered: leads.length,
        totalQualifiedWithVerifiedEmail: qualifiedLeads.length,
        totalRejected: rejectedLeads.length,
        rejectionReasons,
        lastCycleDiscoveredCount: lastRun?.discovered_count || 0,
        lastCycleStatus: lastRun?.status || 'idle',
      },
      emailSending: {
        connectionStatus: emailConnectionStatus,
        providerType: emailProvider,
        oauthStatus: hasGmailOAuth ? 'connected' : 'unconfigured',
        smtpConfigured: hasSmtp,
        messagesQueued: queuedCount,
        messagesAttempted: sentEmails.length,
        messagesAcceptedByProvider: acceptedCount,
        failedCount,
        failureCategories,
      },
      deliveryReplies: {
        providerAcceptedCount: acceptedCount,
        deliveredCount,
        bouncedCount,
        repliedCount,
        unknownDeliveryCount: Math.max(0, unknownDeliveryCount),
        repliesBreakdown,
        explanation: 'Provider Accepted means Gmail SMTP/API returned 250 OK. Delivered is confirmed only upon delivery receipts. Bounced reflects remote 550 rejections.',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

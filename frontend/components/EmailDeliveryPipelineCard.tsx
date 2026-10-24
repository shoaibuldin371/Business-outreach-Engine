'use client';

import React, { useState } from 'react';
import { Stats, FailedEmailDetail } from '@/lib/api';
import {
  Inbox,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Lock,
  MessageSquare,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Ban
} from 'lucide-react';

interface EmailDeliveryPipelineCardProps {
  stats: Stats | null;
  onSelectLeadById?: (leadId: string) => void;
}

export default function EmailDeliveryPipelineCard({
  stats,
  onSelectLeadById
}: EmailDeliveryPipelineCardProps) {
  const [showFailureDetails, setShowFailureDetails] = useState(true);

  const emailsQueued = stats?.emails_queued ?? stats?.pending_approval ?? 0;
  const providerAccepted = stats?.accepted_by_provider_count ?? stats?.sent_count ?? 0;
  const confirmedDelivered = stats?.confirmed_delivered_count ?? 0;
  const hardBounces = stats?.bounced_count ?? 0;
  const tempFailures = stats?.temporary_failures_count ?? 0;
  const authErrors = stats?.auth_provider_errors_count ?? 0;
  const repliesReceived = stats?.replies_count ?? 0;

  const failedEmails: FailedEmailDetail[] = stats?.failed_email_details || [];

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-[#0b0f1d] border border-white/5 space-y-5 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider mb-1">
            <Send className="w-4 h-4 text-sky-400" />
            <span>Automated Email Outreach & Deliverability Telemetry</span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>Live Delivery Lifecycle Breakdown</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
              ● Strict Delivery Integrity
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Transparently distinguishes Provider Acceptance (250 OK) from Confirmed Inbox Delivery. Hard bounces are suppressed with zero retries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hardBounces > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
              <Ban className="w-3.5 h-3.5 text-rose-400" />
              <span>{hardBounces} Hard Bounces Suppressed</span>
            </span>
          )}
        </div>
      </div>

      {/* 7 Separate Delivery Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
        {/* 1. Emails Queued */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-1 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold text-[11px]">Emails Queued</span>
            <Inbox className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-200">{emailsQueued}</div>
          <div className="text-[10px] text-slate-400">Ready for dispatch</div>
        </div>

        {/* 2. Provider Accepted */}
        <div className="p-3.5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-1 hover:border-indigo-500/40 transition-colors">
          <div className="flex items-center justify-between text-indigo-400 text-xs">
            <span className="font-semibold text-[11px]">Provider Accepted</span>
            <Send className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-300">{providerAccepted}</div>
          <div className="text-[10px] text-slate-400">SMTP 250 OK accepted</div>
        </div>

        {/* 3. Confirmed Delivered */}
        <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-1 hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between text-emerald-400 text-xs">
            <span className="font-semibold text-[11px]">Delivered</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-300">{confirmedDelivered}</div>
          <div className="text-[10px] text-slate-400">Verified receipt event</div>
        </div>

        {/* 4. Hard Bounces */}
        <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/30 space-y-1 hover:border-rose-500/50 transition-colors">
          <div className="flex items-center justify-between text-rose-400 text-xs">
            <span className="font-semibold text-[11px]">Hard Bounces</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-400">{hardBounces}</div>
          <div className="text-[10px] text-slate-400">550 5.1.1 (Suppressed)</div>
        </div>

        {/* 5. Temporary Failures */}
        <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/20 space-y-1 hover:border-amber-500/40 transition-colors">
          <div className="flex items-center justify-between text-amber-400 text-xs">
            <span className="font-semibold text-[11px]">Temp Failures</span>
            <Clock className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-300">{tempFailures}</div>
          <div className="text-[10px] text-slate-400">421/451 Backoff retry</div>
        </div>

        {/* 6. Authentication / Provider Errors */}
        <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-1 hover:border-purple-500/40 transition-colors">
          <div className="flex items-center justify-between text-purple-400 text-xs">
            <span className="font-semibold text-[11px]">Auth / Quota</span>
            <Lock className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-300">{authErrors}</div>
          <div className="text-[10px] text-slate-400">535 Auth / 429 Limit</div>
        </div>

        {/* 7. Replies Received */}
        <div className="p-3.5 rounded-2xl bg-violet-950/20 border border-violet-500/20 space-y-1 hover:border-violet-500/40 transition-colors">
          <div className="flex items-center justify-between text-violet-400 text-xs">
            <span className="font-semibold text-[11px]">Replies</span>
            <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-violet-300">{repliesReceived}</div>
          <div className="text-[10px] text-slate-400">Prospect engaged</div>
        </div>
      </div>

      {/* Failure Diagnostic & Affected Lead Audit Trail */}
      {failedEmails.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#080c18] border border-rose-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold text-slate-200">
                Failed Outreach Diagnostics & Permanent Suppression Audit ({failedEmails.length} logged)
              </h3>
            </div>
            <button
              onClick={() => setShowFailureDetails(!showFailureDetails)}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span>{showFailureDetails ? 'Collapse Audit' : 'Expand Audit'}</span>
              {showFailureDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {showFailureDetails && (
            <div className="overflow-x-auto pt-1">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    <th className="pb-2">Affected Lead</th>
                    <th className="pb-2">Recipient Email</th>
                    <th className="pb-2">Failure Classification</th>
                    <th className="pb-2">Actual Failure Reason (Remote Server Response)</th>
                    <th className="pb-2">Action / Policy</th>
                    <th className="pb-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {failedEmails.map((f, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 font-semibold text-white whitespace-nowrap">
                        {onSelectLeadById && f.lead_id ? (
                          <button
                            onClick={() => onSelectLeadById(f.lead_id!)}
                            className="text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <span>{f.business_name}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </button>
                        ) : (
                          <span>{f.business_name}</span>
                        )}
                        {(f.city || f.state) && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            {f.city}{f.state ? `, ${f.state}` : ''}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 font-mono text-cyan-300 whitespace-nowrap">
                        {f.recipient_email}
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          f.failure_category === 'HARD_BOUNCE' || f.delivery_status === 'bounced'
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : f.failure_category === 'AUTHENTICATION_FAILURE'
                            ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}>
                          {f.smtp_error_code ? `${f.smtp_error_code} ` : ''}
                          {f.failure_category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-300 text-[11px] max-w-sm">
                        <div className="line-clamp-2" title={f.actual_failure_reason}>
                          {f.actual_failure_reason}
                        </div>
                      </td>
                      <td className="py-2.5 whitespace-nowrap text-[11px]">
                        {f.is_suppressed ? (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <Ban className="w-3 h-3 shrink-0" />
                            <span>Suppressed (0 Retries)</span>
                          </span>
                        ) : f.can_retry ? (
                          <span className="text-amber-400 font-medium">
                            Retryable with backoff
                          </span>
                        ) : (
                          <span className="text-slate-400">
                            Stopped (Manual review)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-400 text-[11px] whitespace-nowrap font-mono">
                        {new Date(f.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[10px] text-slate-400 mt-3 italic">
                * Remote SMTP error codes (e.g. 550 5.1.1 "The email account that you tried to reach does not exist") are permanently suppressed from future scheduled campaigns.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

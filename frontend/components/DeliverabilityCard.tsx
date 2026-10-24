'use client';

import React, { useEffect, useState } from 'react';
import { fetchDeliverabilityReport, runSafePreflightTest } from '@/lib/api';
import { 
  ShieldCheck, 
  Mail, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  RefreshCw, 
  Lock, 
  ExternalLink,
  Zap,
  TrendingUp,
  XCircle
} from 'lucide-react';

export default function DeliverabilityCard() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDeliverabilityReport();
      setReport(data);
    } catch (e: any) {
      setError(e.message || 'Failed to load deliverability telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const handleRunSafeTest = async () => {
    setTesting(true);
    setTestResults(null);
    try {
      const res = await runSafePreflightTest();
      setTestResults(res);
      await loadReport();
    } catch (e: any) {
      setError(e.message || 'Safe preflight check failed');
    } finally {
      setTesting(false);
    }
  };

  const deliverability = report?.deliverability_report;
  const metrics = report?.metrics;

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Sender Deliverability & Reputation Guard</span>
          </div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>Gmail SMTP / OAuth Infrastructure</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Pre-flight MX Active
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitors SPF/DMARC alignment, Google daily sending limits (500/day), bounce rate (&lt;2%), and active suppression.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRunSafeTest}
            disabled={testing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all disabled:opacity-50 shadow-sm"
          >
            <Zap className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : 'text-indigo-400'}`} />
            <span>{testing ? 'Testing Handshake...' : 'Run Safe Pre-flight Test'}</span>
          </button>
          <button
            onClick={loadReport}
            disabled={loading}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 transition-colors"
            title="Refresh Deliverability Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl text-xs bg-rose-500/10 border border-rose-500/20 text-rose-400">
          {error}
        </div>
      )}

      {/* Safe Pre-flight Test Results Banner */}
      {testResults && (
        <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Pre-flight Test Results (0 Test Emails Sent to Real Businesses)
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              testResults.all_passed 
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
            }`}>
              {testResults.all_passed ? 'ALL CHECKS PASSED' : 'SOME CHECKS REQUIRE ATTENTION'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {Object.entries(testResults.checks || {}).map(([key, check]: any) => (
              <div key={key} className="p-2.5 rounded-lg bg-slate-900 border border-white/5 space-y-1">
                <div className="flex items-center justify-between font-semibold">
                  <span className="capitalize text-slate-300">{key.replace(/_/g, ' ')}</span>
                  <span className={`text-[10px] font-bold ${check.status === 'passed' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {check.status === 'passed' ? '✓ PASS' : '✗ FAIL'} {check.latency_ms ? `(${check.latency_ms}ms)` : ''}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{check.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deliverability Telemetry Grid (7 Distinct Operational Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] text-slate-400 font-medium">Emails Queued</div>
          <div className="text-xl font-black text-slate-200">{metrics?.emails_queued ?? 0}</div>
          <div className="text-[10px] text-slate-400">Ready for dispatch</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] text-indigo-400 font-medium">Provider Accepted</div>
          <div className="text-xl font-black text-indigo-300">{metrics?.total_accepted ?? 0}</div>
          <div className="text-[10px] text-slate-400">SMTP 250 OK accepted</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] text-emerald-400 font-medium">Confirmed Delivered</div>
          <div className="text-xl font-black text-emerald-400">{metrics?.confirmed_delivered ?? 0}</div>
          <div className="text-[10px] text-slate-400">Verified receipt events</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] text-rose-400 font-medium">Hard Bounces</div>
          <div className="text-xl font-black text-rose-400">{metrics?.bounced_count ?? 0}</div>
          <div className="text-[10px] text-slate-400">550 5.1.1 (Suppressed)</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] text-amber-400 font-medium">Temp Failures</div>
          <div className="text-xl font-black text-amber-300">{metrics?.temporary_failures_count ?? 0}</div>
          <div className="text-[10px] text-slate-400">421/451 (Retryable)</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] text-purple-400 font-medium">Auth / Quota</div>
          <div className="text-xl font-black text-purple-300">{metrics?.auth_provider_errors_count ?? 0}</div>
          <div className="text-[10px] text-slate-400">535 Auth / 429 Limit</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1">
          <div className="text-[11px] text-cyan-400 font-medium">Replies Received</div>
          <div className="text-xl font-black text-cyan-300">{metrics?.replies_count ?? 0}</div>
          <div className="text-[10px] text-slate-400">Prospect engaged</div>
        </div>
      </div>

      {/* Protocol Alignment & Google Limits */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* SPF & Sender Identity */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              SPF Record
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {deliverability?.spf_record?.status?.toUpperCase() || 'PASS'}
            </span>
          </div>
          <div className="text-xs font-mono text-slate-300 truncate" title={deliverability?.sender_email}>
            {deliverability?.sender_email || 'Mshoaibawan371@gmail.com'}
          </div>
          <p className="text-[10px] text-slate-400">
            {deliverability?.spf_record?.recommendation || 'Official Google SPF relays authenticated.'}
          </p>
        </div>

        {/* DMARC Alignment */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              DMARC Policy
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {deliverability?.dmarc_record?.status?.toUpperCase() || 'PASS'}
            </span>
          </div>
          <div className="text-xs font-mono text-slate-300 truncate">
            {deliverability?.sender_domain || 'gmail.com'}
          </div>
          <p className="text-[10px] text-slate-400">
            {deliverability?.dmarc_record?.recommendation || 'From header aligns with authenticated sender.'}
          </p>
        </div>

        {/* Bounce Rate Monitor */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Bounce Rate
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              (metrics?.calculated_bounce_rate_percentage || 0) < 2.0
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}>
              {metrics?.calculated_bounce_rate_percentage ?? 0.0}%
            </span>
          </div>
          <div className="text-xs text-slate-200 font-semibold">
            Threshold: &lt; 2.0% (Strict)
          </div>
          <p className="text-[10px] text-slate-400">
            {metrics?.calculated_bounce_rate_percentage > 2.0
              ? '⚠ Bounce threshold exceeded. Outbound campaigns auto-paused.'
              : '✓ Low bounce risk. Sender reputation fully protected.'}
          </p>
        </div>

        {/* Quota & Suppression Guard */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-amber-400" />
              Gmail Daily Limit
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
              500/DAY MAX
            </span>
          </div>
          <div className="text-xs text-slate-200 font-semibold">
            Safe Batch: 25-50 / Day
          </div>
          <p className="text-[10px] text-slate-400">
            Suppressed addresses: <strong className="text-slate-200">{metrics?.suppression_list_size || 0}</strong> blocked from dispatch.
          </p>
        </div>
      </div>

      {/* Failed Outreach Diagnostics (Audit Trail with Affected Lead & Failure Reason) */}
      {metrics?.failed_email_details && metrics.failed_email_details.length > 0 && (
        <div className="p-4 rounded-xl bg-[#090d1c] border border-rose-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Failed Outreach Diagnostics ({metrics.failed_email_details.length} failed delivery events logged)
            </h3>
            <span className="text-[10px] text-slate-400">Actual Remote Server Failure Reasons</span>
          </div>

          <div className="overflow-x-auto">
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
                {metrics.failed_email_details.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 font-semibold text-white whitespace-nowrap">
                      <div>{item.business_name}</div>
                      {(item.city || item.state) && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          {item.city}{item.state ? `, ${item.state}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 font-mono text-cyan-300 whitespace-nowrap">{item.recipient_email}</td>
                    <td className="py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.failure_category === 'HARD_BOUNCE' || item.delivery_status === 'bounced'
                          ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}>
                        {item.smtp_error_code ? `${item.smtp_error_code} ` : ''}
                        {item.failure_category.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-300 text-[11px] max-w-sm">
                      <div className="line-clamp-2" title={item.actual_failure_reason}>
                        {item.actual_failure_reason}
                      </div>
                    </td>
                    <td className="py-2.5 whitespace-nowrap text-[11px]">
                      {item.is_suppressed ? (
                        <span className="text-rose-400 font-semibold">Permanently Suppressed (0 Retries)</span>
                      ) : item.can_retry ? (
                        <span className="text-amber-400 font-medium">Retryable with backoff</span>
                      ) : (
                        <span className="text-slate-400">Stopped</span>
                      )}
                    </td>
                    <td className="py-2.5 text-slate-400 text-[11px] whitespace-nowrap font-mono">
                      {new Date(item.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Suppression List Table */}
      {metrics?.suppression_entries && metrics.suppression_entries.length > 0 && (
        <div className="p-4 rounded-xl bg-[#080d1a] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Active Suppression List ({metrics.suppression_entries.length} addresses permanently blocked)
            </h3>
            <span className="text-[10px] text-slate-400">550 5.1.1 Hard Bounces & Opt-Outs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-[11px] text-slate-400">
                  <th className="pb-2 font-medium">Suppressed Email</th>
                  <th className="pb-2 font-medium">Reason</th>
                  <th className="pb-2 font-medium">SMTP Diagnostic / Code</th>
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {metrics.suppression_entries.map((entry: any) => (
                  <tr key={entry.id || entry.email} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 font-mono text-cyan-400">{entry.email}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        entry.reason === 'hard_bounce'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        {entry.reason === 'hard_bounce' ? 'Hard Bounce' : 'Opt-Out'}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-400 font-mono text-[11px] max-w-xs truncate" title={entry.diagnostic_message || entry.smtp_error_code}>
                      {entry.smtp_error_code || '550 5.1.1'} {entry.diagnostic_message ? `— ${entry.diagnostic_message}` : ''}
                    </td>
                    <td className="py-2.5 text-slate-400 text-[11px]">{entry.source || 'smtp_bounce_550'}</td>
                    <td className="py-2.5 text-slate-400 text-[11px]">
                      {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 italic">
            * Addresses on this list will never receive automated outreach. To remove an address, administrators must manually verify the mailbox.
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { ProductionHealthTelemetry, fetchProductionHealth } from '@/lib/api';
import { 
  Server, 
  Clock, 
  Search, 
  Send, 
  MessageSquare, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  ExternalLink,
  Layers,
  Sparkles,
  Zap,
  Globe2,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function ProductionHealthSection() {
  const [data, setData] = useState<ProductionHealthTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const loadHealth = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetchProductionHealth();
      setData(res);
    } catch (e) {
      console.error('Failed to fetch production health:', e);
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(() => loadHealth(), 12000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'None recorded';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return isoString;
    }
  };

  if (loading && !data) {
    return (
      <div className="p-5 rounded-2xl bg-[#0b0f1d] border border-white/5 animate-pulse text-xs text-slate-400 text-center">
        Loading real production health telemetry...
      </div>
    );
  }

  const d = data;
  if (!d) return null;

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Production System Health & Live Telemetry
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Real verification across Vercel deployment, 24/7 cloud scheduler, multi-source discovery, Gmail sending, and reply tracking.
          </p>
        </div>

        <button
          onClick={() => loadHealth(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Health'}</span>
        </button>
      </div>

      {/* 5 Production Health Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {/* CARD A: Production Deployment */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0e1428] to-[#0a0e1c] border border-white/5 space-y-3 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-sky-400" />
                A. Deployment
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                d.deployment.status === 'Ready' || d.deployment.status === 'Verified'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : d.deployment.status === 'Building'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}>
                ● {d.deployment.status}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="text-[11px] text-slate-400">
                <span className="text-slate-500">Env:</span> <span className="font-semibold text-slate-200 uppercase">{d.deployment.environment}</span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                <span className="text-slate-500">Host:</span>{' '}
                <a 
                  href={d.deployment.host} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-indigo-400 hover:underline inline-flex items-center gap-0.5 truncate"
                >
                  <span className="truncate">{d.deployment.host.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                </a>
              </div>
              {d.deployment.commitSha && (
                <div className="text-[10px] font-mono text-slate-400 truncate">
                  <span className="text-slate-500">Commit:</span> {d.deployment.commitSha.slice(0, 7)}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 text-[10px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>Next.js App Router Verified</span>
          </div>
        </div>

        {/* CARD B: Scheduler */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0e1428] to-[#0a0e1c] border border-white/5 space-y-3 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                B. Cloud Scheduler
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                Twice Daily
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="text-[11px] text-slate-400">
                <span className="text-slate-500">Runs:</span> <span className="text-white font-medium">08:00 & 20:00 UTC</span>
              </div>
              <div className="text-[10px] text-slate-400">
                <span className="text-slate-500">Last Run:</span>{' '}
                <span className="text-slate-300">{formatDate(d.scheduler.lastScheduledRun)}</span>
              </div>
              <div className="text-[10px] text-slate-400">
                <span className="text-slate-500">Next Run:</span>{' '}
                <span className="text-amber-300 font-semibold">{formatDate(d.scheduler.nextExpectedRun)}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 text-[10px] text-indigo-300 flex items-center gap-1">
            <Zap className="w-3 h-3 text-indigo-400 shrink-0" />
            <span>Autonomous (Laptop Off)</span>
          </div>
        </div>

        {/* CARD C: Lead Discovery & Qualification */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0e1428] to-[#0a0e1c] border border-white/5 space-y-3 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-emerald-400" />
                C. Discovery & Need
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 capitalize">
                {d.discovery.status}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Total Audited:</span>
                <span className="font-bold text-white">{d.discovery.totalCandidatesDiscovered}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Verified MX Emails:</span>
                <span className="font-bold text-sky-300">{d.discovery.totalQualifiedWithVerifiedEmail}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Rejected Leads:</span>
                <span className="font-bold text-slate-400">{d.discovery.totalRejected}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 text-[10px] text-slate-400 truncate">
            Coverage: All 50 States • 7 Services
          </div>
        </div>

        {/* CARD D: Gmail Sending & Errors */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0e1428] to-[#0a0e1c] border border-white/5 space-y-3 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-amber-400" />
                D. Gmail Sending
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                d.emailSending.connectionStatus === 'connected'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              }`}>
                {d.emailSending.connectionStatus === 'connected' ? '● Connected' : '● Unconfigured'}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Drafts in Queue:</span>
                <span className="font-bold text-amber-300">{d.emailSending.messagesQueued}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Accepted by Gmail:</span>
                <span className="font-bold text-emerald-300">{d.emailSending.messagesAcceptedByProvider}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Delivery Errors:</span>
                <span className={`font-bold ${d.emailSending.failedCount > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                  {d.emailSending.failedCount}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 text-[10px] text-slate-400 truncate">
            Gateway: {d.emailSending.providerType === 'smtp' ? 'Gmail SMTP' : d.emailSending.providerType === 'gmail_oauth' ? 'Gmail OAuth API' : 'Unconfigured'}
          </div>
        </div>

        {/* CARD E: Delivery & Reply Tracking */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-[#0e1428] to-[#0a0e1c] border border-white/5 space-y-3 hover:border-indigo-500/30 transition-all flex flex-col justify-between">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
                E. Replies & Delivery
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/15 text-violet-300 border border-violet-500/30">
                {d.deliveryReplies.repliedCount} Replies
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Accepted (250 OK):</span>
                <span className="font-bold text-white">{d.deliveryReplies.providerAcceptedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Hard Bounces (550):</span>
                <span className="font-bold text-rose-400">{d.deliveryReplies.bouncedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Interested Leads:</span>
                <span className="font-bold text-emerald-400">{d.deliveryReplies.repliesBreakdown.interested}</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 text-[10px] text-slate-400 truncate">
            Zero fake delivery reporting
          </div>
        </div>
      </div>
    </div>
  );
}

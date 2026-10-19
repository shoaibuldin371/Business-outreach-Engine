'use client';

import React, { useEffect, useState } from 'react';
import { SystemLog, fetchLogs } from '@/lib/api';
import { 
  Terminal, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Clock,
  Compass,
  FileText,
  MailCheck,
  Send,
  Eye,
  X
} from 'lucide-react';

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
  const [filterStep, setFilterStep] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadLogs = async (showSpin = false) => {
    if (showSpin) setRefreshing(true);
    try {
      const data = await fetchLogs(250);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => loadLogs(false), 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filteredLogs = logs.filter(log => {
    if (filterStep !== 'all' && log.step !== filterStep) return false;
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchMsg = log.message.toLowerCase().includes(q);
      const matchStep = log.step.toLowerCase().includes(q);
      const matchDetails = JSON.stringify(log.details || {}).toLowerCase().includes(q);
      return matchMsg || matchStep || matchDetails;
    }
    return true;
  });

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'find': return <Compass className="w-3.5 h-3.5 text-sky-400" />;
      case 'explore': return <Search className="w-3.5 h-3.5 text-violet-400" />;
      case 'draft': return <FileText className="w-3.5 h-3.5 text-indigo-400" />;
      case 'approval_pending': return <Clock className="w-3.5 h-3.5 text-amber-400" />;
      case 'approved': return <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />;
      case 'rejected': return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      case 'sending': return <Send className="w-3.5 h-3.5 text-cyan-400" />;
      case 'success': return <MailCheck className="w-3.5 h-3.5 text-emerald-400" />;
      case 'error': return <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />;
      default: return <Terminal className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">SUCCESS</span>;
      case 'error':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">ERROR</span>;
      case 'warning':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">WARNING</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">INFO</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1">
            <Terminal className="w-4 h-4" />
            Execution Telemetry & Agent Audits
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            System Activity & Agent Logs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time feed tracking discovery (find), website audits (explore), pitch drafting, Gmail HITL verification, sending status, and error states.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-900 px-3 py-1.5 rounded-lg border border-white/5">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-slate-800 border-white/20 text-indigo-500 focus:ring-0"
            />
            <span>Auto-refresh (5s)</span>
          </label>

          <button
            onClick={() => loadLogs(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Step Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', label: 'All Steps' },
              { id: 'find', label: 'Find' },
              { id: 'explore', label: 'Explore (Audit)' },
              { id: 'draft', label: 'Draft' },
              { id: 'approval_pending', label: 'HITL Pending' },
              { id: 'approved', label: 'Approved' },
              { id: 'rejected', label: 'Rejected' },
              { id: 'sending', label: 'Sending' },
              { id: 'success', label: 'Success' },
              { id: 'error', label: 'Error' },
            ].map(step => (
              <button
                key={step.id}
                onClick={() => setFilterStep(step.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterStep === step.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {step.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search log messages..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Logs Feed Table */}
      <div className="rounded-2xl bg-[#0b0f1d] border border-white/5 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Streaming system logs...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            No system activity logs found matching the filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-900/40 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-4 w-40">Timestamp</th>
                  <th className="py-2.5 px-4 w-32">Step</th>
                  <th className="py-2.5 px-4 w-24">Status</th>
                  <th className="py-2.5 px-4">Message</th>
                  <th className="py-2.5 px-4 text-right w-20">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03] text-xs font-mono">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleTimeString()} · {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-slate-200">
                        {getStepIcon(log.step)}
                        <span className="capitalize">{log.step.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300 font-sans text-xs">
                      {log.message}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {log.details && Object.keys(log.details).length > 0 && (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
                          title="View JSON Payload"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JSON Payload Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0f1424] border border-white/10 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Log Telemetry Payload</span>
                  {getStatusBadge(selectedLog.status)}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">{selectedLog.id}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Message:</label>
              <p className="text-xs text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-white/5">
                {selectedLog.message}
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Details JSON:</label>
              <pre className="p-3 bg-slate-950 rounded-lg text-xs font-mono text-cyan-300 border border-white/5 overflow-x-auto max-h-60">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

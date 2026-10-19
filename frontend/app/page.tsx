'use client';

import React, { useEffect, useState } from 'react';
import { 
  Lead, 
  Stats, 
  fetchLeads, 
  fetchStats, 
  triggerDiscovery 
} from '@/lib/api';
import LeadModal from '@/components/LeadModal';
import Link from 'next/link';
import { 
  Building2, 
  AlertTriangle, 
  Clock, 
  XCircle, 
  CheckCircle2, 
  Send, 
  Search, 
  Sparkles, 
  Filter, 
  ChevronRight,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Play
} from 'lucide-react';

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('pending_approval');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Discovery Controls
  const [category, setCategory] = useState('dentists');
  const [city, setCity] = useState('Dallas, TX');

  const loadData = async () => {
    try {
      const [leadsData, statsData] = await Promise.all([
        fetchLeads(activeFilter),
        fetchStats(),
      ]);
      setLeads(leadsData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000); // 8-second polling for live updates
    return () => clearInterval(interval);
  }, [activeFilter]);

  const handleTriggerDiscovery = async () => {
    setDiscovering(true);
    setNotification(null);
    try {
      const res = await triggerDiscovery(category, city, 5);
      setNotification({
        type: 'success',
        message: `✓ Discovery Cycle Executed! ${res.leads_qualified || 0} businesses without website saved to Supabase and dispatched for HITL verification.`
      });
      await loadData();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: `Agent execution failed: ${err.message}`
      });
    } finally {
      setDiscovering(false);
    }
  };

  const filteredLeads = leads.filter(l => {
    const q = searchQuery.toLowerCase();
    return (
      l.business_name.toLowerCase().includes(q) ||
      (l.city && l.city.toLowerCase().includes(q)) ||
      (l.category && l.category.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Banner / Notification */}
      {notification && (
        <div className={`p-4 rounded-xl text-sm font-medium border flex items-center justify-between ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="text-xs underline ml-4 opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Mission Statement */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Automated Prospecting Engine
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Local Business Outreach Pipeline
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Scanning 5 businesses every 3 hours • Filtering missing websites • Gmail Human-In-The-Loop approval • Custom email dispatch.
          </p>
        </div>

        {/* Discovery Action Bar */}
        <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-wrap items-center gap-2 shadow-xl">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Niche (e.g. dentists)"
            className="px-3 py-1.5 text-xs bg-slate-950/80 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 w-28"
          />
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (e.g. Dallas, TX)"
            className="px-3 py-1.5 text-xs bg-slate-950/80 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 w-32"
          />
          <button
            onClick={handleTriggerDiscovery}
            disabled={discovering}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
            {discovering ? 'Auditing 5 Businesses...' : 'Scan 5 Businesses Now'}
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/5 space-y-1">
          <span className="text-xs font-medium text-slate-400">Total Businesses</span>
          <div className="text-2xl font-bold text-white">{stats?.total_leads || 0}</div>
          <div className="text-[11px] text-slate-400">Audited in Supabase</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0e1322] border border-rose-500/20 space-y-1">
          <span className="text-xs font-medium text-rose-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> No Website
          </span>
          <div className="text-2xl font-bold text-rose-300">{stats?.no_website_count || 0}</div>
          <div className="text-[11px] text-slate-400">Prime web revamp leads</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0e1322] border border-amber-500/20 space-y-1">
          <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Pending Review
          </span>
          <div className="text-2xl font-bold text-amber-300">{stats?.pending_approval || 0}</div>
          <div className="text-[11px] text-slate-400">Awaiting Gmail approval</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0e1322] border border-rose-400/20 space-y-1">
          <span className="text-xs font-medium text-rose-400 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> Rejected Drafts
          </span>
          <div className="text-2xl font-bold text-rose-400">{stats?.rejected_count || 0}</div>
          <div className="text-[11px] text-slate-400">Custom email ready</div>
        </div>

        <Link href="/completed" className="p-5 rounded-2xl bg-[#0e1322] border border-emerald-500/20 space-y-1 block hover:bg-emerald-500/[0.04] transition-all group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Completed Outreach
            </span>
            <span className="text-[10px] font-semibold text-emerald-400 opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
              View Feature ➔
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-300">{stats?.sent_count || 0}</div>
          <div className="text-[11px] text-slate-400">Pitches sent & archived</div>
        </Link>
      </div>

      {/* Main Content Area */}
      <div className="p-6 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-6">
        {/* Filters & Search Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'pending_approval', label: `Active Queue (${stats?.pending_approval || 0})` },
              { id: 'rejected', label: `Rejected (${stats?.rejected_count || 0})` },
              { id: 'completed', label: `Completed & Sent (${stats?.sent_count || 0})` },
              { id: 'all', label: 'All Archive' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  activeFilter === tab.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search business or city..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Leads Table */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading pipeline leads...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-3">
            <p className="text-sm text-slate-300 font-medium">
              {activeFilter === 'pending_approval' 
                ? 'All caught up! No leads are currently pending review.'
                : 'No leads match the current filter.'}
            </p>
            <p className="max-w-md mx-auto">
              {activeFilter === 'pending_approval'
                ? 'Approved leads automatically move to the Completed feature. Click "Scan 5 Businesses Now" to fetch more leads, or check the Completed Outreach page.'
                : 'Click "Scan 5 Businesses Now" above to trigger discovery cycle immediately.'}
            </p>
            {stats && stats.sent_count > 0 && activeFilter === 'pending_approval' && (
              <Link
                href="/completed"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                View {stats.sent_count} Completed Pitches
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Business</th>
                  <th className="py-3 px-4">Website Signal</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Outreach Status</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {filteredLeads.map((lead) => {
                  const isRejected = lead.status === 'rejected';
                  const isPending = lead.status === 'pending_approval';
                  const isSent = lead.status === 'sent' || lead.status === 'approved';

                  return (
                    <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors group">
                      {/* Business */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                          {lead.business_name}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{lead.category || 'Local Service'}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {lead.city}</span>
                        </div>
                      </td>

                      {/* Website Signal */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          !lead.website || lead.website_status?.includes('No website') || lead.website_status?.includes('Unreachable')
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          <AlertTriangle className="w-3 h-3" />
                          {lead.website_status || 'No Website'}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{lead.phone || 'No phone'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 truncate max-w-[180px]">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{lead.email || 'No email'}</span>
                        </div>
                      </td>

                      {/* Outreach Status */}
                      <td className="py-3.5 px-4">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock className="w-3 h-3" /> Pending Gmail Review
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <XCircle className="w-3 h-3" /> Draft Rejected
                          </span>
                        )}
                        {isSent && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Pitch Delivered
                          </span>
                        )}
                      </td>

                      {/* Score */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-200">
                          {lead.score || 85}
                        </span>
                        <span className="text-[10px] text-slate-400">/100</span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {isRejected ? (
                          <Link
                            href={`/custom-email?lead_id=${lead.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/20 transition-all"
                          >
                            <Send className="w-3 h-3" />
                            Send Custom Email
                          </Link>
                        ) : (
                          <button
                            onClick={() => setSelectedLead(lead)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                          >
                            Review Pitch
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review & Approval Modal */}
      <LeadModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onActionComplete={loadData}
      />
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { Lead, fetchLeads, Stats, fetchStats } from '@/lib/api';
import Link from 'next/link';
import { 
  CheckCheck, 
  Mail, 
  Search, 
  Send, 
  Sparkles, 
  ArrowLeft,
  Building2,
  Calendar,
  Eye,
  CheckCircle2,
  Phone,
  MapPin,
  RefreshCw,
  X
} from 'lucide-react';

export default function CompletedOutreachPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const loadCompletedLeads = async () => {
    try {
      const [data, statsData] = await Promise.all([
        fetchLeads('completed'),
        fetchStats(),
      ]);
      setLeads(data);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load completed leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompletedLeads();
    const interval = setInterval(loadCompletedLeads, 10000);
    return () => clearInterval(interval);
  }, []);

  const filtered = leads.filter(l => {
    const q = searchQuery.toLowerCase();
    return (
      l.business_name.toLowerCase().includes(q) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.city && l.city.toLowerCase().includes(q)) ||
      (l.category && l.category.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <CheckCheck className="w-4 h-4 text-emerald-400" />
            <span>Completed Outreach Archive</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex flex-wrap items-center gap-2 sm:gap-3">
            <span>Delivered Pitches & Outreach</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
              {leads.length} Approved & Sent
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Once a lead is approved and the proposal is sent, it is automatically archived here so your active prospecting pipeline stays clean.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Active Pipeline</span>
          </Link>
          <button
            onClick={loadCompletedLeads}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition-colors"
            title="Refresh Completed List"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1322] border border-emerald-500/20 space-y-1">
          <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Delivered Pitches
          </span>
          <div className="text-xl sm:text-2xl font-bold text-white">{leads.length}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400">Sent to prospects</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1322] border border-white/5 space-y-1">
          <span className="text-xs font-medium text-slate-400">Active Queue</span>
          <div className="text-xl sm:text-2xl font-bold text-amber-300">{stats?.pending_approval || 0}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400">Waiting approval</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1322] border border-white/5 space-y-1">
          <span className="text-xs font-medium text-slate-400">Audited Businesses</span>
          <div className="text-xl sm:text-2xl font-bold text-white">{stats?.total_leads || 0}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400">In database</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1322] border border-white/5 space-y-1">
          <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Delivery Channel
          </span>
          <div className="text-xs sm:text-sm font-bold text-slate-200 truncate">Gmail API (Verified)</div>
          <div className="text-[10px] sm:text-[11px] text-emerald-400 truncate">● MX Pre-flight Guard Active</div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span>Delivered Proposals ({filtered.length})</span>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search business, city, email..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading completed outreach records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 sm:py-16 text-center text-slate-400 text-xs space-y-3 px-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
              <Mail className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-300 font-medium">No completed pitches yet.</p>
            <p className="max-w-md mx-auto text-slate-400">
              Once you click <strong>Approve</strong> in Gmail or on the active dashboard, the email is automatically sent to the business and will appear in this Completed section!
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all"
            >
              Go to Active Pipeline
            </Link>
          </div>
        ) : (
          <>
            {/* 1. Mobile Phone View: Clean Responsive Cards (Zero Horizontal Sliding) */}
            <div className="block md:hidden space-y-3">
              {filtered.map((lead) => (
                <div
                  key={lead.id}
                  className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-3 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-white text-sm flex items-center gap-1.5 truncate">
                        <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="truncate">{lead.business_name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400 flex-wrap">
                        {lead.category && (
                          <span className="capitalize px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5">
                            {lead.category}
                          </span>
                        )}
                        {lead.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {lead.city}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                      <CheckCheck className="w-3 h-3" />
                      Delivered
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-1">
                    <div className="text-xs text-slate-200 font-mono flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{lead.email || 'No email on record'}</span>
                    </div>
                    {lead.email_subject && (
                      <div className="text-[11px] text-slate-400 truncate">
                        {lead.email_subject}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>
                        {lead.last_contacted_at 
                          ? new Date(lead.last_contacted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : new Date(lead.created_at || Date.now()).toLocaleDateString()
                        }
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                    <button
                      onClick={() => setSelectedLead(lead)}
                      className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Pitch
                    </button>
                    <Link
                      href={`/custom-email?leadId=${lead.id}&mode=followup`}
                      className="w-full py-2 px-3 rounded-lg text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Follow-Up
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. Desktop View: Perfectly Aligned Fixed Table with ZERO Horizontal Sliding */}
            <div className="hidden md:block w-full">
              <table className="w-full table-fixed text-left text-xs text-slate-300">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[28%]" />
                  <col className="w-[15%]" />
                  <col className="w-[14%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/5">
                  <tr>
                    <th className="py-3 px-4">Business Details</th>
                    <th className="py-3 px-4">Recipient Email & Pitch</th>
                    <th className="py-3 px-4">Status & Proof</th>
                    <th className="py-3 px-4">Date Contacted</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((lead) => (
                    <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 truncate">
                        <div className="font-semibold text-white text-sm flex items-center gap-1.5 truncate">
                          <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span className="truncate">{lead.business_name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-slate-400 text-[11px] truncate">
                          {lead.category && <span className="capitalize">{lead.category}</span>}
                          {lead.city && <span>• {lead.city}</span>}
                          {lead.phone && <span>• {lead.phone}</span>}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 truncate">
                        <div className="font-mono text-slate-200 text-xs flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{lead.email || 'No direct email'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {lead.email_subject || 'Outreach Pitch'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <CheckCheck className="w-3 h-3 shrink-0" />
                          <span>Pitch Delivered</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-400 text-xs">
                        <div className="flex items-center gap-1.5 truncate">
                          <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {lead.last_contacted_at 
                              ? new Date(lead.last_contacted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : new Date(lead.created_at || Date.now()).toLocaleDateString()
                            }
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedLead(lead)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors flex items-center gap-1"
                            title="View delivered email pitch"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                          <Link
                            href={`/custom-email?leadId=${lead.id}&mode=followup`}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors flex items-center gap-1"
                            title="Compose follow up"
                          >
                            <Send className="w-3 h-3" />
                            <span>Follow-Up</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal for viewing the delivered pitch (Mobile Responsive) */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0e1322] border border-white/10 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between shrink-0">
              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Delivered Pitch
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {selectedLead.last_contacted_at ? new Date(selectedLead.last_contacted_at).toLocaleString() : ''}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mt-1 truncate">
                  {selectedLead.business_name}
                </h3>
                <p className="text-xs text-slate-400 truncate">
                  Recipient: <span className="text-slate-200 font-mono">{selectedLead.email}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5 shrink-0">
              <label className="text-xs font-semibold text-slate-300">Email Subject</label>
              <div className="p-2.5 sm:p-3 bg-slate-950/80 border border-white/10 rounded-xl text-xs font-medium text-slate-200 break-words">
                {selectedLead.email_subject}
              </div>
            </div>

            <div className="space-y-1.5 flex-1 min-h-0 flex flex-col">
              <label className="text-xs font-semibold text-slate-300">Delivered Pitch Body</label>
              <div className="p-3 sm:p-4 bg-slate-950/80 border border-white/10 rounded-xl text-xs leading-relaxed text-slate-300 font-mono whitespace-pre-wrap overflow-y-auto flex-1">
                {selectedLead.email_body}
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/5 shrink-0">
              <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                Sender: Muhammad Shoaib (Mshoaibawan371@gmail.com)
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Link
                  href={`/custom-email?leadId=${selectedLead.id}&mode=followup`}
                  className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Follow-Up
                </Link>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="px-3 sm:px-4 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

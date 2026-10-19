'use client';

import React, { useEffect, useState } from 'react';
import { Lead, fetchLeads, Stats, fetchStats } from '@/lib/api';
import Link from 'next/link';
import { 
  CheckCheck, 
  Mail, 
  Clock, 
  Search, 
  ExternalLink, 
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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <CheckCheck className="w-4 h-4 text-emerald-400" />
            <span>Completed Outreach Archive</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Delivered Pitches & Successful Outreach
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold">
              {leads.length} Approved & Sent
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Once a lead is approved and the proposal is sent, it is automatically archived here so your active prospecting pipeline stays clean.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Active Pipeline
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

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#0e1322] border border-emerald-500/20 space-y-1">
          <span className="text-xs font-medium text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Delivered Pitches
          </span>
          <div className="text-2xl font-bold text-white">{leads.length}</div>
          <div className="text-[11px] text-slate-400">Sent to prospects</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/5 space-y-1">
          <span className="text-xs font-medium text-slate-400">Active Queue Remaining</span>
          <div className="text-2xl font-bold text-amber-300">{stats?.pending_approval || 0}</div>
          <div className="text-[11px] text-slate-400">Waiting for approval</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/5 space-y-1">
          <span className="text-xs font-medium text-slate-400">Total Businesses Audited</span>
          <div className="text-2xl font-bold text-white">{stats?.total_leads || 0}</div>
          <div className="text-[11px] text-slate-400">In Supabase database</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/5 space-y-1">
          <span className="text-xs font-medium text-indigo-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Outreach Sender
          </span>
          <div className="text-sm font-bold text-slate-200 truncate">Muhammad Shoaib</div>
          <div className="text-[11px] text-slate-400 truncate">Mshoaibawan371@gmail.com</div>
        </div>
      </div>

      {/* Main Table / Feed */}
      <div className="p-6 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span>Delivered Proposals ({filtered.length})</span>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by business, city, email..."
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
          <div className="py-16 text-center text-slate-400 text-xs space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
              <Mail className="w-6 h-6" />
            </div>
            <p className="text-sm text-slate-300 font-medium">No completed pitches yet.</p>
            <p className="max-w-md mx-auto">
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-white/5">
                <tr>
                  <th className="py-3 px-4">Business Details</th>
                  <th className="py-3 px-4">Recipient Email</th>
                  <th className="py-3 px-4">Status & Proof</th>
                  <th className="py-3 px-4">Date Contacted</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-semibold text-white text-sm flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                        {lead.business_name}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-slate-400">
                        {lead.category && <span className="capitalize">{lead.category}</span>}
                        {lead.city && <span>• {lead.city}</span>}
                        {lead.phone && <span>• {lead.phone}</span>}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-mono text-slate-200 text-xs flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-emerald-400" />
                        {lead.email || 'No direct email'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                        {lead.email_subject || 'Outreach Pitch'}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <CheckCheck className="w-3 h-3" />
                        Pitch Delivered
                      </span>
                    </td>

                    <td className="py-4 px-4 text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {lead.last_contacted_at 
                          ? new Date(lead.last_contacted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : new Date(lead.created_at || Date.now()).toLocaleDateString()
                        }
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View Pitch
                        </button>
                        <Link
                          href={`/custom-email?leadId=${lead.id}&mode=followup`}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors flex items-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          Follow-Up
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for viewing the delivered pitch */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1322] border border-white/10 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Delivered Pitch
                  </span>
                  <span className="text-xs text-slate-400">
                    {selectedLead.last_contacted_at ? new Date(selectedLead.last_contacted_at).toLocaleString() : ''}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  {selectedLead.business_name}
                </h3>
                <p className="text-xs text-slate-400">
                  Recipient: <span className="text-slate-200 font-mono">{selectedLead.email}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Email Subject</label>
              <div className="p-3 bg-slate-950/80 border border-white/10 rounded-xl text-xs font-medium text-slate-200">
                {selectedLead.email_subject}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Delivered Pitch Body</label>
              <div className="p-4 bg-slate-950/80 border border-white/10 rounded-xl text-xs leading-relaxed text-slate-300 font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
                {selectedLead.email_body}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-white/5">
              <div className="text-[11px] text-slate-400">
                Sender: Muhammad Shoaib (Mshoaibawan371@gmail.com)
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/custom-email?leadId=${selectedLead.id}&mode=followup`}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Compose Follow-Up Email
                </Link>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
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

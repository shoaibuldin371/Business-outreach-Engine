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
import DatabaseSettingCard from '@/components/DatabaseSettingCard';
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
  MapPin, 
  Phone, 
  Mail, 
  Globe2, 
  RefreshCw,
  Compass,
  ArrowRight,
  Zap,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Layers,
  Database
} from 'lucide-react';

const HIGH_GROWTH_SHOWCASE = [
  { label: 'Med Spas & Aesthetics', icon: '💉' },
  { label: 'Solar & Clean Energy', icon: '⚡' },
  { label: 'Luxury Custom Builders', icon: '🏡' },
  { label: 'Commercial HVAC', icon: '❄️' },
  { label: 'Boutique Law Firms', icon: '⚖️' },
  { label: 'Cosmetic Orthodontics', icon: '🦷' },
  { label: 'Exotic Auto Detailing', icon: '🏎️' },
  { label: 'Commercial Roofing', icon: '🏢' },
  { label: 'Veterinary Hospitals', icon: '🐾' },
];

const QUICK_WORLDWIDE_PRESETS = [
  { label: '🌍 Worldwide Auto-Rotate', city: '', category: '' },
  { label: '🇬🇧 London, UK', city: 'London, United Kingdom', category: 'cosmetic dentistry & orthodontics' },
  { label: '🇺🇸 New York, US', city: 'New York, NY', category: 'commercial roofing & restoration' },
  { label: '🇨🇦 Toronto, CA', city: 'Toronto, ON', category: 'luxury custom home builders' },
  { label: '🇦🇺 Sydney, AU', city: 'Sydney, Australia', category: 'commercial hvac & refrigeration contractors' },
  { label: '🇦🇪 Dubai, UAE', city: 'Dubai, UAE', category: 'aesthetic clinics & med spas' },
  { label: '🇺🇸 Los Angeles, US', city: 'Los Angeles, CA', category: 'boutique corporate & ip law firms' },
];

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Optional manual override (collapsed by default for 100% autonomous operation)
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');

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
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [activeFilter]);

  const handleTriggerDiscovery = async (overrideCity?: string, overrideCategory?: string) => {
    setDiscovering(true);
    setNotification(null);
    try {
      const targetCity = overrideCity !== undefined ? overrideCity : city;
      const targetCategory = overrideCategory !== undefined ? overrideCategory : category;

      const res = await triggerDiscovery(targetCategory || undefined, targetCity || undefined, 5);
      setNotification({
        type: 'success',
        message: `✓ Autopilot Cycle Finished! Discovered & audited high-growth businesses in worldwide hub (${res.leads_qualified || 0} qualified, no-website leads pushed to Supabase).`
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
    if (!l) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (l.business_name || '').toLowerCase().includes(q) ||
      (l.city || '').toLowerCase().includes(q) ||
      (l.category || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.phone || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto w-full">
      {/* 100% Autonomous Autopilot Banner & Controls */}
      <div className="bg-gradient-to-br from-[#0e1428] via-[#0b0f1e] to-[#070a14] p-5 sm:p-6 rounded-3xl border border-indigo-500/20 shadow-2xl relative overflow-hidden space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Autopilot Information & High-Growth Sectors */}
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>100% Autonomous Autopilot Active • 3-Hour Cycle</span>
            </div>
            
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Worldwide High-Growth Business Prospecting
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Targeting <span className="text-white font-medium">35+ high-growth sectors</span> across <span className="text-white font-medium">35+ global economic hubs</span> (US, UK, Canada, Australia, UAE, Europe). The autonomous agent continuously audits local businesses without websites, verifies contact emails, and prepares 1-click Gmail HITL approval. <span className="text-indigo-400 font-medium">Zero typing or manual work required!</span>
            </p>

            {/* High-Growth Industry Showcase Pills */}
            <div className="pt-1">
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>Auto-Rotating High-Growth Sectors:</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {HIGH_GROWTH_SHOWCASE.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-slate-300 hover:border-indigo-500/30 transition-colors"
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Autopilot Action Box (1-Click Run, No Typing Needed) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-indigo-500/20 flex flex-col gap-3 shadow-2xl shrink-0 w-full lg:w-80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Autonomous Scheduler
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ● 24/7 Online
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal">
              Cloud automation automatically runs every 3 hours. Click below to trigger the next auto-rotation cycle immediately without writing anything.
            </p>

            {/* Big Instant 1-Click Run Button */}
            <button
              onClick={() => handleTriggerDiscovery('', '')}
              disabled={discovering}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-500/30 transition-all disabled:opacity-50 active:scale-[0.99]"
            >
              <Sparkles className={`w-4 h-4 ${discovering ? 'animate-spin' : ''}`} />
              <span>{discovering ? 'Auditing Next Global Hub...' : '⚡ Run Instant Autopilot Cycle'}</span>
            </button>

            <div className="text-[10px] text-center text-slate-400">
              Auto-selects next high-growth niche & worldwide city
            </div>

            {/* Optional Collapsible Manual Override Toggle */}
            <div className="pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setShowManualOverride(!showManualOverride)}
                className="w-full flex items-center justify-between text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors py-1"
              >
                <span className="flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
                  <span>Custom Target Override (Optional)</span>
                </span>
                {showManualOverride ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Manual Override Drawer (Hidden by default so user doesn't have to write anything) */}
        {showManualOverride && (
          <div className="pt-4 border-t border-white/10 space-y-3 bg-black/20 p-4 rounded-2xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                Custom City or Category Override (For Specific Testing Only)
              </span>
              <button
                onClick={() => {
                  setCity('');
                  setCategory('');
                }}
                className="text-[11px] text-indigo-400 hover:underline"
              >
                Reset to Worldwide Auto
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                placeholder="Specific Niche (e.g. Med Spas, Commercial HVAC)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-950 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 w-full sm:w-64"
              />
              <input
                type="text"
                placeholder="Specific City (e.g. Dubai, London, New York)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-950 border border-white/10 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500 w-full sm:w-64"
              />
              <button
                onClick={() => handleTriggerDiscovery()}
                disabled={discovering}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 shrink-0"
              >
                Scan Specific Target
              </button>
            </div>

            {/* Quick Presets inside Drawer */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-slate-400 mr-1 flex items-center gap-1">
                <Globe2 className="w-3 h-3 text-indigo-400" /> Quick Hubs:
              </span>
              {QUICK_WORLDWIDE_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCity(preset.city);
                    setCategory(preset.category);
                  }}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                    city === preset.city && category === preset.category
                      ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/5'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {notification && (
        <div className={`p-4 rounded-2xl text-xs sm:text-sm font-medium border flex items-center justify-between ${
          notification.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="underline text-xs ml-3">Dismiss</button>
        </div>
      )}

      {/* Database Engine & Central Store Settings */}
      <DatabaseSettingCard initialTelemetry={stats?.database} />

      {/* KPI Stats Grid (Fully responsive on phone & tablet) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1322] border border-white/5 space-y-1">
          <span className="text-xs font-medium text-slate-400">Total Audited</span>
          <div className="text-xl sm:text-2xl font-bold text-white">{stats?.total_leads || 0}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400">Stored in Supabase</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1322] border border-indigo-500/30 space-y-1 bg-indigo-500/[0.04]">
          <span className="text-xs font-medium text-indigo-400 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>Active Pipelines</span>
          </span>
          <div className="text-xl sm:text-2xl font-bold text-indigo-300">
            {stats?.active_pipelines_count ?? ((stats?.pending_approval || 0) + (stats?.missing_contact_count || 0))}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400">Active prospect funnel</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1322] border border-amber-500/20 space-y-1">
          <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Email Ready</span>
          </span>
          <div className="text-xl sm:text-2xl font-bold text-amber-300">{stats?.pending_approval || 0}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400">1-click pitch review</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-[#0e1322] border border-sky-500/20 space-y-1">
          <span className="text-xs font-medium text-sky-400 flex items-center gap-1">
            <Phone className="w-3.5 h-3.5 shrink-0" />
            <span>Needs Contact</span>
          </span>
          <div className="text-xl sm:text-2xl font-bold text-sky-300">{stats?.missing_contact_count || 0}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400">Phone & address verified</div>
        </div>

        <Link
          href="/completed"
          className="col-span-2 sm:col-span-1 p-4 sm:p-5 rounded-2xl bg-[#0e1322] border border-emerald-500/20 space-y-1 block hover:bg-emerald-500/[0.04] transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Completed</span>
            </span>
            <span className="text-[10px] font-semibold text-emerald-400 opacity-80 group-hover:opacity-100 flex items-center gap-0.5">
              View ➔
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-300">{stats?.sent_count || 0}</div>
          <div className="text-[10px] sm:text-[11px] text-slate-400">Pitches sent & archived</div>
        </Link>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-5">
        {/* Filters & Search Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: 'active', label: `🚀 Active Pipelines (${stats?.active_pipelines_count ?? ((stats?.pending_approval || 0) + (stats?.missing_contact_count || 0))})` },
              { id: 'pending_approval', label: `✉️ Email Ready (${stats?.pending_approval || 0})` },
              { id: 'missing_contact', label: `📞 Needs Contact (${stats?.missing_contact_count || 0})` },
              { id: 'rejected', label: `❌ Rejected (${stats?.rejected_count || 0})` },
              { id: 'completed', label: `✅ Completed (${stats?.sent_count || 0})` },
              { id: 'all', label: `🗄️ All Records (${stats?.total_leads || 0})` },
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

          <div className="relative w-full sm:w-64">
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

        {/* Leads Table & Mobile Card View */}
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            Loading pipeline leads...
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="py-12 sm:py-16 text-center text-slate-400 text-xs space-y-3 px-4">
            <p className="text-sm text-slate-300 font-medium">
              {activeFilter === 'active'
                ? 'Your active pipeline is currently ready for prospects. Click "Scan 5 Businesses Now" to fetch verified local businesses worldwide!'
                : activeFilter === 'pending_approval' 
                ? 'All caught up! No leads are currently pending review in this queue.'
                : activeFilter === 'missing_contact'
                ? 'No leads currently pending contact details.'
                : 'No leads match the current filter.'}
            </p>
            <p className="max-w-md mx-auto text-slate-400">
              Approved pitches automatically archive to the Completed feature. Click "Scan 5 Businesses Now" to trigger live discovery immediately.
            </p>
            {stats && stats.sent_count > 0 && (
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
          <>
            {/* 1. Mobile Phone View: Clean Cards (Zero Horizontal Sliding) */}
            <div className="block md:hidden space-y-3">
              {filteredLeads.map((lead) => {
                const isRejected = lead.status === 'rejected';
                const isPending = lead.status === 'pending_approval' || lead.status === 'draft_ready';
                const isSent = lead.status === 'sent' || lead.status === 'approved';
                const isMissingContact = lead.status === 'missing_contact' || (!lead.email && !isSent && !isRejected);

                return (
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
                          <span className="capitalize px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/5">
                            {lead.category || 'Local Business'}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {lead.city}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-200">
                          {lead.score || 85}
                        </span>
                        <span className="text-[10px] text-slate-400">/100</span>
                      </div>
                    </div>

                    {/* Website Signal */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        !lead.website || lead.website_status?.includes('No website') || lead.website_status?.includes('Unreachable')
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        <AlertTriangle className="w-3 h-3" />
                        {lead.website_status || 'No Website'}
                      </span>

                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" /> Pending Review
                        </span>
                      )}
                      {isMissingContact && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          <Phone className="w-3 h-3" /> Phone Active (Needs Email)
                        </span>
                      )}
                      {isRejected && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                      {isSent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Pitch Sent
                        </span>
                      )}
                    </div>

                    {/* Contact snippet */}
                    <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-1 text-xs text-slate-300">
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate font-mono">{lead.email || 'No email on file'}</span>
                      </div>
                      {lead.phone && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <a href={`tel:${lead.phone}`} className="hover:underline text-slate-300">{lead.phone}</a>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="pt-1 border-t border-white/5">
                      {isRejected ? (
                        <Link
                          href={`/custom-email?lead_id=${lead.id}`}
                          className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Send Custom Email
                        </Link>
                      ) : (
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                            isMissingContact
                              ? 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30'
                              : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
                          }`}
                        >
                          {isMissingContact ? 'Review Pitch & Add Email' : 'Review Pitch & Approve'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Desktop View: Perfectly Aligned Fixed Table with ZERO Horizontal Sliding */}
            <div className="hidden md:block w-full">
              <table className="w-full table-fixed text-left text-xs text-slate-300">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[16%]" />
                  <col className="w-[22%]" />
                  <col className="w-[16%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900/60">
                    <th className="py-3 px-4">Business</th>
                    <th className="py-3 px-4">Website Signal</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Outreach Status</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredLeads.map((lead) => {
                    const isRejected = lead.status === 'rejected';
                    const isPending = lead.status === 'pending_approval' || lead.status === 'draft_ready';
                    const isSent = lead.status === 'sent' || lead.status === 'approved';
                    const isMissingContact = lead.status === 'missing_contact' || (!lead.email && !isSent && !isRejected);

                    return (
                      <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors group">
                        {/* Business */}
                        <td className="py-3.5 px-4 truncate">
                          <div className="font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                            {lead.business_name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                            <span>{lead.category || 'Local Service'}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 truncate">
                              <MapPin className="w-3 h-3 shrink-0" /> {lead.city}
                            </span>
                          </div>
                        </td>

                        {/* Website Signal */}
                        <td className="py-3.5 px-4 truncate">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold truncate ${
                            !lead.website || lead.website_status?.includes('No website') || lead.website_status?.includes('Unreachable')
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span className="truncate">{lead.website_status || 'No Website'}</span>
                          </span>
                        </td>

                        {/* Contact */}
                        <td className="py-3.5 px-4 text-slate-300 truncate">
                          <div className="flex items-center gap-1.5 text-xs font-mono truncate">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{lead.email || 'No email on record'}</span>
                          </div>
                          {lead.phone && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 truncate">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <a href={`tel:${lead.phone}`} className="hover:underline text-slate-300 truncate">{lead.phone}</a>
                            </div>
                          )}
                        </td>

                        {/* Outreach Status */}
                        <td className="py-3.5 px-4">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <Clock className="w-3 h-3 shrink-0" /> Pending Review
                            </span>
                          )}
                          {isMissingContact && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                              <Phone className="w-3 h-3 text-sky-400 shrink-0" /> Phone Active (Needs Email)
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <XCircle className="w-3 h-3 shrink-0" /> Draft Rejected
                            </span>
                          )}
                          {isSent && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3 shrink-0" /> Pitch Delivered
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
                        <td className="py-3.5 px-4 text-right">
                          {isRejected ? (
                            <Link
                              href={`/custom-email?lead_id=${lead.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all"
                            >
                              <Send className="w-3 h-3" />
                              Custom
                            </Link>
                          ) : (
                            <button
                              onClick={() => setSelectedLead(lead)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isMissingContact
                                  ? 'text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 font-semibold'
                                  : 'text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10'
                              }`}
                            >
                              {isMissingContact ? 'Review & Enrich' : 'Review'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
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

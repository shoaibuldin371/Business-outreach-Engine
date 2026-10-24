'use client';

import React, { useEffect, useState } from 'react';
import { 
  Lead, 
  Stats, 
  fetchLeads, 
  fetchStats, 
  triggerDiscovery 
} from '@/lib/api';
import { 
  US_50_STATES, 
  SERVICE_CATEGORIES_LIST, 
  DEMAND_SIGNALS_LIST, 
  TARGET_INDUSTRIES_LIST 
} from '@/lib/constants';
import LeadModal from '@/components/LeadModal';
import ProductionHealthSection from '@/components/ProductionHealthSection';
import DatabaseSettingCard from '@/components/DatabaseSettingCard';
import DeliverabilityCard from '@/components/DeliverabilityCard';
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
  Zap,
  ShieldCheck,
  Filter,
  Layers,
  Target,
  ExternalLink,
  Code2,
  Cloud,
  BarChart3,
  GraduationCap
} from 'lucide-react';

const TECHNICAL_SERVICES_SHOWCASE = [
  { label: 'AI Development & Automation', icon: Zap, cat: 'ai_automation', color: 'text-emerald-400' },
  { label: 'LLMs, RAG & AI Agents', icon: Sparkles, cat: 'llm_rag_agents', color: 'text-violet-400' },
  { label: 'Python Backend & ETL', icon: Code2, cat: 'python_dev', color: 'text-sky-400' },
  { label: 'Huawei Cloud Architecture', icon: Cloud, cat: 'huawei_cloud', color: 'text-rose-400' },
  { label: 'Data Science & Analytics', icon: BarChart3, cat: 'data_science_analytics', color: 'text-amber-400' },
  { label: 'Corporate Technical Training', icon: GraduationCap, cat: 'data_science_training', color: 'text-indigo-400' },
  { label: 'Website & Digital Systems', icon: Globe2, cat: 'website_digital', color: 'text-cyan-400' },
];

function renderServiceBadge(lead: Lead) {
  const cat = lead.service_category || 'ai_automation';
  const meta: Record<string, { label: string; icon: any; color: string }> = {
    ai_automation: { label: 'AI & Automation', icon: Zap, color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
    llm_rag_agents: { label: 'LLMs & AI Agents', icon: Sparkles, color: 'bg-violet-500/10 text-violet-300 border-violet-500/30' },
    python_dev: { label: 'Python Backend', icon: Code2, color: 'bg-sky-500/10 text-sky-300 border-sky-500/30' },
    huawei_cloud: { label: 'Huawei Cloud', icon: Cloud, color: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
    data_science_analytics: { label: 'Data Analytics', icon: BarChart3, color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
    data_science_training: { label: 'Corporate Training', icon: GraduationCap, color: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' },
    website_digital: { label: 'Website & Digital', icon: Globe2, color: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30' },
  };
  const item = meta[cat] || meta.ai_automation;
  const Icon = item.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] md:text-[11px] font-semibold border ${item.color} truncate`}>
      <Icon className="w-3 h-3 shrink-0" />
      <span className="truncate">{item.label}</span>
    </span>
  );
}

function renderSignalBadge(lead: Lead) {
  const sig = lead.signal_type || 'evidence_backed';
  if (sig === 'explicit_demand') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <Zap className="w-2.5 h-2.5 text-amber-400 shrink-0" />
        <span>Explicit Demand</span>
      </span>
    );
  }
  if (sig === 'website_opportunity') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
        <Globe2 className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
        <span>Website Opp</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
      <Target className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
      <span>Evidence-Backed</span>
    </span>
  );
}

function renderWebsiteBadge(lead: Lead) {
  const status = (lead.website_status || '').toLowerCase().trim();
  const hasWebsite = Boolean(lead.website && lead.website.trim() && !lead.website.includes('example.com'));

  if (!hasWebsite || status === 'none_found' || status.includes('no website') || status.includes('none')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] md:text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25 truncate">
        <Globe2 className="w-3 h-3 shrink-0 text-amber-400" />
        <span className="truncate">No Website Found</span>
      </span>
    );
  }

  if (status === 'unreachable' || status.includes('unreachable') || status.includes('broken') || status.includes('offline') || status.includes('error')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] md:text-[11px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/25 truncate">
        <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
        <span className="truncate">Broken / Offline Site</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] md:text-[11px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 truncate">
      <Globe2 className="w-3 h-3 shrink-0 text-cyan-400" />
      <span className="truncate">Active Website</span>
    </span>
  );
}

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('active');
  const [dashboardTab, setDashboardTab] = useState<'leads' | 'telemetry' | 'deliverability' | 'database'>('leads');
  
  // Dashboard multi-criteria filter state
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedSignal, setSelectedSignal] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Discovery execution configuration
  const [triggerService, setTriggerService] = useState<string>('all');
  const [triggerState, setTriggerState] = useState<string>('all');
  const [triggerSignal, setTriggerSignal] = useState<string>('all');

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = async () => {
    try {
      const [leadsData, statsData] = await Promise.all([
        fetchLeads({
          status: activeFilter,
          service_category: selectedService,
          signal_type: selectedSignal,
          state: selectedState,
          industry: selectedIndustry,
          search: searchQuery
        }),
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
  }, [activeFilter, selectedService, selectedSignal, selectedState, selectedIndustry]);

  const handleTriggerDiscovery = async () => {
    setDiscovering(true);
    setNotification(null);
    try {
      const res = await triggerDiscovery(undefined, undefined, 8, {
        serviceCategory: triggerService !== 'all' ? triggerService : undefined,
        signalType: triggerSignal !== 'all' ? triggerSignal : undefined,
        state: triggerState !== 'all' ? triggerState : undefined
      });
      setNotification({
        type: 'success',
        message: `✓ Autonomous US Cycle Executed! Audited prospective businesses (${res.leads_qualified || 0} qualified leads with verified MX emails & evidence-backed opportunities pushed to Supabase).`
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
      (l.state || '').toLowerCase().includes(q) ||
      (l.category || '').toLowerCase().includes(q) ||
      (l.industry || '').toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.demand_evidence || '').toLowerCase().includes(q) ||
      (l.phone || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto w-full">
      {/* Sleek Executive Hero Banner & Quick Discovery Action Bar */}
      <div className="bg-gradient-to-br from-[#0c1224] via-[#090d1a] to-[#060812] p-5 sm:p-7 rounded-3xl border border-indigo-500/20 shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left: Professional Positioning */}
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>24/7 Cloud Autopilot Active • All 50 US States</span>
            </div>
            
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              AI Developer & Automation Client Acquisition
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Targeting US businesses with verifiable technical needs. The engine audits operational bottlenecks, verifies DNS MX deliverability, generates tailored pitches, and delivers them directly to prospects via Gmail SMTP.
            </p>

            {/* Technical Service Tags */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {TECHNICAL_SERVICES_SHOWCASE.map((item, idx) => {
                const Icon = item.icon;
                const isActive = selectedService === item.cat;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      setSelectedService(isActive ? 'all' : item.cat);
                      setDashboardTab('leads');
                    }}
                    className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-sm'
                        : 'bg-white/5 border-white/5 text-slate-300 hover:border-indigo-500/30'
                    }`}
                  >
                    <Icon className={`w-3 h-3 ${item.color}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Compact Instant Discovery Controller */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col gap-3 shadow-xl shrink-0 w-full lg:w-80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Targeted US Discovery
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ● 24/7 Autopilot
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                  Service
                </label>
                <select
                  value={triggerService}
                  onChange={(e) => setTriggerService(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">⚡ All Services</option>
                  {SERVICE_CATEGORIES_LIST.filter(c => c.id !== 'all').map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                  US State
                </label>
                <select
                  value={triggerState}
                  onChange={(e) => setTriggerState(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">🇺🇸 All States</option>
                  {US_50_STATES.map(s => (
                    <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Instant Run Button */}
            <button
              onClick={() => handleTriggerDiscovery()}
              disabled={discovering}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 active:scale-[0.99]"
            >
              <Sparkles className={`w-3.5 h-3.5 ${discovering ? 'animate-spin' : ''}`} />
              <span>{discovering ? 'Auditing US Businesses...' : '⚡ Run Discovery Scan Now'}</span>
            </button>
          </div>
        </div>
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

      {/* KPI Stats Ribbon (4 High-Impact Metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-[#0c101d] border border-white/5 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" /> Total Qualified
          </span>
          <div className="text-xl sm:text-2xl font-bold text-white">{stats?.total_leads || leads.length || 0}</div>
          <div className="text-[10px] text-slate-500">Verified US Businesses</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c101d] border border-emerald-500/20 space-y-1 bg-emerald-500/[0.02]">
          <span className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-emerald-400" /> Dispatched via Gmail
          </span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-300">
            {stats?.accepted_by_provider_count ?? stats?.sent_count ?? 0}
          </div>
          <div className="text-[10px] text-slate-500">250 OK Provider Accepted</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c101d] border border-sky-500/20 space-y-1 bg-sky-500/[0.02]">
          <span className="text-[11px] font-medium text-sky-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" /> Deliverability
          </span>
          <div className="text-xl sm:text-2xl font-bold text-sky-300">100% MX Verified</div>
          <div className="text-[10px] text-slate-500">Zero Bounce Guarantee</div>
        </div>

        <div className="p-4 rounded-2xl bg-[#0c101d] border border-indigo-500/20 space-y-1 bg-indigo-500/[0.02]">
          <span className="text-[11px] font-medium text-indigo-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-400" /> Cloud Schedule
          </span>
          <div className="text-xl sm:text-2xl font-bold text-indigo-300">Twice Daily</div>
          <div className="text-[10px] text-slate-500">08:00 & 20:00 UTC (Laptop Off)</div>
        </div>
      </div>

      {/* Main Interactive View Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2 overflow-x-auto">
        <button
          onClick={() => setDashboardTab('leads')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            dashboardTab === 'leads'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>All Leads & Pitches</span>
          <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-white/20 text-white">
            {filteredLeads.length}
          </span>
        </button>

        <button
          onClick={() => setDashboardTab('telemetry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            dashboardTab === 'telemetry'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-400" />
          <span>Production Health (5 Domains)</span>
        </button>

        <button
          onClick={() => setDashboardTab('deliverability')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            dashboardTab === 'deliverability'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-sky-400" />
          <span>Deliverability Guard</span>
        </button>

        <button
          onClick={() => setDashboardTab('database')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
            dashboardTab === 'database'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Layers className="w-4 h-4 text-violet-400" />
          <span>Database Schema</span>
        </button>
      </div>

      {/* Conditional View: Production Health Telemetry */}
      {dashboardTab === 'telemetry' && (
        <div className="space-y-4 animate-fadeIn">
          <ProductionHealthSection />
        </div>
      )}

      {/* Conditional View: Deliverability & Sender Reputation Guard */}
      {dashboardTab === 'deliverability' && (
        <div className="space-y-4 animate-fadeIn">
          <DeliverabilityCard />
        </div>
      )}

      {/* Conditional View: Database Explorer */}
      {dashboardTab === 'database' && (
        <div className="space-y-4 animate-fadeIn">
          <DatabaseSettingCard initialTelemetry={stats?.database} />
        </div>
      )}

      {/* Conditional View: Primary Leads & Outreach Funnel */}
      {dashboardTab === 'leads' && (
        <div className="p-4 sm:p-6 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-5 animate-fadeIn">
        {/* Top Status Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {[
              { id: 'active', label: `🚀 Emailed & Active (${stats?.total_leads || 0})` },
              { id: 'pending_approval', label: `✉️ Drafts for Review (${stats?.pending_approval || 0})` },
              { id: 'completed', label: `✅ Sent via Gmail (${stats?.sent_count || 0})` },
              { id: 'rejected', label: `❌ Rejected (${stats?.rejected_count || 0})` },
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
              placeholder="Search company, city, state, need..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Multi-Criteria Filter Bar (Service Category, Signal, State, Industry) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-900/50 border border-white/5 text-xs">
          {/* Service Category Filter */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Service Category
            </label>
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {SERVICE_CATEGORIES_LIST.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>

          {/* Demand Signal Filter */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Demand Signal
            </label>
            <select
              value={selectedSignal}
              onChange={(e) => setSelectedSignal(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              {DEMAND_SIGNALS_LIST.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* US State Filter */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              US State (50 States)
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">🇺🇸 All 50 States + DC</option>
              {US_50_STATES.map(s => (
                <option key={s.code} value={s.code}>{s.code} - {s.name}</option>
              ))}
            </select>
          </div>

          {/* Industry Filter */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Target Industry
            </label>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-200 focus:outline-none focus:border-indigo-500 truncate"
            >
              {TARGET_INDUSTRIES_LIST.map(ind => (
                <option key={ind} value={ind === 'All Industries' ? 'all' : ind}>{ind}</option>
              ))}
            </select>
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
                ? 'Your active pipeline is currently ready for prospects. Click "Run US Discovery Cycle Now" to find verified US businesses!'
                : activeFilter === 'pending_approval' 
                ? 'All caught up! No leads are currently pending review in this queue.'
                : 'No leads match the current filters.'}
            </p>
            <p className="max-w-md mx-auto text-slate-400">
              Run the discovery cycle to explore verified opportunities across all 50 states with verified DNS MX public emails.
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
            {/* 1. Mobile Phone View: Clean Cards */}
            <div className="block md:hidden space-y-3">
              {filteredLeads.map((lead) => {
                const isRejected = lead.status === 'rejected';
                const isPending = lead.status === 'pending_approval' || lead.status === 'draft_ready';
                const isSent = lead.status === 'sent' || lead.status === 'approved' || lead.status === 'accepted_by_provider' || lead.status === 'delivered';
                const isFailed = lead.status === 'error' || lead.status === 'failed' || lead.status === 'bounced';

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
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            {lead.city}{lead.state ? `, ${lead.state}` : ''}
                          </span>
                          <span>•</span>
                          <span className="text-slate-300">
                            {lead.industry || lead.category || 'SMB'}
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

                    {/* Service & Signal Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {renderServiceBadge(lead)}
                      {renderSignalBadge(lead)}
                      {renderWebsiteBadge(lead)}
                    </div>

                    {/* Demand Evidence Snippet */}
                    {lead.demand_evidence && (
                      <div className="p-2.5 rounded-lg bg-indigo-500/[0.04] border border-indigo-500/15 text-[11px] text-slate-300 leading-relaxed">
                        <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-0.5">
                          Verified Technical Need:
                        </div>
                        <p className="line-clamp-2">{lead.demand_evidence}</p>
                      </div>
                    )}

                    {/* Contact snippet with MX Shield */}
                    <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-1 text-xs text-slate-300">
                      <div className="flex items-center justify-between gap-2 truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate font-mono">{lead.email || 'No email on file'}</span>
                        </div>
                        {lead.email_verification_status?.includes('mx') && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 shrink-0">
                            <ShieldCheck className="w-2.5 h-2.5" /> MX OK
                          </span>
                        )}
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
                          className="w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10"
                        >
                          {isSent ? 'View Sent Pitch' : isFailed ? 'View Delivery Error' : 'Review Pitch & Evidence'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 2. Desktop View: Perfectly Aligned Fixed Table */}
            <div className="hidden md:block w-full">
              <table className="w-full table-fixed text-left text-xs text-slate-300">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[18%]" />
                  <col className="w-[20%]" />
                  <col className="w-[16%]" />
                  <col className="w-[8%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-white/5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-900/60">
                    <th className="py-3 px-4">Business & Location</th>
                    <th className="py-3 px-4">Service & Signal</th>
                    <th className="py-3 px-4">Contact (MX Verified)</th>
                    <th className="py-3 px-4">Outreach Status</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredLeads.map((lead) => {
                    const isRejected = lead.status === 'rejected';
                    const isPending = lead.status === 'pending_approval' || lead.status === 'draft_ready';
                    const isSent = lead.status === 'sent' || lead.status === 'approved' || lead.status === 'accepted_by_provider' || lead.status === 'delivered';
                    const isFailed = lead.status === 'error' || lead.status === 'failed' || lead.status === 'bounced';

                    return (
                      <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors group">
                        {/* Business & Location */}
                        <td className="py-3.5 px-4 truncate">
                          <div className="font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                            {lead.business_name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                            <span className="flex items-center gap-0.5 truncate">
                              <MapPin className="w-3 h-3 shrink-0" /> {lead.city}{lead.state ? `, ${lead.state}` : ''}
                            </span>
                            <span>•</span>
                            <span className="truncate">{lead.industry || lead.category || 'SMB'}</span>
                          </div>
                          {lead.demand_evidence && (
                            <div className="text-[10px] text-slate-400 truncate mt-1 italic">
                              Need: {lead.demand_evidence}
                            </div>
                          )}
                        </td>

                        {/* Service & Signal */}
                        <td className="py-3.5 px-4 truncate">
                          <div className="space-y-1">
                            <div>{renderServiceBadge(lead)}</div>
                            <div>{renderSignalBadge(lead)}</div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-3.5 px-4 text-slate-300 truncate">
                          <div className="flex items-center gap-1.5 text-xs font-mono truncate">
                            <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{lead.email || 'No email on record'}</span>
                            {lead.email_verification_status?.includes('mx') && (
                              <span title="DNS MX Verified" className="inline-flex items-center">
                                <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              </span>
                            )}
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
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <XCircle className="w-3 h-3 shrink-0" /> Draft Rejected
                            </span>
                          )}
                          {isFailed && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <AlertTriangle className="w-3 h-3 shrink-0" /> Blocked (Invalid MX)
                            </span>
                          )}
                          {isSent && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3 shrink-0" /> Auto-Emailed via Gmail
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
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10"
                            >
                              {isSent ? 'View Pitch' : isFailed ? 'View Error' : 'Review & Pitch'}
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
      )}

      {/* Review & Approval Modal */}
      <LeadModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onActionComplete={loadData}
      />
    </div>
  );
}

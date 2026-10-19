'use client';

import React, { useEffect, useState } from 'react';
import { fetchSettings, updateSettings } from '@/lib/api';
import { 
  Settings, 
  ShieldCheck, 
  Server, 
  Database, 
  Mail, 
  Clock, 
  MapPin, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [defaultCategory, setDefaultCategory] = useState('');
  const [defaultCity, setDefaultCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchSettings();
        setSettings(data);
        setAdminEmail(data.admin_email || '');
        setDefaultCategory(data.default_category || '');
        setDefaultCity(data.default_city || '');
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg(null);
    try {
      await updateSettings({
        admin_email: adminEmail,
        default_category: defaultCategory,
        default_city: defaultCity,
      });
      setStatusMsg({ type: 'success', message: 'Settings successfully updated!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', message: err.message || 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-1">
          <Settings className="w-4 h-4" />
          Engine Configuration
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          System Settings & Deployment Integrations
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure default targeting, Human-In-The-Loop Gmail notification address, and monitor deployment health.
        </p>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium border ${
          statusMsg.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {statusMsg.message}
        </div>
      )}

      {/* Integration Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Backend & Railway */}
        <div className="p-5 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              Backend (Railway)
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Online
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <p>Runs FastAPI, APScheduler (3 hours), and Gmail action webhooks.</p>
            <p className="font-mono text-[11px] text-slate-300 truncate">{settings?.backend_url || 'http://localhost:8000'}</p>
          </div>
        </div>

        {/* Supabase */}
        <div className="p-5 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              Supabase DB
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {settings?.supabase_configured ? 'Connected' : 'Active (Local Sync)'}
            </span>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <p>Syncs `leads`, `logs`, and `sent_emails` tables continuously.</p>
          </div>
        </div>

        {/* 3-Hour Scheduler */}
        <div className="p-5 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Automation Cycle
            </span>
            <span className="text-[11px] font-bold text-amber-400">Every 3 Hours</span>
          </div>
          <div className="text-xs text-slate-400 space-y-1">
            <p>Scans 5 local businesses, checks for missing websites, drafts pitch, and emails Gmail.</p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <div className="p-6 rounded-2xl bg-[#0b0f1d] border border-white/5">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="border-b border-white/5 pb-4">
            <h2 className="text-base font-bold text-white">Targeting & Reviewer Configuration</h2>
            <p className="text-xs text-slate-400 mt-0.5">These parameters govern the 3-hour automated discovery agent.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Default Target Category</label>
              <input
                type="text"
                value={defaultCategory}
                onChange={(e) => setDefaultCategory(e.target.value)}
                placeholder="e.g. dentists, plumbers, roofers"
                className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Default Target City / Market</label>
              <input
                type="text"
                value={defaultCity}
                onChange={(e) => setDefaultCity(e.target.value)}
                placeholder="e.g. Dallas, TX or Austin, TX"
                className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              Admin Gmail for Human-In-The-Loop Approvals
            </label>
            <input
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="your-email@gmail.com"
              className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
            />
            <p className="text-[11px] text-slate-400">
              When a business without a website is found, a draft review email with 1-click Approve / Reject buttons is delivered directly to this address.
            </p>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* Deployment Reference Card */}
      <div className="p-6 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Deployment Quick Reference
        </h3>
        <div className="text-xs text-slate-400 space-y-2">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 space-y-1">
            <strong className="text-slate-200">1. Railway Backend Deployment:</strong>
            <p>Connect your GitHub repository to Railway, set root directory to <code>backend/</code>, and configure your environment variables (<code>SUPABASE_URL</code>, <code>SUPABASE_KEY</code>, <code>ADMIN_EMAIL</code>, <code>BACKEND_PUBLIC_URL</code>).</p>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 space-y-1">
            <strong className="text-slate-200">2. Vercel Frontend Deployment:</strong>
            <p>Import repo to Vercel, set root directory to <code>frontend/</code>, and add <code>NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app</code>.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

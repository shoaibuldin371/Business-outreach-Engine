'use client';

import React from 'react';
import Link from 'next/link';
import { RefreshCw, Bell, Shield, Sparkles } from 'lucide-react';

interface NavbarProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function Navbar({ onRefresh, isRefreshing }: NavbarProps) {
  return (
    <header className="h-16 border-b border-white/5 bg-[#0b0f1d]/50 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span>Outreach Pipeline Control Center</span>
          <span className="text-[11px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
            Auto-Sync 3h
          </span>
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>
        )}

        <div className="h-4 w-[1px] bg-white/10 mx-1"></div>

        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Scheduler Online</span>
        </div>
      </div>
    </header>
  );
}

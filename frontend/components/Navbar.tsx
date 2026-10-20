'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { RefreshCw, Sparkles, LogOut, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function Navbar({ onRefresh, isRefreshing }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/login') {
    return null;
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (e) {
      console.error('Logout error:', e);
      router.push('/login');
    }
  };

  return (
    <header className="h-16 border-b border-white/5 bg-[#0b0f1d]/70 backdrop-blur-md px-4 sm:px-6 md:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Mini Logo */}
        <div className="flex md:hidden w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <h1 className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-2 truncate">
          <span className="truncate">Outreach Control Center</span>
          <span className="hidden sm:inline-block text-[10px] font-medium text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 shrink-0">
            Auto-Sync 3h
          </span>
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] sm:text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
          <span>Scheduler Online</span>
        </div>

        {/* RBAC Admin Indicator & Logout */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/10">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Admin</span>
          </span>
          <button
            onClick={handleLogout}
            title="Log out from console"
            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded-lg border border-transparent hover:border-rose-500/20 transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock</span>
          </button>
        </div>
      </div>
    </header>
  );
}

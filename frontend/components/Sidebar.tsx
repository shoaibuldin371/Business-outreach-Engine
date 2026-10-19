'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Terminal, 
  Send, 
  Settings, 
  Sparkles,
  CheckCheck,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Active Pipeline', href: '/', icon: LayoutDashboard },
    { label: 'Completed', href: '/completed', icon: CheckCheck },
    { label: 'Logs', href: '/logs', icon: Terminal },
    { label: 'Custom Email', href: '/custom-email', icon: Send },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <>
      {/* Desktop Sidebar (Hidden on mobile) */}
      <aside className="hidden md:flex w-64 border-r border-white/5 bg-[#0b0f1d]/80 backdrop-blur-xl flex-col justify-between shrink-0 min-h-screen sticky top-0 h-screen">
        <div>
          {/* Brand Header */}
          <div className="p-6 border-b border-white/5">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-bold text-base text-white tracking-tight flex items-center gap-1.5">
                  Outreach Engine
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    MVP
                  </span>
                </div>
                <div className="text-xs text-slate-400">Autonomous 3H Agent</div>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm shadow-indigo-500/10'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Deployment & Integration Status Card */}
        <div className="p-4 m-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Engine Status</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              3h Active
            </span>
          </div>

          <div className="space-y-1.5 text-[11px] text-slate-400">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Stack:</span>
              <span className="text-slate-200 font-medium">Full-Stack Next.js</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Hosting:</span>
              <span className="text-slate-200 font-medium">Vercel Serverless</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Database:</span>
              <span className="text-slate-200 font-medium">Supabase</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">HITL Verification:</span>
              <span className="text-slate-200 font-medium">Gmail 1-Click</span>
            </div>
          </div>

          <div className="pt-2 border-t border-white/5 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Discovery: Worldwide</span>
            <span className="text-indigo-400 font-semibold">5 leads/cycle</span>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (Visible only on mobile devices) */}
      <nav className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0b0f1d]/95 backdrop-blur-2xl border-t border-white/10 px-2 py-2 justify-around items-center shadow-2xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] font-medium transition-all ${
                isActive
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

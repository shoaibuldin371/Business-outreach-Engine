'use client';

import React, { useState, useEffect } from 'react';

interface Props {
  token: string;
  businessName: string;
  city?: string;
  state?: string;
  industry?: string;
  website?: string;
  proposal: {
    headline: string;
    summary: string;
    core_deliverables: string[];
    recommended_service: string;
    evidence_quote: string;
  };
  initialRoi: {
    hours_saved_per_week: number;
    hourly_rate_usd: number;
    inquiries_automated_monthly: number;
    conversion_lift_percent: number;
    estimated_monthly_value_usd: number;
    disclaimer: string;
  };
  expiresAt: string;
}

export default function PersonalizedClientView({
  token,
  businessName,
  city,
  state,
  industry,
  website,
  proposal,
  initialRoi,
  expiresAt,
}: Props) {
  // Interactive ROI state
  const [hoursPerWeek, setHoursPerWeek] = useState(initialRoi.hours_saved_per_week || 10);
  const [hourlyRate, setHourlyRate] = useState(initialRoi.hourly_rate_usd || 50);
  const [monthlyInquiries, setMonthlyInquiries] = useState(initialRoi.inquiries_automated_monthly || 80);
  const [meetingRequested, setMeetingRequested] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Fire page_viewed event on mount
  useEffect(() => {
    fetch(`/api/p/${token}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'page_viewed' }),
    }).catch(() => {});
  }, [token]);

  // Derived calculations
  const monthlyAdminSavings = Math.round(hoursPerWeek * hourlyRate * 4.2);
  const automatedInquiries = Math.round(monthlyInquiries * 0.7); // 70% triage automation
  const totalMonthlyValue = monthlyAdminSavings;

  const handleRoiChange = () => {
    fetch(`/api/p/${token}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'roi_calculated',
        payload: { hoursPerWeek, hourlyRate, monthlyAdminSavings },
      }),
    }).catch(() => {});
  };

  const handleMeetingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('Submitting your inquiry...');
    try {
      await fetch(`/api/p/${token}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'meeting_requested',
          payload: { note: requestNote, businessName },
        }),
      });
      setMeetingRequested(true);
      setStatusMsg('Thank you! Your request has been transmitted directly to Muhammad Shoaib. Expect a response within 24 hours.');
    } catch {
      setStatusMsg('Error transmitting request. Please email directly at Mshoaibawan371@gmail.com');
    }
  };

  const expiryFormatted = new Date(expiresAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 antialiased font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-[#0d1424]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-cyan-500/20">
              S
            </div>
            <div>
              <span className="text-sm font-semibold tracking-wide text-white">Shoaib Tech Advisory</span>
              <span className="hidden sm:inline-block ml-2 text-xs text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                Tailored Proposal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="hidden md:inline">Prepared for <strong className="text-white">{businessName}</strong></span>
            <span className="bg-slate-800/80 px-2.5 py-1 rounded-full text-slate-300 border border-slate-700/60">
              Valid until {expiryFormatted}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#111a30] to-[#0c1322] border border-slate-800 p-8 sm:p-12 shadow-2xl">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-4 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-300">
              <span className="bg-blue-950/70 text-blue-300 px-3 py-1 rounded-full border border-blue-800/60">
                {industry || 'US Business'}
              </span>
              {city && (
                <span className="bg-slate-800/80 text-slate-300 px-3 py-1 rounded-full border border-slate-700">
                  {city}{state ? `, ${state}` : ''}
                </span>
              )}
              <span className="bg-emerald-950/70 text-emerald-300 px-3 py-1 rounded-full border border-emerald-800/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Verified Business Assessment
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              {proposal.headline}
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
              {proposal.summary}
            </p>

            <div className="pt-2 text-xs text-slate-400 italic border-l-2 border-cyan-500/70 pl-3">
              {proposal.evidence_quote}
            </div>
          </div>
        </div>

        {/* Deliverables & Architecture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-7 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">Proposed Implementation Roadmap</h3>
              </div>
              <p className="text-sm text-slate-400">
                Engineered for speed, high conversion, and zero ongoing operational friction:
              </p>
              <ul className="space-y-3 pt-2">
                {proposal.core_deliverables.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-slate-200">
                    <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs font-bold">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 border-t border-slate-800 text-xs text-slate-400">
              Technology Stack: <span className="text-slate-200 font-mono">Next.js 14, TypeScript, Python, Cloud Serverless, Tailwind</span>
            </div>
          </div>

          {/* Interactive ROI Calculator */}
          <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-7 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">Interactive Operational Value Model</h3>
              </div>
              <span className="text-xs text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">Adjustable</span>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                  <span>Weekly hours spent on manual intake & repetitive admin:</span>
                  <span className="font-bold text-cyan-400">{hoursPerWeek} hrs/week</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="40"
                  step="1"
                  value={hoursPerWeek}
                  onChange={(e) => {
                    setHoursPerWeek(Number(e.target.value));
                    handleRoiChange();
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                  <span>Estimated team hourly cost / resource rate:</span>
                  <span className="font-bold text-cyan-400">${hourlyRate} / hr</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="120"
                  step="5"
                  value={hourlyRate}
                  onChange={(e) => {
                    setHourlyRate(Number(e.target.value));
                    handleRoiChange();
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1.5">
                  <span>Monthly client inquiries / leads handled:</span>
                  <span className="font-bold text-cyan-400">{monthlyInquiries} inquiries</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="400"
                  step="10"
                  value={monthlyInquiries}
                  onChange={(e) => {
                    setMonthlyInquiries(Number(e.target.value));
                    handleRoiChange();
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
              </div>
            </div>

            {/* Calculations Display */}
            <div className="rounded-lg bg-[#080d1a] border border-slate-800 p-4 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Monthly Hours Reclaimed:</span>
                <span className="font-semibold text-slate-200">{Math.round(hoursPerWeek * 4.2)} hrs/mo</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Automated Intake Capacity:</span>
                <span className="font-semibold text-slate-200">~{automatedInquiries} inquiries/mo</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
                <span className="text-sm font-medium text-slate-300">Projected Monthly Efficiency:</span>
                <span className="text-2xl font-black text-emerald-400">
                  ${totalMonthlyValue.toLocaleString()}
                  <span className="text-xs font-normal text-slate-400"> / mo</span>
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-normal border-l border-slate-700 pl-2">
              <strong>Transparent Assumption:</strong> {initialRoi.disclaimer}
            </p>
          </div>
        </div>

        {/* Meeting Request & Direct Contact */}
        <div className="rounded-xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 border border-slate-800 p-8 sm:p-10 text-center space-y-6">
          <div className="max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Let’s Discuss the Technical Scope</h2>
            <p className="text-sm text-slate-300">
              No sales pressure. A direct 15-minute technical review with Muhammad Shoaib on how this fits {businessName}'s existing systems.
            </p>
          </div>

          {!meetingRequested ? (
            <form onSubmit={handleMeetingSubmit} className="max-w-lg mx-auto space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="Optional brief note or preferred time (e.g. Next Tuesday morning)"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  className="flex-1 bg-slate-900/90 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold px-5 py-2.5 rounded-lg text-xs transition-all shadow-lg shadow-cyan-500/20 whitespace-nowrap"
                >
                  Request Technical Review
                </button>
              </div>
              <div className="text-xs text-slate-400">
                Or email directly:{' '}
                <a
                  href={`mailto:Mshoaibawan371@gmail.com?subject=Technical Review - ${encodeURIComponent(businessName)}`}
                  className="text-cyan-400 hover:underline font-mono"
                >
                  Mshoaibawan371@gmail.com
                </a>
              </div>
            </form>
          ) : (
            <div className="bg-emerald-950/50 border border-emerald-700/60 p-4 rounded-lg max-w-md mx-auto text-emerald-200 text-xs">
              {statusMsg}
            </div>
          )}
        </div>

        {/* Consultant Credentials Footer */}
        <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <span className="font-semibold text-slate-200">Muhammad Shoaib</span> — AI Developer & Automation Architect
            <div className="text-[11px] text-slate-400">Huawei Certified Cloud Developer · LLMs & Python · Data Science Trainer</div>
          </div>
          <div className="text-right text-[11px] text-slate-400">
            Privacy Protected · No 3rd-party tracking cookies · Link expires in 30 days
          </div>
        </div>
      </main>
    </div>
  );
}

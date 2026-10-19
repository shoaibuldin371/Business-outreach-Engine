'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lead, fetchLeads, sendCustomEmail } from '@/lib/api';
import { 
  Send, 
  Sparkles, 
  Building2, 
  Mail, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft,
  Eye,
  FileEdit,
  History
} from 'lucide-react';
import Link from 'next/link';

function CustomEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryLeadId = searchParams.get('lead_id');

  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>(queryLeadId || '');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const allLeads = await fetchLeads();
        setLeads(allLeads);

        if (queryLeadId) {
          const matched = allLeads.find(l => l.id === queryLeadId);
          if (matched) {
            populateLead(matched);
          }
        } else if (allLeads.length > 0) {
          // Default to first rejected lead if available, else first lead
          const rejectedLead = allLeads.find(l => l.status === 'rejected') || allLeads[0];
          setSelectedLeadId(rejectedLead.id);
          populateLead(rejectedLead);
        }
      } catch (err) {
        console.error('Failed to load leads:', err);
      }
    }
    init();
  }, [queryLeadId]);

  const populateLead = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setRecipientEmail(lead.email || '');
    setSubject(lead.email_subject || `A tailored website idea for ${lead.business_name}`);
    setBody(lead.email_body || `Dear ${lead.business_name} Team,\n\nI came across your business while researching reputable ${lead.category || 'local services'} in ${lead.city}. Your positive customer feedback and local reputation really stood out.\n\nWhile reviewing your digital presence, I noticed that ${lead.business_name} does not currently have an active, dedicated website where potential clients can view your full services, explore customer testimonials, or send direct inquiries.\n\nI build modern, high-converting websites specifically tailored for ${lead.category || 'local services'} that turn online searches into confirmed bookings.\n\nWould you be open to a quick 5-minute chat this week? I'd be glad to share a free wireframe and concept drafted for ${lead.business_name}, with no obligation.\n\nWarm regards,\n\nMuhammad Shoaib\nWeb Development & Growth Consultant\nEmail: Mshoaibawan371@gmail.com\n\n(If this is not relevant to you, please reply with "No thanks" and I will not follow up.)`);
  };

  const handleLeadSelect = (id: string) => {
    const matched = leads.find(l => l.id === id);
    if (matched) {
      populateLead(matched);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) {
      setStatusMsg({ type: 'error', message: 'Please select a target business.' });
      return;
    }
    if (!recipientEmail || !subject || !body) {
      setStatusMsg({ type: 'error', message: 'Recipient email, subject, and body are required.' });
      return;
    }

    setLoading(true);
    setStatusMsg(null);
    try {
      await sendCustomEmail(selectedLeadId, {
        recipient_email: recipientEmail,
        subject,
        body
      });
      setStatusMsg({
        type: 'success',
        message: '✓ Custom email successfully dispatched! Logged to Supabase and lead status updated to Sent.'
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        message: `Failed to deliver custom email: ${err.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const currentLead = leads.find(l => l.id === selectedLeadId);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Lead Pipeline
          </Link>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>Custom Outreach Composer</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
              Manual Override
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Send customized pitches to rejected leads or tailored follow-ups. All sent emails are automatically archived in Supabase.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl text-sm font-medium border flex items-center justify-between ${
          statusMsg.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
        }`}>
          <span>{statusMsg.message}</span>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs underline hover:text-white">Go to Dashboard</Link>
            <Link href="/logs" className="text-xs underline hover:text-white">View in Logs</Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Editor Form */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSend} className="p-6 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-5">
            {/* Target Lead Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Target Business Lead</span>
                {currentLead?.status === 'rejected' && (
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    Draft Rejected — Ready for Custom Touch
                  </span>
                )}
              </label>
              <select
                value={selectedLeadId}
                onChange={(e) => handleLeadSelect(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">-- Choose a business from database --</option>
                {leads.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.business_name} ({l.city}) — [{l.status.toUpperCase()}]
                  </option>
                ))}
              </select>
            </div>

            {/* Recipient */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Recipient Email Address
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="contact@business.com"
                required
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Email Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject line"
                required
                className="w-full px-3 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Message Body</span>
                <span className="text-[11px] text-slate-400">Plain text or formatted</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={11}
                required
                className="w-full px-3.5 py-3 text-xs font-mono bg-slate-950/80 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                placeholder="Compose custom outreach message..."
              />
            </div>

            {/* Submit */}
            <div className="pt-2 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                Logged to Supabase `sent_emails` table
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {loading ? 'Delivering...' : 'Send Custom Email'}
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview & Intel Sidebar */}
        <div className="lg:col-span-5 space-y-6">
          {/* Business Intel Card */}
          {currentLead && (
            <div className="p-5 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-3">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                Prospect Intelligence
              </div>
              <div className="text-xs space-y-2 text-slate-300">
                <div className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="text-slate-400">Company:</span>
                  <span className="font-semibold text-white">{currentLead.business_name}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="text-slate-400">Location:</span>
                  <span>{currentLead.city}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="text-slate-400">Phone:</span>
                  <span>{currentLead.phone || 'N/A'}</span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-1.5">
                  <span className="text-slate-400">Website Signal:</span>
                  <span className="text-rose-400 font-semibold">{currentLead.website_status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Current Status:</span>
                  <span className="capitalize font-semibold text-amber-400">{currentLead.status.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Inbox Preview Mockup */}
          <div className="p-5 rounded-2xl bg-[#0b0f1d] border border-white/5 space-y-3">
            <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              Recipient Inbox Preview
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-white/10 space-y-3 shadow-inner">
              <div className="border-b border-white/5 pb-2 text-[11px] space-y-1">
                <div><span className="text-slate-400">To:</span> <span className="text-slate-200 font-medium">{recipientEmail || 'client@business.com'}</span></div>
                <div><span className="text-slate-400">Subject:</span> <span className="text-white font-semibold">{subject || 'No subject'}</span></div>
              </div>
              <div className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {body || 'Your email preview will appear here...'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CustomEmailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-slate-400">Loading custom composer...</div>}>
      <CustomEmailContent />
    </Suspense>
  );
}

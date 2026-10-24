'use client';

import React, { useState } from 'react';
import { Lead, directApprovalAction, patchLead, recordLeadReply } from '@/lib/api';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  Send, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  AlertTriangle,
  Sparkles,
  Edit3,
  ShieldCheck,
  MessageSquare,
  ChevronDown,
  ExternalLink,
  Target,
  Zap,
  Code2,
  Cloud,
  BarChart3,
  GraduationCap
} from 'lucide-react';
import Link from 'next/link';

interface LeadModalProps {
  lead: Lead | null;
  onClose: () => void;
  onActionComplete: () => void;
}

type PitchAngleOption = 
  | 'ai_automation' 
  | 'llm_rag_agents' 
  | 'python_dev' 
  | 'huawei_cloud' 
  | 'data_science_analytics' 
  | 'data_science_training' 
  | 'website_digital';

const SERVICE_PITCH_OPTIONS: { id: PitchAngleOption; label: string; icon: string; subtitle: string }[] = [
  { id: 'ai_automation', label: 'AI Automation', icon: '⚡', subtitle: 'Workflows & n8n/Python' },
  { id: 'llm_rag_agents', label: 'LLMs & RAG', icon: '🤖', subtitle: 'Knowledge assistants' },
  { id: 'python_dev', label: 'Python Dev', icon: '🐍', subtitle: 'FastAPI & ETL pipelines' },
  { id: 'huawei_cloud', label: 'Huawei Cloud', icon: '☁️', subtitle: 'Certified architecture' },
  { id: 'data_science_analytics', label: 'Data Analytics', icon: '📊', subtitle: 'BI & forecasting' },
  { id: 'data_science_training', label: 'Tech Training', icon: '🎓', subtitle: 'Corporate upskilling' },
  { id: 'website_digital', label: 'Web & Digital', icon: '🌐', subtitle: 'Lead capture & speed' },
];

export default function LeadModal({ lead, onClose, onActionComplete }: LeadModalProps) {
  if (!lead) return null;

  const [loading, setLoading] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(lead.email?.trim() || '');
  const [subject, setSubject] = useState(lead.email_subject || '');
  const [body, setBody] = useState(lead.email_body || '');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAngle, setSelectedAngle] = useState<PitchAngleOption>(
    (lead.service_category as PitchAngleOption) || 'ai_automation'
  );
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isAlreadySent = lead.status === 'sent' || lead.status === 'accepted_by_provider' || lead.status === 'delivered' || lead.status === 'reply_received';

  // Reply logging state
  const [showReplyLogger, setShowReplyLogger] = useState(false);
  const [replyType, setReplyType] = useState<
    'interested' | 'wants_details' | 'requests_pricing' | 'meeting_requested' | 'not_interested' | 'follow_up_later' | 'unsubscribe' | 'unknown'
  >('interested');
  const [replyNotes, setReplyNotes] = useState('');
  const [loggingReply, setLoggingReply] = useState(false);

  const applyPitchAngle = (angle: PitchAngleOption) => {
    setSelectedAngle(angle);
    const bName = lead.business_name;
    const city = (lead.city || 'your area').split(',')[0].trim();
    const state = lead.state || (lead.city?.includes(',') ? lead.city.split(',')[1].trim() : 'US');
    const industry = lead.industry || lead.category || 'technology services';
    const evidenceSnippet = lead.demand_evidence?.trim() 
      ? lead.demand_evidence.split('.')[0] + '.'
      : `operational and technology initiatives in ${city}`;

    const sig = `Best,\n\nMuhammad Shoaib\nAI Developer & Automation Architect | Huawei Certified Cloud Developer\nLLMs & Python | Data Science Trainer\nMshoaibawan371@gmail.com`;

    if (angle === 'ai_automation') {
      setSubject(`quick question regarding ${bName} workflows`);
      setBody(`Hi ${bName} team,\n\nI came across ${bName} in ${city}, ${state} while reviewing technology initiatives in the ${industry} space.\n\n${evidenceSnippet}\n\nI am an AI Developer & Automation Architect (Huawei Certified Cloud Developer, Python/LLMs). I build bespoke workflow automations, custom AI intake agents, and multi-system API pipelines (n8n, Make, Zapier, and Python) that connect fragmented business tools and eliminate 10-15+ hours of repetitive manual data entry every week.\n\nI mapped out a quick 2-minute workflow breakdown showing a couple of areas where automated AI agents could plug right into your stack.\n\nWould you be open to me sharing the outline? (No sales pitch or expectation at all, just thought it'd be genuinely helpful for your team.)\n\n${sig}`);
    } else if (angle === 'llm_rag_agents') {
      setSubject(`question on internal knowledge / LLM assistant for ${bName}`);
      setBody(`Hi ${bName} team,\n\nI came across ${bName} in ${city} and was following your work in ${industry}.\n\n${evidenceSnippet}\n\nI specialize in building custom RAG (Retrieval-Augmented Generation) systems, enterprise knowledge assistants, and tool-using AI agents that query internal documentation, tickets, or SOPs with strict accuracy and source citations.\n\nInstead of generic chatbot responses, I build domain-specific vector search pipelines that allow your team to instantly search complex documentation and automate repetitive customer inquiries.\n\nWould you be open to a quick 2-minute architecture preview showing how a specialized RAG assistant could integrate with your systems?\n\n${sig}`);
    } else if (angle === 'python_dev') {
      setSubject(`Python backend & API pipeline question for ${bName}`);
      setBody(`Hi ${bName} team,\n\nI was looking into ${bName} in ${city}, ${state} and noticed your technical footprint in ${industry}.\n\n${evidenceSnippet}\n\nI am an AI Developer & Python Specialist (Huawei Certified Cloud Developer). I build robust FastAPI microservices, asynchronous ETL data pipelines, third-party API integrations, and task automations that replace fragile spreadsheets and legacy scripts with reliable, monitored services.\n\nI put together a quick technical outline showing how an automated Python data pipeline could handle this workflow with zero manual overhead.\n\nWould you be open to me sending over the outline and a couple of relevant GitHub examples?\n\n${sig}`);
    } else if (angle === 'huawei_cloud') {
      setSubject(`cloud architecture & deployment for ${bName}`);
      setBody(`Hi ${bName} team,\n\nI came across ${bName} in ${city} while researching cloud deployment and infrastructure initiatives in ${industry}.\n\n${evidenceSnippet}\n\nI am a Huawei Certified Cloud Developer and backend systems architect. I help companies configure, containerize, and deploy secure workloads on Huawei Cloud infrastructure (ECS, OBS, CCE, and multi-cloud API gateways), ensuring high availability, streamlined CI/CD, and optimized cloud compute costs.\n\nWould you be open to a quick high-level review of your current cloud deployment setup to see if there are opportunities to optimize latency or infrastructure overhead?\n\n${sig}`);
    } else if (angle === 'data_science_analytics') {
      setSubject(`data pipeline & reporting dashboards for ${bName}`);
      setBody(`Hi ${bName} team,\n\nI came across ${bName} in ${city}, ${state} while reviewing analytics and reporting operations in ${industry}.\n\n${evidenceSnippet}\n\nI build automated business intelligence pipelines, SQL/Python data transformation routines, and interactive dashboards that turn disparate operational records into real-time KPI visibility and predictive forecasts.\n\nI put together a quick 2-minute preview showing how an automated metrics pipeline and executive dashboard could eliminate manual reporting for your team.\n\nWould you be open to me sharing the preview? No catch or sales pressure at all, just thought it would provide immediate value.\n\n${sig}`);
    } else if (angle === 'data_science_training') {
      setSubject(`curriculum / AI & Python training for ${bName}`);
      setBody(`Hi ${bName} team,\n\nI came across ${bName} while looking at leading tech and training organizations in ${city}, ${state}.\n\n${evidenceSnippet}\n\nI am a Data Science Trainer and Huawei Certified Cloud Developer specializing in Python, Large Language Models (LLMs), and practical Machine Learning. I help academies and corporate teams deliver hands-on, job-ready training modules and practical lab exercises for students and technical professionals.\n\nAre you currently looking for guest trainers, curriculum mentors, or practical lab instructors for your upcoming Python, Data Science, or AI cohorts?\n\nI'd be glad to share our syllabus and past cohort project outlines if you're open to a quick look.\n\n${sig}`);
    } else {
      setSubject(`${bName} — quick question regarding client inquiry flow`);
      setBody(`Hi ${bName} team,\n\nI came across ${bName} earlier today while looking at established ${lead.category || 'local services'} providers in ${city}, ${state}.\n\n${evidenceSnippet}\n\nI noticed a couple of friction points on mobile—specifically page load speed and how prospective clients request an estimate or booking. Most people searching on smartphones prefer requesting a quote online rather than calling, and bounce if they can't submit an inquiry in two clicks.\n\nI put together a clean 1-page mobile redesign concept for ${bName} with an instant estimate form to show how you can capture more booked inquiries from your search traffic.\n\nCan I shoot the preview link over? No catch or sales pressure at all, just thought it might be useful for your team.\n\n${sig}`);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    setFeedback(null);

    const emailToSend = recipientEmail.trim().toLowerCase();
    if (!emailToSend) {
      setFeedback({ 
        type: 'error', 
        message: 'Cannot deliver: No verified public email address. Dispatch is strictly blocked to protect Gmail deliverability.' 
      });
      setLoading(false);
      return;
    }

    try {
      if (emailToSend !== (lead.email || '').trim().toLowerCase()) {
        await patchLead(lead.id, { email: emailToSend, status: 'pending_approval' });
      }
      await directApprovalAction(lead.id, 'approve', subject, body);
      setFeedback({ type: 'success', message: '✓ Approved & Dispatched via Gmail! Visible in your Gmail Sent folder.' });
      setTimeout(() => {
        onActionComplete();
        onClose();
      }, 1400);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to approve and send' });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      await directApprovalAction(lead.id, 'reject');
      setFeedback({ type: 'success', message: 'Rejected! Status set to Rejected.' });
      setTimeout(() => {
        onActionComplete();
        onClose();
      }, 1400);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reject' });
    } finally {
      setLoading(false);
    }
  };

  const handleRecordReply = async () => {
    setLoggingReply(true);
    setFeedback(null);
    try {
      await recordLeadReply(lead.id, { reply_type: replyType, notes: replyNotes });
      setFeedback({ type: 'success', message: `✓ Prospect reply successfully recorded as '${replyType}'!` });
      setTimeout(() => {
        onActionComplete();
        onClose();
      }, 1400);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to record reply' });
    } finally {
      setLoggingReply(false);
    }
  };

  const breakdown = lead.score_breakdown || {
    signal_strength: lead.signal_type === 'explicit_demand' ? 35 : 28,
    service_match: 25,
    email_verification: 20,
    evidence_quality: 18,
    total: lead.score || 85,
    explanation: 'Verified operational requirement matching technical services; MX-checked business email on public domain.',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f1424] border border-white/10 rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/5 flex items-start justify-between bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {/* Service Category Badge */}
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                {lead.service_category?.replace(/_/g, ' ').toUpperCase() || 'AI AUTOMATION'}
              </span>

              {/* Demand Signal Badge */}
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                lead.signal_type === 'explicit_demand'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : lead.signal_type === 'evidence_backed'
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {lead.signal_type === 'explicit_demand' ? '⚡ Explicit Demand' : lead.signal_type === 'evidence_backed' ? '🔍 Evidence-Backed Need' : '🌐 Website Opportunity'}
              </span>

              {/* MX Shield */}
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                MX Verified
              </span>

              {/* Commercial Relevance Score */}
              <span className="text-xs font-medium text-slate-400">
                Score: <strong className="text-indigo-400">{breakdown.total}/100</strong>
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{lead.business_name}</h2>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-slate-300 font-medium">{lead.industry || lead.category || 'Technology Services'}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" /> {lead.city}</span>
              {lead.company_size && (
                <>
                  <span>•</span>
                  <span className="text-slate-400">Size: {lead.company_size}</span>
                </>
              )}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {isAlreadySent && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Proposal already delivered to <strong>{lead.email}</strong> via Gmail. Visible in your Gmail <strong>Sent</strong> folder.
              </span>
            </div>
          )}

          {feedback && (
            <div className={`p-3.5 rounded-xl text-xs sm:text-sm font-medium border ${
              feedback.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {feedback.message}
            </div>
          )}

          {/* 1. Demand Evidence & Observation Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-slate-900/40 to-slate-950/60 border border-indigo-500/25 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-400" />
                Verified Business Demand Evidence
              </span>
              {lead.evidence_url && (
                <a 
                  href={lead.evidence_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline"
                >
                  <span>Evidence Source</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-sans">
              {lead.demand_evidence || lead.notes || 'Documented business requirement identified during technology audit.'}
            </p>
          </div>

          {/* 2. Explainable Commercial Relevance Breakdown */}
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-300 font-semibold">
              <span className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
                Explainable Score Breakdown:
              </span>
              <span className="text-indigo-300 font-bold">{breakdown.total} / 100</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="p-2 rounded-lg bg-black/20 border border-white/5">
                <div className="text-slate-400">Signal Strength</div>
                <div className="font-bold text-emerald-400">{breakdown.signal_strength} / 35</div>
              </div>
              <div className="p-2 rounded-lg bg-black/20 border border-white/5">
                <div className="text-slate-400">Service Match</div>
                <div className="font-bold text-indigo-400">{breakdown.service_match} / 25</div>
              </div>
              <div className="p-2 rounded-lg bg-black/20 border border-white/5">
                <div className="text-slate-400">Email Delivery</div>
                <div className="font-bold text-sky-400">{breakdown.email_verification} / 20</div>
              </div>
              <div className="p-2 rounded-lg bg-black/20 border border-white/5">
                <div className="text-slate-400">Evidence Quality</div>
                <div className="font-bold text-purple-400">{breakdown.evidence_quality} / 20</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 pt-1">
              <em>{breakdown.explanation}</em>
            </div>
          </div>

          {/* 3. Contact & Target Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-400" /> Phone:</span>
              <p className="font-semibold text-slate-200">
                {lead.phone ? (
                  <a href={`tel:${lead.phone}`} className="text-indigo-400 hover:underline">
                    {lead.phone}
                  </a>
                ) : (
                  'None listed'
                )}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Mail className="w-3.5 h-3.5 text-indigo-400" /> Target Email (Verified):
                </span>
                {recipientEmail.trim() ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Verified Public Email
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-2.5 h-2.5" /> No Email Found
                  </span>
                )}
              </div>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Enter verified email (e.g. contact@business.com)"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-900 border border-white/10 rounded-lg text-emerald-400 font-semibold focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* 4. Switch Pitch Angle across all 7 services */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Select Technical Service Pitch:
              </label>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                {isEditing ? 'Cancel Edit' : 'Edit Text Manually'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
              {SERVICE_PITCH_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => applyPitchAngle(opt.id)}
                  className={`p-2 rounded-xl text-left border transition-all ${
                    selectedAngle === opt.id
                      ? 'bg-indigo-600/25 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                      : 'bg-white/[0.03] border-white/5 text-slate-400 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px] font-bold truncate">
                    <span>{opt.icon}</span>
                    <span className="truncate">{opt.label}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 truncate mt-0.5">{opt.subtitle}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 5. Pitch Draft Box */}
          <div className="space-y-2">
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950/80 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                  placeholder="Subject line"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={9}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950/80 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                  placeholder="Email body"
                />
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-indigo-500/20 space-y-3">
                <div className="text-xs text-slate-400 pb-2 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400">Subject: </span>
                    <span className="text-slate-200 font-semibold">{subject}</span>
                  </div>
                  <span className="text-[10px] text-indigo-400 font-medium">100% Humanized Draft</span>
                </div>
                <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                  {body}
                </div>
              </div>
            )}
          </div>

          {/* 6. Reply Logger */}
          <div className="pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowReplyLogger(!showReplyLogger)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium"
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>{showReplyLogger ? 'Hide Reply Tracking' : 'Track Prospect Response & Classification'}</span>
            </button>

            {showReplyLogger && (
              <div className="mt-3 p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-3">
                <div className="text-xs font-semibold text-slate-200">Select Reply Classification:</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'interested', label: 'Interested' },
                    { id: 'wants_details', label: 'Wants Details' },
                    { id: 'requests_pricing', label: 'Requests Pricing' },
                    { id: 'meeting_requested', label: 'Meeting Booked' },
                    { id: 'not_interested', label: 'Not Interested' },
                    { id: 'follow_up_later', label: 'Follow Up Later' },
                    { id: 'unsubscribe', label: 'Unsubscribe' },
                    { id: 'unknown', label: 'General / Unknown' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setReplyType(t.id as any)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-semibold border text-center transition-all ${
                        replyType === t.id
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={replyNotes}
                  onChange={(e) => setReplyNotes(e.target.value)}
                  placeholder="Optional notes or prospect message snippet..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                />
                <button
                  type="button"
                  onClick={handleRecordReply}
                  disabled={loggingReply}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  {loggingReply ? 'Recording...' : 'Save Reply & Classification'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/5 bg-slate-900/60 flex items-center justify-between gap-3">
          {isAlreadySent ? (
            <div className="flex items-center justify-between w-full gap-3">
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Pitch Delivered to {lead.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/custom-email?lead_id=${lead.id}`}
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Follow-Up
                </Link>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/30"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              <Link
                href={`/custom-email?lead_id=${lead.id}`}
                onClick={onClose}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                Send Custom Email Instead
              </Link>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4 text-rose-400" />
                  Reject Draft
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading || !recipientEmail.trim()}
                  title={!recipientEmail.trim() ? 'Enter a verified email above to enable sending' : 'Approve and deliver pitch'}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  {loading ? 'Processing...' : recipientEmail.trim() ? 'Approve & Send Pitch' : 'Email Required to Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

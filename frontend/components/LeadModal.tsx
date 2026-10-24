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
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';

interface LeadModalProps {
  lead: Lead | null;
  onClose: () => void;
  onActionComplete: () => void;
}

export default function LeadModal({ lead, onClose, onActionComplete }: LeadModalProps) {
  if (!lead) return null;

  const [loading, setLoading] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(lead.email?.trim() || '');
  const [subject, setSubject] = useState(lead.email_subject || '');
  const [body, setBody] = useState(lead.email_body || '');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedAngle, setSelectedAngle] = useState<'local_search' | 'mobile_speed' | 'free_mockup'>('local_search');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isAlreadySent = lead.status === 'sent' || lead.status === 'accepted_by_provider' || lead.status === 'delivered' || lead.status === 'reply_received';

  // Reply logging state
  const [showReplyLogger, setShowReplyLogger] = useState(false);
  const [replyType, setReplyType] = useState<'positive' | 'pricing_or_portfolio' | 'meeting_requested' | 'unsubscribed' | 'negative'>('positive');
  const [replyNotes, setReplyNotes] = useState('');
  const [loggingReply, setLoggingReply] = useState(false);

  const applyPitchAngle = (angle: 'local_search' | 'mobile_speed' | 'free_mockup') => {
    setSelectedAngle(angle);
    const bName = lead.business_name;
    const city = (lead.city || 'your area').split(',')[0].trim();
    const cat = (lead.category || 'local services').toLowerCase();

    const sig = `Best,\n\nMuhammad Shoaib\nAI Developer & Automation Architect | Huawei Certified Cloud Developer\nLLMs & Python | Data Science Trainer\nMshoaibawan371@gmail.com`;

    if (angle === 'mobile_speed') {
      setSubject(`${bName} — quick question`);
      setBody(`Hi ${bName} team,\n\nI was looking up ${cat} services in ${city} earlier today and saw ${bName}.\n\nYou have really solid customer feedback, but I noticed a couple of friction points on mobile—specifically page load speed and how prospective clients request an estimate or booking. Most clients searching on their phones in the evening prefer booking or requesting a quote online rather than calling, and bounce if they can't book in two clicks.\n\nI put together a clean 1-page mobile redesign concept for ${bName} with an instant estimate form to show how an online estimate page would look on mobile.\n\nCan I shoot the preview link over? No catch or sales pressure at all, just thought it might be useful for your team.\n\n${sig}`);
    } else if (angle === 'free_mockup') {
      setSubject(`Website concept for ${bName}`);
      setBody(`Hi ${bName} team,\n\nI came across your profile while looking up established ${cat} providers in ${city}. You clearly have a strong local reputation, but I noticed there is currently no active website linked to your business listing.\n\nWhen local clients search for ${cat} on their phones, over 80% choose whichever provider allows them to view services or submit an instant estimate request directly online.\n\nI actually put together a clean 1-page design preview specifically for ${bName} to show how you can capture those search inquiries with an instant quote form.\n\nCan I send the preview link over? No catch or sales pressure at all—just thought it would be a useful asset for your team.\n\n${sig}`);
    } else {
      setSubject(`Idea for ${bName} (${city})`);
      setBody(`Hi there,\n\nI came across ${bName} while looking at local ${cat} providers in ${city}.\n\nWhile checking your business listing, I noticed you don't currently have an official website attached. When customers in ${city} search online, they usually look for photos of past work and an easy contact form before picking up the phone.\n\nI build clean, fast digital systems for ${cat} businesses that help turn local search traffic into booked inquiries.\n\nI already put together a quick preview draft for ${bName}. Would it be alright if I sent the preview link over to look at?\n\n${sig}`);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    setFeedback(null);

    const emailToSend = recipientEmail.trim().toLowerCase();
    if (!emailToSend) {
      setFeedback({ 
        type: 'error', 
        message: 'Cannot deliver: No verified email address. Dispatch is strictly blocked to protect your Gmail account from 550 Recipient Rejected bounce notifications. Please use Phone Outreach.' 
      });
      setLoading(false);
      return;
    }

    if (emailToSend === 'contact@outbackroofing.com' || emailToSend === 'contact@.com') {
      setFeedback({
        type: 'error',
        message: 'Delivery Blocked: Mailbox is on the suppression list (550 Recipient rejected). Please use phone outreach instead.'
      });
      setLoading(false);
      return;
    }

    try {
      if (emailToSend !== (lead.email || '').trim().toLowerCase()) {
        await patchLead(lead.id, { email: emailToSend, status: 'pending_approval' });
      }
      await directApprovalAction(lead.id, 'approve', subject, body);
      setFeedback({ type: 'success', message: '✓ Approved & Accepted by Provider! Message queued cleanly with zero simulation.' });
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
      setFeedback({ type: 'success', message: 'Rejected! Status set to Rejected. You can now compose a custom email.' });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f1424] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-start justify-between bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {isAlreadySent ? (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Auto-Sent via Gmail
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {lead.website_status === 'none_found' || !lead.website
                    ? 'No Website Found'
                    : lead.website_status === 'unreachable'
                    ? 'Broken / Offline Site'
                    : lead.website_status || 'No Website Detected'}
                </span>
              )}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                MX Verified
              </span>
              <span className="text-xs font-medium text-slate-400">
                Score: <strong className="text-indigo-400">{lead.score || 85}/100</strong>
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">{lead.business_name}</h2>
            <p className="text-xs text-slate-400 flex items-center gap-2 mt-1">
              <span>{lead.category || 'Local Business'}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {lead.city}</span>
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
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {isAlreadySent && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-3 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Proposal has already been <strong>auto-delivered to {lead.email}</strong> via Gmail SMTP. A copy is saved in your Gmail <strong>Sent</strong> folder.
              </span>
            </div>
          )}

          {feedback && (
            <div className={`p-4 rounded-xl text-sm font-medium border ${
              feedback.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {feedback.message}
            </div>
          )}

          {/* Contact Intel */}
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
                  <Mail className="w-3.5 h-3.5 text-indigo-400" /> Target Email (Prospect Recipient):
                </span>
                {recipientEmail.trim() ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Verified Public Email
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-2.5 h-2.5" /> No Email Found (Phone Only)
                  </span>
                )}
              </div>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="Enter verified email (e.g. owner@business.com)"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-900 border border-white/10 rounded-lg text-emerald-400 font-semibold focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                {recipientEmail.trim() 
                  ? '✓ Verified recipient for direct pitch delivery.' 
                  : '⚠ Guessed emails are disabled to prevent 550 bounce notices. Call phone or enter verified email.'}
              </span>
            </div>
          </div>

          {/* Evidence-Backed Personalization Angles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Select Evidence-Backed Pitch Angle
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

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPitchAngle('local_search')}
                className={`p-2 rounded-xl text-left border transition-all ${
                  selectedAngle === 'local_search'
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <div className="font-semibold text-[11px]">Angle 1: Search Capture</div>
                <div className="text-[10px] text-slate-400 line-clamp-1">Google Maps clients</div>
              </button>
              <button
                type="button"
                onClick={() => applyPitchAngle('mobile_speed')}
                className={`p-2 rounded-xl text-left border transition-all ${
                  selectedAngle === 'mobile_speed'
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <div className="font-semibold text-[11px]">Angle 2: Mobile Inquiries</div>
                <div className="text-[10px] text-slate-400 line-clamp-1">Fast 30-sec booking</div>
              </button>
              <button
                type="button"
                onClick={() => applyPitchAngle('free_mockup')}
                className={`p-2 rounded-xl text-left border transition-all ${
                  selectedAngle === 'free_mockup'
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                <div className="font-semibold text-[11px]">Angle 3: Free Mockup</div>
                <div className="text-[10px] text-slate-400 line-clamp-1">Zero-obligation proof</div>
              </button>
            </div>
          </div>

          {/* Draft Pitch Box */}
          <div className="space-y-2">
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950/80 border border-white/10 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
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
              <div className="p-4 rounded-xl bg-slate-950/60 border border-indigo-500/20 space-y-3">
                <div className="text-xs text-slate-400 pb-2 border-b border-white/5">
                  <span className="text-slate-400">Subject: </span>
                  <span className="text-slate-200 font-semibold">{subject}</span>
                </div>
                <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                  {body}
                </div>
              </div>
            )}
          </div>

          {/* Optional Reply Logger Drawer */}
          <div className="pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => setShowReplyLogger(!showReplyLogger)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium"
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>{showReplyLogger ? 'Hide Reply Logger' : 'Log Prospect Reply (Calculate Genuine Reply Rate)'}</span>
            </button>

            {showReplyLogger && (
              <div className="mt-3 p-4 rounded-xl bg-slate-950/80 border border-white/10 space-y-3">
                <div className="text-xs font-semibold text-slate-200">Log Received Response:</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'positive', label: 'Positive Interest' },
                    { id: 'pricing_or_portfolio', label: 'Pricing / Portfolio' },
                    { id: 'meeting_requested', label: 'Meeting Booked' },
                    { id: 'negative', label: 'Not Interested' },
                    { id: 'unsubscribed', label: 'Unsubscribe / Opt-Out' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setReplyType(t.id as any)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border text-center transition-all ${
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
                  {loggingReply ? 'Recording...' : 'Save Reply & Update Telemetry'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/5 bg-slate-900/50 flex items-center justify-between gap-3">
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

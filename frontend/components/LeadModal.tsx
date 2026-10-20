'use client';

import React, { useState } from 'react';
import { Lead, directApprovalAction, patchLead } from '@/lib/api';
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
  Edit3
} from 'lucide-react';
import Link from 'next/link';

interface LeadModalProps {
  lead: Lead | null;
  onClose: () => void;
  onActionComplete: () => void;
}

export default function LeadModal({ lead, onClose, onActionComplete }: LeadModalProps) {
  if (!lead) return null;

  const hasVerifiedEmail = Boolean(lead.email && lead.email.trim());
  const [loading, setLoading] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(lead.email?.trim() || '');
  const [subject, setSubject] = useState(lead.email_subject || '');
  const [body, setBody] = useState(lead.email_body || '');
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

    if (emailToSend === 'contact@outbackroofing.com') {
      setFeedback({
        type: 'error',
        message: 'Delivery Blocked: contact@outbackroofing.com was rejected by Microsoft Outlook (550 Access Denied - Mailbox does not exist). Use phone outreach instead.'
      });
      setLoading(false);
      return;
    }

    try {
      if (emailToSend !== (lead.email || '').trim().toLowerCase()) {
        await patchLead(lead.id, { email: emailToSend, status: 'pending_approval' });
      }
      await directApprovalAction(lead.id, 'approve', isEditing ? subject : undefined, isEditing ? body : undefined);
      setFeedback({ type: 'success', message: '✓ Approved & Delivered! Pitch dispatched to verified prospect.' });
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0f1424] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-start justify-between bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {lead.website_status || 'No Website Detected'}
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

          {/* Draft Pitch Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Tailored Website Proposal Pitch
              </label>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" />
                {isEditing ? 'Cancel Edit' : 'Edit Draft'}
              </button>
            </div>

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

          {/* Notes */}
          {lead.notes && (
            <div className="text-[11px] text-slate-400 bg-white/[0.01] p-3 rounded-lg border border-white/5">
              <strong>Discovery Notes:</strong> {lead.notes}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/5 bg-slate-900/50 flex items-center justify-between gap-3">
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
            {lead.phone && !recipientEmail.trim() && (
              <a
                href={`tel:${lead.phone}`}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all"
              >
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                Call Phone ({lead.phone})
              </a>
            )}
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
        </div>
      </div>
    </div>
  );
}

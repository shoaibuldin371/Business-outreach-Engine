const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export interface Lead {
  id: string;
  business_name: string;
  category?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  website_status?: string;
  score?: number;
  notes?: string;
  email_subject?: string;
  email_body?: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'sent' | 'error';
  approval_token?: string;
  source?: string;
  created_at?: string;
  last_contacted_at?: string;
}

export interface SystemLog {
  id: string;
  lead_id?: string;
  step: 'find' | 'explore' | 'draft' | 'approval_pending' | 'approved' | 'rejected' | 'sending' | 'success' | 'error';
  status: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface Stats {
  total_leads: number;
  no_website_count: number;
  pending_approval: number;
  rejected_count: number;
  sent_count: number;
  total_logs: number;
  total_sent_emails: number;
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/api/stats`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchLeads(status?: string): Promise<Lead[]> {
  const url = status && status !== 'all' 
    ? `${API_BASE}/api/leads?status=${encodeURIComponent(status)}`
    : `${API_BASE}/api/leads`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch leads');
  return res.json();
}

export async function fetchLead(id: string): Promise<Lead> {
  const res = await fetch(`${API_BASE}/api/leads/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch lead');
  return res.json();
}

export async function sendCustomEmail(leadId: string, payload: { recipient_email: string; subject: string; body: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/api/leads/${leadId}/send-custom-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to send custom email' }));
    throw new Error(err.detail || 'Failed to send custom email');
  }
  return res.json();
}

export async function directApprovalAction(leadId: string, action: 'approve' | 'reject', custom_subject?: string, custom_body?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/api/approval/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lead_id: leadId, action, custom_subject, custom_body }),
  });
  if (!res.ok) throw new Error(`Failed to perform ${action}`);
  return res.json();
}

export async function fetchLogs(limit = 100): Promise<SystemLog[]> {
  const res = await fetch(`${API_BASE}/api/logs?limit=${limit}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch logs');
  return res.json();
}

export async function triggerDiscovery(category?: string, city?: string, count = 5): Promise<any> {
  const res = await fetch(`${API_BASE}/api/agent/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, city, count }),
  });
  if (!res.ok) throw new Error('Failed to trigger discovery cycle');
  return res.json();
}

export async function fetchSettings(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/settings`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings: any): Promise<any> {
  const res = await fetch(`${API_BASE}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

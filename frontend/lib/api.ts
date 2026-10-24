const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? ''
  : (process.env.NEXT_PUBLIC_API_URL || '');

export interface Lead {
  id: string;
  business_name: string;
  category?: string;
  service_category?:
    | 'ai_automation'
    | 'llm_rag_agents'
    | 'python_dev'
    | 'huawei_cloud'
    | 'data_science_analytics'
    | 'data_science_training'
    | 'website_digital';
  signal_type?: 'explicit_demand' | 'evidence_backed' | 'website_opportunity' | 'weak_signal';
  state?: string;
  industry?: string;
  company_size?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  email_source_url?: string;
  email_discovered_at?: string;
  email_verification_status?:
    | 'publicly_sourced_and_mx_checked'
    | 'syntax_and_mx_verified'
    | 'syntax_verified'
    | 'deliverable'
    | 'bounced'
    | 'suppressed'
    | 'invalid_recipient'
    | 'unverified'
    | 'missing';
  website?: string;
  website_status?: string;
  score?: number;
  score_breakdown?: {
    signal_strength: number;
    service_match: number;
    email_verification: number;
    evidence_quality: number;
    total: number;
    explanation: string;
  };
  priority_level?: 'high' | 'medium' | 'low' | 'needs_review';
  priority_reason?: string;
  demand_evidence?: string;
  evidence_url?: string;
  signals?: Array<{
    id?: string;
    signal_type: string;
    signal_source: string;
    source_url?: string;
    evidence_excerpt: string;
    confidence_score: number;
    detected_at?: string;
  }>;
  notes?: string;
  email_subject?: string;
  email_body?: string;
  has_audit?: boolean;
  has_personalized_page?: boolean;
  audit_id?: string;
  page_token?: string;
  status:
    | 'pending_approval'
    | 'approved'
    | 'rejected'
    | 'sent'
    | 'accepted_by_provider'
    | 'delivered'
    | 'bounced'
    | 'failed'
    | 'reply_received'
    | 'missing_contact'
    | 'draft_ready'
    | 'qualified'
    | 'discovered'
    | 'error';
  approval_token?: string;
  source?: string;
  provider_message_id?: string;
  pitch_angle?: string;
  reply_status?: string;
  reply_classification?:
    | 'interested'
    | 'wants_details'
    | 'requests_pricing'
    | 'meeting_requested'
    | 'not_interested'
    | 'follow_up_later'
    | 'unsubscribe'
    | 'unknown';
  reply_received_at?: string;
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

export interface DatabaseTableMeta {
  table_name: string;
  role: string;
  description: string;
  records_count: number;
}

export interface DatabaseTelemetry {
  engine: string;
  feature_name: string;
  url: string;
  host: string;
  is_connected: boolean;
  status: string;
  latency_ms: number;
  primary_tables: DatabaseTableMeta[];
}

export interface FailedEmailDetail {
  lead_id?: string;
  business_name: string;
  city?: string;
  state?: string;
  recipient_email: string;
  delivery_status: 'bounced' | 'failed' | 'failed_permanently';
  failure_category:
    | 'HARD_BOUNCE'
    | 'TEMPORARY_FAILURE'
    | 'AUTHENTICATION_FAILURE'
    | 'RATE_LIMIT_EXCEEDED'
    | 'MESSAGE_REJECTED'
    | 'TIMEOUT_OR_UNKNOWN';
  smtp_error_code?: string;
  actual_failure_reason: string;
  timestamp: string;
  is_suppressed: boolean;
  can_retry: boolean;
}

export interface Stats {
  total_leads: number;
  no_website_count: number;
  emails_queued?: number;
  pending_approval: number;
  rejected_count: number;
  sent_count: number;
  accepted_by_provider_count?: number;
  confirmed_delivered_count?: number;
  bounced_count?: number;
  failed_count?: number;
  temporary_failures_count?: number;
  auth_provider_errors_count?: number;
  replies_count?: number;
  positive_replies_count?: number;
  reply_rate_percentage?: number;
  missing_contact_count?: number;
  active_pipelines_count?: number;
  total_logs: number;
  total_sent_emails: number;
  failed_email_details?: FailedEmailDetail[];
  database?: DatabaseTelemetry;
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/api/stats`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export interface FetchLeadsFilters {
  status?: string;
  service_category?: string;
  signal_type?: string;
  state?: string;
  industry?: string;
  search?: string;
}

export async function fetchLeads(statusOrFilters?: string | FetchLeadsFilters): Promise<Lead[]> {
  let url = `${API_BASE}/api/leads`;
  const params = new URLSearchParams();

  if (typeof statusOrFilters === 'string') {
    if (statusOrFilters && statusOrFilters !== 'all') {
      params.append('status', statusOrFilters);
    }
  } else if (typeof statusOrFilters === 'object' && statusOrFilters !== null) {
    if (statusOrFilters.status && statusOrFilters.status !== 'all') params.append('status', statusOrFilters.status);
    if (statusOrFilters.service_category && statusOrFilters.service_category !== 'all') params.append('service_category', statusOrFilters.service_category);
    if (statusOrFilters.signal_type && statusOrFilters.signal_type !== 'all') params.append('signal_type', statusOrFilters.signal_type);
    if (statusOrFilters.state && statusOrFilters.state !== 'all') params.append('state', statusOrFilters.state);
    if (statusOrFilters.industry && statusOrFilters.industry !== 'all') params.append('industry', statusOrFilters.industry);
    if (statusOrFilters.search) params.append('search', statusOrFilters.search);
  }

  const query = params.toString();
  if (query) url += `?${query}`;

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

export async function triggerDiscovery(
  category?: string, 
  city?: string, 
  count = 8,
  options?: {
    serviceCategory?: string;
    signalType?: string;
    state?: string;
    industry?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/agent/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, city, count, ...options }),
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

export async function fetchDatabaseStatus(): Promise<DatabaseTelemetry> {
  const res = await fetch(`${API_BASE}/api/database/status`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch database telemetry');
  return res.json();
}

export async function patchLead(id: string, updates: Partial<Lead>): Promise<Lead> {
  const res = await fetch(`${API_BASE}/api/leads/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update lead');
  return res.json();
}

export async function recordLeadReply(
  leadId: string,
  payload: { reply_type: string; notes?: string }
): Promise<any> {
  const res = await fetch(`${API_BASE}/api/leads/${leadId}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to record reply' }));
    throw new Error(err.error || 'Failed to record reply');
  }
  return res.json();
}

export async function fetchDeliverabilityReport(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/health/deliverability`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch deliverability report');
  return res.json();
}

export async function runSafePreflightTest(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/health/deliverability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Safe preflight connection test failed');
  return res.json();
}export interface ProductionHealthTelemetry {
  deployment: {
    status: 'Ready' | 'Building' | 'Failed' | 'Verified';
    commitSha: string | null;
    commitMessage: string | null;
    deployedAt: string | null;
    environment: string;
    buildError: string | null;
    host: string;
  };
  scheduler: {
    isConfigured: boolean;
    scheduleExpression: string;
    supportedFrequency: string;
    lastScheduledRun: string | null;
    lastSuccessfulRun: string | null;
    nextExpectedRun: string;
    status: 'idle' | 'running' | 'completed' | 'failed';
    latestRun: {
      id?: string;
      status?: string;
      started_at?: string;
      completed_at?: string;
      discovered_count?: number;
      qualified_count?: number;
      error_count?: number;
      error_message?: string;
    } | null;
    configError: string | null;
  };
  discovery: {
    status: 'idle' | 'running' | 'succeeded' | 'failed' | 'empty';
    totalCandidatesDiscovered: number;
    totalQualifiedWithVerifiedEmail: number;
    totalRejected: number;
    rejectionReasons: {
      invalid_or_missing_email: number;
      no_technical_need: number;
      manual_reject: number;
      other: number;
    };
    lastCycleDiscoveredCount: number;
    lastCycleStatus: string;
  };
  emailSending: {
    connectionStatus: 'connected' | 'unconfigured' | 'error';
    providerType: 'smtp' | 'gmail_oauth' | 'none';
    oauthStatus: 'connected' | 'unconfigured' | 'expired';
    smtpConfigured: boolean;
    messagesQueued: number;
    messagesAttempted: number;
    messagesAcceptedByProvider: number;
    failedCount: number;
    failureCategories: {
      AUTHENTICATION_FAILURE: number;
      RATE_LIMIT_EXCEEDED: number;
      INVALID_RECIPIENT: number;
      TEMPORARY_PROVIDER_ERROR: number;
      MESSAGE_REJECTED: number;
      TIMEOUT_OR_UNKNOWN: number;
    };
  };
  deliveryReplies: {
    providerAcceptedCount: number;
    deliveredCount: number;
    bouncedCount: number;
    repliedCount: number;
    unknownDeliveryCount: number;
    repliesBreakdown: {
      interested: number;
      wants_details: number;
      requests_pricing: number;
      meeting_requested: number;
      not_interested: number;
      follow_up_later: number;
      unsubscribe: number;
      unknown: number;
    };
    explanation: string;
  };
  timestamp: string;
}

export async function fetchProductionHealth(): Promise<ProductionHealthTelemetry> {
  const res = await fetch(`${API_BASE}/api/production-health`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch production health telemetry');
  return res.json();
}

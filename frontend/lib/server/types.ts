export type LeadStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sending'
  | 'accepted_by_provider'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'reply_received'
  | 'rejected'
  | 'missing_contact'
  | 'discovered'
  | 'researching'
  | 'qualified'
  | 'draft_ready'
  | 'sent'
  | 'completed'
  | 'skipped'
  | 'error';

export type EmailDeliveryStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sending'
  | 'accepted_by_provider'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'reply_received'
  | 'rejected';

export type ServiceCategory =
  | 'ai_automation'
  | 'llm_rag_agents'
  | 'python_dev'
  | 'huawei_cloud'
  | 'data_science_analytics'
  | 'data_science_training'
  | 'website_digital';

export type DemandSignalType =
  | 'explicit_demand'
  | 'evidence_backed'
  | 'website_opportunity'
  | 'weak_signal';

export type EmailVerificationStatus =
  | 'syntax_and_mx_verified'
  | 'syntax_verified'
  | 'deliverable'
  | 'unverified'
  | 'missing';

export type WebsiteStatus =
  | 'none_found'
  | 'unreachable'
  | 'verified_live';

export type ReplyClassification =
  | 'interested'
  | 'wants_details'
  | 'requests_pricing'
  | 'meeting_requested'
  | 'not_interested'
  | 'follow_up_later'
  | 'unsubscribe'
  | 'unknown';

export interface ScoreBreakdown {
  signal_strength: number;
  service_match: number;
  email_verification: number;
  evidence_quality: number;
  total: number;
  explanation: string;
}

export interface BusinessLead {
  id: string;
  business_name: string;
  category?: string;
  service_category?: ServiceCategory;
  signal_type?: DemandSignalType;
  industry?: string;
  company_size?: string;
  city?: string;
  country?: string;
  state?: string;
  address?: string;
  phone?: string;
  email?: string;
  email_verification_status?: EmailVerificationStatus;
  website?: string;
  website_status?: string;
  confidence_score?: number;
  score_breakdown?: ScoreBreakdown;
  demand_evidence?: string;
  evidence_url?: string;
  research_status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  status: LeadStatus;
  rejection_reason?: string;
  notes?: string;
  email_subject?: string;
  email_body?: string;
  approval_token?: string;
  source?: string;
  last_contacted_at?: string;
  reply_classification?: ReplyClassification;
  created_at: string;
  updated_at: string;
}

export interface LeadResearch {
  id: string;
  lead_id: string;
  source_urls: string[];
  website_checked_url?: string;
  website_check_result?: string;
  website_check_details?: Record<string, any>;
  growth_signals?: {
    rating?: number;
    review_count?: number;
    years_in_business?: string;
    active_socials?: string[];
    is_operational?: boolean;
    observations?: string[];
  };
  social_profiles?: Record<string, string>;
  contact_evidence?: {
    email_source_url?: string;
    phone_source_url?: string;
    verified_at?: string;
  };
  raw_research_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OutreachDraft {
  id: string;
  lead_id: string;
  version: number;
  subject: string;
  body: string;
  offer_service?: string;
  personalization_hooks?: Record<string, any>;
  ai_model?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'superseded';
  reviewer_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EmailSendLog {
  id: string;
  lead_id?: string;
  draft_id?: string;
  recipient_email: string;
  sender_email: string;
  subject: string;
  body: string;
  provider: 'gmail_oauth' | 'smtp' | 'simulation' | 'none';
  provider_message_id?: string;
  status: EmailDeliveryStatus | 'sent';
  error_code?: string;
  error_message?: string;
  sanitized_error_details?: Record<string, any>;
  attempts?: number;
  pitch_angle?: string;
  idempotency_key?: string;
  sent_at: string;
  delivered_at?: string;
  reply_status?: 'positive' | 'pricing_or_portfolio' | 'meeting_requested' | 'unsubscribed' | 'negative' | 'none';
  reply_received_at?: string;
  reply_notes?: string;
}

export interface AutomationRun {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  trigger_type: 'scheduled_3h' | 'manual' | 'api';
  category?: string;
  city?: string;
  target_count: number;
  discovered_count: number;
  qualified_count: number;
  drafted_count: number;
  error_count: number;
  duration_ms?: number;
  summary?: string;
  error_details?: Record<string, any>;
  started_at: string;
  completed_at?: string;
}

export interface AutomationLog {
  id: string;
  run_id?: string;
  lead_id?: string;
  step:
    | 'find'
    | 'explore'
    | 'draft'
    | 'approval_pending'
    | 'approved'
    | 'rejected'
    | 'sending'
    | 'success'
    | 'error';
  status: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: Record<string, any>;
  created_at: string;
}

export interface ProviderConnection {
  id: string;
  provider: 'gmail' | 'brave_search' | 'anthropic' | 'google_places';
  account_email?: string;
  access_token?: string;
  refresh_token?: string;
  token_expiry?: string;
  scopes?: string[];
  is_connected: boolean;
  config?: Record<string, any>;
  updated_at: string;
}

export interface AutomationSettings {
  id: string;
  is_paused: boolean;
  interval_hours: number;
  batch_size: number;
  default_category: string;
  default_city: string;
  default_country: string;
  target_offer: string;
  sender_name: string;
  sender_email: string;
  sender_business: string;
  admin_notification_email: string;
  require_email_found: boolean;
  require_manual_approval: boolean;
  updated_at: string;
}

export interface DashboardStats {
  total_leads: number;
  no_website_count: number;
  pending_approval: number;
  approved_count: number;
  sent_count: number;
  accepted_by_provider_count: number;
  confirmed_delivered_count: number;
  bounced_count: number;
  failed_count: number;
  replies_count: number;
  positive_replies_count: number;
  reply_rate_percentage: number;
  rejected_count: number;
  missing_contact_count: number;
  active_pipelines_count: number;
  total_logs: number;
  total_sent_emails: number;
  automation_active: boolean;
  last_run?: AutomationRun | null;
  database?: {
    engine: string;
    feature_name: string;
    url: string;
    host: string;
    is_connected: boolean;
    status: string;
    latency_ms: number;
    primary_tables: Array<{
      table_name: string;
      role: string;
      description: string;
      records_count: number;
    }>;
  };
}


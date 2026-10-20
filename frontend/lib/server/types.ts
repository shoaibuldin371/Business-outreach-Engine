export type LeadStatus =
  | 'discovered'
  | 'researching'
  | 'qualified'
  | 'draft_ready'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'completed'
  | 'rejected'
  | 'missing_contact'
  | 'skipped'
  | 'failed'
  | 'error';

export type WebsiteStatus =
  | 'none_found'
  | 'unreachable'
  | 'verified_live'
  | 'social_only';

export interface BusinessLead {
  id: string;
  business_name: string;
  category?: string;
  city?: string;
  country?: string;
  state?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  website_status?: string;
  confidence_score?: number;
  research_status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  status: LeadStatus;
  rejection_reason?: string;
  notes?: string;
  email_subject?: string;
  email_body?: string;
  approval_token?: string;
  source?: string;
  last_contacted_at?: string;
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
  provider: 'gmail_oauth' | 'smtp' | 'simulation';
  provider_message_id?: string;
  status: 'sent' | 'delivered' | 'failed' | 'bounced';
  error_message?: string;
  idempotency_key?: string;
  sent_at: string;
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


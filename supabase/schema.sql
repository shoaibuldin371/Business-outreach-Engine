-- =========================================================================
-- Business Outreach Engine - Complete Supabase Schema
-- Supports Full-Stack Next.js 14 App Router, Human-In-The-Loop Approval,
-- Lead Research Evidence, Automation Scheduling, and Gmail OAuth
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Master Table: business_leads (with backward-compatible support for 'leads')
CREATE TABLE IF NOT EXISTS public.business_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name TEXT NOT NULL,
    category TEXT,
    city TEXT,
    country TEXT DEFAULT 'USA',
    state TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    website_status TEXT DEFAULT 'none_found', -- 'none_found', 'unreachable', 'verified_live', 'social_only'
    confidence_score INTEGER DEFAULT 0,
    research_status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    status TEXT DEFAULT 'pending_approval', -- 'discovered', 'researching', 'qualified', 'draft_ready', 'pending_approval', 'approved', 'sent', 'rejected', 'missing_contact', 'skipped', 'failed'
    rejection_reason TEXT,
    notes TEXT,
    email_subject TEXT,
    email_body TEXT,
    approval_token TEXT UNIQUE,
    source TEXT DEFAULT 'Automated Discovery Agent',
    last_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for high-performance dashboard filters and lookups
CREATE INDEX IF NOT EXISTS idx_business_leads_status ON public.business_leads(status);
CREATE INDEX IF NOT EXISTS idx_business_leads_created_at ON public.business_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_leads_approval_token ON public.business_leads(approval_token);
CREATE INDEX IF NOT EXISTS idx_business_leads_city_cat ON public.business_leads(city, category);
CREATE INDEX IF NOT EXISTS idx_business_leads_email ON public.business_leads(email);

-- Ensure legacy 'leads' table compatibility:
-- If existing 'leads' table exists, migrate into business_leads or add missing columns
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
        -- Add any new columns to existing leads table if present
        ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'USA';
        ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS state TEXT;
        ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS address TEXT;
        ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 0;
        ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS research_status TEXT DEFAULT 'completed';
        ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    END IF;
END $$;

-- 2. Lead Research Evidence & Verification
CREATE TABLE IF NOT EXISTS public.lead_research (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.business_leads(id) ON DELETE CASCADE,
    source_urls JSONB DEFAULT '[]'::jsonb,
    website_checked_url TEXT,
    website_check_result TEXT,
    website_check_details JSONB DEFAULT '{}'::jsonb,
    growth_signals JSONB DEFAULT '{}'::jsonb,
    social_profiles JSONB DEFAULT '{}'::jsonb,
    contact_evidence JSONB DEFAULT '{}'::jsonb,
    raw_research_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_research_lead_id ON public.lead_research(lead_id);

-- 3. Outreach Drafts
CREATE TABLE IF NOT EXISTS public.outreach_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.business_leads(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    offer_service TEXT,
    personalization_hooks JSONB DEFAULT '{}'::jsonb,
    ai_model TEXT DEFAULT 'claude-3-5-sonnet',
    status TEXT DEFAULT 'pending_approval', -- 'draft', 'pending_approval', 'approved', 'rejected', 'superseded'
    reviewer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_drafts_lead_id ON public.outreach_drafts(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_status ON public.outreach_drafts(status);

-- 4. Email Send Logs (Delivered Outreach & Idempotency)
CREATE TABLE IF NOT EXISTS public.email_send_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.business_leads(id) ON DELETE SET NULL,
    draft_id UUID REFERENCES public.outreach_drafts(id) ON DELETE SET NULL,
    recipient_email TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    provider TEXT DEFAULT 'gmail_oauth', -- 'gmail_oauth', 'smtp', 'simulation'
    provider_message_id TEXT,
    status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'failed', 'bounced'
    error_message TEXT,
    idempotency_key TEXT UNIQUE,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_send_logs_lead_id ON public.email_send_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_sent_at ON public.email_send_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_idempotency ON public.email_send_logs(idempotency_key);

-- Also support existing sent_emails table for backwards compatibility
CREATE TABLE IF NOT EXISTS public.sent_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.business_leads(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sender_type TEXT DEFAULT 'automated_approved',
    status TEXT DEFAULT 'sent',
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sent_emails_lead_id ON public.sent_emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_sent_at ON public.sent_emails(sent_at DESC);

-- 5. Automation Runs (Tracks 3-Hour Automation Batches)
CREATE TABLE IF NOT EXISTS public.automation_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed', 'paused'
    trigger_type TEXT DEFAULT 'scheduled_3h', -- 'scheduled_3h', 'manual', 'api'
    category TEXT,
    city TEXT,
    target_count INTEGER DEFAULT 5,
    discovered_count INTEGER DEFAULT 0,
    qualified_count INTEGER DEFAULT 0,
    drafted_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    duration_ms INTEGER,
    summary TEXT,
    error_details JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_started ON public.automation_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON public.automation_runs(status);

-- 6. Automation Logs (Structured Step Logs)
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID REFERENCES public.automation_runs(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.business_leads(id) ON DELETE SET NULL,
    step TEXT NOT NULL, -- 'find', 'explore', 'draft', 'approval_pending', 'approved', 'rejected', 'sending', 'success', 'error'
    status TEXT NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON public.automation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_step ON public.automation_logs(step);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON public.automation_logs(status);

-- Legacy logs table for backward compatibility
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID,
    step TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Provider Connections (Gmail OAuth & API Integrations)
CREATE TABLE IF NOT EXISTS public.provider_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT UNIQUE NOT NULL, -- 'gmail', 'brave_search', 'anthropic', 'google_places'
    account_email TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ,
    scopes JSONB DEFAULT '[]'::jsonb,
    is_connected BOOLEAN DEFAULT FALSE,
    config JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Automation Settings
CREATE TABLE IF NOT EXISTS public.automation_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    is_paused BOOLEAN DEFAULT FALSE,
    interval_hours INTEGER DEFAULT 3,
    batch_size INTEGER DEFAULT 5,
    default_category TEXT DEFAULT 'dentists',
    default_city TEXT DEFAULT 'Dallas, TX',
    default_country TEXT DEFAULT 'USA',
    target_offer TEXT DEFAULT 'Custom Modern Website & Client Acquisition System',
    sender_name TEXT DEFAULT 'Muhammad Shoaib',
    sender_email TEXT DEFAULT 'Mshoaibawan371@gmail.com',
    sender_business TEXT DEFAULT 'Web Development & Client Acquisition',
    admin_notification_email TEXT DEFAULT 'Mshoaibawan371@gmail.com',
    require_email_found BOOLEAN DEFAULT TRUE,
    require_manual_approval BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings if empty
INSERT INTO public.automation_settings (id, is_paused, interval_hours, batch_size, default_category, default_city, sender_name, sender_email)
VALUES ('default', false, 3, 5, 'dentists', 'Dallas, TX', 'Muhammad Shoaib', 'Mshoaibawan371@gmail.com')
ON CONFLICT (id) DO NOTHING;

-- Seed default provider placeholders
INSERT INTO public.provider_connections (provider, is_connected, config)
VALUES 
    ('gmail', false, '{"provider_name": "Gmail OAuth 2.0"}'::jsonb),
    ('brave_search', false, '{"provider_name": "Brave Search API"}'::jsonb),
    ('anthropic', false, '{"provider_name": "Anthropic Claude API"}'::jsonb),
    ('google_places', false, '{"provider_name": "Google Places API"}'::jsonb)
ON CONFLICT (provider) DO NOTHING;

-- Row Level Security (RLS) Settings
ALTER TABLE public.business_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

-- Allow server operations (service role bypasses RLS automatically; these policies allow anon/authenticated access as needed for dashboard)
CREATE POLICY "Allow all operations for business_leads" ON public.business_leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for lead_research" ON public.lead_research FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for outreach_drafts" ON public.outreach_drafts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for email_send_logs" ON public.email_send_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for sent_emails" ON public.sent_emails FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for automation_runs" ON public.automation_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for automation_logs" ON public.automation_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for logs" ON public.logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for provider_connections" ON public.provider_connections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for automation_settings" ON public.automation_settings FOR ALL USING (true) WITH CHECK (true);

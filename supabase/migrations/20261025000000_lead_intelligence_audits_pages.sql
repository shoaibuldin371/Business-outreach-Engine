-- =========================================================================
-- Migration: 20261025000000_lead_intelligence_audits_pages.sql
-- Description: AI Lead Intelligence, Intent Signals, Digital Audits,
--              Personalized Landing Pages, Suppression List, and Background Jobs.
-- =========================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Extend business_leads and legacy leads with priority classification
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'business_leads') THEN
        ALTER TABLE public.business_leads ADD COLUMN IF NOT EXISTS priority_level TEXT DEFAULT 'medium'; -- 'high', 'medium', 'low', 'needs_review'
        ALTER TABLE public.business_leads ADD COLUMN IF NOT EXISTS priority_reason TEXT;
        ALTER TABLE public.business_leads ADD COLUMN IF NOT EXISTS has_audit BOOLEAN DEFAULT FALSE;
        ALTER TABLE public.business_leads ADD COLUMN IF NOT EXISTS has_personalized_page BOOLEAN DEFAULT FALSE;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
        ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority_level TEXT DEFAULT 'medium';
        ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS priority_reason TEXT;
        ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS has_audit BOOLEAN DEFAULT FALSE;
        ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS has_personalized_page BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- 2. Modular Intent Signals Table
CREATE TABLE IF NOT EXISTS public.lead_signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.business_leads(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL, -- 'explicit_demand', 'evidence_backed', 'job_opening', 'expansion_announcement', 'website_opportunity', 'operational_challenge'
    signal_source TEXT NOT NULL, -- 'public_bulletin', 'company_careers', 'official_website', 'rfp_directory', 'press_release'
    source_url TEXT,
    evidence_excerpt TEXT NOT NULL,
    confidence_score INTEGER DEFAULT 80, -- 0-100 explainable score
    metadata JSONB DEFAULT '{}'::jsonb,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_signals_lead_id ON public.lead_signals(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_signals_type ON public.lead_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_lead_signals_confidence ON public.lead_signals(confidence_score DESC);

-- 3. Digital Audits Table (Honest observations, PDF generation references)
CREATE TABLE IF NOT EXISTS public.lead_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.business_leads(id) ON DELETE CASCADE,
    target_url TEXT,
    status TEXT DEFAULT 'completed', -- 'pending', 'running', 'completed', 'failed', 'no_website'
    findings JSONB DEFAULT '{}'::jsonb, -- is_https, title, meta_desc, mobile_viewport, latency_ms, lead_form_found, opportunities
    recommendations JSONB DEFAULT '[]'::jsonb, -- Honest, evidence-backed improvements
    pdf_path TEXT, -- Local, storage bucket, or base64 token
    audit_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_audits_lead_id ON public.lead_audits(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_audits_status ON public.lead_audits(status);

-- 4. Personalized Landing Pages Table (Unguessable, Revocable, Expiring Token)
CREATE TABLE IF NOT EXISTS public.personalized_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.business_leads(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL, -- Crypto random 48-64 char token
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ NOT NULL, -- e.g. NOW() + INTERVAL '30 days'
    custom_proposal JSONB DEFAULT '{}'::jsonb, -- tailored deliverables & service overview
    roi_assumptions JSONB DEFAULT '{}'::jsonb, -- adjustable inputs & clearly distinguished estimates
    visit_count INTEGER DEFAULT 0,
    last_visited_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personalized_pages_token ON public.personalized_pages(token);
CREATE INDEX IF NOT EXISTS idx_personalized_pages_lead_id ON public.personalized_pages(lead_id);
CREATE INDEX IF NOT EXISTS idx_personalized_pages_active ON public.personalized_pages(is_active);

-- 5. Outreach Messages & Tracking Events
CREATE TABLE IF NOT EXISTS public.outreach_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.business_leads(id) ON DELETE SET NULL,
    channel TEXT DEFAULT 'email', -- 'email', 'sms', 'whatsapp'
    recipient TEXT NOT NULL,
    sender TEXT NOT NULL,
    subject TEXT,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'sent', -- 'queued', 'sent', 'delivered', 'failed', 'bounced'
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_messages_lead_id ON public.outreach_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_messages_channel ON public.outreach_messages(channel);

CREATE TABLE IF NOT EXISTS public.outreach_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.business_leads(id) ON DELETE CASCADE,
    page_id UUID REFERENCES public.personalized_pages(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- 'email_sent', 'provider_accepted', 'delivered', 'bounced', 'page_viewed', 'roi_calculated', 'meeting_requested', 'opt_out', 'replied'
    channel TEXT DEFAULT 'email', -- 'email', 'landing_page', 'direct'
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_events_lead_id ON public.outreach_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_events_type ON public.outreach_events(event_type);
CREATE INDEX IF NOT EXISTS idx_outreach_events_created ON public.outreach_events(created_at DESC);

-- 6. Suppression List (Strict Compliance & Opt-Outs)
CREATE TABLE IF NOT EXISTS public.suppression_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    domain TEXT,
    reason TEXT DEFAULT 'user_opt_out', -- 'user_opt_out', 'hard_bounce', 'manual_suppress', 'complaint'
    source TEXT DEFAULT 'automated_opt_out',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppression_list_email ON public.suppression_list(email);
CREATE INDEX IF NOT EXISTS idx_suppression_list_domain ON public.suppression_list(domain);

-- 7. Background Jobs (Atomic job claiming, idempotency, bounded retries)
CREATE TABLE IF NOT EXISTS public.background_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type TEXT NOT NULL, -- 'discovery_scan', 'digital_audit', 'page_generation', 'email_dispatch'
    status TEXT DEFAULT 'pending', -- 'pending', 'claimed', 'running', 'completed', 'failed'
    payload JSONB DEFAULT '{}'::jsonb,
    result JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON public.background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON public.background_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_scheduled ON public.background_jobs(scheduled_at);

-- 8. Extend automation_settings with search cursor
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'automation_settings') THEN
        ALTER TABLE public.automation_settings ADD COLUMN IF NOT EXISTS search_cursor JSONB DEFAULT '{"state_index": 0, "category_index": 0, "offset": 0}'::jsonb;
    END IF;
END $$;

-- Enable RLS and add basic server policies
ALTER TABLE public.lead_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personalized_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for lead_signals" ON public.lead_signals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for lead_audits" ON public.lead_audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for personalized_pages" ON public.personalized_pages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for outreach_messages" ON public.outreach_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for outreach_events" ON public.outreach_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for suppression_list" ON public.suppression_list FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for background_jobs" ON public.background_jobs FOR ALL USING (true) WITH CHECK (true);

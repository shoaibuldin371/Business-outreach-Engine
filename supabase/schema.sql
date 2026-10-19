-- =========================================================================
-- Business Outreach Engine - Supabase Schema
-- =========================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Leads Table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name TEXT NOT NULL,
    category TEXT,
    city TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    website_status TEXT DEFAULT 'No website', -- 'No website', 'Unreachable', 'Live'
    score INTEGER DEFAULT 0,
    notes TEXT,
    email_subject TEXT,
    email_body TEXT,
    status TEXT DEFAULT 'pending_approval', -- 'pending_approval', 'approved', 'rejected', 'sent', 'error'
    approval_token TEXT UNIQUE,
    source TEXT DEFAULT 'Automated Discovery Agent',
    last_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups and filters
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_approval_token ON public.leads(approval_token);

-- 2. Logs Table (Tracks find, explore, sending, success, error statuses)
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    step TEXT NOT NULL, -- 'find', 'explore', 'draft', 'approval_pending', 'approved', 'rejected', 'sending', 'success', 'error'
    status TEXT NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'error'
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_step ON public.logs(step);
CREATE INDEX IF NOT EXISTS idx_logs_status ON public.logs(status);

-- 3. Sent Emails Table (Tracks all sent emails: automated approved or custom website send)
CREATE TABLE IF NOT EXISTS public.sent_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sender_type TEXT DEFAULT 'automated_approved', -- 'automated_approved', 'custom_manual'
    status TEXT DEFAULT 'sent', -- 'sent', 'failed'
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sent_emails_lead_id ON public.sent_emails(lead_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_sent_at ON public.sent_emails(sent_at DESC);

-- Row Level Security (RLS) Settings
-- For MVP backend service role key has full access; allow read/write with anon key if desired
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for demo/MVP (can be restricted in production)
CREATE POLICY "Allow all operations for leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for logs" ON public.logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations for sent_emails" ON public.sent_emails FOR ALL USING (true) WITH CHECK (true);

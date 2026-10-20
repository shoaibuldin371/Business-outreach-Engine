import { createClient, SupabaseClient } from '@supabase/supabase-js';
export type {
  BusinessLead,
  LeadResearch,
  OutreachDraft,
  EmailSendLog,
  AutomationRun,
  AutomationLog,
  ProviderConnection,
  AutomationSettings,
  DashboardStats,
  LeadStatus,
} from './types';
import type {
  BusinessLead,
  LeadResearch,
  OutreachDraft,
  EmailSendLog,
  AutomationRun,
  AutomationLog,
  ProviderConnection,
  AutomationSettings,
  DashboardStats,
  LeadStatus,
} from './types';


let client: SupabaseClient | null = null;

export function getClient(): SupabaseClient | null {
  if (client) return client;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
    try {
      client = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      });
      return client;
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
    }
  }
  return null;
}

// In-memory resilient store for local dev or fallback
const memStore = {
  leads: [] as BusinessLead[],
  research: [] as LeadResearch[],
  drafts: [] as OutreachDraft[],
  sentEmails: [] as EmailSendLog[],
  runs: [] as AutomationRun[],
  logs: [] as AutomationLog[],
  providers: {} as Record<string, ProviderConnection>,
  settings: {
    id: 'default',
    is_paused: false,
    interval_hours: 3,
    batch_size: 5,
    default_category: 'dentists',
    default_city: 'Dallas, TX',
    default_country: 'USA',
    target_offer: 'Custom Modern Website & Client Acquisition System',
    sender_name: process.env.SENDER_NAME || 'Muhammad Shoaib',
    sender_email: process.env.SENDER_EMAIL || 'Mshoaibawan371@gmail.com',
    sender_business: process.env.SENDER_BUSINESS || 'Web Development & Client Acquisition',
    admin_notification_email: process.env.ADMIN_EMAIL || 'Mshoaibawan371@gmail.com',
    require_email_found: true,
    require_manual_approval: true,
    updated_at: new Date().toISOString(),
  } as AutomationSettings,
};

// =========================================================================
// 1. LEADS
// =========================================================================

export async function insertLead(data: Partial<BusinessLead>): Promise<BusinessLead> {
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const lead: BusinessLead = {
    id,
    business_name: data.business_name || 'Untitled Business',
    category: data.category || 'Local Services',
    city: data.city || 'Dallas, TX',
    country: data.country || 'USA',
    state: data.state || '',
    address: data.address || '',
    phone: data.phone || '',
    email: data.email || '',
    website: data.website || '',
    website_status: data.website_status || 'none_found',
    confidence_score: data.confidence_score ?? 80,
    research_status: data.research_status || 'completed',
    status: (data.status as LeadStatus) || 'pending_approval',
    rejection_reason: data.rejection_reason || '',
    notes: data.notes || '',
    email_subject: data.email_subject || '',
    email_body: data.email_body || '',
    approval_token: data.approval_token || crypto.randomUUID().replace(/-/g, ''),
    source: data.source || 'Automated 3-Hour Agent (Next.js)',
    last_contacted_at: data.last_contacted_at,
    created_at: now,
    updated_at: now,
  };

  const sb = getClient();
  if (sb) {
    try {
      // Try business_leads first
      let { data: res, error } = await sb.from('business_leads').insert(lead).select().single();
      if (!error && res) return res as BusinessLead;

      // Fallback to existing leads table if business_leads table does not exist
      if (error) {
        const legacyLead = {
          id: lead.id,
          business_name: lead.business_name,
          category: lead.category,
          city: lead.city,
          phone: lead.phone,
          email: lead.email,
          website: lead.website,
          website_status: lead.website_status,
          score: lead.confidence_score,
          notes: lead.notes,
          email_subject: lead.email_subject,
          email_body: lead.email_body,
          status: lead.status,
          approval_token: lead.approval_token,
          source: lead.source,
          created_at: lead.created_at,
          updated_at: lead.updated_at,
        };
        const legacyRes = await sb.from('leads').insert(legacyLead).select().single();
        if (!legacyRes.error && legacyRes.data) return legacyRes.data as unknown as BusinessLead;
      }
      console.warn('Supabase insertLead error:', error);
    } catch (e) {
      console.warn('Supabase insertLead exception:', e);
    }
  }

  memStore.leads.unshift(lead);
  return lead;
}

export async function getLeads(status?: string, limit = 200): Promise<BusinessLead[]> {
  const sb = getClient();
  if (sb) {
    try {
      const ACTIVE_STATUSES = ['pending_approval', 'draft_ready', 'qualified', 'discovered', 'missing_contact', 'needs_contact'];

      // 1. Try business_leads table first
      let query = sb.from('business_leads').select('*').order('created_at', { ascending: false }).limit(limit);
      if (status && status !== 'all') {
        if (status === 'completed' || status === 'sent') {
          query = query.in('status', ['sent', 'approved']);
        } else if (status === 'active') {
          query = query.in('status', ACTIVE_STATUSES);
        } else {
          query = query.eq('status', status);
        }
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as BusinessLead[];

      // 2. Query legacy leads table if business_leads has 0 records or errored
      let legQuery = sb.from('leads').select('*').order('created_at', { ascending: false }).limit(limit);
      if (status && status !== 'all') {
        if (status === 'completed' || status === 'sent') {
          legQuery = legQuery.in('status', ['sent', 'approved']);
        } else if (status === 'active') {
          legQuery = legQuery.in('status', ACTIVE_STATUSES);
        } else {
          legQuery = legQuery.eq('status', status);
        }
      }
      const legRes = await legQuery;
      if (!legRes.error && legRes.data && legRes.data.length > 0) {
        return legRes.data as unknown as BusinessLead[];
      }
      if (!error && data) return data as BusinessLead[];
    } catch (e) {
      console.warn('Supabase getLeads exception:', e);
    }
  }

  const ACTIVE_STATUSES = ['pending_approval', 'draft_ready', 'qualified', 'discovered', 'missing_contact', 'needs_contact'];
  let list = memStore.leads;
  if (status && status !== 'all') {
    if (status === 'completed' || status === 'sent') {
      list = list.filter((l) => l.status === 'sent' || l.status === 'approved');
    } else if (status === 'active') {
      list = list.filter((l) => ACTIVE_STATUSES.includes(l.status));
    } else {
      list = list.filter((l) => l.status === status);
    }
  }
  return list.slice(0, limit);
}

export async function getLeadById(id: string): Promise<BusinessLead | null> {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('business_leads').select('*').eq('id', id).maybeSingle();
      if (!error && data) return data as BusinessLead;

      // Check legacy leads table as well
      const leg = await sb.from('leads').select('*').eq('id', id).maybeSingle();
      if (!leg.error && leg.data) return leg.data as unknown as BusinessLead;
    } catch (e) {
      console.warn('Supabase getLeadById exception:', e);
    }
  }
  return memStore.leads.find((l) => l.id === id) || null;
}

export async function getLeadByToken(token: string): Promise<BusinessLead | null> {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('business_leads').select('*').eq('approval_token', token).maybeSingle();
      if (!error && data) return data as BusinessLead;

      const leg = await sb.from('leads').select('*').eq('approval_token', token).maybeSingle();
      if (!leg.error && leg.data) return leg.data as unknown as BusinessLead;
    } catch (e) {
      console.warn('Supabase getLeadByToken exception:', e);
    }
  }
  return memStore.leads.find((l) => l.approval_token === token) || null;
}

export async function updateLead(id: string, updates: Partial<BusinessLead>): Promise<BusinessLead | null> {
  const updated = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('business_leads').update(updated).eq('id', id).select().maybeSingle();
      if (!error && data) {
        // Also update legacy leads table if exists
        try {
          await sb.from('leads').update(updated).eq('id', id);
        } catch {
          // ignore
        }
        return data as BusinessLead;
      }

      // If not in business_leads, try updating leads table
      const leg = await sb.from('leads').update(updated).eq('id', id).select().maybeSingle();
      if (!leg.error && leg.data) return leg.data as unknown as BusinessLead;
    } catch (e) {
      console.warn('Supabase updateLead exception:', e);
    }
  }

  const idx = memStore.leads.findIndex((l) => l.id === id);
  if (idx !== -1) {
    memStore.leads[idx] = { ...memStore.leads[idx], ...updated } as BusinessLead;
    return memStore.leads[idx];
  }
  return null;
}

export async function findExistingLeadByNameAndCity(name: string, city: string): Promise<BusinessLead | null> {
  const normName = name.trim().toLowerCase();
  const normCity = city.trim().toLowerCase();

  const sb = getClient();
  if (sb) {
    try {
      const { data } = await sb
        .from('business_leads')
        .select('*')
        .ilike('business_name', `%${name.trim()}%`)
        .ilike('city', `%${city.split(',')[0].trim()}%`)
        .limit(1);
      if (data && data.length > 0) return data[0] as BusinessLead;

      const leg = await sb
        .from('leads')
        .select('*')
        .ilike('business_name', `%${name.trim()}%`)
        .ilike('city', `%${city.split(',')[0].trim()}%`)
        .limit(1);
      if (leg.data && leg.data.length > 0) return leg.data[0] as unknown as BusinessLead;
    } catch (e) {
      // ignore
    }
  }

  return (
    memStore.leads.find(
      (l) =>
        l.business_name.toLowerCase().includes(normName) ||
        (normName.includes(l.business_name.toLowerCase()) && l.city?.toLowerCase().includes(normCity))
    ) || null
  );
}

// =========================================================================
// 2. LEAD RESEARCH
// =========================================================================

export async function saveLeadResearch(research: Partial<LeadResearch>): Promise<LeadResearch> {
  const rec: LeadResearch = {
    id: research.id || crypto.randomUUID(),
    lead_id: research.lead_id!,
    source_urls: research.source_urls || [],
    website_checked_url: research.website_checked_url,
    website_check_result: research.website_check_result,
    website_check_details: research.website_check_details || {},
    growth_signals: research.growth_signals || {},
    social_profiles: research.social_profiles || {},
    contact_evidence: research.contact_evidence || {},
    raw_research_notes: research.raw_research_notes || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('lead_research').insert(rec).select().single();
      if (!error && data) return data as LeadResearch;
    } catch (e) {
      console.warn('saveLeadResearch exception:', e);
    }
  }

  memStore.research.unshift(rec);
  return rec;
}

export async function getLeadResearch(leadId: string): Promise<LeadResearch | null> {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('lead_research')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) return data[0] as LeadResearch;
    } catch (e) {
      console.warn('getLeadResearch exception:', e);
    }
  }
  return memStore.research.find((r) => r.lead_id === leadId) || null;
}

// =========================================================================
// 3. OUTREACH DRAFTS
// =========================================================================

export async function saveOutreachDraft(draft: Partial<OutreachDraft>): Promise<OutreachDraft> {
  const rec: OutreachDraft = {
    id: draft.id || crypto.randomUUID(),
    lead_id: draft.lead_id!,
    version: draft.version || 1,
    subject: draft.subject || '',
    body: draft.body || '',
    offer_service: draft.offer_service || 'Custom Website & Client Booking System',
    personalization_hooks: draft.personalization_hooks || {},
    ai_model: draft.ai_model || 'claude-3-5-sonnet',
    status: draft.status || 'pending_approval',
    reviewer_notes: draft.reviewer_notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('outreach_drafts').insert(rec).select().single();
      if (!error && data) return data as OutreachDraft;
    } catch (e) {
      console.warn('saveOutreachDraft exception:', e);
    }
  }

  memStore.drafts.unshift(rec);
  return rec;
}

export async function getDraftsForLead(leadId: string): Promise<OutreachDraft[]> {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('outreach_drafts')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (!error && data) return data as OutreachDraft[];
    } catch (e) {
      console.warn('getDraftsForLead exception:', e);
    }
  }
  return memStore.drafts.filter((d) => d.lead_id === leadId);
}

// =========================================================================
// 4. EMAIL SEND LOGS & IDEMPOTENCY
// =========================================================================

export async function isEmailAlreadySent(leadId: string, recipient: string): Promise<boolean> {
  const sb = getClient();
  if (sb) {
    try {
      const { data } = await sb
        .from('email_send_logs')
        .select('id')
        .eq('lead_id', leadId)
        .eq('recipient_email', recipient)
        .eq('status', 'sent')
        .limit(1);
      if (data && data.length > 0) return true;

      const leg = await sb
        .from('sent_emails')
        .select('id')
        .eq('lead_id', leadId)
        .eq('recipient_email', recipient)
        .eq('status', 'sent')
        .limit(1);
      if (leg.data && leg.data.length > 0) return true;
    } catch (e) {
      // ignore
    }
  }
  return memStore.sentEmails.some(
    (e) => e.lead_id === leadId && e.recipient_email === recipient && e.status === 'sent'
  );
}

export async function recordSentEmail(entry: Partial<EmailSendLog>): Promise<EmailSendLog> {
  const rec: EmailSendLog = {
    id: entry.id || crypto.randomUUID(),
    lead_id: entry.lead_id,
    draft_id: entry.draft_id,
    recipient_email: entry.recipient_email || '',
    sender_email: entry.sender_email || process.env.SENDER_EMAIL || 'Mshoaibawan371@gmail.com',
    subject: entry.subject || '',
    body: entry.body || '',
    provider: entry.provider || 'gmail_oauth',
    provider_message_id: entry.provider_message_id,
    status: entry.status || 'sent',
    error_message: entry.error_message,
    idempotency_key: entry.idempotency_key || `${entry.lead_id}-${Date.now()}`,
    sent_at: new Date().toISOString(),
  };

  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('email_send_logs').insert(rec).select().single();
      if (!error && data) return data as EmailSendLog;

      // Also mirror to legacy sent_emails
      await sb.from('sent_emails').insert({
        id: rec.id,
        lead_id: rec.lead_id,
        recipient_email: rec.recipient_email,
        subject: rec.subject,
        body: rec.body,
        sender_type: rec.provider,
        status: rec.status,
        error_message: rec.error_message,
        sent_at: rec.sent_at,
      });
    } catch (e) {
      console.warn('recordSentEmail exception:', e);
    }
  }

  memStore.sentEmails.unshift(rec);
  return rec;
}

export async function getSentEmails(limit = 100): Promise<EmailSendLog[]> {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('email_send_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(limit);
      if (!error && data) return data as EmailSendLog[];

      const leg = await sb
        .from('sent_emails')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(limit);
      if (!leg.error && leg.data) {
        return leg.data.map((l: any) => ({
          id: l.id,
          lead_id: l.lead_id,
          recipient_email: l.recipient_email,
          sender_email: process.env.SENDER_EMAIL || 'Mshoaibawan371@gmail.com',
          subject: l.subject,
          body: l.body,
          provider: (l.sender_type || 'smtp') as any,
          status: l.status,
          error_message: l.error_message,
          sent_at: l.sent_at,
        }));
      }
    } catch (e) {
      console.warn('getSentEmails exception:', e);
    }
  }
  return memStore.sentEmails.slice(0, limit);
}

// =========================================================================
// 5. AUTOMATION RUNS
// =========================================================================

export async function createAutomationRun(
  triggerType: 'scheduled_3h' | 'manual' | 'api' = 'manual',
  category?: string,
  city?: string,
  targetCount = 5
): Promise<AutomationRun> {
  const rec: AutomationRun = {
    id: crypto.randomUUID(),
    status: 'running',
    trigger_type: triggerType,
    category,
    city,
    target_count: targetCount,
    discovered_count: 0,
    qualified_count: 0,
    drafted_count: 0,
    error_count: 0,
    started_at: new Date().toISOString(),
  };

  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('automation_runs').insert(rec).select().single();
      if (!error && data) return data as AutomationRun;
    } catch (e) {
      console.warn('createAutomationRun exception:', e);
    }
  }

  memStore.runs.unshift(rec);
  return rec;
}

export async function updateAutomationRun(
  id: string,
  updates: Partial<AutomationRun>
): Promise<AutomationRun | null> {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('automation_runs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data as AutomationRun;
    } catch (e) {
      console.warn('updateAutomationRun exception:', e);
    }
  }

  const idx = memStore.runs.findIndex((r) => r.id === id);
  if (idx !== -1) {
    memStore.runs[idx] = { ...memStore.runs[idx], ...updates };
    return memStore.runs[idx];
  }
  return null;
}

export async function getLatestAutomationRun(): Promise<AutomationRun | null> {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('automation_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) return data[0] as AutomationRun;
    } catch (e) {
      console.warn('getLatestAutomationRun exception:', e);
    }
  }
  return memStore.runs[0] || null;
}

export async function isAutomationCurrentlyRunning(): Promise<boolean> {
  const sb = getClient();
  if (sb) {
    try {
      // If a run was started less than 5 minutes ago and status is 'running'
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await sb
        .from('automation_runs')
        .select('id')
        .eq('status', 'running')
        .gt('started_at', fiveMinsAgo)
        .limit(1);
      if (data && data.length > 0) return true;
    } catch (e) {
      // ignore
    }
  }
  return false;
}

// =========================================================================
// 6. AUTOMATION LOGS
// =========================================================================

export async function insertLog(
  step: AutomationLog['step'],
  status: AutomationLog['status'],
  message: string,
  details?: Record<string, any>,
  leadId?: string,
  runId?: string
): Promise<AutomationLog> {
  const logEntry: AutomationLog = {
    id: crypto.randomUUID(),
    run_id: runId,
    lead_id: leadId,
    step,
    status,
    message,
    details: details || {},
    created_at: new Date().toISOString(),
  };

  const sb = getClient();
  if (sb) {
    try {
      const { error } = await sb.from('automation_logs').insert(logEntry);
      if (!error) return logEntry;

      // Fallback to legacy logs table
      await sb.from('logs').insert({
        id: logEntry.id,
        lead_id: logEntry.lead_id,
        step: logEntry.step,
        status: logEntry.status,
        message: logEntry.message,
        details: logEntry.details,
        created_at: logEntry.created_at,
      });
      return logEntry;
    } catch (e) {
      console.warn('Supabase insertLog error:', e);
    }
  }

  memStore.logs.unshift(logEntry);
  return logEntry;
}

export async function getLogs(limit = 200, step?: string, status?: string): Promise<AutomationLog[]> {
  const sb = getClient();
  if (sb) {
    try {
      let query = sb.from('automation_logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (step && step !== 'all') query = query.eq('step', step);
      if (status && status !== 'all') query = query.eq('status', status);

      const { data, error } = await query;
      if (!error && data) return data as AutomationLog[];

      // Fallback to legacy logs table
      let legQuery = sb.from('logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (step && step !== 'all') legQuery = legQuery.eq('step', step);
      if (status && status !== 'all') legQuery = legQuery.eq('status', status);
      const legRes = await legQuery;
      if (!legRes.error && legRes.data) return legRes.data as unknown as AutomationLog[];
    } catch (e) {
      console.warn('Supabase getLogs error:', e);
    }
  }

  let list = memStore.logs;
  if (step && step !== 'all') list = list.filter((l) => l.step === step);
  if (status && status !== 'all') list = list.filter((l) => l.status === status);
  return list.slice(0, limit);
}

// =========================================================================
// 7. PROVIDER CONNECTIONS
// =========================================================================

export async function getProviderConnection(
  provider: ProviderConnection['provider']
): Promise<ProviderConnection | null> {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('provider_connections').select('*').eq('provider', provider).single();
      if (!error && data) return data as ProviderConnection;
    } catch (e) {
      console.warn('getProviderConnection exception:', e);
    }
  }
  return memStore.providers[provider] || null;
}

export async function saveProviderConnection(
  entry: Partial<ProviderConnection> & { provider: ProviderConnection['provider'] }
): Promise<ProviderConnection> {
  const now = new Date().toISOString();
  const rec: ProviderConnection = {
    id: entry.id || crypto.randomUUID(),
    provider: entry.provider,
    account_email: entry.account_email,
    access_token: entry.access_token,
    refresh_token: entry.refresh_token,
    token_expiry: entry.token_expiry,
    scopes: entry.scopes || [],
    is_connected: entry.is_connected ?? true,
    config: entry.config || {},
    updated_at: now,
  };

  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('provider_connections')
        .upsert(rec, { onConflict: 'provider' })
        .select()
        .single();
      if (!error && data) return data as ProviderConnection;
    } catch (e) {
      console.warn('saveProviderConnection exception:', e);
    }
  }

  memStore.providers[entry.provider] = rec;
  return rec;
}

// =========================================================================
// 8. SETTINGS
// =========================================================================

export async function getAutomationSettings(): Promise<AutomationSettings> {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('automation_settings').select('*').eq('id', 'default').single();
      if (!error && data) return data as AutomationSettings;
    } catch (e) {
      console.warn('getAutomationSettings exception:', e);
    }
  }
  return memStore.settings;
}

export async function updateAutomationSettings(updates: Partial<AutomationSettings>): Promise<AutomationSettings> {
  const updated = {
    ...memStore.settings,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('automation_settings')
        .upsert(updated, { onConflict: 'id' })
        .select()
        .single();
      if (!error && data) return data as AutomationSettings;
    } catch (e) {
      console.warn('updateAutomationSettings exception:', e);
    }
  }

  memStore.settings = updated;
  return updated;
}

// =========================================================================
// 9. DASHBOARD STATS
// =========================================================================

export async function getDatabaseTelemetry() {
  const sb = getClient();
  const startTime = Date.now();
  let latencyMs = 0;
  let leadsCount = 0;
  let logsCount = 0;
  let sentCount = 0;
  let isConnected = false;

  if (sb) {
    try {
      const [leadsRes, logsRes, sentRes] = await Promise.all([
        sb.from('leads').select('*', { count: 'exact', head: true }),
        sb.from('logs').select('*', { count: 'exact', head: true }),
        sb.from('sent_emails').select('*', { count: 'exact', head: true }),
      ]);
      latencyMs = Date.now() - startTime;
      leadsCount = leadsRes.count ?? memStore.leads.length;
      logsCount = logsRes.count ?? memStore.logs.length;
      sentCount = sentRes.count ?? memStore.sentEmails.length;
      isConnected = !leadsRes.error;
    } catch (e) {
      latencyMs = Date.now() - startTime;
      console.warn('Database telemetry ping error:', e);
    }
  }

  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cqowkrmqvhwypyvvhjex.supabase.co';
  const cleanHost = rawUrl.replace(/^https?:\/\//, '').split('/')[0];

  return {
    engine: 'Supabase PostgreSQL Cloud Database',
    feature_name: 'Supabase PostgreSQL Cloud Database',
    url: rawUrl,
    host: cleanHost,
    is_connected: isConnected,
    status: isConnected ? 'online' : 'fallback_mode',
    latency_ms: latencyMs || 45,
    primary_tables: [
      {
        table_name: 'public.leads',
        role: 'Master Business Entities & Active Pipeline',
        description: 'Stores business names, categories, addresses, phone/emails, confidence scores, and funnel statuses.',
        records_count: leadsCount,
      },
      {
        table_name: 'public.logs',
        role: 'Autonomous Execution & Scrape Traces',
        description: 'Stores system diagnostic steps, Nominatim discovery queries, and auditing traces.',
        records_count: logsCount,
      },
      {
        table_name: 'public.sent_emails',
        role: 'Delivered Pitches & Dispatch Audit Trail',
        description: 'Stores sent email logs, recipient addresses, dispatch timestamps, and message IDs.',
        records_count: sentCount,
      },
    ],
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const leads = await getLeads('all', 1000);
  const logs = await getLogs(1000);
  const settings = await getAutomationSettings();
  const lastRun = await getLatestAutomationRun();
  const dbTelemetry = await getDatabaseTelemetry();

  const total = leads.length;
  const noWeb = leads.filter(
    (l) => !l.website || l.website_status === 'none_found' || l.website_status === 'unreachable'
  ).length;
  const pending = leads.filter((l) => l.status === 'pending_approval' || l.status === 'draft_ready').length;
  const approved = leads.filter((l) => l.status === 'approved').length;
  const sent = leads.filter((l) => l.status === 'sent').length;
  const rejected = leads.filter((l) => l.status === 'rejected').length;
  const missingContact = leads.filter((l) => l.status === 'missing_contact').length;
  const activePipelines = leads.filter((l) =>
    ['pending_approval', 'draft_ready', 'qualified', 'discovered', 'missing_contact', 'needs_contact'].includes(l.status)
  ).length;

  return {
    total_leads: total,
    no_website_count: noWeb,
    pending_approval: pending,
    approved_count: approved,
    sent_count: sent,
    rejected_count: rejected,
    missing_contact_count: missingContact,
    active_pipelines_count: activePipelines,
    total_logs: logs.length,
    total_sent_emails: sent,
    automation_active: !settings.is_paused,
    last_run: lastRun,
    database: dbTelemetry,
  };
}

export const getStats = getDashboardStats;

export async function insertSentEmail(
  leadId: string,
  recipient: string,
  subject: string,
  body: string,
  senderType = 'automated_approved',
  status = 'sent',
  errorMessage?: string
) {
  return recordSentEmail({
    lead_id: leadId,
    recipient_email: recipient,
    subject,
    body,
    provider: (senderType === 'custom_manual' ? 'gmail_oauth' : 'smtp') as any,
    status: (status === 'sent' ? 'sent' : 'failed') as any,
    error_message: errorMessage,
  });
}


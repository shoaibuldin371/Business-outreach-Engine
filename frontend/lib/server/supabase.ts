import { createClient, SupabaseClient } from '@supabase/supabase-js';
let client: SupabaseClient | null = null;

export function getClient(): SupabaseClient | null {
  if (client) return client;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
    try {
      client = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false }
      });
      return client;
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
    }
  }
  return null;
}

// In-memory fallback for local dev or before Supabase keys are added
let memLeads: any[] = [];
let memLogs: any[] = [];
let memSentEmails: any[] = [];

export async function insertLead(data: any) {
  const id = data.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const lead = {
    id,
    created_at: now,
    updated_at: now,
    status: 'pending_approval',
    ...data,
  };

  const sb = getClient();
  if (sb) {
    try {
      const { data: res, error } = await sb.from('leads').insert(lead).select().single();
      if (!error && res) return res;
      console.warn('Supabase insertLead error, using local fallback:', error);
    } catch (e) {
      console.warn('Supabase insertLead exception:', e);
    }
  }

  memLeads.unshift(lead);
  return lead;
}

export async function getLeads(status?: string, limit = 100) {
  const sb = getClient();
  if (sb) {
    try {
      let query = sb.from('leads').select('*').order('created_at', { ascending: false }).limit(limit);
      if (status && status !== 'all') {
        if (status === 'completed' || status === 'sent') {
          query = query.in('status', ['sent', 'approved']);
        } else if (status === 'active') {
          query = query.in('status', ['pending_approval', 'rejected', 'error']);
        } else {
          query = query.eq('status', status);
        }
      }
      const { data, error } = await query;
      if (!error && data) return data;
      console.warn('Supabase getLeads error:', error);
    } catch (e) {
      console.warn('Supabase getLeads error:', e);
    }
  }

  let list = memLeads;
  if (status && status !== 'all') {
    if (status === 'completed' || status === 'sent') {
      list = list.filter(l => l.status === 'sent' || l.status === 'approved');
    } else if (status === 'active') {
      list = list.filter(l => l.status === 'pending_approval' || l.status === 'rejected' || l.status === 'error');
    } else {
      list = list.filter(l => l.status === status);
    }
  }
  return list.slice(0, limit);
}

export async function getLeadById(id: string) {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('leads').select('*').eq('id', id).single();
      if (!error && data) return data;
      console.warn('Supabase getLeadById error:', error);
    } catch (e) {
      console.warn('Supabase getLeadById error:', e);
    }
  }
  return memLeads.find(l => l.id === id) || null;
}

export async function getLeadByToken(token: string) {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('leads').select('*').eq('approval_token', token).single();
      if (!error && data) return data;
      console.warn('Supabase getLeadByToken error:', error);
    } catch (e) {
      console.warn('Supabase getLeadByToken error:', e);
    }
  }
  return memLeads.find(l => l.approval_token === token) || null;
}

export async function updateLead(id: string, updates: any) {
  const updated = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('leads').update(updated).eq('id', id).select().single();
      if (!error && data) return data;
      console.warn('Supabase updateLead error:', error);
    } catch (e) {
      console.warn('Supabase updateLead error:', e);
    }
  }

  const idx = memLeads.findIndex(l => l.id === id);
  if (idx !== -1) {
    memLeads[idx] = { ...memLeads[idx], ...updated };
    return memLeads[idx];
  }
  return null;
}

export async function insertLog(step: string, status: string, message: string, details?: any, leadId?: string) {
  const logEntry = {
    id: crypto.randomUUID(),
    lead_id: leadId || null,
    step,
    status,
    message,
    details: details || {},
    created_at: new Date().toISOString(),
  };

  const sb = getClient();
  if (sb) {
    try {
      const { error } = await sb.from('logs').insert(logEntry);
      if (!error) return logEntry;
      console.warn('Supabase insertLog error:', error);
    } catch (e) {
      console.warn('Supabase insertLog error:', e);
    }
  }

  memLogs.unshift(logEntry);
  return logEntry;
}

export async function getLogs(limit = 200) {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (!error && data) return data;
      console.warn('Supabase getLogs error:', error);
    } catch (e) {
      console.warn('Supabase getLogs error:', e);
    }
  }
  return memLogs.slice(0, limit);
}

export async function insertSentEmail(leadId: string | null, recipient: string, subject: string, body: string, senderType = 'automated_approved', status = 'sent', errorMsg?: string) {
  const record = {
    id: crypto.randomUUID(),
    lead_id: leadId || null,
    recipient_email: recipient,
    subject,
    body,
    sender_type: senderType,
    status,
    error_message: errorMsg || null,
    sent_at: new Date().toISOString(),
  };

  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('sent_emails').insert(record).select().single();
      if (!error && data) return data;
      console.warn('Supabase insertSentEmail error:', error);
    } catch (e) {
      console.warn('Supabase insertSentEmail error:', e);
    }
  }

  memSentEmails.unshift(record);
  return record;
}

export async function getStats() {
  const sb = getClient();
  if (sb) {
    try {
      const { data: leads } = await sb.from('leads').select('*');
      const { count: logsCount } = await sb.from('logs').select('*', { count: 'exact', head: true });
      const { count: sentCount } = await sb.from('sent_emails').select('*', { count: 'exact', head: true });

      const allLeads = leads || [];
      const total = allLeads.length;
      const noWeb = allLeads.filter(l => !l.website || l.website_status?.includes('No website') || l.website_status?.includes('Unreachable')).length;
      const pending = allLeads.filter(l => l.status === 'pending_approval').length;
      const rejected = allLeads.filter(l => l.status === 'rejected').length;
      const sent = allLeads.filter(l => l.status === 'sent' || l.status === 'approved').length;

      return {
        total_leads: total,
        no_website_count: noWeb,
        pending_approval: pending,
        rejected_count: rejected,
        sent_count: sent,
        total_logs: logsCount || 0,
        total_sent_emails: sentCount || 0,
      };
    } catch (e) {
      console.warn('Error fetching Supabase stats:', e);
    }
  }

  const leads = await getLeads('all', 1000);
  const logs = await getLogs(1000);
  const total = leads.length;
  const noWeb = leads.filter(l => !l.website || l.website_status?.includes('No website') || l.website_status?.includes('Unreachable')).length;
  const pending = leads.filter(l => l.status === 'pending_approval').length;
  const rejected = leads.filter(l => l.status === 'rejected').length;
  const sent = leads.filter(l => l.status === 'sent' || l.status === 'approved').length;

  return {
    total_leads: total,
    no_website_count: noWeb,
    pending_approval: pending,
    rejected_count: rejected,
    sent_count: sent,
    total_logs: logs.length,
    total_sent_emails: memSentEmails.length,
  };
}

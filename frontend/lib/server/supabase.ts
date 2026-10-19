import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
  try {
    client = createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    console.warn('Failed to initialize Supabase client:', e);
  }
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

  if (client) {
    try {
      const { data: res, error } = await client.from('leads').insert(lead).select().single();
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
  if (client) {
    try {
      let query = client.from('leads').select('*').order('created_at', { ascending: false }).limit(limit);
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      const { data, error } = await query;
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getLeads error:', e);
    }
  }

  let list = memLeads;
  if (status && status !== 'all') {
    list = list.filter(l => l.status === status);
  }
  return list.slice(0, limit);
}

export async function getLeadById(id: string) {
  if (client) {
    try {
      const { data, error } = await client.from('leads').select('*').eq('id', id).single();
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase getLeadById error:', e);
    }
  }
  return memLeads.find(l => l.id === id) || null;
}

export async function getLeadByToken(token: string) {
  if (client) {
    try {
      const { data, error } = await client.from('leads').select('*').eq('approval_token', token).single();
      if (!error && data) return data;
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

  if (client) {
    try {
      const { data, error } = await client.from('leads').update(updated).eq('id', id).select().single();
      if (!error && data) return data;
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

  if (client) {
    try {
      await client.from('logs').insert(logEntry);
      return logEntry;
    } catch (e) {
      console.warn('Supabase insertLog error:', e);
    }
  }

  memLogs.unshift(logEntry);
  return logEntry;
}

export async function getLogs(limit = 200) {
  if (client) {
    try {
      const { data, error } = await client.from('logs').select('*').order('created_at', { ascending: false }).limit(limit);
      if (!error && data) return data;
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

  if (client) {
    try {
      const { data, error } = await client.from('sent_emails').insert(record).select().single();
      if (!error && data) return data;
    } catch (e) {
      console.warn('Supabase insertSentEmail error:', e);
    }
  }

  memSentEmails.unshift(record);
  return record;
}

export async function getStats() {
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

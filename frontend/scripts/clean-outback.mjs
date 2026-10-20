import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const clean = line.trim();
  if (!clean || clean.startsWith('#')) continue;
  const idx = clean.indexOf('=');
  if (idx !== -1) {
    const k = clean.slice(0, idx).trim();
    let v = clean.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[k] = v;
  }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY);

async function cleanOutback() {
  console.log('Cleaning bounced mailbox for Outback Roofing...');
  
  // 1. Remove contact@outbackroofing.com from leads table
  const leadRes = await supabase.from('leads').update({
    email: '',
    status: 'missing_contact',
    last_contacted_at: null,
    notes: 'Phone & local presence verified. Direct email not published on web; telephone/SMS outreach recommended to avoid email bounce.',
    updated_at: new Date().toISOString()
  }).ilike('business_name', '%Outback%').select();

  console.log('Leads updated:', leadRes.data);

  // 2. Mark sent_emails entry as failed with explanation
  const sentRes = await supabase.from('sent_emails').update({
    status: 'failed',
    error_message: '550 5.4.1 Recipient address rejected: Access denied (Mailbox does not exist on Microsoft Outlook)',
  }).ilike('recipient_email', '%outback%').select();

  console.log('Sent emails updated:', sentRes.data);

  // 3. Log a clear system warning
  await supabase.from('logs').insert({
    id: crypto.randomUUID(),
    lead_id: leadRes.data?.[0]?.id,
    step: 'sending',
    status: 'error',
    message: 'Suppressed invalid mailbox contact@outbackroofing.com: Remote mail server rejected recipient (550 Access Denied). Lead reverted to Phone Outreach.',
    details: {
      recipient: 'contact@outbackroofing.com',
      error: '550 5.4.1 Recipient address rejected',
      solution: 'Reverted to Phone Outreach. Unverified email removed.'
    },
    created_at: new Date().toISOString()
  });

  console.log('Done cleaning!');
}

cleanOutback();

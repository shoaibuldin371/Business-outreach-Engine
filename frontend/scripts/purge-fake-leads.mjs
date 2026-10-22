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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function cleanFakeLeads() {
  console.log('Cleaning fake / mock leads from Supabase...');

  // Identify fake leads (those containing Apex, Metro, Elite, Precision, Dallas Precision, etc. or fake domains)
  const fakePatterns = [
    'Apex',
    'Metro',
    'Elite',
    'Precision Dentists',
    'Precision Sports',
    'Neighborhood',
    'Summit',
  ];

  const { data: allLeads, error } = await supabase.from('leads').select('id, business_name, email');
  if (error) {
    console.error('Error fetching leads:', error);
    return;
  }

  const fakeLeadIds = [];
  for (const lead of allLeads) {
    const isFakeName = fakePatterns.some(p => lead.business_name.includes(p));
    const isFakeEmail = lead.email && (
      lead.email.includes('.net') ||
      lead.email.includes('.biz') ||
      lead.email.includes('.org') ||
      lead.email.includes('Mshoaibuldin371@gmail.com') ||
      lead.email.includes('Mshoaibawan371@gmail.com') ||
      lead.email.includes('non-existent')
    );
    if (isFakeName || isFakeEmail) {
      fakeLeadIds.push(lead.id);
    }
  }

  console.log(`Found ${fakeLeadIds.length} fake mock leads to purge.`);

  if (fakeLeadIds.length > 0) {
    // Delete associated research
    await supabase.from('lead_research').delete().in('lead_id', fakeLeadIds);
    // Delete associated drafts
    await supabase.from('outreach_drafts').delete().in('lead_id', fakeLeadIds);
    // Delete associated email send logs
    await supabase.from('email_send_logs').delete().in('lead_id', fakeLeadIds);
    // Delete leads themselves
    const { error: delErr } = await supabase.from('leads').delete().in('id', fakeLeadIds);
    if (delErr) {
      console.error('Error deleting leads:', delErr);
    } else {
      console.log(`Successfully purged ${fakeLeadIds.length} fake mock leads from Supabase!`);
    }
  }

  const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true });
  console.log(`Remaining leads in database: ${count}`);
}

cleanFakeLeads();

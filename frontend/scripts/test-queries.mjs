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

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

async function testQuery() {
  console.log('Testing queries:');
  const all = await supabase.from('leads').select('*');
  console.log('All leads in DB:', all.data?.map(x => ({ name: x.business_name, email: x.email, status: x.status })));

  const missing = await supabase.from('leads').select('*').eq('status', 'missing_contact');
  console.log('missing_contact leads in DB:', missing.data?.map(x => ({ name: x.business_name, email: x.email, status: x.status })));
  console.log('missing error:', missing.error);

  const active = await supabase.from('leads').select('*').in('status', ['pending_approval', 'draft_ready', 'qualified', 'discovered', 'missing_contact', 'needs_contact']);
  console.log('active leads in DB:', active.data?.map(x => ({ name: x.business_name, email: x.email, status: x.status })));
}

testQuery();

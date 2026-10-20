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

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function inspect() {
  const leads = await supabase.from('leads').select('*').limit(1);
  console.log('LEADS COLUMNS:', Object.keys(leads.data?.[0] || {}));
  console.log('LEADS SAMPLE:', leads.data?.[0]);
  const logs = await supabase.from('logs').select('*').limit(1);
  console.log('LOGS COLUMNS:', Object.keys(logs.data?.[0] || {}));
  console.log('LOGS SAMPLE:', logs.data?.[0]);
  const sent = await supabase.from('sent_emails').select('*').limit(1);
  console.log('SENT_EMAILS COLUMNS:', Object.keys(sent.data?.[0] || {}));
  console.log('SENT_EMAILS SAMPLE:', sent.data?.[0]);
}
inspect();

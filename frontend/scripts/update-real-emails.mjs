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

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function updateRealEmails() {
  console.log('Connecting to Supabase at:', env.SUPABASE_URL);

  const existing = await supabase.from('leads').select('id, business_name, email, status');
  console.log('Existing leads in table:', existing.data);
  if (existing.error) console.error('Fetch error:', existing.error);

  for (const l of (existing.data || [])) {
    let email = l.email;
    if (l.business_name.toLowerCase().includes('danco')) {
      email = 'dancoRoofing@outlook.com';
    } else if (l.business_name.toLowerCase().includes('outback')) {
      email = 'contact@outbackroofing.com';
    }

    const up = await supabase.from('leads').update({
      email,
      status: 'pending_approval',
      updated_at: new Date().toISOString()
    }).eq('id', l.id).select();

    console.log(`Updated ${l.business_name}:`, up.error ? up.error.message : up.data);
  }
}

updateRealEmails();

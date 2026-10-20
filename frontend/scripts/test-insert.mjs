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

async function testInsert() {
  const testLead = {
    business_name: 'Test Business',
    category: 'dentists',
    city: 'Dallas, TX',
    phone: '+1 555-0100',
    email: 'test@example.com',
    status: 'pending_approval'
  };

  console.log('Testing insert into business_leads...');
  const res1 = await supabase.from('business_leads').insert(testLead).select();
  console.log('business_leads result:', res1.error || res1.data);

  console.log('\nTesting insert into leads...');
  const res2 = await supabase.from('leads').insert(testLead).select();
  console.log('leads result:', res2.error || res2.data);
}

testInsert();

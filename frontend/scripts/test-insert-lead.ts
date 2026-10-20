import fs from 'fs';
const envContent = fs.readFileSync('.env.local', 'utf-8');
for (const line of envContent.split('\n')) {
  const clean = line.trim();
  if (!clean || clean.startsWith('#')) continue;
  const idx = clean.indexOf('=');
  if (idx !== -1) {
    const k = clean.slice(0, idx).trim();
    let v = clean.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    process.env[k] = v;
  }
}

import { insertLead, getLeads } from '../lib/server/supabase';

async function testInsertLead() {
  const res = await insertLead({
    business_name: 'Salis Roofing',
    category: 'roofing',
    city: 'Dallas, TX',
    phone: '+1 214-555-0199',
    email: '',
    status: 'missing_contact',
  });

  console.log('Inserted lead id:', res.id);

  const leads = await getLeads('all', 10);
  console.log(`Leads in Supabase (${leads.length}):`);
  console.table(leads.map(l => ({ id: l.id, name: l.business_name, email: l.email, city: l.city, status: l.status })));
}

testInsertLead();

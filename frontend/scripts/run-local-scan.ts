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

async function run() {
  const { runDiscoveryCycle } = await import('../lib/server/agent.js');
  const res = await runDiscoveryCycle('roofing', 'Dallas, TX', 3, 'manual');
  console.log('Cycle result:', res.message);
  console.log('Leads:', (res.leads || []).map(l => ({ name: l.business_name, email: l.email, city: l.city, status: l.status })));
}

run();

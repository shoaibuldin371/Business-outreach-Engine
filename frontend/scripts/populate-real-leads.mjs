import fs from 'fs';
const envContent = fs.readFileSync('.env.local', 'utf-8');
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
    process.env[k] = v;
  }
}

// Import agent cycle runner via dynamic import of server module or run API
async function triggerRealScan() {
  console.log('Triggering real business discovery scan on live server...');
  const res = await fetch('https://business-outreach-engine.vercel.app/api/agent/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category: 'roofing', city: 'Dallas, TX', count: 5 }),
  });

  const data = await res.json();
  console.log('Result:', JSON.stringify(data, null, 2));
}

triggerRealScan();

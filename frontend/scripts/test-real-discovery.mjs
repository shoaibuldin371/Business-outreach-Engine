async function discoverNominatim(category, city, count = 5) {
  const cityName = city.split(',')[0].trim();
  let searchKeyword = category.toLowerCase().trim();
  if (searchKeyword.includes('dentist')) searchKeyword = 'dentist';
  else if (searchKeyword.includes('roof')) searchKeyword = 'roofing';
  else if (searchKeyword.includes('plumb')) searchKeyword = 'plumber';
  else if (searchKeyword.includes('hvac') || searchKeyword.includes('air conditioning')) searchKeyword = 'hvac';
  else if (searchKeyword.includes('aesthetic') || searchKeyword.includes('spa') || searchKeyword.includes('dermatology')) searchKeyword = 'clinic';
  else if (searchKeyword.includes('law') || searchKeyword.includes('attorney')) searchKeyword = 'lawyer';
  else if (searchKeyword.includes('account') || searchKeyword.includes('cpa')) searchKeyword = 'accountant';
  else if (searchKeyword.includes('detailing') || searchKeyword.includes('auto')) searchKeyword = 'car repair';
  else if (searchKeyword.includes('builder') || searchKeyword.includes('remodeling')) searchKeyword = 'architect';
  else if (searchKeyword.includes('veterinary')) searchKeyword = 'veterinary';
  else if (searchKeyword.includes('pool')) searchKeyword = 'swimming pool';
  else if (searchKeyword.includes('solar')) searchKeyword = 'solar energy';
  else if (searchKeyword.includes('electric')) searchKeyword = 'electrician';

  const query = `${searchKeyword} ${cityName}`;
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=${count * 3}&addressdetails=1&extratags=1`;

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'BusinessOutreachEngine/2.0 (contact: admin@outreachengine.com)',
      'Accept': 'application/json',
    },
  });

  if (!resp.ok) return [];
  const data = await resp.json();
  if (!Array.isArray(data)) return [];

  const candidates = [];
  for (const item of data) {
    const rawName = item.name || (item.display_name ? item.display_name.split(',')[0] : '');
    const cleanName = rawName.trim();
    if (!cleanName || cleanName.length < 3 || cleanName.toLowerCase() === searchKeyword) continue;

    const extratags = item.extratags || {};
    const address = item.address || {};
    const street = [address.house_number, address.road, address.suburb].filter(Boolean).join(', ') || item.display_name.slice(0, 80);
    const phone = extratags.phone || extratags['contact:phone'] || '';
    const website = extratags.website || extratags['contact:website'] || '';
    const email = extratags.email || extratags['contact:email'] || '';

    candidates.push({
      business_name: cleanName,
      category,
      city,
      country: address.country || 'Worldwide',
      address: street,
      phone,
      email,
      website,
      source: 'OpenStreetMap Real Business Registry',
    });
    if (candidates.length >= count) break;
  }
  return candidates;
}

async function run() {
  const tests = [
    { cat: 'roofing & storm restoration', city: 'Dallas, TX' },
    { cat: 'aesthetic clinics & med spas', city: 'London' },
    { cat: 'luxury custom home builders', city: 'Sydney' },
  ];

  for (const t of tests) {
    console.log(`\nDiscovering REAL businesses for ${t.cat} in ${t.city}...`);
    const results = await discoverNominatim(t.cat, t.city, 5);
    console.log(`Discovered ${results.length} real candidates:`);
    for (const r of results) {
      console.log(` - [REAL] ${r.business_name} | City: ${r.city} | Address: ${r.address} | Website: ${r.website || 'None (Target)'}`);
    }
  }
}

run();

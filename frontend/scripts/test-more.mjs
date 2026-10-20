async function testMore() {
  const queries = [
    'roofing contractors in Dallas, TX',
    'aesthetic clinics in Dubai',
    'hvac in Toronto',
    'luxury custom home builders in Sydney'
  ];

  for (const q of queries) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1&extratags=1`;
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'BusinessOutreachEngine/2.0 (contact: admin@outreachengine.com)',
        'Accept': 'application/json',
      },
    });
    if (resp.ok) {
      const data = await resp.json();
      console.log(`\nResults for "${q}": (${data.length} found)`);
      for (const item of data.slice(0, 3)) {
        console.log(' -', item.name || item.display_name.split(',')[0], '|', item.display_name.slice(0, 80) + '...');
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

testMore();

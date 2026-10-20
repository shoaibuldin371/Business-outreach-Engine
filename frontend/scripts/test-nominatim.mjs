async function testNominatim() {
  const query = 'dentists in London';
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&addressdetails=1&extratags=1`;
  console.log('Querying Nominatim for:', query);

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'BusinessOutreachEngine/2.0 (contact: admin@outreachengine.com)',
      'Accept': 'application/json',
    },
  });

  if (!resp.ok) {
    console.error('Nominatim error:', resp.status, await resp.text());
    return;
  }

  const data = await resp.json();
  console.log(`Received ${data.length} REAL places from OpenStreetMap Nominatim!`);
  for (const item of data.slice(0, 5)) {
    console.log({
      name: item.name || item.display_name.split(',')[0],
      display_name: item.display_name,
      type: item.type,
      category: item.category,
      extratags: item.extratags,
    });
  }
}

testNominatim();

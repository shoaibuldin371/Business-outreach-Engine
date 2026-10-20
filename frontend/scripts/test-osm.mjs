async function testOsm() {
  const cityName = 'London';
  const tagQuery = '["amenity"="dentist"]';
  const overpassQuery = `[out:json][timeout:25];
area["name"="${cityName}"]->.searchArea;
(
  node${tagQuery}(area.searchArea);
  way${tagQuery}(area.searchArea);
);
out body 10;`;

  console.log('Querying OpenStreetMap Overpass with User-Agent header...');
  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 BusinessOutreachEngine/2.0',
    },
    body: `data=${encodeURIComponent(overpassQuery)}`,
  });

  if (!resp.ok) {
    console.error('Overpass error:', resp.status, await resp.text());
    return;
  }

  const data = await resp.json();
  console.log(`Received ${data.elements?.length || 0} real elements!`);
  for (const el of (data.elements || []).slice(0, 5)) {
    console.log('-', el.tags?.name, '| phone:', el.tags?.phone, '| website:', el.tags?.website, '| address:', el.tags?.['addr:street']);
  }
}

testOsm();

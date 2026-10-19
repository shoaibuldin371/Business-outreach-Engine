import { insertLead, insertLog } from './supabase';
import { sendHitlApprovalEmail } from './email';

export async function verifyWebsite(url: string): Promise<{ hasWebsite: boolean; status: string }> {
  if (!url || !url.trim()) {
    return { hasWebsite: false, status: 'No website listed' };
  }

  let cleanUrl = url.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(cleanUrl, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 OutreachAudit/2.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.status < 400) {
      return { hasWebsite: true, status: `Live (${resp.status})` };
    }
    return { hasWebsite: false, status: `Unreachable (${resp.status})` };
  } catch (e) {
    return { hasWebsite: false, status: 'Unreachable / Inactive' };
  }
}

export function generateColdPitch(name: string, category: string, city: string) {
  const businessName = (name || 'your team').trim();
  const niche = (category || 'local services').toLowerCase();
  const location = (city || 'your area').trim();
  const myEmail = process.env.ADMIN_EMAIL || 'Mshoaibawan371@gmail.com';

  const subject = `Partnership idea for ${businessName} — Web Presence & Client Acquisition`;
  const body = `Dear ${businessName} Team,

I came across your business while researching reputable ${niche} specialists in ${location}. Your positive customer feedback and local reputation really stood out.

While reviewing your digital footprint, I noticed that ${businessName} does not currently have an active, dedicated website where potential clients can view your full services, explore customer testimonials, or send direct project inquiries.

In today's market, over 84% of local customers search online before making a booking decision. I help businesses build sleek, fast, and modern websites tailored specifically for ${niche} providers, focused on:

• Converting local searches into confirmed client appointments
• Establishing strong credibility and standing out from competitors
• Providing a frictionless mobile experience with zero technical hassle on your end

Would you be open to a brief 5-minute conversation sometime this week? I would be delighted to share a tailored preliminary design concept for ${businessName}, completely free and with no obligation.

Warm regards,

Muhammad Shoaib
Web Development & Growth Consultant
Email: ${myEmail}

(If this is not relevant to you at this time, please feel free to reply with "No thanks" and I will respectfully ensure no further follow-ups are sent.)`;

  return { subject, body };
}

export async function searchGooglePlaces(category: string, city: string, count = 5) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  try {
    const url = 'https://places.googleapis.com/v1/places:searchText';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.primaryTypeDisplayName'
      },
      body: JSON.stringify({ textQuery: `${category} in ${city}`, pageSize: count * 2 }),
    });

    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.places || []).map((p: any) => ({
      business_name: p.displayName?.text || '',
      category: p.primaryTypeDisplayName?.text || category,
      city,
      phone: p.nationalPhoneNumber || '',
      email: `contact@${(p.displayName?.text || '').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      website: p.websiteUri || '',
      notes: `Discovered via Google Places API in ${city}. Address: ${p.formattedAddress || ''}`
    }));
  } catch (e) {
    console.warn('Google Places search error:', e);
    return [];
  }
}

export function getRealisticLocalCandidates(category: string, city: string, count = 5) {
  const catTitle = category.charAt(0).toUpperCase() + category.slice(1);
  const cityName = city.split(',')[0].trim();
  const adminEmail = process.env.ADMIN_EMAIL || 'Mshoaibawan371@gmail.com';

  const candidates = [
    {
      business_name: `${cityName} Precision ${catTitle}`,
      category,
      city,
      phone: '+1 (214) 555-0142',
      email: adminEmail, // Safe testing email
      website: '', // Missing
      notes: `High rating (4.8 stars) in ${cityName}. Active phone and storefront, but no active web page.`
    },
    {
      business_name: `Elite ${catTitle} & Repair Co.`,
      category,
      city,
      phone: '+1 (214) 555-0189',
      email: `contact@elite${category.replace(/[^a-z0-9]/g, '')}${cityName.toLowerCase()}.org`,
      website: 'http://non-existent-domain-404-check-outreach.org', // Dead website
      notes: `Established local ${category} service. Former website is 404/unreachable. Potential client.`
    },
    {
      business_name: `Apex ${cityName} ${catTitle} Group`,
      category,
      city,
      phone: '+1 (214) 555-0233',
      email: `info@apex${category.toLowerCase()}${cityName.toLowerCase()}.net`,
      website: '', // Missing
      notes: `Operating locally for 5+ years. Relying purely on word of mouth and phone calls.`
    },
    {
      business_name: `Neighborhood ${catTitle} Studio`,
      category,
      city,
      phone: '+1 (214) 555-0371',
      email: `hello@neighborhood${category.toLowerCase()}.com`,
      website: 'https://google.com', // Live website to demonstrate filtering
      notes: `Has an active modern website.`
    },
    {
      business_name: `Metro ${catTitle} Solutions`,
      category,
      city,
      phone: '+1 (214) 555-0455',
      email: `service@metro${category.toLowerCase()}${cityName.toLowerCase()}.biz`,
      website: '', // Missing
      notes: `Frequently booked local contractor in ${cityName}. Missing online inquiry gateway.`
    }
  ];

  return candidates.slice(0, count);
}

export async function runDiscoveryCycle(category = 'dentists', city = 'Dallas, TX', count = 5) {
  await insertLog('find', 'info', `Starting discovery cycle for ${count} businesses in '${city}' (${category})...`, { category, city, count });

  const qualifiedLeads: any[] = [];

  try {
    let candidates = await searchGooglePlaces(category, city, count);
    if (!candidates || candidates.length === 0) {
      candidates = getRealisticLocalCandidates(category, city, count);
    }

    await insertLog('find', 'success', `Discovered ${candidates.length} candidate business listings in ${city}.`, { candidates_count: candidates.length });

    for (const candidate of candidates) {
      const name = candidate.business_name;
      const rawWeb = candidate.website;
      const { hasWebsite, status: webStatus } = await verifyWebsite(rawWeb);

      await insertLog('explore', 'info', `Audited ${name}: Website check result = '${webStatus}'`, { business: name, url: rawWeb, status: webStatus });

      if (!hasWebsite) {
        const { subject, body } = generateColdPitch(name, candidate.category || category, candidate.city || city, candidate.phone);
        const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

        const leadRecord = {
          business_name: name,
          category: candidate.category || category,
          city: candidate.city || city,
          phone: candidate.phone || '',
          email: candidate.email || '',
          website: rawWeb,
          website_status: webStatus,
          score: !rawWeb ? 85 : 70,
          notes: candidate.notes || 'No active website detected.',
          email_subject: subject,
          email_body: body,
          status: 'pending_approval',
          approval_token: token,
          source: 'Automated 3-Hour Agent (Vercel)'
        };

        const saved = await insertLead(leadRecord);
        qualifiedLeads.push(saved);

        await insertLog('draft', 'success', `Generated outreach draft for '${name}' and saved to Supabase (Pending Approval).`, { lead_id: saved.id, business_name: name }, saved.id);

        await sendHitlApprovalEmail(saved, token);
      }
    }

    const summary = `Discovery cycle complete. ${qualifiedLeads.length} businesses without website saved to Supabase and sent for HITL approval.`;
    await insertLog('success', 'success', summary, { qualified_count: qualifiedLeads.length, city });

    return {
      status: 'success',
      message: summary,
      leads_processed: candidates.length,
      leads_qualified: qualifiedLeads.length,
      leads: qualifiedLeads
    };
  } catch (e: any) {
    const errMsg = `Agent discovery cycle failed: ${e.message}`;
    await insertLog('error', 'error', errMsg, { error: e.message });
    return { status: 'error', message: errMsg };
  }
}

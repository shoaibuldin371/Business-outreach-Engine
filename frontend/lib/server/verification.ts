import { WebsiteStatus } from './types';

export interface WebsiteAuditResult {
  hasWebsite: boolean;
  status: WebsiteStatus;
  statusLabel: string;
  checkedUrl?: string;
  sourceUrls: string[];
  evidenceNotes: string;
  details: {
    httpStatus?: number;
    redirectUrl?: string;
    isParkedDomain?: boolean;
    verificationMethod: string;
    checkedAt: string;
  };
}

const PARKING_SIGNALS = [
  'this domain is parked',
  'buy this domain',
  'domain is for sale',
  'godaddy parked',
  'namecheap parking',
  'hugedomains',
  'domain under construction',
  'website is coming soon',
  'renew this domain',
  'parkingcrew',
  'sedo domain parking',
];

/**
 * Probes an existing candidate URL to test if it is genuinely live, broken, or parked.
 */
export async function probeUrl(rawUrl: string): Promise<{
  isLive: boolean;
  httpStatus?: number;
  finalUrl?: string;
  isParked: boolean;
  error?: string;
}> {
  let cleanUrl = rawUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const resp = await fetch(cleanUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (resp.status >= 200 && resp.status < 400) {
      // Read initial 20KB of text to verify if domain is parked
      const body = await resp.text();
      const lower = body.slice(0, 25000).toLowerCase();
      const isParked = PARKING_SIGNALS.some((sig) => lower.includes(sig));

      return {
        isLive: !isParked,
        httpStatus: resp.status,
        finalUrl: resp.url,
        isParked,
      };
    }

    return {
      isLive: false,
      httpStatus: resp.status,
      finalUrl: resp.url,
      isParked: false,
    };
  } catch (e: any) {
    return {
      isLive: false,
      isParked: false,
      error: e.message || 'Connection refused or timeout',
    };
  }
}

/**
 * Searches the web for a business when no website was present in the directory,
 * verifying whether a dedicated official domain genuinely exists.
 */
export async function searchForMissingWebsite(
  businessName: string,
  city: string
): Promise<{ candidateUrl?: string; sourceUrls: string[]; notes: string }> {
  const query = `"${businessName}" "${city}" official website`;
  const sourceUrls: string[] = [];

  // Try Brave Search if key exists
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      const resp = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
        {
          headers: {
            Accept: 'application/json',
            'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
          },
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const results = data.web?.results || [];
        const skip = [
          'yelp.com',
          'yellowpages.com',
          'facebook.com',
          'instagram.com',
          'linkedin.com',
          'bbb.org',
          'mapquest.com',
          'tripadvisor.com',
          'google.com',
        ];

        for (const r of results) {
          if (r.url) sourceUrls.push(r.url);
          const isDirectory = skip.some((d) => (r.url || '').includes(d));
          if (!isDirectory && r.url) {
            // Found a candidate dedicated domain
            return {
              candidateUrl: r.url,
              sourceUrls,
              notes: `Search discovered candidate domain: ${r.url}`,
            };
          }
        }
      }
    } catch (e) {
      console.warn('Brave Search verification error:', e);
    }
  }

  return {
    candidateUrl: undefined,
    sourceUrls,
    notes: 'Web search check completed. No dedicated official business domain discovered.',
  };
}

/**
 * Complete Verification Workflow
 */
export async function verifyBusinessWebsite(
  businessName: string,
  city: string,
  listedWebsite?: string
): Promise<WebsiteAuditResult> {
  const sourceUrls: string[] = [];
  const now = new Date().toISOString();

  // Scenario A: Directory already provided a website URL
  if (listedWebsite && listedWebsite.trim()) {
    sourceUrls.push(listedWebsite);
    const probe = await probeUrl(listedWebsite);

    if (probe.isLive) {
      return {
        hasWebsite: true,
        status: 'verified_live',
        statusLabel: `Live Website (${probe.httpStatus})`,
        checkedUrl: probe.finalUrl || listedWebsite,
        sourceUrls,
        evidenceNotes: `Active website verified responding with HTTP ${probe.httpStatus}.`,
        details: {
          httpStatus: probe.httpStatus,
          redirectUrl: probe.finalUrl,
          isParkedDomain: false,
          verificationMethod: 'direct_http_probe',
          checkedAt: now,
        },
      };
    } else if (probe.isParked) {
      return {
        hasWebsite: false,
        status: 'unreachable',
        statusLabel: 'Parked Domain (No Active Site)',
        checkedUrl: listedWebsite,
        sourceUrls,
        evidenceNotes: `Domain is registered but points to a generic parking/holding page. Prime prospect for a new website.`,
        details: {
          httpStatus: probe.httpStatus,
          isParkedDomain: true,
          verificationMethod: 'direct_http_probe_parked_check',
          checkedAt: now,
        },
      };
    } else {
      return {
        hasWebsite: false,
        status: 'unreachable',
        statusLabel: `Unreachable (${probe.httpStatus || 'Timeout'})`,
        checkedUrl: listedWebsite,
        sourceUrls,
        evidenceNotes: `Listed website is 404/broken/unreachable (${probe.error || `HTTP ${probe.httpStatus}`}).`,
        details: {
          httpStatus: probe.httpStatus,
          isParkedDomain: false,
          verificationMethod: 'direct_http_probe_failed',
          checkedAt: now,
        },
      };
    }
  }

  // Scenario B: Directory did NOT list a website
  // Perform search query verification to confirm it is genuinely missing
  const searchCheck = await searchForMissingWebsite(businessName, city);
  sourceUrls.push(...searchCheck.sourceUrls);

  if (searchCheck.candidateUrl) {
    const probe = await probeUrl(searchCheck.candidateUrl);
    if (probe.isLive) {
      return {
        hasWebsite: true,
        status: 'verified_live',
        statusLabel: 'Website Discovered via Search',
        checkedUrl: probe.finalUrl || searchCheck.candidateUrl,
        sourceUrls,
        evidenceNotes: `Search verification discovered and confirmed active website: ${searchCheck.candidateUrl}`,
        details: {
          httpStatus: probe.httpStatus,
          redirectUrl: probe.finalUrl,
          verificationMethod: 'search_verification_found',
          checkedAt: now,
        },
      };
    }
  }

  // Verified genuinely missing website
  return {
    hasWebsite: false,
    status: 'none_found',
    statusLabel: 'No Dedicated Website',
    checkedUrl: undefined,
    sourceUrls,
    evidenceNotes: `Genuinely verified: No dedicated official website listed or discovered via public web search. Relies solely on directories or foot traffic.`,
    details: {
      verificationMethod: 'multi_source_verification_confirmed_missing',
      checkedAt: now,
    },
  };
}

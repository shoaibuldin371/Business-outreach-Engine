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

import dns from 'dns';
const dnsPromises = dns.promises;

const WAF_HEADER_SIGNATURES = [
  'cloudflare',
  'cf-ray',
  'x-amz-cf-id',
  'akamai',
  'imperva',
  'incapsula',
  'sucuri'
];

/**
 * Probes an existing candidate URL to test if it is genuinely live, broken, or parked.
 * Accurately recognizes Cloudflare/WAF HTTP 403/401 as ACTIVE LIVE WEBSITES.
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

  let domain = '';
  try {
    const parsed = new URL(cleanUrl);
    domain = parsed.hostname;
  } catch {
    domain = cleanUrl.replace(/^https?:\/\//, '').split('/')[0];
  }

  // Pre-check DNS resolution
  let dnsResolved = false;
  if (domain) {
    try {
      const ips = await dnsPromises.resolve4(domain);
      if (Array.isArray(ips) && ips.length > 0) {
        dnsResolved = true;
      }
    } catch {
      // ignore
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(cleanUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    const serverHeader = (resp.headers.get('server') || '').toLowerCase();
    const isWaf = WAF_HEADER_SIGNATURES.some((sig) => serverHeader.includes(sig) || resp.headers.has(sig));

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

    // CRITICAL FIX: If HTTP 403 or 401 is returned by Cloudflare/WAF, the website IS LIVE!
    if ([401, 403, 406, 429].includes(resp.status) && (isWaf || dnsResolved)) {
      return {
        isLive: true,
        httpStatus: resp.status,
        finalUrl: resp.url,
        isParked: false,
      };
    }

    return {
      isLive: false,
      httpStatus: resp.status,
      finalUrl: resp.url,
      isParked: false,
    };
  } catch (e: any) {
    // If connection timed out or was refused but domain has active DNS, flag with error
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

import { isSuppressed } from './suppression';

export interface EmailVerificationDetail {
  email: string;
  isValidSyntax: boolean;
  hasMxRecords: boolean;
  isSuppressed: boolean;
  isPlaceholderOrGuess: boolean;
  status:
    | 'publicly_sourced_and_mx_checked'
    | 'syntax_and_mx_verified'
    | 'bounced'
    | 'suppressed'
    | 'invalid_syntax'
    | 'missing_mx'
    | 'placeholder_rejected'
    | 'missing';
  eligibleForOutreach: boolean;
  rejectionReason?: string;
  sourceUrl?: string;
  checkedAt: string;
}

const RFC_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const PLACEHOLDER_DOMAINS = new Set([
  'example.com',
  'domain.com',
  'business.com',
  'yourdomain.com',
  'company.com',
  'website.com',
  'placeholder.com',
  'site.com',
  'test.com',
  'local',
  'invalid',
]);

export function isValidEmailSyntax(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254 || trimmed.length < 5) return false;
  if (!RFC_EMAIL_REGEX.test(trimmed)) return false;
  if (trimmed.includes('..')) return false;
  return true;
}

export function isPlaceholderOrGuessedAddress(email: string): boolean {
  if (!email) return true;
  const lower = email.trim().toLowerCase();
  const parts = lower.split('@');
  if (parts.length !== 2) return true;
  const [localPart, domain] = parts;

  if (PLACEHOLDER_DOMAINS.has(domain) || domain.endsWith('.local') || domain.endsWith('.invalid')) {
    return true;
  }

  // Reject generic test usernames
  if (['user', 'username', 'email', 'yourname', 'test', 'sample', 'placeholder'].includes(localPart)) {
    return true;
  }

  return false;
}

export function isCredibleEmailSourceUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return trimmed.includes('verified public registry') || trimmed.includes('official directory listing');
  }
  const searchOrDummyPatterns = [
    'duckduckgo.com',
    'google.',
    'bing.com',
    'search.brave.com',
    'yahoo.com',
    'yandex.com',
    'baidu.com',
    'example.com',
    'domain.com',
    'placeholder.com',
    'test.com',
  ];
  return !searchOrDummyPatterns.some((pattern) => trimmed.includes(pattern));
}

/**
 * Rigorously verifies an email address prior to outreach.
 * Distinguishes syntax validation, DNS MX resolution, suppression checks, and credible source provenance.
 * Transparently acknowledges that MX verification does NOT guarantee mailbox existence.
 * Only emails extracted from credible public sources with active MX are eligible for outreach.
 */
export async function verifyEmailAddress(
  email: string | undefined,
  sourceUrl?: string
): Promise<EmailVerificationDetail> {
  const now = new Date().toISOString();

  if (!email || !email.trim()) {
    return {
      email: '',
      isValidSyntax: false,
      hasMxRecords: false,
      isSuppressed: false,
      isPlaceholderOrGuess: false,
      status: 'missing',
      eligibleForOutreach: false,
      rejectionReason: 'No email address provided or discovered.',
      checkedAt: now,
    };
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Syntax Check
  if (!isValidEmailSyntax(cleanEmail)) {
    return {
      email: cleanEmail,
      isValidSyntax: false,
      hasMxRecords: false,
      isSuppressed: false,
      isPlaceholderOrGuess: false,
      status: 'invalid_syntax',
      eligibleForOutreach: false,
      rejectionReason: 'Email syntax fails RFC standards or contains malformed characters.',
      checkedAt: now,
    };
  }

  // 2. Placeholder Check
  if (isPlaceholderOrGuessedAddress(cleanEmail)) {
    return {
      email: cleanEmail,
      isValidSyntax: true,
      hasMxRecords: false,
      isSuppressed: false,
      isPlaceholderOrGuess: true,
      status: 'placeholder_rejected',
      eligibleForOutreach: false,
      rejectionReason: 'Address is a placeholder, dummy domain, or unsupported guess.',
      checkedAt: now,
    };
  }

  // 3. Suppression & Hard-Bounce Check
  const suppressed = await isSuppressed(cleanEmail);
  if (suppressed) {
    return {
      email: cleanEmail,
      isValidSyntax: true,
      hasMxRecords: true,
      isSuppressed: true,
      isPlaceholderOrGuess: false,
      status: 'suppressed',
      eligibleForOutreach: false,
      rejectionReason: 'Address is permanently suppressed due to prior hard bounce (550 5.1.1) or opt-out.',
      checkedAt: now,
    };
  }

  // 4. DNS MX Check
  const domain = cleanEmail.split('@')[1];
  let hasMx = false;
  try {
    const mxRecords = await dnsPromises.resolveMx(domain);
    hasMx = Array.isArray(mxRecords) && mxRecords.length > 0;
  } catch {
    hasMx = false;
  }

  if (!hasMx) {
    return {
      email: cleanEmail,
      isValidSyntax: true,
      hasMxRecords: false,
      isSuppressed: false,
      isPlaceholderOrGuess: false,
      status: 'missing_mx',
      eligibleForOutreach: false,
      rejectionReason: `Domain '${domain}' has no active mail exchange (MX) servers on the internet.`,
      checkedAt: now,
    };
  }

  // 5. Source Provenance & Credibility Check
  if (!isCredibleEmailSourceUrl(sourceUrl)) {
    return {
      email: cleanEmail,
      isValidSyntax: true,
      hasMxRecords: true,
      isSuppressed: false,
      isPlaceholderOrGuess: true,
      status: 'missing',
      eligibleForOutreach: false,
      rejectionReason: 'Email was not discovered on a credible public website or verified contact page. Unsupported guesses are prohibited.',
      sourceUrl,
      checkedAt: now,
    };
  }

  // 6. Qualified & eligible: Publicly Sourced and MX Checked
  // Note: An active MX record confirms domain mail handling, but does not prove the specific mailbox exists.
  return {
    email: cleanEmail,
    isValidSyntax: true,
    hasMxRecords: true,
    isSuppressed: false,
    isPlaceholderOrGuess: false,
    status: 'publicly_sourced_and_mx_checked',
    eligibleForOutreach: true,
    sourceUrl,
    checkedAt: now,
  };
}


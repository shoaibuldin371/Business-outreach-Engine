import { LeadResearch } from './types';
import { WebsiteAuditResult } from './verification';

export interface DeepResearchResult {
  confidence_score: number;
  public_email?: string;
  public_phone?: string;
  source_urls: string[];
  growth_signals: {
    rating?: number;
    review_count?: number;
    years_in_business?: string;
    active_socials?: string[];
    is_operational?: boolean;
    observations: string[];
  };
  social_profiles: Record<string, string>;
  contact_evidence: {
    email_source_url?: string;
    phone_source_url?: string;
    verified_at: string;
  };
  research_notes: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const IGNORE_DOMAINS = [
  'example.com',
  'sentry.io',
  'wixpress.com',
  'yelp.com',
  'yellowpages.com',
  'google.com',
  'facebook.com',
  'instagram.com',
  'apple.com',
  'microsoft.com',
  'cloudflare.com',
  'schema.org',
];

/**
 * Searches for public contact details from legitimate web search listings
 */
async function searchPublicContactDetails(
  businessName: string,
  city: string
): Promise<{ email?: string; sourceUrl?: string; socialProfiles: Record<string, string> }> {
  const socialProfiles: Record<string, string> = {};
  let email: string | undefined = undefined;
  let sourceUrl: string | undefined = undefined;

  if (!process.env.BRAVE_SEARCH_API_KEY) {
    return { email, sourceUrl, socialProfiles };
  }

  try {
    const query = `"${businessName}" "${city}" contact email OR "facebook.com" OR "instagram.com"`;
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

      for (const r of results) {
        const text = `${r.title || ''} ${r.description || ''}`;
        const url = r.url || '';

        // Check for social profiles
        if (url.includes('facebook.com/')) socialProfiles.facebook = url;
        if (url.includes('instagram.com/')) socialProfiles.instagram = url;
        if (url.includes('linkedin.com/')) socialProfiles.linkedin = url;
        if (url.includes('yelp.com/biz/')) socialProfiles.yelp = url;

        // Search for published email addresses in snippet
        if (!email) {
          const matches = text.match(EMAIL_REGEX);
          if (matches) {
            for (const m of matches) {
              const lower = m.toLowerCase();
              const domain = lower.split('@')[1];
              if (!IGNORE_DOMAINS.includes(domain)) {
                email = lower;
                sourceUrl = url;
                break;
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('searchPublicContactDetails error:', e);
  }

  return { email, sourceUrl, socialProfiles };
}

/**
 * Conducts deep research on an audited business candidate
 */
export async function conductBusinessResearch(
  businessName: string,
  category: string,
  city: string,
  initialPhone?: string,
  initialEmail?: string,
  audit?: WebsiteAuditResult,
  rating?: number,
  reviewCount?: number
): Promise<DeepResearchResult> {
  const sourceUrls: string[] = audit ? [...audit.sourceUrls] : [];
  const observations: string[] = [];
  const now = new Date().toISOString();

  // 1. Gather Contact details
  let publicPhone = initialPhone?.trim() || '';
  let publicEmail = initialEmail?.trim() || '';
  let emailSourceUrl: string | undefined = undefined;

  const publicSearch = await searchPublicContactDetails(businessName, city);
  const socialProfiles = publicSearch.socialProfiles;

  if (!publicEmail && publicSearch.email) {
    publicEmail = publicSearch.email;
    emailSourceUrl = publicSearch.sourceUrl;
    if (emailSourceUrl) sourceUrls.push(emailSourceUrl);
  }

  // 2. Synthesize factual growth signals
  const activeSocials = Object.keys(socialProfiles);
  if (rating && rating >= 4.0) {
    observations.push(`Strong customer satisfaction: ${rating}★ rating with ${reviewCount || 'multiple'} verified local reviews.`);
  }

  if (activeSocials.length > 0) {
    observations.push(`Maintains active social media presence on ${activeSocials.join(', ')}.`);
  }

  if (publicPhone) {
    observations.push(`Established local telephone contact line: ${publicPhone}.`);
  }

  if (audit?.status === 'none_found') {
    observations.push('Has no official dedicated website, missing out on organic search bookings and inquiry forms.');
  } else if (audit?.status === 'unreachable') {
    observations.push('Existing web address is broken or inactive, creating friction for prospective clients.');
  }

  // 3. Compute Confidence Score (0 - 100)
  let score = 30; // base score for verified existing entity
  if (audit && !audit.hasWebsite) score += 25; // High value target
  if (publicPhone) score += 15;
  if (publicEmail) score += 20;
  if (rating && rating >= 4.0) score += 10;

  const researchNotes = observations.join(' ');

  return {
    confidence_score: Math.min(score, 100),
    public_email: publicEmail || undefined,
    public_phone: publicPhone || undefined,
    source_urls: Array.from(new Set(sourceUrls)),
    growth_signals: {
      rating,
      review_count: reviewCount,
      active_socials: activeSocials,
      is_operational: true,
      observations,
    },
    social_profiles: socialProfiles,
    contact_evidence: {
      email_source_url: emailSourceUrl,
      phone_source_url: publicPhone ? 'Directory Listing' : undefined,
      verified_at: now,
    },
    research_notes: researchNotes,
  };
}

import crypto from 'crypto';
import { BusinessLead, PersonalizedPage, PersonalizedProposal, RoiAssumptions, ServiceCategory } from './types';
import { getClient } from './supabase';

/**
 * Generates an unguessable, cryptographically secure 48-character hex token
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Calculates evidence-backed initial ROI assumptions tailored to the lead's service category
 */
export function buildInitialRoiAssumptions(category?: ServiceCategory): RoiAssumptions {
  switch (category) {
    case 'ai_automation':
    case 'llm_rag_agents':
      return {
        hours_saved_per_week: 14,
        hourly_rate_usd: 55,
        inquiries_automated_monthly: 120,
        conversion_lift_percent: 18,
        estimated_monthly_value_usd: 3080, // (14 * 55 * 4)
        disclaimer: 'Estimates calculated from standard administrative workflow automation benchmarks. Actual results depend on team adoption and inquiry volume.',
      };
    case 'python_dev':
    case 'huawei_cloud':
      return {
        hours_saved_per_week: 16,
        hourly_rate_usd: 60,
        inquiries_automated_monthly: 80,
        conversion_lift_percent: 15,
        estimated_monthly_value_usd: 3840,
        disclaimer: 'Calculated based on reduced manual batch processing and serverless cloud automation. Figures are planning projections.',
      };
    case 'data_science_analytics':
    case 'data_science_training':
      return {
        hours_saved_per_week: 12,
        hourly_rate_usd: 65,
        inquiries_automated_monthly: 60,
        conversion_lift_percent: 12,
        estimated_monthly_value_usd: 3120,
        disclaimer: 'Projections based on weekly reporting pipeline automation and decision cycle acceleration. Not a guarantee of financial return.',
      };
    case 'website_digital':
    default:
      return {
        hours_saved_per_week: 10,
        hourly_rate_usd: 45,
        inquiries_automated_monthly: 90,
        conversion_lift_percent: 22,
        estimated_monthly_value_usd: 1800,
        disclaimer: 'Estimated from improved mobile conversion and direct inquiry capture. Figures are illustrative planning models.',
      };
  }
}

/**
 * Builds tailored personalized proposal content based on verified lead data
 */
export function buildProposalForLead(lead: BusinessLead): PersonalizedProposal {
  const category: ServiceCategory = lead.service_category || 'website_digital';
  const bizName = lead.business_name || 'Your Business';
  const city = lead.city || 'your area';
  const roi = buildInitialRoiAssumptions(category);

  let headline = `Modern Web Architecture & Rapid Lead Capture for ${bizName}`;
  let summary = `A custom technical evaluation for ${bizName} in ${city}, focusing on increasing qualified customer inquiries and automating client intake.`;
  let deliverables = [
    'Sub-second mobile-responsive web experience built with Next.js & modern CSS',
    'Instant lead qualification form with automated email notification',
    'Direct appointment booking integration (Calendly / custom workflow)',
    'On-page technical SEO & structured business metadata',
  ];

  if (category === 'ai_automation' || category === 'llm_rag_agents') {
    headline = `Autonomous AI Workflow & Intelligent Client Triage for ${bizName}`;
    summary = `Deploying verified LLM agents and document retrieval (RAG) to handle repetitive prospect inquiries and operational workflows 24/7.`;
    deliverables = [
      'Custom LLM-powered inquiry assistant trained on company services and pricing FAQs',
      'Automated qualification and CRM lead routing pipeline',
      'Secure, privacy-first architecture with strict API token protection',
      'Automated weekly reporting on client queries and conversion drop-offs',
    ];
  } else if (category === 'python_dev' || category === 'huawei_cloud') {
    headline = `Cloud Automation & Scalable Python Infrastructure for ${bizName}`;
    summary = `Streamlining operational data flows and backend APIs using Huawei Cloud / AWS serverless architecture and production Python services.`;
    deliverables = [
      'Serverless micro-services eliminating repetitive manual data transfers',
      'Automated database synchronization and web-hook event processing',
      'Resilient error tracking and automated health monitoring alerts',
      'Containerized deployment pipelines for zero-downtime updates',
    ];
  } else if (category === 'data_science_analytics' || category === 'data_science_training') {
    headline = `Executive Intelligence & Automated Decision Dashboards for ${bizName}`;
    summary = `Transforming disparate operational spreadsheets into clean, real-time analytics dashboards and predictive customer insights.`;
    deliverables = [
      'Unified executive dashboard with key revenue and operational metrics',
      'Automated ETL pipelines refreshing data on daily/weekly schedules',
      'Customer retention & churn risk indicators',
      'Hands-on team training and interactive data modeling documentation',
    ];
  }

  const evidenceQuote = lead.demand_evidence
    ? `Based on verified opportunity: ${lead.demand_evidence.slice(0, 140)}`
    : `Tailored for ${bizName}'s public presence in ${city}, ${lead.state || 'USA'}.`;

  return {
    headline,
    summary,
    core_deliverables: deliverables,
    recommended_service: category,
    evidence_quote: evidenceQuote,
    roi_assumptions: roi,
  };
}

/**
 * Generates and persists a personalized client portal for a qualified lead
 */
export async function generatePersonalizedPage(lead: BusinessLead): Promise<PersonalizedPage> {
  const sb = getClient();
  const token = generateSecureToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  const proposal = buildProposalForLead(lead);

  const pageData: PersonalizedPage = {
    id: crypto.randomUUID(),
    lead_id: lead.id,
    token,
    is_active: true,
    expires_at: expiresAt,
    custom_proposal: proposal,
    roi_assumptions: proposal.roi_assumptions,
    visit_count: 0,
    created_at: now.toISOString(),
  };

  if (sb) {
    try {
      await sb.from('personalized_pages').insert({
        id: pageData.id,
        lead_id: pageData.lead_id,
        token: pageData.token,
        is_active: pageData.is_active,
        expires_at: pageData.expires_at,
        custom_proposal: pageData.custom_proposal,
        roi_assumptions: pageData.roi_assumptions,
        visit_count: 0,
      });

      await sb.from('business_leads').update({ has_personalized_page: true }).eq('id', lead.id);
    } catch (e) {
      console.warn('generatePersonalizedPage database notice:', e);
    }
  }

  return pageData;
}

/**
 * Retrieves a personalized page by its secure token, verifying active status and expiration.
 * Sanitizes response so internal notes, email addresses, and scoring are NEVER exposed to the public.
 */
export async function getPersonalizedPageByToken(token: string): Promise<{
  page: Omit<PersonalizedPage, 'lead_id'>;
  business_name: string;
  city?: string;
  state?: string;
  industry?: string;
  website?: string;
} | null> {
  if (!token || typeof token !== 'string' || token.length < 32) {
    return null;
  }

  const sb = getClient();
  if (!sb) return null;

  try {
    const { data: pageRecord, error: pageErr } = await sb
      .from('personalized_pages')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (pageErr || !pageRecord) return null;

    // Check expiration
    if (new Date(pageRecord.expires_at).getTime() < Date.now()) {
      return null;
    }

    // Fetch minimal public business metadata
    const { data: leadRecord } = await sb
      .from('business_leads')
      .select('business_name, city, state, industry, website')
      .eq('id', pageRecord.lead_id)
      .single();

    const sanitizedLead = {
      business_name: leadRecord?.business_name || 'Client',
      city: leadRecord?.city,
      state: leadRecord?.state,
      industry: leadRecord?.industry,
      website: leadRecord?.website,
    };

    // Strip internal lead_id
    const { lead_id, ...safePage } = pageRecord;

    return {
      page: safePage,
      ...sanitizedLead,
    };
  } catch (e) {
    console.error('getPersonalizedPageByToken error:', e);
    return null;
  }
}

/**
 * Records privacy-conscious page analytics events without capturing sensitive personal data
 */
export async function recordPageEvent(
  token: string,
  eventType: 'page_viewed' | 'roi_calculated' | 'meeting_requested',
  payload?: Record<string, any>
): Promise<boolean> {
  const sb = getClient();
  if (!sb) return false;

  try {
    const { data: page } = await sb
      .from('personalized_pages')
      .select('id, lead_id, visit_count')
      .eq('token', token)
      .single();

    if (!page) return false;

    // Increment visit count on page view
    if (eventType === 'page_viewed') {
      await sb.from('personalized_pages').update({
        visit_count: (page.visit_count || 0) + 1,
        last_visited_at: new Date().toISOString(),
      }).eq('id', page.id);
    }

    // Insert lightweight audit event
    await sb.from('outreach_events').insert({
      lead_id: page.lead_id,
      page_id: page.id,
      event_type: eventType,
      channel: 'landing_page',
      payload: payload || {},
    });

    return true;
  } catch (e) {
    console.warn('recordPageEvent error:', e);
    return false;
  }
}

/**
 * Revokes a personalized page token immediately
 */
export async function revokePageToken(token: string): Promise<boolean> {
  const sb = getClient();
  if (!sb) return false;

  try {
    const { error } = await sb.from('personalized_pages').update({
      is_active: false,
      revoked_at: new Date().toISOString(),
    }).eq('token', token);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Regenerates a revoked or existing page with a fresh token
 */
export async function regeneratePageToken(oldToken: string): Promise<string | null> {
  const sb = getClient();
  if (!sb) return null;

  try {
    const newToken = generateSecureToken();
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await sb.from('personalized_pages').update({
      token: newToken,
      is_active: true,
      expires_at: newExpiresAt,
      revoked_at: null,
    }).eq('token', oldToken);

    return error ? null : newToken;
  } catch {
    return null;
  }
}

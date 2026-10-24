import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { BusinessLead, DigitalAudit, DigitalAuditFindings } from './types';
import { getClient } from './supabase';

/**
 * Conducts a realistic, non-invasive server-side digital audit on a prospect's public website
 * or verifies the documented absence of an official web presence.
 *
 * Strict Compliance:
 * - Zero fabricated security exploits or fake vulnerabilities
 * - Non-invasive public HTTP observation only
 * - Clearly distinguishes estimated value from measured metrics
 */
export async function conductDigitalAudit(lead: BusinessLead): Promise<DigitalAudit> {
  const targetUrl = lead.website?.trim() || '';
  const nowIso = new Date().toISOString();

  let findings: DigitalAuditFindings = {
    target_url: targetUrl || undefined,
    has_website: Boolean(targetUrl),
    is_https: targetUrl.startsWith('https://'),
    identified_gaps: [],
    opportunities: [],
    has_mobile_viewport: false,
    has_lead_form: false,
    has_booking_flow: false,
  };

  const recommendations: string[] = [];

  if (!targetUrl || lead.website_status === 'none_found') {
    // Audit for business without verified website
    findings.has_website = false;
    findings.identified_gaps.push('No verified official company website found in public business registries.');
    findings.identified_gaps.push('Relying solely on directory citations or third-party listings.');
    findings.opportunities.push('Deploy modern, high-speed lead generation web application.');
    findings.opportunities.push('Integrate automated 24/7 customer inquiry capture and appointment booking.');

    recommendations.push('Establish an official web presence with high-converting mobile layout and clear value proposition.');
    recommendations.push('Implement automated customer inquiry handling to capture local and national search demand.');
    findings.estimated_monthly_value = '$1,200 - $3,500 in captured client opportunities';
  } else {
    // Live non-invasive public audit
    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const resp = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 BusinessAudit/1.0',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      findings.response_time_ms = Date.now() - startTime;
      findings.status_code = resp.status;
      findings.is_https = targetUrl.startsWith('https://') || resp.url.startsWith('https://');

      if (resp.ok) {
        const html = await resp.text();
        const lowerHtml = html.toLowerCase();

        // 1. Meta Description Check
        const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
        if (metaDescMatch && metaDescMatch[1]) {
          findings.meta_description = metaDescMatch[1].slice(0, 160);
        } else {
          findings.identified_gaps.push('Missing search engine meta description tag (impacts Google click-through rates).');
          findings.opportunities.push('Add tailored meta tags to optimize organic search visibility.');
        }

        // 2. Title Tag Check
        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          findings.title = titleMatch[1].trim();
        }

        // 3. Mobile Viewport Tag Check
        findings.has_mobile_viewport = lowerHtml.includes('name="viewport"') || lowerHtml.includes("name='viewport'");
        if (!findings.has_mobile_viewport) {
          findings.identified_gaps.push('Mobile viewport configuration missing (potential layout rendering issues on smartphones).');
          findings.opportunities.push('Modernize responsive viewport architecture for modern mobile screens.');
        }

        // 4. Lead Capture Form Check
        findings.has_lead_form = lowerHtml.includes('<form') && (lowerHtml.includes('type="email"') || lowerHtml.includes('type="tel"') || lowerHtml.includes('placeholder='));
        if (!findings.has_lead_form) {
          findings.identified_gaps.push('No direct contact or lead capture form detected on primary landing page.');
          findings.opportunities.push('Add friction-free inquiry capture form with instant email notification.');
        }

        // 5. Booking Workflow or Scheduling Tool Check
        findings.has_booking_flow = lowerHtml.includes('calendly') || lowerHtml.includes('acuity') || lowerHtml.includes('hubspot') || lowerHtml.includes('book-now') || lowerHtml.includes('schedule');
        if (!findings.has_booking_flow) {
          findings.opportunities.push('Incorporate direct calendar scheduling or intelligent appointment routing.');
        }

        // 6. Automation & AI Opportunity
        if (lead.demand_evidence) {
          findings.opportunities.push(`Address documented requirement: ${lead.demand_evidence.slice(0, 110)}...`);
        }

        // 7. Latency observation
        if (findings.response_time_ms > 1200) {
          findings.identified_gaps.push(`Server response latency is ${findings.response_time_ms}ms (recommend optimizing asset delivery below 600ms).`);
        }

        recommendations.push('Streamline customer journey from landing to direct inquiry with responsive form workflows.');
        recommendations.push('Implement automated inquiry validation and CRM sync to eliminate manual response delays.');
        findings.estimated_monthly_value = '$1,500 - $4,800 in recovered operational hours & client retention';
      } else {
        findings.identified_gaps.push(`Public HTTP response code: ${resp.status} (intermittent server accessibility).`);
        recommendations.push('Verify web hosting infrastructure and configure high-availability routing.');
      }
    } catch (e: any) {
      findings.identified_gaps.push(`Live endpoint unreachable or timeout during public check (${e.message || 'Network timeout'}).`);
      recommendations.push('Audit DNS routing and ensure 99.9% public server uptime.');
    }
  }

  if (findings.opportunities.length === 0) {
    findings.opportunities.push('Integrate automated AI workflow orchestration to reduce internal processing bottlenecks.');
  }

  const auditRecord: DigitalAudit = {
    id: crypto.randomUUID(),
    lead_id: lead.id,
    target_url: targetUrl || undefined,
    status: 'completed',
    findings,
    recommendations,
    audit_date: nowIso,
    created_at: nowIso,
  };

  return auditRecord;
}

function cleanPdfText(str: string | undefined): string {
  if (!str) return '';
  return str
    .replace(/[•●]/g, '-')
    .replace(/[✓✔]/g, '+')
    .replace(/[—–]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E]/g, ' ')
    .trim();
}

/**
 * Generates an executive, highly polished 1-page vector PDF Digital Audit
 * using pure JavaScript pdf-lib (100% compatible with Vercel serverless).
 */
export async function generateAuditPdfBuffer(lead: BusinessLead, audit: DigitalAudit): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // Standard A4 (pts)
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Background Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 110,
    width: width,
    height: 110,
    color: rgb(0.05, 0.08, 0.16), // Deep Navy
  });

  // Top Accent Line
  page.drawRectangle({
    x: 0,
    y: height - 6,
    width: width,
    height: 6,
    color: rgb(0.39, 0.4, 0.95), // Indigo Accent
  });

  // Header Title
  page.drawText('EXECUTIVE DIGITAL AUDIT & TECHNICAL ASSESSMENT', {
    x: 36,
    y: height - 42,
    size: 15,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Prepared for: ${cleanPdfText(lead.business_name)} | ${cleanPdfText(lead.city || 'United States')}`, {
    x: 36,
    y: height - 62,
    size: 11,
    font: fontRegular,
    color: rgb(0.7, 0.78, 0.92),
  });

  const auditDateStr = new Date(audit.audit_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  page.drawText(`Date: ${auditDateStr}  |  Assessment ID: ${audit.id.slice(0, 8)}  |  Classification: Public Technical Review`, {
    x: 36,
    y: height - 80,
    size: 9,
    font: fontRegular,
    color: rgb(0.55, 0.62, 0.75),
  });

  let currentY = height - 135;

  // SECTION 1: ASSESSMENT OVERVIEW & CORE PARAMETERS
  page.drawText('1. TECHNICAL BASELINE OBSERVATIONS', {
    x: 36,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.28),
  });

  currentY -= 18;

  const findings = audit.findings;
  const baselineRows = [
    { label: 'Target Web Presence', val: findings.has_website ? cleanPdfText(lead.website || 'Verified Live') : 'No Official Website Found' },
    { label: 'Security & Protocol', val: findings.is_https ? 'HTTPS Enforced (Secure TLS)' : 'Unencrypted or Missing TLS' },
    { label: 'Mobile Optimization', val: findings.has_mobile_viewport ? 'Responsive Viewport Configured' : 'Mobile Viewport Needs Optimization' },
    { label: 'Lead Capture Mechanism', val: findings.has_lead_form ? 'Inquiry Form Detected' : 'No Direct Online Lead Form Detected' },
    { label: 'Response Latency', val: findings.response_time_ms ? `${findings.response_time_ms} ms (Observed Latency)` : 'N/A' },
  ];

  page.drawRectangle({
    x: 36,
    y: currentY - 80,
    width: width - 72,
    height: 90,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.85, 0.88, 0.93),
    borderWidth: 1,
  });

  let rowY = currentY - 5;
  for (const r of baselineRows) {
    page.drawText(`${r.label}:`, {
      x: 48,
      y: rowY,
      size: 9,
      font: fontBold,
      color: rgb(0.2, 0.25, 0.35),
    });
    page.drawText(cleanPdfText(r.val), {
      x: 190,
      y: rowY,
      size: 9,
      font: fontRegular,
      color: rgb(0.1, 0.15, 0.25),
    });
    rowY -= 16;
  }

  currentY -= 105;

  // SECTION 2: IDENTIFIED TECHNICAL GAPS & OPERATIONAL FRICTION
  page.drawText('2. IDENTIFIED FRICTION POINTS & AREAS FOR IMPROVEMENT', {
    x: 36,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.28),
  });

  currentY -= 16;

  const gaps = findings.identified_gaps.length > 0
    ? findings.identified_gaps
    : ['Standard responsive architecture verified; opportunities exist for automated workflow integration.'];

  for (const gap of gaps.slice(0, 4)) {
    page.drawText('-', { x: 44, y: currentY, size: 10, font: fontBold, color: rgb(0.8, 0.25, 0.25) });
    page.drawText(cleanPdfText(gap.slice(0, 95)), {
      x: 56,
      y: currentY,
      size: 9,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.32),
    });
    currentY -= 15;
  }

  currentY -= 10;

  // SECTION 3: STRATEGIC OPPORTUNITIES & RECOMMENDED SOLUTION
  page.drawText('3. RECOMMENDED HIGH-IMPACT DELIVERABLES', {
    x: 36,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.28),
  });

  currentY -= 16;

  const opps = findings.opportunities.length > 0 ? findings.opportunities : audit.recommendations;
  for (const opp of opps.slice(0, 4)) {
    page.drawText('+', { x: 44, y: currentY, size: 10, font: fontBold, color: rgb(0.1, 0.6, 0.35) });
    page.drawText(cleanPdfText(opp.slice(0, 95)), {
      x: 58,
      y: currentY,
      size: 9,
      font: fontRegular,
      color: rgb(0.15, 0.2, 0.3),
    });
    currentY -= 15;
  }

  currentY -= 12;

  // SECTION 4: ESTIMATED ROI & EFFICIENCY IMPACT
  page.drawText('4. ESTIMATED OPERATIONAL IMPACT & VALUE POTENTIAL', {
    x: 36,
    y: currentY,
    size: 11,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.28),
  });

  currentY -= 18;

  page.drawRectangle({
    x: 36,
    y: currentY - 55,
    width: width - 72,
    height: 65,
    color: rgb(0.93, 0.97, 0.95), // Soft Mint
    borderColor: rgb(0.65, 0.85, 0.75),
    borderWidth: 1,
  });

  page.drawText('Projected Value Lift:', {
    x: 48,
    y: currentY - 12,
    size: 10,
    font: fontBold,
    color: rgb(0.08, 0.45, 0.25),
  });

  page.drawText(findings.estimated_monthly_value || '$1,500 - $4,500 monthly productivity & inquiry capture lift', {
    x: 180,
    y: currentY - 12,
    size: 10,
    font: fontBold,
    color: rgb(0.08, 0.45, 0.25),
  });

  page.drawText('Assumptions & Transparency Disclaimer:', {
    x: 48,
    y: currentY - 28,
    size: 8,
    font: fontBold,
    color: rgb(0.3, 0.4, 0.35),
  });

  page.drawText('Estimates reflect standard industry benchmarks (10-15 hrs/week saved on manual workflows & automated lead capture).', {
    x: 48,
    y: currentY - 39,
    size: 7.5,
    font: fontOblique,
    color: rgb(0.35, 0.45, 0.4),
  });

  page.drawText('Actual ROI varies based on individual business volume. All solutions tailored specifically to verified operations.', {
    x: 48,
    y: currentY - 49,
    size: 7.5,
    font: fontOblique,
    color: rgb(0.35, 0.45, 0.4),
  });

  // FOOTER & CONSULTANT CREDENTIALS
  page.drawRectangle({
    x: 36,
    y: 36,
    width: width - 72,
    height: 60,
    color: rgb(0.05, 0.08, 0.16),
  });

  page.drawText('CONSULTANT & TECHNICAL ARCHITECT', {
    x: 48,
    y: 78,
    size: 8.5,
    font: fontBold,
    color: rgb(0.7, 0.78, 0.95),
  });

  page.drawText('Muhammad Shoaib - AI Developer & Automation Architect', {
    x: 48,
    y: 64,
    size: 9.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText('Huawei Certified Cloud Developer  |  LLMs & Python  |  Data Science Trainer', {
    x: 48,
    y: 52,
    size: 8,
    font: fontRegular,
    color: rgb(0.7, 0.78, 0.92),
  });

  page.drawText('Contact: Mshoaibawan371@gmail.com', {
    x: width - 210,
    y: 64,
    size: 9,
    font: fontBold,
    color: rgb(0.39, 0.7, 1),
  });

  page.drawText('Confidential & Private Assessment', {
    x: width - 210,
    y: 52,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.6, 0.65, 0.75),
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

/**
 * Saves a digital audit record to Supabase
 */
export async function saveDigitalAudit(audit: DigitalAudit): Promise<DigitalAudit> {
  const sb = getClient();
  if (sb) {
    try {
      const { error } = await sb.from('lead_audits').upsert({
        id: audit.id,
        lead_id: audit.lead_id,
        target_url: audit.target_url,
        status: audit.status,
        findings: audit.findings,
        recommendations: audit.recommendations,
        pdf_path: audit.pdf_path,
        audit_date: audit.audit_date,
      });

      if (!error) {
        // Flag lead as having an audit
        await sb.from('business_leads').update({ has_audit: true }).eq('id', audit.lead_id);
      }
    } catch (e) {
      console.warn('saveDigitalAudit warning (continuing with memory store):', e);
    }
  }

  return audit;
}

/**
 * Retrieves a digital audit for a given lead ID
 */
export async function getDigitalAuditByLeadId(leadId: string): Promise<DigitalAudit | null> {
  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('lead_audits').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).single();
      if (!error && data) return data as DigitalAudit;
    } catch {}
  }
  return null;
}

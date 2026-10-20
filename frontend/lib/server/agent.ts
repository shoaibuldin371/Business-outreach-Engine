import {
  insertLead,
  insertLog,
  saveLeadResearch,
  saveOutreachDraft,
  createAutomationRun,
  updateAutomationRun,
  isAutomationCurrentlyRunning,
  getAutomationSettings,
  findExistingLeadByNameAndCity,
} from './supabase';
import { 
  discoverBusinesses, 
  getRandomWorldwideHub, 
  getRandomWorldwideCategory 
} from './discovery';
import { verifyBusinessWebsite } from './verification';
import { conductBusinessResearch } from './research';
import { generatePersonalizedPitch } from './ai';
import { sendHitlApprovalEmail, verifyDomainHasMx } from './email';
import { BusinessLead } from './types';

export interface CycleResult {
  status: 'success' | 'paused' | 'locked' | 'error';
  message: string;
  run_id?: string;
  leads_discovered?: number;
  leads_qualified?: number;
  leads_missing_email?: number;
  leads?: BusinessLead[];
}

/**
 * Runs a complete, automated discovery and research cycle
 * Now supports worldwide locations and strict deduplication
 */
export async function runDiscoveryCycle(
  customCategory?: string,
  customCity?: string,
  customCount?: number,
  triggerType: 'scheduled_3h' | 'manual' | 'api' = 'manual'
): Promise<CycleResult> {
  const settings = await getAutomationSettings();

  // 1. Check if paused
  if (settings.is_paused && triggerType === 'scheduled_3h') {
    return {
      status: 'paused',
      message: 'Automation is currently paused in settings. Scheduled run skipped.',
    };
  }

  // 2. Prevent overlapping runs
  const isRunning = await isAutomationCurrentlyRunning();
  if (isRunning) {
    return {
      status: 'locked',
      message: 'Another discovery run is currently in progress. Skipping to prevent overlap.',
    };
  }

  // Dynamic Worldwide Hub & High-Growth Category Selection (100% Autopilot)
  const isDefaultCity = !customCity || !customCity.trim();
  const hub = isDefaultCity ? getRandomWorldwideHub() : null;
  const city = customCity && customCity.trim() ? customCity.trim() : (hub ? `${hub.city}, ${hub.country}` : 'London, United Kingdom');
  const category = customCategory && customCategory.trim() ? customCategory.trim() : getRandomWorldwideCategory();
  const count = customCount || settings.batch_size || 5;

  const run = await createAutomationRun(triggerType, category, city, count);
  const startTime = Date.now();

  await insertLog(
    'find',
    'info',
    `Initiated worldwide outreach cycle for ${count} target businesses in '${city}' (${category}) [Trigger: ${triggerType}]`,
    { category, city, count, run_id: run.id, region: hub?.region || 'Global' },
    undefined,
    run.id
  );

  const qualifiedLeads: BusinessLead[] = [];
  let discoveredCount = 0;
  let qualifiedCount = 0;
  let missingEmailCount = 0;
  let errorCount = 0;

  try {
    // 3. Discover candidate businesses across worldwide providers
    const candidates = await discoverBusinesses(category, city, count);
    discoveredCount = candidates.length;

    await insertLog(
      'find',
      discoveredCount > 0 ? 'success' : 'warning',
      `Discovered ${discoveredCount} prospective business listings in ${city} for auditing.`,
      { candidates_count: discoveredCount, run_id: run.id },
      undefined,
      run.id
    );

    // 4. Audit, research, and draft each candidate
    for (const candidate of candidates) {
      if (qualifiedLeads.length >= count) break;

      const name = candidate.business_name;
      try {
        // Strict Deduplication Check before processing
        const existing = await findExistingLeadByNameAndCity(name, candidate.city);
        if (existing) {
          await insertLog(
            'explore',
            'info',
            `Skipping '${name}': already contacted or stored in pipeline.`,
            { business: name, city: candidate.city },
            undefined,
            run.id
          );
          continue;
        }

        // Step A: Audit Website Presence
        const audit = await verifyBusinessWebsite(name, candidate.city, candidate.website);

        await insertLog(
          'explore',
          audit.hasWebsite ? 'info' : 'warning',
          `Audited '${name}': Website status = '${audit.statusLabel}'.`,
          {
            business: name,
            website_status: audit.status,
            checked_url: audit.checkedUrl,
            evidence: audit.evidenceNotes,
          },
          undefined,
          run.id
        );

        // If active live website exists, skip candidate
        if (audit.hasWebsite) {
          continue;
        }

        // Step B: Deep Presence Research & Public Contact Discovery
        const research = await conductBusinessResearch(
          name,
          candidate.category,
          candidate.city,
          candidate.phone,
          candidate.email,
          audit,
          candidate.rating,
          candidate.review_count
        );

        // Step C: Generate Personalized Outreach Pitch
        const pitch = await generatePersonalizedPitch({
          businessName: name,
          category: candidate.category,
          city: candidate.city,
          research,
          offerService: settings.target_offer,
          senderName: settings.sender_name,
          senderEmail: settings.sender_email,
          senderBusiness: settings.sender_business,
        });

        // Determine lead status with autonomous contact assignment & Admin Protection
        let validContactEmail = '';
        if (research.public_email && research.public_email.trim()) {
          const candidateEmail = research.public_email.trim().toLowerCase();
          const adminEmail = (settings.admin_notification_email || settings.sender_email || 'mshoaibawan371@gmail.com').toLowerCase();

          if (candidateEmail === adminEmail || candidateEmail.includes('mshoaibawan371') || candidateEmail.includes('shoaib')) {
            const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
            validContactEmail = `contact@${clean}.com`;
          } else {
            validContactEmail = candidateEmail;
          }
        } else {
          const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
          validContactEmail = `contact@${clean}.com`;
        }

        const hasContactEmail = Boolean(validContactEmail);
        const leadStatus = 'pending_approval';

        const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

        // Step D: Save Master Lead Record to Supabase
        const leadRecord: Partial<BusinessLead> = {
          business_name: name,
          category: candidate.category,
          city: candidate.city,
          country: candidate.country || 'Worldwide',
          address: candidate.address,
          phone: research.public_phone || candidate.phone || '',
          email: validContactEmail,
          website: audit.checkedUrl || '',
          website_status: audit.status,
          confidence_score: research.confidence_score,
          research_status: 'completed',
          status: leadStatus,
          notes: research.research_notes,
          email_subject: pitch.subject,
          email_body: pitch.body,
          approval_token: token,
          source: candidate.source,
        };

        const savedLead = await insertLead(leadRecord);

        // Step E: Save Lead Research Evidence
        await saveLeadResearch({
          lead_id: savedLead.id,
          source_urls: research.source_urls,
          website_checked_url: audit.checkedUrl,
          website_check_result: audit.statusLabel,
          website_check_details: audit.details,
          growth_signals: research.growth_signals,
          social_profiles: research.social_profiles,
          contact_evidence: research.contact_evidence,
          raw_research_notes: research.research_notes,
        });

        // Step F: Save Outreach Draft
        await saveOutreachDraft({
          lead_id: savedLead.id,
          version: 1,
          subject: pitch.subject,
          body: pitch.body,
          offer_service: settings.target_offer,
          personalization_hooks: {
            observations: research.growth_signals.observations,
            confidence_score: research.confidence_score,
          },
          ai_model: pitch.modelUsed,
          status: 'pending_approval',
        });

        qualifiedLeads.push(savedLead);
        qualifiedCount++;

        await insertLog(
          'draft',
          'success',
          `Generated personalized pitch for '${name}' in ${candidate.city} (${pitch.modelUsed}). Saved to pipeline [Status: ${leadStatus}].`,
          { lead_id: savedLead.id, business: name, score: research.confidence_score, status: leadStatus },
          savedLead.id,
          run.id
        );

        // Step G: Send HITL review email to admin ONLY ONCE per newly qualified business
        if (hasContactEmail && settings.require_manual_approval) {
          await sendHitlApprovalEmail(savedLead, token);
        }
      } catch (leadError: any) {
        errorCount++;
        await insertLog(
          'error',
          'error',
          `Failed processing candidate '${name}': ${leadError.message}`,
          { business: name, error: leadError.message },
          undefined,
          run.id
        );
      }
    }

    const durationMs = Date.now() - startTime;
    const summaryMsg = `Discovery cycle complete for ${city}. ${qualifiedCount} qualified businesses without website saved to Supabase (${missingEmailCount} awaiting contact discovery, ${qualifiedCount - missingEmailCount} dispatched for HITL approval).`;

    await updateAutomationRun(run.id, {
      status: 'completed',
      discovered_count: discoveredCount,
      qualified_count: qualifiedCount,
      drafted_count: qualifiedCount,
      error_count: errorCount,
      duration_ms: durationMs,
      summary: summaryMsg,
      completed_at: new Date().toISOString(),
    });

    await insertLog(
      'success',
      'success',
      summaryMsg,
      {
        run_id: run.id,
        duration_ms: durationMs,
        discovered: discoveredCount,
        qualified: qualifiedCount,
        missing_email: missingEmailCount,
      },
      undefined,
      run.id
    );

    return {
      status: 'success',
      message: summaryMsg,
      run_id: run.id,
      leads_discovered: discoveredCount,
      leads_qualified: qualifiedCount,
      leads_missing_email: missingEmailCount,
      leads: qualifiedLeads,
    };
  } catch (cycleError: any) {
    const durationMs = Date.now() - startTime;
    const errMsg = `Autonomous discovery cycle failed: ${cycleError.message}`;

    await updateAutomationRun(run.id, {
      status: 'failed',
      discovered_count: discoveredCount,
      qualified_count: qualifiedCount,
      error_count: errorCount + 1,
      duration_ms: durationMs,
      summary: errMsg,
      error_details: { message: cycleError.message, stack: cycleError.stack },
      completed_at: new Date().toISOString(),
    });

    await insertLog('error', 'error', errMsg, { error: cycleError.message }, undefined, run.id);

    return {
      status: 'error',
      message: errMsg,
      run_id: run.id,
    };
  }
}

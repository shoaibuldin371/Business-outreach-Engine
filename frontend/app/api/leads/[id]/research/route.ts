import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, getLeadResearch, saveLeadResearch, updateLead, insertLog } from '@/lib/server/supabase';
import { verifyBusinessWebsite } from '@/lib/server/verification';
import { conductBusinessResearch } from '@/lib/server/research';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const research = await getLeadResearch(params.id);
    if (!research) {
      return NextResponse.json({ detail: 'No research found for this lead' }, { status: 404 });
    }
    return NextResponse.json(research);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const lead = await getLeadById(params.id);
    if (!lead) {
      return NextResponse.json({ detail: 'Lead not found' }, { status: 404 });
    }

    await insertLog('explore', 'info', `Re-research requested for ${lead.business_name}...`, { lead_id: lead.id }, lead.id);

    // Re-verify website
    const audit = await verifyBusinessWebsite(lead.business_name, lead.city || 'Dallas, TX', lead.website);

    // Deep research
    const research = await conductBusinessResearch(
      lead.business_name,
      lead.category || 'Local Service',
      lead.city || 'Dallas, TX',
      lead.phone,
      lead.email,
      audit
    );

    // Save research record
    const savedResearch = await saveLeadResearch({
      lead_id: lead.id,
      source_urls: research.source_urls,
      website_checked_url: audit.checkedUrl,
      website_check_result: audit.statusLabel,
      website_check_details: audit.details,
      growth_signals: research.growth_signals,
      social_profiles: research.social_profiles,
      contact_evidence: research.contact_evidence,
      raw_research_notes: research.research_notes,
    });

    // Update lead record
    const updatedLead = await updateLead(lead.id, {
      website_status: audit.status,
      confidence_score: research.confidence_score,
      email: research.public_email || lead.email,
      phone: research.public_phone || lead.phone,
      notes: research.research_notes,
      research_status: 'completed',
    });

    await insertLog('explore', 'success', `Re-research completed for ${lead.business_name}. Score: ${research.confidence_score}/100`, { score: research.confidence_score }, lead.id);

    return NextResponse.json({
      lead: updatedLead,
      research: savedResearch,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

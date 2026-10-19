import { NextRequest, NextResponse } from 'next/server';
import {
  getLeadById,
  getLeadResearch,
  getDraftsForLead,
  saveOutreachDraft,
  updateLead,
  getAutomationSettings,
  insertLog,
} from '@/lib/server/supabase';
import { generatePersonalizedPitch } from '@/lib/server/ai';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const drafts = await getDraftsForLead(params.id);
    return NextResponse.json(drafts);
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

    const settings = await getAutomationSettings();
    const research = await getLeadResearch(lead.id);

    const observations = research?.growth_signals?.observations || [
      lead.notes || 'Operating locally without an active dedicated website.',
    ];

    const pitch = await generatePersonalizedPitch({
      businessName: lead.business_name,
      category: lead.category || 'Local Service',
      city: lead.city || 'Dallas, TX',
      research: {
        confidence_score: lead.confidence_score || 80,
        source_urls: research?.source_urls || [],
        growth_signals: {
          observations,
        },
        social_profiles: research?.social_profiles || {},
        contact_evidence: { verified_at: new Date().toISOString() },
        research_notes: lead.notes || '',
      },
      offerService: settings.target_offer,
      senderName: settings.sender_name,
      senderEmail: settings.sender_email,
      senderBusiness: settings.sender_business,
    });

    const existingDrafts = await getDraftsForLead(lead.id);
    const version = existingDrafts.length + 1;

    const draft = await saveOutreachDraft({
      lead_id: lead.id,
      version,
      subject: pitch.subject,
      body: pitch.body,
      offer_service: settings.target_offer,
      ai_model: pitch.modelUsed,
      status: 'pending_approval',
    });

    // Update lead with draft
    await updateLead(lead.id, {
      email_subject: pitch.subject,
      email_body: pitch.body,
      status: lead.email ? 'pending_approval' : 'missing_contact',
    });

    await insertLog(
      'draft',
      'success',
      `Regenerated draft v${version} for '${lead.business_name}' using ${pitch.modelUsed}.`,
      { lead_id: lead.id, version },
      lead.id
    );

    return NextResponse.json(draft);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

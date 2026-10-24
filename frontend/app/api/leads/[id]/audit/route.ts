import { NextRequest, NextResponse } from 'next/server';
import { getLeadById } from '@/lib/server/supabase';
import { conductDigitalAudit, getDigitalAuditByLeadId, saveDigitalAudit } from '@/lib/server/audit';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leadId = params.id;
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead ID' }, { status: 400 });
    }

    const audit = await getDigitalAuditByLeadId(leadId);
    if (!audit) {
      return NextResponse.json({ exists: false, message: 'No audit generated yet' }, { status: 404 });
    }

    return NextResponse.json({ exists: true, audit });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching audit' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leadId = params.id;
    if (!leadId) {
      return NextResponse.json({ error: 'Missing lead ID' }, { status: 400 });
    }

    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const audit = await conductDigitalAudit(lead);
    const saved = await saveDigitalAudit(audit);

    return NextResponse.json({ success: true, audit: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error running audit' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getLeadById } from '@/lib/server/supabase';
import { conductDigitalAudit, generateAuditPdfBuffer, getDigitalAuditByLeadId, saveDigitalAudit } from '@/lib/server/audit';

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

    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Retrieve existing or generate fresh audit
    let audit = await getDigitalAuditByLeadId(leadId);
    if (!audit) {
      audit = await conductDigitalAudit(lead);
      await saveDigitalAudit(audit);
    }

    const pdfBytes = await generateAuditPdfBuffer(lead, audit);

    // Sanitize business name for Content-Disposition header
    const safeName = (lead.business_name || 'business')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="digital-audit-${safeName}.pdf"`,
        'Cache-Control': 'public, max-age=1800, s-maxage=3600',
      },
    });
  } catch (err: any) {
    console.error('PDF generation error:', err);
    return NextResponse.json({ error: err.message || 'Failed generating PDF audit' }, { status: 500 });
  }
}

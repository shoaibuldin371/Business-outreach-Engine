import { NextRequest, NextResponse } from 'next/server';
import { recordLeadReply, getLeadById } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const leadId = params.id;
    const lead = await getLeadById(leadId);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const replyType = body.reply_type;
    const notes = body.notes || '';

    const validTypes = ['positive', 'pricing_or_portfolio', 'meeting_requested', 'unsubscribed', 'negative'];
    if (!replyType || !validTypes.includes(replyType)) {
      return NextResponse.json(
        { error: `Invalid reply_type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const res = await recordLeadReply(leadId, replyType as any, notes);
    return NextResponse.json({
      status: 'success',
      message: res.message,
      lead: res.lead,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to record reply' }, { status: 500 });
  }
}

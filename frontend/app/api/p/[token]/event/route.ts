import { NextRequest, NextResponse } from 'next/server';
import { recordPageEvent } from '@/lib/server/personalized-page';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    if (!token || token.length < 32) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const eventType = body.event_type || 'page_viewed';

    if (!['page_viewed', 'roi_calculated', 'meeting_requested'].includes(eventType)) {
      return NextResponse.json({ error: 'Unsupported event type' }, { status: 400 });
    }

    const ok = await recordPageEvent(token, eventType, body.payload);
    return NextResponse.json({ success: ok });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Event tracking error' }, { status: 500 });
  }
}

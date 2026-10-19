import { NextRequest } from 'next/server';
import { POST as sendHandler } from '../send/route';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return sendHandler(req, { params });
}

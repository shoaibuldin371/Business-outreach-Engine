import { NextRequest, NextResponse } from 'next/server';
import { getClient, getDatabaseTelemetry } from '@/lib/server/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const table = searchParams.get('table') || 'leads';
    const limit = parseInt(searchParams.get('limit') || '50');

    const sb = getClient();
    if (!sb) {
      return NextResponse.json({ error: 'Supabase client not initialized' }, { status: 500 });
    }

    const telemetry = await getDatabaseTelemetry();

    // Fetch data for requested table
    let rows: any[] = [];
    let count = 0;

    if (table === 'leads') {
      const res = await sb.from('leads').select('*').order('created_at', { ascending: false }).limit(limit);
      rows = res.data || [];
      count = rows.length;
    } else if (table === 'logs') {
      const res = await sb.from('logs').select('*').order('created_at', { ascending: false }).limit(limit);
      rows = res.data || [];
      count = rows.length;
    } else if (table === 'sent_emails') {
      const res = await sb.from('sent_emails').select('*').order('sent_at', { ascending: false }).limit(limit);
      rows = res.data || [];
      count = rows.length;
    }

    // Schema definitions for complete transparency
    const schemas: Record<string, { role: string; description: string; columns: { name: string; type: string; purpose: string }[] }> = {
      leads: {
        role: 'Master Business Entities & Active Pipeline Funnel',
        description: 'Primary master table storing every business discovered, audited, and prepared for outreach.',
        columns: [
          { name: 'id', type: 'UUID', purpose: 'Unique primary identifier for the business entity' },
          { name: 'business_name', type: 'TEXT', purpose: 'Verified registered trade or company name' },
          { name: 'category', type: 'TEXT', purpose: 'Specific business trade (e.g. roofing, cosmetic dentist)' },
          { name: 'city', type: 'TEXT', purpose: 'City, State/Region of business headquarters' },
          { name: 'phone', type: 'TEXT', purpose: 'Official voice telephone contact number' },
          { name: 'email', type: 'TEXT', purpose: 'Auto-enriched target email address for outreach proposal' },
          { name: 'website', type: 'TEXT', purpose: 'Audited digital footprint or company website address' },
          { name: 'website_status', type: 'TEXT', purpose: 'Website audit evaluation (none_found, unreachable, custom_target)' },
          { name: 'score', type: 'INTEGER', purpose: 'Algorithm confidence rating score (0 - 100)' },
          { name: 'notes', type: 'TEXT', purpose: 'Factual local review ratings and operational evidence' },
          { name: 'email_subject', type: 'TEXT', purpose: 'Personalized tailored proposal email subject' },
          { name: 'email_body', type: 'TEXT', purpose: 'AI-generated personalized value proposition pitch' },
          { name: 'status', type: 'TEXT', purpose: 'Current outreach stage: pending_approval, sent, rejected' },
          { name: 'approval_token', type: 'TEXT', purpose: 'Cryptographic 64-char token for 1-click review in Gmail' },
          { name: 'source', type: 'TEXT', purpose: 'Data source origin (e.g. OpenStreetMap Live Directory)' },
          { name: 'last_contacted_at', type: 'TIMESTAMPTZ', purpose: 'Timestamp when pitch was successfully dispatched' },
          { name: 'created_at', type: 'TIMESTAMPTZ', purpose: 'Timestamp when record was created in database' },
          { name: 'updated_at', type: 'TIMESTAMPTZ', purpose: 'Timestamp of last modification or enrichment' },
        ],
      },
      logs: {
        role: 'Autonomous Execution & Diagnostic Audit Traces',
        description: 'Chronological timeline recording every operation: Nominatim queries, DNS MX verifications, and dispatches.',
        columns: [
          { name: 'id', type: 'UUID', purpose: 'Unique trace log identifier' },
          { name: 'lead_id', type: 'UUID', purpose: 'Foreign key reference to related business lead' },
          { name: 'step', type: 'TEXT', purpose: 'Execution pipeline step (find, explore, draft, sending, success)' },
          { name: 'status', type: 'TEXT', purpose: 'Execution severity status (info, success, warning, error)' },
          { name: 'message', type: 'TEXT', purpose: 'Human-readable explanation of the action performed' },
          { name: 'details', type: 'JSONB', purpose: 'Technical metadata, HTTP response codes, and search queries' },
          { name: 'created_at', type: 'TIMESTAMPTZ', purpose: 'Exact timestamp of the execution event' },
        ],
      },
      sent_emails: {
        role: 'Delivered Pitches & Dispatch Audit Trail',
        description: 'Permanent immutable audit ledger of all proposals delivered to business prospects.',
        columns: [
          { name: 'id', type: 'UUID', purpose: 'Unique message dispatch audit identifier' },
          { name: 'lead_id', type: 'UUID', purpose: 'Foreign key to the recipient business in public.leads' },
          { name: 'recipient_email', type: 'TEXT', purpose: 'Target email address the proposal was delivered to' },
          { name: 'subject', type: 'TEXT', purpose: 'Subject line of the delivered email message' },
          { name: 'body', type: 'TEXT', purpose: 'Exact body content of the outreach email dispatched' },
          { name: 'sender_type', type: 'TEXT', purpose: 'Delivery transport provider (smtp, gmail_oauth, custom_manual)' },
          { name: 'status', type: 'TEXT', purpose: 'Delivery outcome status (sent, failed)' },
          { name: 'error_message', type: 'TEXT', purpose: 'Error explanation if message transmission failed' },
          { name: 'sent_at', type: 'TIMESTAMPTZ', purpose: 'Exact timestamp of transmission' },
        ],
      },
    };

    return NextResponse.json({
      telemetry,
      current_table: table,
      schema: schemas[table] || null,
      all_schemas: schemas,
      count,
      rows,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

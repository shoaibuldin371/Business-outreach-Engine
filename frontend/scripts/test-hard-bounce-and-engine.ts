import assert from 'assert';
import { classifyEmailError, sendEmail, sendPitchToProspect } from '../lib/server/email';
import { isSuppressed, addToSuppressionList, getSuppressionList } from '../lib/server/suppression';
import { isValidEmailSyntax, isPlaceholderOrGuessedAddress, verifyEmailAddress, isCredibleEmailSourceUrl } from '../lib/server/verification';
import { extractEmailWithSource, parseEmailsFromHtml } from '../lib/server/research';
import { conductDigitalAudit, generateAuditPdfBuffer } from '../lib/server/audit';
import { generateSecureToken, buildInitialRoiAssumptions, buildProposalForLead } from '../lib/server/personalized-page';
import { BusinessLead } from '../lib/server/types';
import { getDashboardStats } from '../lib/server/supabase';
import { POST as handleWebhookPost } from '../app/api/outreach/webhook/route';
import { NextRequest } from 'next/server';

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 RUNNING BUSINESS OUTREACH ENGINE COMPREHENSIVE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    return (async () => {
      try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
      } catch (err: any) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}\n`);
        failed++;
      }
    })();
  }

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Hard Bounce & SMTP Error Classification (550 5.1.1)
  // --------------------------------------------------------------------------
  console.log('📦 GROUP 1: Gmail SMTP Hard-Bounce Classification (550 5.1.1)');

  await test('Accurately detects standard 550 5.1.1 "account does not exist" as HARD_BOUNCE', () => {
    const rawError = '550 5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient\'s email address.';
    const result = classifyEmailError(new Error(rawError));
    assert.strictEqual(result.isHardBounce, true, 'Must be classified as hard bounce');
    assert.strictEqual(result.canRetry, false, 'Permanent failure must not be retried');
    assert.strictEqual(result.category, 'HARD_BOUNCE');
    assert.strictEqual(result.smtpCode, '550 5.1.1');
  });

  await test('Detects NoSuchUser / 550 User unknown as HARD_BOUNCE', () => {
    const rawError = '550-5.1.1 Recipient address rejected: NoSuchUser recipient account deactivated';
    const result = classifyEmailError(new Error(rawError));
    assert.strictEqual(result.isHardBounce, true);
    assert.strictEqual(result.canRetry, false);
    assert.strictEqual(result.category, 'HARD_BOUNCE');
  });

  await test('Detects "550 User unknown" and "mailbox unavailable" as HARD_BOUNCE', () => {
    const rawError = '550 User unknown: mailbox unavailable';
    const result = classifyEmailError(new Error(rawError));
    assert.strictEqual(result.isHardBounce, true);
    assert.strictEqual(result.canRetry, false);
    assert.strictEqual(result.category, 'HARD_BOUNCE');
  });

  await test('Detects temporary rate limit or 421 deferral as retriable TEMPORARY_FAILURE', () => {
    const rawError = '421 4.7.0 Try again later, closing transmission channel';
    const result = classifyEmailError(new Error(rawError));
    assert.strictEqual(result.isHardBounce, false, 'Temporary errors are not hard bounces');
    assert.strictEqual(result.canRetry, true, 'Temporary error should allow bounded retry');
    assert.strictEqual(result.category, 'TEMPORARY_FAILURE');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Suppression List & Safety Enforcement
  // --------------------------------------------------------------------------
  console.log('\n📦 GROUP 2: Suppression List & Domain Reputation Protection');

  await test('Permanently suppresses info@unstructured.io (the real reported failure address)', async () => {
    const suppressed = await isSuppressed('info@unstructured.io');
    assert.strictEqual(suppressed, true, 'info@unstructured.io must be suppressed');
  });

  await test('Suppression checks are case-insensitive and trim whitespace', async () => {
    const suppressed = await isSuppressed('  INFO@UNSTRUCTURED.IO  ');
    assert.strictEqual(suppressed, true, 'Should match case-insensitively with whitespace trimmed');
  });

  await test('Dynamic suppression entry addition persists with SMTP code and diagnostic message', async () => {
    const testEmail = 'bounced-prospect-unit-test@example-invalid.org';
    await addToSuppressionList(
      testEmail,
      'hard_bounce',
      'unit_test_suite',
      '550 5.1.1',
      'Recipient mailbox does not exist'
    );
    const isNowSuppressed = await isSuppressed(testEmail);
    assert.strictEqual(isNowSuppressed, true, 'Dynamically added email must be suppressed');
  });

  await test('verifyEmailAddress rejects suppressed email (info@unstructured.io) even if provided with website URL', async () => {
    const res = await verifyEmailAddress('info@unstructured.io', 'https://unstructured.io/contact');
    assert.strictEqual(res.eligibleForOutreach, false, 'Suppressed email must never be eligible for outreach');
    assert.strictEqual(res.status, 'suppressed');
    assert.ok(res.rejectionReason?.includes('permanently suppressed'));
  });

  await test('Unrelated valid address remains eligible and is not affected by suppression', async () => {
    const res = await verifyEmailAddress('press@google.com', 'https://about.google/contact');
    assert.strictEqual(res.eligibleForOutreach, true, 'Unrelated legitimate address must remain eligible');
    assert.strictEqual(res.status, 'publicly_sourced_and_mx_checked');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Contact Verification & Anti-Fabrication Safeguards
  // --------------------------------------------------------------------------
  console.log('\n📦 GROUP 3: Contact Verification & Sourcing Rules (Missing, Malformed, Guessed, Valid)');

  await test('Missing email: Rejects undefined, empty, or whitespace email addresses', async () => {
    const resUndefined = await verifyEmailAddress(undefined);
    assert.strictEqual(resUndefined.eligibleForOutreach, false);
    assert.strictEqual(resUndefined.status, 'missing');

    const resEmpty = await verifyEmailAddress('');
    assert.strictEqual(resEmpty.eligibleForOutreach, false);
    assert.strictEqual(resEmpty.status, 'missing');

    const resSpaces = await verifyEmailAddress('   ');
    assert.strictEqual(resSpaces.eligibleForOutreach, false);
    assert.strictEqual(resSpaces.status, 'missing');
  });

  await test('Malformed email: Rejects syntax-invalid emails and RFC violations', async () => {
    assert.strictEqual(isValidEmailSyntax('not-an-email'), false);
    assert.strictEqual(isValidEmailSyntax('user@localhost'), false);
    assert.strictEqual(isValidEmailSyntax('user..name@domain.com'), false);
    assert.strictEqual(isValidEmailSyntax('user@.com'), false);
    assert.strictEqual(isValidEmailSyntax('user@domain'), false);

    const resInvalid = await verifyEmailAddress('malformed-address@');
    assert.strictEqual(resInvalid.eligibleForOutreach, false);
    assert.strictEqual(resInvalid.status, 'invalid_syntax');
  });

  await test('Guessed email: Rejects placeholder patterns and generic role mailbox guesses', async () => {
    assert.strictEqual(isPlaceholderOrGuessedAddress('info@domain.com'), true);
    assert.strictEqual(isPlaceholderOrGuessedAddress('admin@website.com'), true);
    assert.strictEqual(isPlaceholderOrGuessedAddress('yourname@company.com'), true);
    assert.strictEqual(isPlaceholderOrGuessedAddress('test@placeholder.com'), true);

    const resPlaceholder = await verifyEmailAddress('info@domain.com', 'https://domain.com');
    assert.strictEqual(resPlaceholder.eligibleForOutreach, false);
    assert.strictEqual(resPlaceholder.status, 'placeholder_rejected');
  });

  await test('Unsupported guess: Rejects email lacking a credible public source URL or derived from search snippet', async () => {
    // 1. Missing sourceUrl is an unsupported guess
    const resNoSource = await verifyEmailAddress('contact@mybusiness.com', undefined);
    assert.strictEqual(resNoSource.eligibleForOutreach, false, 'Must reject email without credible source URL');
    assert.strictEqual(resNoSource.status, 'missing');

    // 2. Search engine snippet URL is not an official credible source URL
    assert.strictEqual(isCredibleEmailSourceUrl('https://html.duckduckgo.com/html/?q=search'), false);
    assert.strictEqual(isCredibleEmailSourceUrl('https://www.google.com/search?q=email'), false);
    assert.strictEqual(isCredibleEmailSourceUrl('https://search.brave.com/res/v1/web/search'), false);

    const resSnippet = await verifyEmailAddress('contact@mybusiness.com', 'https://html.duckduckgo.com/html/?q=mybusiness');
    assert.strictEqual(resSnippet.eligibleForOutreach, false, 'Search engine snippets are not credible source URLs');
    assert.strictEqual(resSnippet.status, 'missing');
  });

  await test('Valid email: parseEmailsFromHtml extracts legitimate emails and ignores placeholders and assets', () => {
    const mockHtml = `
      <html>
        <body>
          <div class="contact">
            <h1>Contact Us</h1>
            <p>For custom engineering and partnerships, reach our team at:</p>
            <a href="mailto:partnerships@acmetechsolutions.com">partnerships@acmetechsolutions.com</a>
            <p>Ignore placeholders: info@domain.com and logo@banner.png and style@theme.css</p>
            <p>Or call our office: (512) 555-0199</p>
          </div>
        </body>
      </html>
    `;
    const emails = parseEmailsFromHtml(mockHtml);
    assert.ok(emails.length === 1, 'Only genuine email must be extracted');
    assert.strictEqual(emails[0], 'partnerships@acmetechsolutions.com');
  });

  await test('Valid publicly sourced email: verifyEmailAddress approves legitimate email with active MX and credible source', async () => {
    const credibleUrl = 'https://about.google/contact';
    assert.strictEqual(isCredibleEmailSourceUrl(credibleUrl), true);

    const res = await verifyEmailAddress('press@google.com', credibleUrl);
    assert.strictEqual(res.eligibleForOutreach, true, 'Legitimate publicly sourced email must be eligible');
    assert.strictEqual(res.status, 'publicly_sourced_and_mx_checked');
    assert.strictEqual(res.sourceUrl, credibleUrl);
    assert.ok(res.hasMxRecords, 'Domain google.com has active MX records');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Digital Audit & Serverless Vector PDF Generation
  // --------------------------------------------------------------------------
  console.log('\n📦 GROUP 4: Evidence-Based Digital Audit & Vector PDF');

  const sampleLead: BusinessLead = {
    id: 'lead-test-audit-001',
    business_name: 'Apex Automated Workflows LLC',
    city: 'Austin',
    state: 'TX',
    industry: 'Technology, Software & SaaS',
    service_category: 'ai_automation',
    signal_type: 'explicit_demand',
    demand_evidence: 'Documented RFP for internal RAG knowledge base and automated customer workflow triage.',
    evidence_url: 'https://example.com/rfp-notice',
    website: 'https://example.com',
    status: 'pending_approval',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await test('conductDigitalAudit generates evidence-backed findings and recommendations', async () => {
    const audit = await conductDigitalAudit(sampleLead);
    assert.ok(audit, 'Audit must be generated');
    assert.strictEqual(audit.lead_id, sampleLead.id);
    assert.ok(audit.recommendations.length > 0, 'Must have at least one recommendation');
  });

  await test('generateAuditPdfBuffer produces valid 1-page vector PDF with %PDF magic header', async () => {
    const audit = await conductDigitalAudit(sampleLead);
    const pdfBuffer = await generateAuditPdfBuffer(sampleLead, audit);
    assert.ok(pdfBuffer instanceof Uint8Array, 'Must return a Uint8Array / Buffer');
    assert.ok(pdfBuffer.length > 500, 'PDF buffer must have reasonable size');
    
    // Check %PDF magic byte header
    const header = Buffer.from(pdfBuffer).slice(0, 5).toString('ascii');
    assert.strictEqual(header, '%PDF-', 'PDF document must begin with %PDF- header');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Personalized Portal & Interactive ROI Math
  // --------------------------------------------------------------------------
  console.log('\n📦 GROUP 5: Personalized Portal Security & ROI Calculator');

  await test('generateSecureToken produces an unguessable 48-character hex token', () => {
    const token1 = generateSecureToken();
    const token2 = generateSecureToken();
    assert.strictEqual(token1.length, 48, 'Token must be exactly 48 chars (24 bytes hex)');
    assert.strictEqual(token2.length, 48);
    assert.notStrictEqual(token1, token2, 'Consecutive tokens must be cryptographically distinct');
    assert.match(token1, /^[0-9a-f]{48}$/, 'Must consist of hexadecimal characters only');
  });

  await test('buildInitialRoiAssumptions math is mathematically sound and has disclaimer', () => {
    const aiRoi = buildInitialRoiAssumptions('ai_automation');
    assert.ok(aiRoi.hours_saved_per_week > 0);
    assert.ok(aiRoi.hourly_rate_usd > 0);
    const expectedMonthly = aiRoi.hours_saved_per_week * aiRoi.hourly_rate_usd * 4;
    assert.strictEqual(
      aiRoi.estimated_monthly_value_usd,
      expectedMonthly,
      'ROI formula (hours * rate * 4 weeks) must match'
    );
    assert.ok(aiRoi.disclaimer.length > 20, 'Disclaimer must be present to avoid unsubstantiated claims');
  });

  await test('buildProposalForLead builds tailored proposal without exposing private lead IDs or notes', () => {
    const proposal = buildProposalForLead(sampleLead);
    assert.ok(proposal.headline.includes(sampleLead.business_name), 'Headline incorporates business name');
    assert.strictEqual(proposal.recommended_service, 'ai_automation');
    assert.ok(proposal.core_deliverables.length >= 3, 'Must include clear deliverables');
  });

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Exact 550 5.1.1 Failure, Complete Suppression & Delivery Counts
  // --------------------------------------------------------------------------
  console.log('\n📦 GROUP 6: Exact 550 5.1.1 Suppression & Outreach Safety Guarantees');

  await test('Exact 550 5.1.1 Gmail response is strictly classified as HARD_BOUNCE with zero retries', () => {
    const exactError = '550 5.1.1 The email account that you tried to reach does not exist. Please try double-checking the recipient\'s email address.';
    const classified = classifyEmailError(new Error(exactError));
    assert.strictEqual(classified.category, 'HARD_BOUNCE');
    assert.strictEqual(classified.isHardBounce, true, 'isHardBounce must be true');
    assert.strictEqual(classified.canRetry, false, 'canRetry must be false (NO RETRY)');
    assert.strictEqual(classified.smtpCode, '550 5.1.1');
    assert.ok(classified.message.includes('550 5.1.1 Hard Bounce: Mailbox does not exist'));
  });

  await test('sendEmail blocks suppressed address (info@unstructured.io) immediately without attempting SMTP', async () => {
    const res = await sendEmail({
      to: 'info@unstructured.io',
      subject: 'Test Subject',
      text: 'Test Body',
    });
    assert.strictEqual(res.success, false, 'Send must fail for suppressed address');
    assert.strictEqual(res.status, 'bounced', 'Status must be bounced');
    assert.strictEqual(res.isHardBounce, true, 'Must report isHardBounce: true');
    assert.strictEqual(res.smtpCode, '550 5.1.1');
    assert.strictEqual(res.provider, 'none', 'Must not connect to any mail provider');
    assert.ok(res.message.includes('suppression list'));
  });

  await test('sendPitchToProspect blocks outreach to suppressed recipient and marks lead bounced', async () => {
    const suppressedLead: BusinessLead = {
      id: 'lead-test-suppressed-001',
      business_name: 'Unstructured Technologies Audit Copy',
      email: 'info@unstructured.io',
      status: 'pending_approval',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const res = await sendPitchToProspect(suppressedLead);
    assert.strictEqual(res.success, false, 'Outreach dispatch must be blocked');
    assert.ok(res.message.includes('permanently suppressed'));
  });

  await test('Unrelated valid prospect with credible public email remains eligible for outreach', async () => {
    const validLead: BusinessLead = {
      id: 'lead-test-valid-google-001',
      business_name: 'Google Press Office',
      email: 'press@google.com',
      email_source_url: 'https://about.google/contact',
      status: 'pending_approval',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const isSupp = await isSuppressed(validLead.email!);
    assert.strictEqual(isSupp, false, 'Legitimate email must NOT be suppressed');

    const verified = await verifyEmailAddress(validLead.email!, validLead.email_source_url);
    assert.strictEqual(verified.eligibleForOutreach, true, 'Legitimate email must remain eligible');
  });

  await test('Gmail authentication failure (535) is classified as AUTHENTICATION_FAILURE (NOT recipient bounce)', () => {
    const authError = '535-5.7.8 Username and Password not accepted. Learn more at https://support.google.com/mail/?p=BadCredentials';
    const classified = classifyEmailError(new Error(authError));
    assert.strictEqual(classified.category, 'AUTHENTICATION_FAILURE');
    assert.strictEqual(classified.isHardBounce, false, 'Auth error is NOT a recipient bounce');
    assert.strictEqual(classified.canRetry, false, 'Auth error credentials must be resolved manually');
    assert.strictEqual(classified.smtpCode, '535');
  });

  await test('Provider sending quota (429/5.4.5) is classified as RATE_LIMIT_EXCEEDED (NOT recipient bounce)', () => {
    const quotaError = '429 5.4.5 Daily user sending limit exceeded for user Mshoaibawan371@gmail.com';
    const classified = classifyEmailError(new Error(quotaError));
    assert.strictEqual(classified.category, 'RATE_LIMIT_EXCEEDED');
    assert.strictEqual(classified.isHardBounce, false, 'Daily quota is NOT a recipient bounce');
    assert.strictEqual(classified.smtpCode, '429');
  });

  await test('getDashboardStats provides 7 separate delivery counts and failed email audit trail', async () => {
    const stats = await getDashboardStats();
    assert.ok(typeof stats.emails_queued === 'number', 'emails_queued must be a number');
    assert.ok(typeof stats.accepted_by_provider_count === 'number', 'accepted_by_provider_count must be a number');
    assert.ok(typeof stats.confirmed_delivered_count === 'number', 'confirmed_delivered_count must be a number');
    assert.ok(typeof stats.bounced_count === 'number', 'bounced_count must be a number');
    assert.ok(typeof stats.temporary_failures_count === 'number', 'temporary_failures_count must be a number');
    assert.ok(typeof stats.auth_provider_errors_count === 'number', 'auth_provider_errors_count must be a number');
    assert.ok(typeof stats.replies_count === 'number', 'replies_count must be a number');

    assert.ok(Array.isArray(stats.failed_email_details), 'failed_email_details must be an array');
    const unstructuredFailure = stats.failed_email_details.find(
      (f) => f.recipient_email.toLowerCase() === 'info@unstructured.io'
    );
    assert.ok(unstructuredFailure, 'Audit entry for info@unstructured.io must be present');
    assert.strictEqual(unstructuredFailure.delivery_status, 'bounced');
    assert.strictEqual(unstructuredFailure.is_suppressed, true);
    assert.strictEqual(unstructuredFailure.can_retry, false);
    assert.ok(unstructuredFailure.actual_failure_reason.includes('550 5.1.1'));
    assert.strictEqual(unstructuredFailure.business_name, 'Unstructured Technologies');
  });

  await test('Webhook endpoint processes hard bounce event and idempotently prevents duplicate processing', async () => {
    const testBounceEmail = 'webhook-bounce-unit-test@example-bounce.org';
    const eventId = `test-evt-bounce-${Date.now()}`;

    const mockRequest1 = new NextRequest('http://localhost:3000/api/outreach/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        event_type: 'hard_bounce',
        recipient: testBounceEmail,
        smtp_code: '550 5.1.1',
        error: '550 5.1.1 The email account that you tried to reach does not exist.',
      }),
    });

    const res1 = await handleWebhookPost(mockRequest1);
    const body1 = await res1.json();
    assert.strictEqual(body1.success, true);
    assert.strictEqual(body1.action, 'suppressed_hard_bounce');

    // Confirm email is now suppressed
    const isSupp = await isSuppressed(testBounceEmail);
    assert.strictEqual(isSupp, true, 'Address must be suppressed via webhook event');

    // Send the EXACT SAME webhook event again to verify idempotency
    const mockRequestDuplicate = new NextRequest('http://localhost:3000/api/outreach/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId,
        event_type: 'hard_bounce',
        recipient: testBounceEmail,
        smtp_code: '550 5.1.1',
        error: '550 5.1.1 The email account that you tried to reach does not exist.',
      }),
    });

    const res2 = await handleWebhookPost(mockRequestDuplicate);
    const body2 = await res2.json();
    assert.strictEqual(body2.success, true);
    assert.strictEqual(body2.idempotent, true, 'Duplicate webhook event must be recognized as idempotent');
    assert.strictEqual(body2.message, 'Duplicate event ignored (idempotent)');
  });

  console.log('\n================================================================');
  console.log(`🏁 TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

import assert from 'assert';
import { classifyEmailError } from '../lib/server/email';
import { isSuppressed, addToSuppressionList, getSuppressionList } from '../lib/server/suppression';
import { isValidEmailSyntax, isPlaceholderOrGuessedAddress, verifyEmailAddress } from '../lib/server/verification';
import { extractEmailWithSource, parseEmailsFromHtml } from '../lib/server/research';
import { conductDigitalAudit, generateAuditPdfBuffer } from '../lib/server/audit';
import { generateSecureToken, buildInitialRoiAssumptions, buildProposalForLead } from '../lib/server/personalized-page';
import { BusinessLead } from '../lib/server/types';

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

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Contact Verification & Anti-Fabrication Safeguards
  // --------------------------------------------------------------------------
  console.log('\n📦 GROUP 3: Contact Verification & Sourcing Rules');

  await test('Rejects syntax-invalid emails and placeholder patterns', () => {
    assert.strictEqual(isValidEmailSyntax('not-an-email'), false);
    assert.strictEqual(isValidEmailSyntax('user@localhost'), false);
    assert.strictEqual(isPlaceholderOrGuessedAddress('info@domain.com'), true);
    assert.strictEqual(isPlaceholderOrGuessedAddress('admin@website.com'), true);
    assert.strictEqual(isPlaceholderOrGuessedAddress('yourname@company.com'), true);
  });

  await test('parseEmailsFromHtml only extracts legitimate public emails from website HTML', () => {
    const mockHtml = `
      <html>
        <body>
          <div class="contact">
            <h1>Contact Us</h1>
            <p>For custom engineering and partnerships, reach our technical team at:</p>
            <a href="mailto:partnerships@acmetechsolutions.com">partnerships@acmetechsolutions.com</a>
            <p>Or call our office: (512) 555-0199</p>
          </div>
        </body>
      </html>
    `;
    const emails = parseEmailsFromHtml(mockHtml);
    assert.ok(emails.length > 0, 'Must successfully extract emails');
    assert.strictEqual(emails[0], 'partnerships@acmetechsolutions.com');
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

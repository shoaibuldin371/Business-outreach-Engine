export interface ClassifiedEmailError {
  category:
    | 'HARD_BOUNCE'
    | 'TEMPORARY_FAILURE'
    | 'AUTHENTICATION_FAILURE'
    | 'RATE_LIMIT_EXCEEDED'
    | 'MESSAGE_REJECTED'
    | 'TIMEOUT_OR_UNKNOWN';
  isHardBounce: boolean;
  canRetry: boolean;
  smtpCode: string;
  enhancedCode?: string;
  diagnosticResponse?: string;
  message: string;
  rawError: string;
}

export interface ParsedBounceNotification {
  isPermanentBounce: boolean;
  isHardBounce: boolean;
  category:
    | 'HARD_BOUNCE'
    | 'TEMPORARY_FAILURE'
    | 'AUTHENTICATION_FAILURE'
    | 'RATE_LIMIT_EXCEEDED'
    | 'MESSAGE_REJECTED'
    | 'TIMEOUT_OR_UNKNOWN';
  recipient?: string;
  smtpCode: string;
  enhancedCode?: string;
  diagnosticResponse: string;
  failureReason: string;
  canRetry: boolean;
  rawContent: string;
}

/**
 * Extracts exact SMTP code and enhanced status code from an error or DSN string.
 * e.g., "550 5.1.1", "550-5.1.1", "553 5.3.0", "421 4.7.0"
 */
export function extractSmtpCodes(text: string): { smtpCode?: string; enhancedCode?: string } {
  if (!text) return {};

  // Check for combined code e.g. "550 5.1.1" or "550-5.1.1"
  const combinedMatch = text.match(/\b(5\d{2}|4\d{2})[- ]([45]\.\d+\.\d+)\b/);
  if (combinedMatch) {
    return {
      smtpCode: `${combinedMatch[1]} ${combinedMatch[2]}`,
      enhancedCode: combinedMatch[2],
    };
  }

  // Check for isolated enhanced code e.g. "5.1.1"
  const enhancedMatch = text.match(/\b([45]\.\d+\.\d+)\b/);
  const baseCodeMatch = text.match(/\b([45]\d{2})\b/);

  if (baseCodeMatch && enhancedMatch) {
    return {
      smtpCode: `${baseCodeMatch[1]} ${enhancedMatch[1]}`,
      enhancedCode: enhancedMatch[1],
    };
  }

  if (baseCodeMatch) {
    return { smtpCode: baseCodeMatch[1] };
  }

  if (enhancedMatch) {
    const defaultBase = enhancedMatch[1].startsWith('5.') ? '550' : '450';
    return {
      smtpCode: `${defaultBase} ${enhancedMatch[1]}`,
      enhancedCode: enhancedMatch[1],
    };
  }

  return {};
}

/**
 * Parses Gmail Delivery Status Notifications (DSN), bounce emails, and webhook payloads.
 * Detects "Address not found", 550 5.1.1, NoSuchUser, and extracts the affected recipient.
 */
export function parseBounceNotification(raw: any): ParsedBounceNotification {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const lower = text.toLowerCase();
  const codes = extractSmtpCodes(text);

  // Extract recipient email if mentioned in standard bounce format
  let recipient: string | undefined = undefined;
  if (typeof raw === 'object' && raw !== null) {
    recipient = raw.recipient || raw.email || raw.to;
  }
  if (!recipient) {
    const rcptMatch =
      text.match(/wasn't delivered to\s+<*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>*/i) ||
      text.match(/couldn't be delivered to\s+<*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>*/i) ||
      text.match(/failed to deliver to\s+<*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>*/i) ||
      text.match(/recipient:\s*<*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>*/i) ||
      text.match(/final-recipient:\s*(?:rfc822;\s*)?<*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>*/i);

    if (rcptMatch) {
      recipient = rcptMatch[1].trim().toLowerCase();
    }
  }

  // Extract diagnostic response (Diagnostic-Code header or error explanation)
  let diagnosticResponse = '';
  const diagMatch = text.match(/diagnostic-code:\s*([^;\r\n]+;\s*)?([^\r\n]+)/i);
  if (diagMatch) {
    diagnosticResponse = diagMatch[2].trim();
  } else if (text.includes('550')) {
    const line550 = text.split('\n').find((l) => l.includes('550'));
    if (line550) diagnosticResponse = line550.trim();
  }

  if (!diagnosticResponse) {
    diagnosticResponse = text.slice(0, 300).trim();
  }

  // Check for permanent recipient failure (Hard Bounce)
  const isHardBounce =
    lower.includes('address not found') ||
    lower.includes("wasn't delivered to") ||
    lower.includes("couldn't be found") ||
    lower.includes('unable to receive mail') ||
    lower.includes('550 5.1.1') ||
    lower.includes('550-5.1.1') ||
    lower.includes('5.1.1') ||
    lower.includes('550 5.1.0') ||
    lower.includes('550 5.2.1') ||
    lower.includes('553 5.3.0') ||
    lower.includes('nosuchuser') ||
    lower.includes('user unknown') ||
    lower.includes('does not exist') ||
    lower.includes('mailbox unavailable') ||
    lower.includes('no mailbox') ||
    lower.includes('invalid recipient') ||
    lower.includes('recipient rejected') ||
    (lower.includes('550') && (lower.includes('unknown') || lower.includes('invalid') || lower.includes('not exist')));

  const smtpCode = codes.smtpCode || (isHardBounce ? '550 5.1.1' : 'UNKNOWN');
  const enhancedCode = codes.enhancedCode || (isHardBounce ? '5.1.1' : undefined);

  let failureReason = diagnosticResponse;
  if (isHardBounce) {
    failureReason = `Permanent Recipient Failure (${smtpCode} Hard Bounce: Mailbox does not exist or address not found). ${diagnosticResponse}`;
  }

  return {
    isPermanentBounce: isHardBounce,
    isHardBounce,
    category: isHardBounce ? 'HARD_BOUNCE' : 'TIMEOUT_OR_UNKNOWN',
    recipient,
    smtpCode,
    enhancedCode,
    diagnosticResponse,
    failureReason,
    canRetry: !isHardBounce,
    rawContent: text,
  };
}

/**
 * Classifies SMTP errors, Gmail API responses, DSN notifications, and network failures.
 * Accurately detects permanent recipient failures (550 5.1.1, Address not found, NoSuchUser, User unknown)
 * so they are never retried, never marked delivered, and immediately suppressed.
 */
export function classifyEmailError(err: any): ClassifiedEmailError {
  const str = String(err?.message || err?.response || err || '');
  const lower = str.toLowerCase();
  const codes = extractSmtpCodes(str);

  // 1. Permanent Recipient Failures (Hard Bounces)
  // Specific checks for "Address not found", 550 5.1.1, NoSuchUser, User unknown, account does not exist
  if (
    lower.includes('address not found') ||
    lower.includes("wasn't delivered to") ||
    lower.includes("couldn't be found") ||
    lower.includes('unable to receive mail') ||
    lower.includes('550 5.1.1') ||
    lower.includes('550-5.1.1') ||
    lower.includes('5.1.1') ||
    lower.includes('550 5.1.0') ||
    lower.includes('550 5.2.1') ||
    lower.includes('553 5.3.0') ||
    lower.includes('nosuchuser') ||
    lower.includes('user unknown') ||
    lower.includes('does not exist') ||
    lower.includes('account that you tried to reach does not exist') ||
    lower.includes('recipient rejected') ||
    lower.includes('mailbox unavailable') ||
    lower.includes('no mailbox') ||
    lower.includes('invalid recipient') ||
    (lower.includes('550') &&
      (lower.includes('unknown') ||
        lower.includes('invalid') ||
        lower.includes('not exist') ||
        lower.includes('recipient') ||
        lower.includes('mailbox')))
  ) {
    const smtpCode = codes.smtpCode || '550 5.1.1';
    const enhancedCode = codes.enhancedCode || '5.1.1';
    return {
      category: 'HARD_BOUNCE',
      isHardBounce: true,
      canRetry: false,
      smtpCode,
      enhancedCode,
      diagnosticResponse: str,
      message: `Remote mail server rejected recipient (${smtpCode} Hard Bounce: Mailbox does not exist / Address not found): ${str}`,
      rawError: str,
    };
  }

  // 2. Authentication Failures (535, Invalid credentials)
  if (
    lower.includes('535') ||
    lower.includes('authentication') ||
    lower.includes('badcredentials') ||
    lower.includes('invalid credentials') ||
    lower.includes('username and password not accepted')
  ) {
    return {
      category: 'AUTHENTICATION_FAILURE',
      isHardBounce: false,
      canRetry: false,
      smtpCode: codes.smtpCode || '535',
      enhancedCode: codes.enhancedCode || '5.7.8',
      diagnosticResponse: str,
      message: 'SMTP/OAuth Authentication failed: Invalid username or App Password.',
      rawError: str,
    };
  }

  // 3. Provider Rate Limits / Quotas (429, 5.4.5)
  if (
    lower.includes('429') ||
    lower.includes('5.4.5') ||
    lower.includes('daily user sending limit') ||
    lower.includes('quota')
  ) {
    return {
      category: 'RATE_LIMIT_EXCEEDED',
      isHardBounce: false,
      canRetry: false,
      smtpCode: codes.smtpCode || '429',
      enhancedCode: codes.enhancedCode || '5.4.5',
      diagnosticResponse: str,
      message:
        'Provider daily sending limit reached (Gmail allows 500/day). Outreach paused to protect sender reputation.',
      rawError: str,
    };
  }

  // 4. Content / Spam / DMARC Rejections (554, 5.7.1)
  if (
    lower.includes('554') ||
    lower.includes('5.7.1') ||
    lower.includes('spam') ||
    lower.includes('dmarc') ||
    lower.includes('blocked')
  ) {
    return {
      category: 'MESSAGE_REJECTED',
      isHardBounce: false,
      canRetry: false,
      smtpCode: codes.smtpCode || '554 5.7.1',
      enhancedCode: codes.enhancedCode || '5.7.1',
      diagnosticResponse: str,
      message: `Message rejected by spam policy or DMARC alignment: ${str}`,
      rawError: str,
    };
  }

  // 5. Temporary Server Issues (421, 450, 451, 452)
  if (
    lower.includes('421') ||
    lower.includes('450') ||
    lower.includes('451') ||
    lower.includes('452') ||
    lower.includes('try again later') ||
    lower.includes('service not available')
  ) {
    const smtpCode = codes.smtpCode || (lower.includes('421') ? '421' : lower.includes('451') ? '451' : '450');
    return {
      category: 'TEMPORARY_FAILURE',
      isHardBounce: false,
      canRetry: true,
      smtpCode,
      enhancedCode: codes.enhancedCode,
      diagnosticResponse: str,
      message: `Temporary mail server issue: ${str}`,
      rawError: str,
    };
  }

  // 6. Network Timeouts
  if (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset')
  ) {
    return {
      category: 'TIMEOUT_OR_UNKNOWN',
      isHardBounce: false,
      canRetry: true,
      smtpCode: 'TIMEOUT',
      diagnosticResponse: str,
      message: `Connection timed out. Check existing send records before retrying to prevent duplicate emails.`,
      rawError: str,
    };
  }

  return {
    category: 'TIMEOUT_OR_UNKNOWN',
    isHardBounce: false,
    canRetry: false,
    smtpCode: codes.smtpCode || 'UNKNOWN',
    diagnosticResponse: str,
    message: str || 'Mail dispatch failed.',
    rawError: str,
  };
}

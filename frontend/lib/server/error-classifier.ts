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
  message: string;
  rawError: string;
}

/**
 * Classifies SMTP errors, Gmail API responses, and network failures.
 * Accurately detects permanent recipient failures (550 5.1.1, NoSuchUser, User unknown)
 * so they are never retried or marked delivered.
 */
export function classifyEmailError(err: any): ClassifiedEmailError {
  const str = String(err?.message || err?.response || err || '');
  const lower = str.toLowerCase();

  // 1. Permanent Recipient Failures (Hard Bounces)
  // Specific checks for 550 5.1.1, NoSuchUser, User unknown, account does not exist
  if (
    lower.includes('550 5.1.1') ||
    lower.includes('5.1.1') ||
    lower.includes('nosuchuser') ||
    lower.includes('user unknown') ||
    lower.includes('does not exist') ||
    lower.includes('account that you tried to reach does not exist') ||
    lower.includes('recipient rejected') ||
    lower.includes('mailbox unavailable') ||
    lower.includes('no mailbox') ||
    lower.includes('invalid recipient') ||
    (lower.includes('550') && (lower.includes('unknown') || lower.includes('invalid') || lower.includes('not exist') || lower.includes('recipient')))
  ) {
    return {
      category: 'HARD_BOUNCE',
      isHardBounce: true,
      canRetry: false,
      smtpCode: '550 5.1.1',
      enhancedCode: '5.1.1',
      message: `Remote mail server rejected recipient (550 5.1.1 Hard Bounce: Mailbox does not exist): ${str}`,
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
      smtpCode: '535',
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
      smtpCode: '429',
      message: 'Provider daily sending limit reached (Gmail allows 500/day). Outreach paused to protect sender reputation.',
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
      smtpCode: '554 5.7.1',
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
    return {
      category: 'TEMPORARY_FAILURE',
      isHardBounce: false,
      canRetry: true,
      smtpCode: lower.includes('421') ? '421' : lower.includes('451') ? '451' : '450',
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
      message: `Connection timed out. Check existing send records before retrying to prevent duplicate emails.`,
      rawError: str,
    };
  }

  return {
    category: 'TIMEOUT_OR_UNKNOWN',
    isHardBounce: false,
    canRetry: false,
    smtpCode: 'UNKNOWN',
    message: str || 'Mail dispatch failed.',
    rawError: str,
  };
}

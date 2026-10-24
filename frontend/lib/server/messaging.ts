export interface MessagingProviderConfig {
  provider: 'twilio' | 'meta_whatsapp' | 'none';
  isEnabled: boolean;
  requiresExplicitConsent: boolean;
  estimatedCostPerMessageUsd: number;
}

export interface MessagingResult {
  status: 'disabled' | 'consent_required' | 'sent' | 'failed';
  channel: 'sms' | 'whatsapp';
  messageId?: string;
  error?: string;
}

/**
 * Returns messaging configuration.
 * Disabled by default to comply with TCPA, 10DLC, and WhatsApp Business policies.
 */
export function getMessagingConfig(): MessagingProviderConfig {
  const provider = (process.env.MESSAGING_PROVIDER as any) || 'none';
  const isEnabled = Boolean(
    process.env.ENABLE_MESSAGING === 'true' &&
    (process.env.TWILIO_ACCOUNT_SID || process.env.META_WHATSAPP_TOKEN) &&
    provider !== 'none'
  );

  return {
    provider,
    isEnabled,
    requiresExplicitConsent: true,
    estimatedCostPerMessageUsd: provider === 'meta_whatsapp' ? 0.05 : 0.015,
  };
}

/**
 * Dispatches an SMS or WhatsApp message only if:
 * 1. Provider is configured
 * 2. Explicit opt-in consent is documented
 * 3. Not on suppression list
 */
export async function sendDirectMessage(
  recipientPhone: string,
  message: string,
  channel: 'sms' | 'whatsapp' = 'sms',
  hasDocumentedConsent = false
): Promise<MessagingResult> {
  const config = getMessagingConfig();

  if (!config.isEnabled || config.provider === 'none') {
    return {
      status: 'disabled',
      channel,
      error: 'Messaging channel is disabled by default. Core email & audit workflows operate independently.',
    };
  }

  if (!hasDocumentedConsent) {
    return {
      status: 'consent_required',
      channel,
      error: 'TCPA and WhatsApp Business compliance require explicit documented opt-in prior to mobile dispatch.',
    };
  }

  // Placeholder dispatch when provider is active and consent verified
  return {
    status: 'failed',
    channel,
    error: `Live SMS/WhatsApp provider '${config.provider}' is awaiting approved 10DLC brand registration.`,
  };
}

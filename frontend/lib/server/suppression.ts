import { SuppressionEntry } from './types';
import { getClient } from './supabase';

// In-memory fallback cache seeded with permanent 550 hard bounces
const localSuppressedEmails = new Set<string>([
  'info@unstructured.io',
  'contact@outbackroofing.com',
  'contact@.com',
]);

/**
 * Checks if an email address or domain is in the active suppression list.
 * Evaluates both the fast in-memory cache and persistent Supabase database.
 */
export async function isSuppressed(email: string): Promise<boolean> {
  if (!email || typeof email !== 'string') return true;

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) return true;

  if (localSuppressedEmails.has(cleanEmail)) return true;

  const domain = cleanEmail.split('@')[1];
  if (domain && localSuppressedEmails.has(`@${domain}`)) return true;

  const sb = getClient();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('suppression_list')
        .select('id, reason')
        .or(`email.eq.${cleanEmail},domain.eq.${domain}`)
        .limit(1);

      if (!error && data && data.length > 0) {
        localSuppressedEmails.add(cleanEmail);
        return true;
      }
    } catch (e) {
      console.warn('isSuppressed db lookup warning:', e);
    }
  }

  return false;
}

/**
 * Adds an email address or domain to the permanent suppression list.
 * Saves the SMTP error code (e.g. 550 5.1.1) and diagnostic message.
 */
export async function addToSuppressionList(
  email: string,
  reason: 'user_opt_out' | 'hard_bounce' | 'manual_suppress' | 'complaint' = 'user_opt_out',
  source = 'smtp_bounce_550',
  smtpErrorCode?: string,
  diagnosticMessage?: string
): Promise<boolean> {
  if (!email || typeof email !== 'string') return false;

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) return false;

  localSuppressedEmails.add(cleanEmail);

  const domain = cleanEmail.split('@')[1];
  const sb = getClient();

  if (sb) {
    try {
      const entry: Record<string, any> = {
        email: cleanEmail,
        domain,
        reason,
        source,
        created_at: new Date().toISOString(),
      };

      if (smtpErrorCode) entry.smtp_error_code = smtpErrorCode;
      if (diagnosticMessage) entry.diagnostic_message = diagnosticMessage;

      await sb.from('suppression_list').upsert(entry, { onConflict: 'email' });

      // Update associated leads to keep records safe
      const newStatus = reason === 'hard_bounce' ? 'bounced' : 'suppressed';
      const newVerification = reason === 'hard_bounce' ? 'bounced' : 'suppressed';

      await sb
        .from('business_leads')
        .update({
          status: newStatus,
          email_verification_status: newVerification,
        })
        .eq('email', cleanEmail);

      return true;
    } catch (e) {
      console.warn('addToSuppressionList db error:', e);
    }
  }

  return true;
}

/**
 * Removes an email from suppression list if independently verified by administrator
 */
export async function removeFromSuppressionList(email: string): Promise<boolean> {
  if (!email || typeof email !== 'string') return false;

  const cleanEmail = email.trim().toLowerCase();
  localSuppressedEmails.delete(cleanEmail);

  const sb = getClient();
  if (sb) {
    try {
      const { error } = await sb.from('suppression_list').delete().eq('email', cleanEmail);
      return !error;
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Retrieves suppression entries for dashboard observability
 */
export async function getSuppressionList(limit = 100): Promise<SuppressionEntry[]> {
  const sb = getClient();
  if (!sb) {
    return Array.from(localSuppressedEmails).map((email, idx) => ({
      id: `local-${idx}`,
      email,
      reason: email === 'info@unstructured.io' ? 'hard_bounce' : 'manual_suppress',
      source: 'local_pre_seed',
      smtp_error_code: email === 'info@unstructured.io' ? '550 5.1.1' : undefined,
      diagnostic_message: email === 'info@unstructured.io' ? 'The email account that you tried to reach does not exist.' : undefined,
      created_at: new Date().toISOString(),
    }));
  }

  try {
    const { data, error } = await sb
      .from('suppression_list')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as SuppressionEntry[];
  } catch {
    return [];
  }
}

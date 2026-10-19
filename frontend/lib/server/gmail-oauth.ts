import { getProviderConnection, saveProviderConnection } from './supabase';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GMAIL_SEND_URL = 'https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

export function getGmailClientId(): string {
  return process.env.GMAIL_CLIENT_ID || '';
}

export function getGmailClientSecret(): string {
  return process.env.GMAIL_CLIENT_SECRET || '';
}

export function getGmailRedirectUri(): string {
  if (process.env.GMAIL_REDIRECT_URI) return process.env.GMAIL_REDIRECT_URI;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return `${appUrl}/api/auth/gmail/callback`;
}

/**
 * Generates OAuth 2.0 authorization URL for user to grant Gmail send permissions
 */
export function generateGmailAuthUrl(): string {
  const clientId = getGmailClientId();
  const redirectUri = getGmailRedirectUri();

  if (!clientId) {
    throw new Error('GMAIL_CLIENT_ID is not configured in environment variables.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchanges authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  success: boolean;
  email?: string;
  error?: string;
}> {
  const clientId = getGmailClientId();
  const clientSecret = getGmailClientSecret();
  const redirectUri = getGmailRedirectUri();

  if (!clientId || !clientSecret) {
    return { success: false, error: 'GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET is missing.' };
  }

  try {
    const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResp.ok) {
      const errText = await tokenResp.text();
      return { success: false, error: `Token exchange failed: ${errText}` };
    }

    const tokenData = await tokenResp.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 3600;
    const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Fetch user email
    let userEmail = '';
    const userResp = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (userResp.ok) {
      const userData = await userResp.json();
      userEmail = userData.email || '';
    }

    // Persist to provider_connections
    await saveProviderConnection({
      provider: 'gmail',
      account_email: userEmail,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expiry: tokenExpiry,
      scopes: GMAIL_SCOPES,
      is_connected: true,
      config: {
        token_type: tokenData.token_type,
        connected_at: new Date().toISOString(),
      },
    });

    return { success: true, email: userEmail };
  } catch (e: any) {
    return { success: false, error: e.message || 'Token exchange failed' };
  }
}

/**
 * Retrieves a valid access token, automatically refreshing if expired
 */
export async function getValidGmailAccessToken(): Promise<string | null> {
  const conn = await getProviderConnection('gmail');
  if (!conn || !conn.is_connected) return null;

  const now = new Date();
  const expiry = conn.token_expiry ? new Date(conn.token_expiry) : new Date(0);

  // If token is still valid for at least 2 more minutes, reuse
  if (conn.access_token && expiry.getTime() > now.getTime() + 120000) {
    return conn.access_token;
  }

  // Refresh token required
  if (!conn.refresh_token) {
    console.warn('Gmail connection lacks refresh_token. Re-authentication required.');
    return null;
  }

  const clientId = getGmailClientId();
  const clientSecret = getGmailClientSecret();

  try {
    const refreshResp = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!refreshResp.ok) {
      console.warn('Failed to refresh Gmail token:', await refreshResp.text());
      return null;
    }

    const data = await refreshResp.json();
    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;
    const newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

    await saveProviderConnection({
      provider: 'gmail',
      access_token: newAccessToken,
      token_expiry: newExpiry,
      refresh_token: conn.refresh_token, // keep existing refresh token
      is_connected: true,
    });

    return newAccessToken;
  } catch (e) {
    console.error('Exception refreshing Gmail token:', e);
    return null;
  }
}

/**
 * Sends an email via official Gmail REST API
 */
export async function sendEmailViaGmailApi(
  to: string,
  subject: string,
  textBody: string,
  htmlBody?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accessToken = await getValidGmailAccessToken();
  if (!accessToken) {
    return { success: false, error: 'Gmail OAuth is not connected or token expired.' };
  }

  const conn = await getProviderConnection('gmail');
  const fromEmail = conn?.account_email || process.env.SENDER_EMAIL || 'me';
  const senderName = process.env.SENDER_NAME || 'Muhammad Shoaib';

  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const bodyContent = htmlBody || textBody.replace(/\n/g, '<br/>');

  const rawMessage = [
    `From: "${senderName}" <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    bodyContent,
  ].join('\r\n');

  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  try {
    const resp = await fetch(GMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { success: false, error: `Gmail API error: ${err}` };
    }

    const data = await resp.json();
    return { success: true, messageId: data.id };
  } catch (e: any) {
    return { success: false, error: e.message || 'Gmail dispatch failed' };
  }
}

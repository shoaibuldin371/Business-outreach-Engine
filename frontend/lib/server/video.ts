import { getClient } from './supabase';

export interface VideoGenerationConfig {
  provider: 'tavus' | 'heygen' | 'synthesia' | 'none';
  apiKey?: string;
  templateId?: string;
  replicaId?: string;
  isEnabled: boolean;
  costPerVideoUsd: number;
}

export interface VideoJobResult {
  jobId?: string;
  status: 'unavailable' | 'pending' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
  provider: string;
}

/**
 * Retrieves the current video provider configuration.
 * Disabled by default to protect user from unintended API costs.
 */
export function getVideoProviderConfig(): VideoGenerationConfig {
  const provider = (process.env.VIDEO_PROVIDER as any) || 'none';
  const apiKey = process.env.VIDEO_API_KEY;
  const isEnabled = Boolean(apiKey && provider !== 'none' && process.env.ENABLE_VIDEO_OUTREACH === 'true');

  return {
    provider,
    apiKey,
    templateId: process.env.VIDEO_TEMPLATE_ID,
    replicaId: process.env.VIDEO_REPLICA_ID,
    isEnabled,
    costPerVideoUsd: provider === 'tavus' ? 1.50 : 2.00,
  };
}

/**
 * Video Personalization Interface
 * Strict rule: If unconfigured, clearly returns status: 'unavailable'.
 * Never pretends a video was generated when unconfigured.
 */
export async function requestPersonalizedVideo(
  leadId: string,
  businessName: string,
  script: string
): Promise<VideoJobResult> {
  const config = getVideoProviderConfig();

  if (!config.isEnabled || !config.apiKey || config.provider === 'none') {
    return {
      status: 'unavailable',
      provider: config.provider,
      error: 'Video provider not configured. Core outreach functions normally without paid video generation.',
    };
  }

  // Example Tavus / HeyGen dispatch when credentials are provided
  try {
    if (config.provider === 'tavus') {
      const resp = await fetch('https://tavusapi.com/v2/videos', {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          replica_id: config.replicaId,
          script,
          video_name: `Brief for ${businessName}`,
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        return { status: 'failed', provider: 'tavus', error: `Tavus API HTTP ${resp.status}: ${err}` };
      }

      const data = await resp.json();
      return {
        status: 'pending',
        jobId: data.video_id,
        provider: 'tavus',
      };
    }

    return {
      status: 'unavailable',
      provider: config.provider,
      error: `Integration for provider '${config.provider}' is pending template configuration.`,
    };
  } catch (err: any) {
    return {
      status: 'failed',
      provider: config.provider,
      error: err.message || 'Unknown video provider error',
    };
  }
}

import { BackgroundJob } from './types';
import { getClient } from './supabase';

// Local resilient fallback queue for testing and offline environments
const localJobQueue: BackgroundJob[] = [];

/**
 * Enqueues a persistent background task.
 * Idempotently schedules execution within hosting limits.
 */
export async function enqueueBackgroundJob(
  jobType: BackgroundJob['job_type'],
  payload: Record<string, any> = {},
  scheduledAt?: string
): Promise<BackgroundJob> {
  const sb = getClient();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const job: BackgroundJob = {
    id,
    job_type: jobType,
    status: 'pending',
    payload,
    retry_count: 0,
    max_retries: 3,
    scheduled_at: scheduledAt || now,
    created_at: now,
  };

  localJobQueue.push(job);

  if (sb) {
    try {
      await sb.from('background_jobs').insert({
        id: job.id,
        job_type: job.job_type,
        status: job.status,
        payload: job.payload,
        retry_count: job.retry_count,
        max_retries: job.max_retries,
        scheduled_at: job.scheduled_at,
        created_at: job.created_at,
      });
    } catch (e) {
      console.warn('enqueueBackgroundJob db warning:', e);
    }
  }

  return job;
}

/**
 * Atomically claims the next pending background job for execution.
 * Prevents overlapping cloud execution across concurrent workers.
 */
export async function claimNextBackgroundJob(
  jobType?: BackgroundJob['job_type']
): Promise<BackgroundJob | null> {
  const sb = getClient();
  const nowIso = new Date().toISOString();

  if (sb) {
    try {
      let query = sb
        .from('background_jobs')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', nowIso)
        .order('scheduled_at', { ascending: true })
        .limit(1);

      if (jobType) {
        query = query.eq('job_type', jobType);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        const candidate = data[0] as BackgroundJob;

        // Atomically claim the job
        const { data: updated, error: updateErr } = await sb
          .from('background_jobs')
          .update({
            status: 'claimed',
            started_at: nowIso,
          })
          .eq('id', candidate.id)
          .eq('status', 'pending')
          .select()
          .maybeSingle();

        if (!updateErr && updated) {
          return updated as BackgroundJob;
        }
      }
    } catch (e) {
      console.warn('claimNextBackgroundJob db warning:', e);
    }
  }

  // Fallback local memory queue check
  const candidateIndex = localJobQueue.findIndex(
    (j) =>
      j.status === 'pending' &&
      (!jobType || j.job_type === jobType) &&
      new Date(j.scheduled_at).getTime() <= Date.now()
  );

  if (candidateIndex !== -1) {
    const job = localJobQueue[candidateIndex];
    job.status = 'claimed';
    job.started_at = nowIso;
    return job;
  }

  return null;
}

/**
 * Marks a claimed background job as completed with optional result payload
 */
export async function completeBackgroundJob(
  jobId: string,
  result: Record<string, any> = {}
): Promise<boolean> {
  const sb = getClient();
  const nowIso = new Date().toISOString();

  // Update local memory queue
  const localJob = localJobQueue.find((j) => j.id === jobId);
  if (localJob) {
    localJob.status = 'completed';
    localJob.result = result;
    localJob.completed_at = nowIso;
  }

  if (sb) {
    try {
      const { error } = await sb
        .from('background_jobs')
        .update({
          status: 'completed',
          result,
          completed_at: nowIso,
        })
        .eq('id', jobId);

      return !error;
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Bounded retry policy on job failure:
 * - If retry_count < max_retries, schedules retry with exponential backoff.
 * - If max_retries exceeded, permanently marks job as 'failed'.
 */
export async function failBackgroundJob(
  jobId: string,
  errorMessage: string
): Promise<{ status: 'retrying' | 'failed'; retryCount: number }> {
  const sb = getClient();
  const localJob = localJobQueue.find((j) => j.id === jobId);

  let retryCount = (localJob?.retry_count || 0) + 1;
  const maxRetries = localJob?.max_retries || 3;

  if (sb) {
    try {
      const { data } = await sb
        .from('background_jobs')
        .select('retry_count, max_retries')
        .eq('id', jobId)
        .single();
      if (data) {
        retryCount = (data.retry_count || 0) + 1;
      }
    } catch {}
  }

  const willRetry = retryCount < maxRetries;
  const delaySec = Math.pow(2, retryCount) * 60; // 2m, 4m, 8m backoff
  const nextScheduledAt = new Date(Date.now() + delaySec * 1000).toISOString();
  const finalStatus = willRetry ? 'pending' : 'failed';

  if (localJob) {
    localJob.status = finalStatus;
    localJob.error_message = errorMessage;
    localJob.retry_count = retryCount;
    if (willRetry) localJob.scheduled_at = nextScheduledAt;
  }

  if (sb) {
    try {
      await sb
        .from('background_jobs')
        .update({
          status: finalStatus,
          error_message: errorMessage,
          retry_count: retryCount,
          scheduled_at: willRetry ? nextScheduledAt : undefined,
          completed_at: willRetry ? undefined : new Date().toISOString(),
        })
        .eq('id', jobId);
    } catch (e) {
      console.warn('failBackgroundJob db warning:', e);
    }
  }

  return {
    status: willRetry ? 'retrying' : 'failed',
    retryCount,
  };
}

/**
 * Recovers jobs that were interrupted due to serverless timeouts or crashed workers.
 * Resets stuck 'claimed' or 'running' jobs back to 'pending'.
 */
export async function recoverInterruptedJobs(timeoutMinutes = 15): Promise<number> {
  const sb = getClient();
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();
  let recoveredCount = 0;

  // Local memory recovery
  for (const job of localJobQueue) {
    if (
      (job.status === 'claimed' || job.status === 'running') &&
      job.started_at &&
      new Date(job.started_at).getTime() <= Date.now() - timeoutMinutes * 60 * 1000
    ) {
      job.status = 'pending';
      recoveredCount++;
    }
  }

  if (sb) {
    try {
      const { data, error } = await sb
        .from('background_jobs')
        .update({ status: 'pending' })
        .in('status', ['claimed', 'running'])
        .lt('started_at', cutoff)
        .select('id');

      if (!error && data) {
        recoveredCount = Math.max(recoveredCount, data.length);
      }
    } catch {}
  }

  return recoveredCount;
}

/**
 * Retrieves background job history for dashboard telemetry
 */
export async function getBackgroundJobs(
  limit = 20,
  status?: BackgroundJob['status']
): Promise<BackgroundJob[]> {
  const sb = getClient();

  if (sb) {
    try {
      let query = sb
        .from('background_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (!error && data) return data as BackgroundJob[];
    } catch {}
  }

  return localJobQueue
    .filter((j) => !status || j.status === status)
    .slice(-limit);
}

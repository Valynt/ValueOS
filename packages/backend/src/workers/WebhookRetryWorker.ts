/**
 * WebhookRetryWorker
 *
 * BullMQ worker that processes failed webhook delivery jobs.
 *
 * Replaces the CronJob-triggered WebhookRetryService.processRetries() path.
 * On webhook delivery failure, the WebhookRetryService enqueues a job here
 * instead of writing directly to the DLQ table and waiting for the CronJob.
 *
 * Retry schedule: exponential backoff (1 min → 5 min → 15 min → 1 hr → 6 hr)
 * Max attempts: 5
 * On exhaustion: marks the event `failed` in DB, increments
 *   billing_webhook_exhausted_total counter.
 *
 * Job ID format: webhook:{eventId}:{attemptNumber}
 * This prevents duplicate enqueue on worker restart.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

import { createLogger } from '../lib/logger.js';
import { billingWebhookExhaustedTotal } from '../metrics/billingMetrics.js';
import { attachQueueMetrics } from '../observability/queueMetrics.js';
import { WebhookRetryService } from '../services/billing/WebhookRetryService.js';

const logger = createLogger({ component: 'webhook-retry-worker' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const WEBHOOK_RETRY_QUEUE_NAME = 'webhook-retry';

/** Backoff delays in ms matching the existing WebhookRetryService schedule. */
const BACKOFF_DELAYS_MS = [
  1 * 60 * 1_000,   // attempt 1: 1 min
  5 * 60 * 1_000,   // attempt 2: 5 min
  15 * 60 * 1_000,  // attempt 3: 15 min
  60 * 60 * 1_000,  // attempt 4: 1 hr
  6 * 60 * 60 * 1_000, // attempt 5: 6 hr
];

const MAX_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Job payload
// ---------------------------------------------------------------------------

export interface WebhookRetryJobPayload {
  eventId: string;
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  attemptNumber: number;
}

// ---------------------------------------------------------------------------
// Shared Redis connection (lazy, maxRetriesPerRequest: null required by BullMQ)
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return _redis;
}

// ---------------------------------------------------------------------------
// Queue (used by WebhookRetryService to enqueue jobs)
// ---------------------------------------------------------------------------

let _queue: Queue<WebhookRetryJobPayload> | null = null;

export function getWebhookRetryQueue(): Queue<WebhookRetryJobPayload> {
  if (!_queue) {
    _queue = new Queue<WebhookRetryJobPayload>(WEBHOOK_RETRY_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: MAX_ATTEMPTS,
        backoff: { type: 'custom' }, // delays controlled per-job via opts.delay
        removeOnComplete: { age: 7 * 86_400 },  // keep 7 days
        removeOnFail: { age: 30 * 86_400 },     // keep 30 days for audit
      },
    });
    attachQueueMetrics(_queue, WEBHOOK_RETRY_QUEUE_NAME);
  }
  return _queue;
}

/**
 * Enqueue a webhook retry job.
 *
 * Job ID is deterministic: webhook:{eventId}:{attemptNumber}
 * BullMQ deduplicates by job ID, so re-enqueuing the same attempt is safe.
 */
export async function enqueueWebhookRetry(
  payload: WebhookRetryJobPayload,
): Promise<void> {
  const queue = getWebhookRetryQueue();
  const jobId = `webhook:${payload.eventId}:${payload.attemptNumber}`;
  const delayMs = BACKOFF_DELAYS_MS[payload.attemptNumber - 1] ?? BACKOFF_DELAYS_MS.at(-1)!;

  await queue.add(WEBHOOK_RETRY_QUEUE_NAME, payload, {
    jobId,
    delay: delayMs,
  });

  logger.info('Webhook retry job enqueued', {
    jobId,
    eventId: payload.eventId,
    tenantId: payload.tenantId,
    attemptNumber: payload.attemptNumber,
    delayMs,
  });
}

// ---------------------------------------------------------------------------
// Supabase service-role client
// ---------------------------------------------------------------------------

function getServiceSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for the webhook retry worker');
  }
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Job processor
// ---------------------------------------------------------------------------

async function processWebhookRetryJob(
  job: Job<WebhookRetryJobPayload>,
  supabase: SupabaseClient,
): Promise<void> {
  const { eventId, tenantId, eventType, payload, attemptNumber } = job.data;

  logger.info('Processing webhook retry job', {
    jobId: job.id,
    eventId,
    tenantId,
    eventType,
    attemptNumber,
    jobAttemptsMade: job.attemptsMade,
  });

  const retryService = new WebhookRetryService(supabase);

  try {
    await retryService.deliverWebhookEvent(eventId, tenantId, eventType, payload);

    logger.info('Webhook delivered successfully', {
      jobId: job.id,
      eventId,
      tenantId,
      attemptNumber,
    });
  } catch (err) {
    const isLastAttempt = job.attemptsMade >= MAX_ATTEMPTS - 1;

    if (isLastAttempt) {
      // All attempts exhausted — mark as permanently failed
      logger.error('Webhook retry exhausted — marking as failed', err, {
        jobId: job.id,
        eventId,
        tenantId,
        eventType,
        attemptsMade: job.attemptsMade,
      });

      const { error: updateError } = await supabase
        .from('webhook_events')
        .update({
          status: 'failed',
          last_error: (err as Error).message,
          failed_at: new Date().toISOString(),
        })
        .eq('id', eventId);

      if (updateError) {
        // Log but don't re-throw — the job is already exhausted. Operators
        // must reconcile manually; the counter below provides the signal.
        logger.error('Failed to mark exhausted webhook event as failed in DB', updateError, {
          eventId,
          tenantId,
          eventType,
        });
      }

      billingWebhookExhaustedTotal.labels({ event_type: eventType }).inc();
    } else {
      logger.warn('Webhook delivery failed — will retry', {
        jobId: job.id,
        eventId,
        tenantId,
        attemptNumber,
        error: (err as Error).message,
      });
    }

    // Re-throw so BullMQ records the failure and applies backoff
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Worker initialisation
// ---------------------------------------------------------------------------

let _worker: Worker<WebhookRetryJobPayload> | null = null;

export function initWebhookRetryWorker(): Worker<WebhookRetryJobPayload> {
  if (_worker) return _worker;

  const supabase = getServiceSupabase();

  _worker = new Worker<WebhookRetryJobPayload>(
    WEBHOOK_RETRY_QUEUE_NAME,
    (job) => processWebhookRetryJob(job, supabase),
    {
      connection: getRedis(),
      concurrency: 5,
    },
  );

  _worker.on('completed', (job) => {
    logger.info('Webhook retry job completed', { jobId: job.id, eventId: job.data.eventId });
  });

  _worker.on('failed', (job, err) => {
    logger.error('Webhook retry job failed', err, {
      jobId: job?.id,
      eventId: job?.data.eventId,
      attemptsMade: job?.attemptsMade,
    });
  });

  logger.info('WebhookRetryWorker initialised', { queue: WEBHOOK_RETRY_QUEUE_NAME });
  return _worker;
}

export async function closeWebhookRetryWorker(): Promise<void> {
  await _worker?.close();
  await _queue?.close();
  await _redis?.quit();
  _worker = null;
  _queue = null;
  _redis = null;
}

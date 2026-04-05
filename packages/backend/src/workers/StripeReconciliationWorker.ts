/**
 * StripeReconciliationWorker
 *
 * BullMQ repeatable job that detects and backfills Stripe events missing from
 * the local webhook_events table.
 *
 * Schedule: every RECONCILIATION_INTERVAL_HOURS hours (default 6).
 * Window:   looks back RECONCILIATION_WINDOW_HOURS hours (default 24).
 *
 * Idempotency: backfill re-processes events via WebhookService.processEvent(),
 * which relies on the DB UNIQUE constraint on stripe_event_id to prevent
 * duplicate processing.
 *
 * Metrics emitted:
 *   webhook_reconciliation_runs_total
 *   webhook_reconciliation_failures_total
 *   webhook_reconciliation_drift_count{tenant_id}
 */

import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';
import Stripe from 'stripe';

import { STRIPE_CONFIG } from '../config/billing.js';
import { createLogger } from '../lib/logger.js';
import { createWorkerServiceSupabaseClient } from '../lib/supabase/privileged/index.js';
import {
  subscriptionCreationReconciliationResolved,
  webhookReconciliationDriftCount,
  webhookReconciliationFailuresTotal,
  webhookReconciliationRunsTotal,
} from '../metrics/billingMetrics.js';
import { TransactionalSubscriptionService } from '../services/billing/SubscriptionService.transaction.js';
import { WebhookService } from '../services/billing/WebhookService.js';

const logger = createLogger({ component: 'StripeReconciliationWorker' });

export const RECONCILIATION_QUEUE_NAME = 'stripe-reconciliation';

const INTERVAL_HOURS = parseInt(process.env.RECONCILIATION_INTERVAL_HOURS ?? '6', 10);
const WINDOW_HOURS = parseInt(process.env.RECONCILIATION_WINDOW_HOURS ?? '24', 10);

// ── Job payload ──────────────────────────────────────────────────────────────

export interface ReconciliationJobPayload {
  /** ISO timestamp of when this job was scheduled */
  scheduledAt: string;
  /** Look-back window in hours */
  windowHours: number;
}

// ── Redis connection ─────────────────────────────────────────────────────────

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return _redis;
}

// ── Queue ────────────────────────────────────────────────────────────────────

let _queue: Queue<ReconciliationJobPayload> | null = null;

export function getReconciliationQueue(): Queue<ReconciliationJobPayload> {
  if (!_queue) {
    _queue = new Queue<ReconciliationJobPayload>(RECONCILIATION_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 }, // 1m, 2m, 4m
        removeOnComplete: { age: 7 * 86_400 },
        removeOnFail: { age: 30 * 86_400 },
      },
    });
  }
  return _queue;
}

/**
 * Schedule the repeatable reconciliation job.
 * Safe to call multiple times — BullMQ deduplicates by repeat key.
 */
export async function scheduleReconciliationJob(): Promise<void> {
  const queue = getReconciliationQueue();
  await queue.add(
    'reconcile',
    { scheduledAt: new Date().toISOString(), windowHours: WINDOW_HOURS },
    {
      repeat: {
        every: INTERVAL_HOURS * 60 * 60 * 1000, // ms
      },
      jobId: 'stripe-reconciliation-repeatable',
    }
  );
  logger.info('Stripe reconciliation job scheduled', {
    intervalHours: INTERVAL_HOURS,
    windowHours: WINDOW_HOURS,
  });
}

// ── Stripe client ────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY must be set');
  return new Stripe(key, { apiVersion: STRIPE_CONFIG.apiVersion });
}

// ── Core reconciliation logic ────────────────────────────────────────────────

/**
 * Reconcile Stripe events against the local DB for a given time window.
 *
 * Fetches all Stripe events created in the last `windowHours` hours, compares
 * against webhook_events, and re-processes any that are missing.
 *
 * Returns the number of events backfilled.
 */
export async function reconcileStripeEvents(windowHours: number): Promise<number> {
  const supabase = createWorkerServiceSupabaseClient({
    justification: 'service-role:justified stripe reconciliation compares and backfills webhook events',
  });
  const stripe = getStripe();

  const windowStart = Math.floor((Date.now() - windowHours * 60 * 60 * 1000) / 1000);

  // Fetch all Stripe events in the window (paginated)
  const stripeEventIds = new Set<string>();
  const stripeEventMap = new Map<string, Stripe.Event>();

  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const params: Stripe.EventListParams = {
      created: { gte: windowStart },
      limit: 100,
    };
    if (startingAfter) params.starting_after = startingAfter;

    const page = await stripe.events.list(params);

    for (const event of page.data) {
      stripeEventIds.add(event.id);
      stripeEventMap.set(event.id, event);
    }

    hasMore = page.has_more;
    if (page.data.length > 0) {
      startingAfter = page.data[page.data.length - 1]!.id;
    }
  }

  if (stripeEventIds.size === 0) {
    logger.info('Reconciliation: no Stripe events in window', { windowHours });
    return 0;
  }

  // Fetch all event IDs we have in the DB for the same window
  const windowStartIso = new Date(windowStart * 1000).toISOString();
  const { data: dbEvents, error: dbError } = await supabase
    .from('webhook_events')
    .select('stripe_event_id')
    .gte('received_at', windowStartIso);

  if (dbError) {
    throw new Error(`Failed to query webhook_events: ${dbError.message}`);
  }

  const dbEventIds = new Set((dbEvents ?? []).map((r: { stripe_event_id: string }) => r.stripe_event_id));

  // Find events in Stripe but not in DB
  const missing: Stripe.Event[] = [];
  for (const id of stripeEventIds) {
    if (!dbEventIds.has(id)) {
      const event = stripeEventMap.get(id);
      if (event) missing.push(event);
    }
  }

  if (missing.length === 0) {
    logger.info('Reconciliation: no drift detected', {
      stripeEvents: stripeEventIds.size,
      dbEvents: dbEventIds.size,
      windowHours,
    });
    return 0;
  }

  logger.warn('Reconciliation: drift detected — backfilling missing events', {
    missing: missing.length,
    stripeEvents: stripeEventIds.size,
    dbEvents: dbEventIds.size,
    windowHours,
  });

  // Backfill missing events by re-processing them
  const webhookService = new WebhookService();
  let backfilled = 0;

  for (const event of missing) {
    try {
      await webhookService.processEvent(event);
      backfilled++;
    } catch (err) {
      logger.error('Reconciliation: failed to backfill event', err as Error, {
        stripeEventId: event.id,
        eventType: event.type,
      });
      // Continue with remaining events — partial backfill is better than none
    }
  }

  logger.info('Reconciliation: backfill complete', {
    missing: missing.length,
    backfilled,
    windowHours,
  });

  return backfilled;
}

// ── Job processor (exported for testing) ─────────────────────────────────────

/**
 * Core reconciliation logic executed on each BullMQ job run.
 * Exported so it can be unit-tested without spinning up a BullMQ worker.
 */
export async function runReconciliationJob(job: Pick<Job<ReconciliationJobPayload>, 'id' | 'data'>): Promise<void> {
  const { windowHours } = job.data;
  logger.info('Stripe reconciliation job started', { jobId: job.id, windowHours });

  webhookReconciliationRunsTotal.inc();

  try {
    // ── Phase 1: backfill missing webhook events ──────────────────────
    const backfilled = await reconcileStripeEvents(windowHours);
    webhookReconciliationDriftCount.labels({ tenant_id: 'global' }).set(backfilled);

    // ── Phase 2: resolve orphaned subscription creation intents ───────
    // Catches split-brain from createSubscription(): Stripe sub created
    // but DB insert failed and rollback also failed.
    // Pass the service-role Supabase client so the reconciler bypasses RLS
    // and can see stale intents across all tenants.
    const stripe = getStripe();
    const transactionalService = new TransactionalSubscriptionService(stripe, getServiceSupabase());
    const creationResolved = await transactionalService.reconcileSubscriptionCreations();
    subscriptionCreationReconciliationResolved.set(creationResolved);

    if (creationResolved > 0) {
      logger.warn('Reconciliation: cancelled orphaned Stripe subscriptions', {
        creationResolved,
      });
    }

    logger.info('Stripe reconciliation job complete', {
      jobId: job.id,
      backfilled,
      creationResolved,
      windowHours,
    });
  } catch (err) {
    webhookReconciliationFailuresTotal.inc();
    logger.error('Stripe reconciliation job failed', err as Error, { jobId: job.id });
    throw err; // BullMQ will retry per defaultJobOptions.attempts
  }
}

// ── Worker ───────────────────────────────────────────────────────────────────

let _worker: Worker<ReconciliationJobPayload> | null = null;

export function initStripeReconciliationWorker(): Worker<ReconciliationJobPayload> {
  if (_worker) return _worker;

  _worker = new Worker<ReconciliationJobPayload>(
    RECONCILIATION_QUEUE_NAME,
    (job) => runReconciliationJob(job),
    {
      connection: getRedis(),
      concurrency: 1, // reconciliation must not run concurrently
    }
  );

  _worker.on('failed', (job, err) => {
    logger.error('Reconciliation job permanently failed', err, { jobId: job?.id });
    webhookReconciliationFailuresTotal.inc();
  });

  logger.info('StripeReconciliationWorker initialised', {
    queue: RECONCILIATION_QUEUE_NAME,
    intervalHours: INTERVAL_HOURS,
  });

  return _worker;
}

export async function closeStripeReconciliationWorker(): Promise<void> {
  if (_worker) {
    await _worker.close();
    _worker = null;
  }
  if (_queue) {
    await _queue.close();
    _queue = null;
  }
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}

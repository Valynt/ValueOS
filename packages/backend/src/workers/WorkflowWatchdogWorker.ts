/**
 * WorkflowWatchdogWorker
 *
 * BullMQ repeatable job that detects and resolves stuck workflow executions.
 *
 * A workflow is considered stuck when:
 *   - status = 'running'
 *   - started_at < now() - WATCHDOG_TIMEOUT_MINUTES
 *
 * Resolution:
 *   - If iteration_count < MAX_REQUEUE_ATTEMPTS: mark as 'pending' for retry
 *   - Otherwise: mark as 'failed' with reason 'watchdog_timeout'
 *
 * Schedule: every WATCHDOG_INTERVAL_MINUTES minutes (default 5).
 * Timeout:  WATCHDOG_TIMEOUT_MINUTES minutes before a running workflow is
 *           considered stuck (default 30).
 *
 * Metrics emitted:
 *   workflow_stuck_detected_total
 *   workflow_watchdog_runs_total
 *   workflow_watchdog_failures_total
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';

import { createLogger } from '../lib/logger.js';
import { getMetricsRegistry } from '../middleware/metricsMiddleware.js';
import { Counter } from 'prom-client';

const logger = createLogger({ component: 'WorkflowWatchdogWorker' });

export const WATCHDOG_QUEUE_NAME = 'workflow-watchdog';

const INTERVAL_MINUTES = parseInt(process.env.WATCHDOG_INTERVAL_MINUTES ?? '5', 10);
const TIMEOUT_MINUTES = parseInt(process.env.WATCHDOG_TIMEOUT_MINUTES ?? '30', 10);
const MAX_REQUEUE_ATTEMPTS = parseInt(process.env.WATCHDOG_MAX_REQUEUE_ATTEMPTS ?? '2', 10);

// ── Metrics ──────────────────────────────────────────────────────────────────

const registry = getMetricsRegistry();

const workflowStuckDetectedTotal = new Counter({
  name: 'workflow_stuck_detected_total',
  help: 'Number of workflow executions detected as stuck by the watchdog',
  registers: [registry],
});

const workflowWatchdogRunsTotal = new Counter({
  name: 'workflow_watchdog_runs_total',
  help: 'Total watchdog job executions',
  registers: [registry],
});

const workflowWatchdogFailuresTotal = new Counter({
  name: 'workflow_watchdog_failures_total',
  help: 'Watchdog job executions that failed',
  registers: [registry],
});

// ── Job payload ──────────────────────────────────────────────────────────────

export interface WatchdogJobPayload {
  scheduledAt: string;
  timeoutMinutes: number;
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

let _queue: Queue<WatchdogJobPayload> | null = null;

export function getWatchdogQueue(): Queue<WatchdogJobPayload> {
  if (!_queue) {
    _queue = new Queue<WatchdogJobPayload>(WATCHDOG_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 30_000 },
        removeOnComplete: { age: 7 * 86_400 },
        removeOnFail: { age: 30 * 86_400 },
      },
    });
  }
  return _queue;
}

export async function scheduleWatchdogJob(): Promise<void> {
  const queue = getWatchdogQueue();
  await queue.add(
    'watchdog',
    { scheduledAt: new Date().toISOString(), timeoutMinutes: TIMEOUT_MINUTES },
    {
      repeat: { every: INTERVAL_MINUTES * 60 * 1000 },
      jobId: 'workflow-watchdog-repeatable',
    }
  );
  logger.info('Workflow watchdog job scheduled', {
    intervalMinutes: INTERVAL_MINUTES,
    timeoutMinutes: TIMEOUT_MINUTES,
  });
}

// ── Supabase service client ──────────────────────────────────────────────────

function getServiceSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing required environment variables for workflowWatchdogWorker: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Core watchdog logic ──────────────────────────────────────────────────────

interface StuckExecution {
  id: string;
  tenant_id: string;
  workflow_id: string | null;
  iteration_count: number;
  started_at: string;
}

export async function detectAndResolveStuckWorkflows(timeoutMinutes: number): Promise<{
  detected: number;
  requeued: number;
  failed: number;
}> {
  const supabase = getServiceSupabase();
  const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();

  const { data: stuck, error } = await supabase
    .from('workflow_executions')
    .select('id, tenant_id, workflow_id, iteration_count, started_at')
    .eq('status', 'running')
    .lt('started_at', cutoff);

  if (error) {
    throw new Error(`Watchdog query failed: ${error.message}`);
  }

  const executions = (stuck ?? []) as StuckExecution[];

  if (executions.length === 0) {
    logger.info('Watchdog: no stuck workflows detected', { timeoutMinutes });
    return { detected: 0, requeued: 0, failed: 0 };
  }

  logger.warn('Watchdog: stuck workflows detected', {
    count: executions.length,
    timeoutMinutes,
  });

  workflowStuckDetectedTotal.inc(executions.length);

  let requeued = 0;
  let failed = 0;

  for (const exec of executions) {
    const isRetryable = (exec.iteration_count ?? 0) < MAX_REQUEUE_ATTEMPTS;

    if (isRetryable) {
      // Reset to pending for retry
      const { error: updateErr } = await supabase
        .from('workflow_executions')
        .update({
          status: 'pending',
          error_message: `Watchdog: reset after ${timeoutMinutes}m timeout (attempt ${exec.iteration_count + 1})`,
        })
        .eq('id', exec.id);

      if (updateErr) {
        logger.error('Watchdog: failed to requeue execution', updateErr, { executionId: exec.id });
      } else {
        requeued++;
        logger.info('Watchdog: execution requeued', {
          executionId: exec.id,
          tenantId: exec.tenant_id,
          iterationCount: exec.iteration_count,
        });
      }
    } else {
      // Permanently fail — exceeded max requeue attempts
      const { error: failErr } = await supabase
        .from('workflow_executions')
        .update({
          status: 'failed',
          is_completed: true,
          completed_at: new Date().toISOString(),
          error_message: `watchdog_timeout: execution exceeded ${timeoutMinutes}m and max requeue attempts (${MAX_REQUEUE_ATTEMPTS})`,
        })
        .eq('id', exec.id);

      if (failErr) {
        logger.error('Watchdog: failed to mark execution as failed', failErr, { executionId: exec.id });
      } else {
        failed++;
        logger.warn('Watchdog: execution permanently failed', {
          executionId: exec.id,
          tenantId: exec.tenant_id,
          iterationCount: exec.iteration_count,
        });
      }
    }
  }

  logger.info('Watchdog: resolution complete', {
    detected: executions.length,
    requeued,
    failed,
    timeoutMinutes,
  });

  return { detected: executions.length, requeued, failed };
}

// ── Worker ───────────────────────────────────────────────────────────────────

let _worker: Worker<WatchdogJobPayload> | null = null;

export function initWorkflowWatchdogWorker(): Worker<WatchdogJobPayload> {
  if (_worker) return _worker;

  _worker = new Worker<WatchdogJobPayload>(
    WATCHDOG_QUEUE_NAME,
    async (job: Job<WatchdogJobPayload>) => {
      const { timeoutMinutes } = job.data;
      logger.info('Workflow watchdog job started', { jobId: job.id, timeoutMinutes });

      workflowWatchdogRunsTotal.inc();

      try {
        const result = await detectAndResolveStuckWorkflows(timeoutMinutes);
        logger.info('Workflow watchdog job complete', { jobId: job.id, ...result });
      } catch (err) {
        workflowWatchdogFailuresTotal.inc();
        logger.error('Workflow watchdog job failed', err as Error, { jobId: job.id });
        throw err;
      }
    },
    {
      connection: getRedis(),
      concurrency: 1,
    }
  );

  _worker.on('failed', (job, err) => {
    logger.error('Watchdog job permanently failed', err, { jobId: job?.id });
    workflowWatchdogFailuresTotal.inc();
  });

  logger.info('WorkflowWatchdogWorker initialised', {
    queue: WATCHDOG_QUEUE_NAME,
    intervalMinutes: INTERVAL_MINUTES,
    timeoutMinutes: TIMEOUT_MINUTES,
  });

  return _worker;
}

export async function closeWorkflowWatchdogWorker(): Promise<void> {
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

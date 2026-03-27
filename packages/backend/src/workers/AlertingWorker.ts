/**
 * AlertingWorker
 *
 * BullMQ repeatable job that evaluates alert rules on a schedule.
 *
 * Replaces the setInterval-based evaluation in AlertingService, which fired
 * independently on every backend replica and produced duplicate alert
 * notifications. With a BullMQ repeatable job, only one pod processes each
 * evaluation cycle regardless of replica count.
 *
 * Schedule: each alert rule's checkIntervalMinutes is respected by enqueuing
 * one job per rule with its own repeat interval. BullMQ deduplicates by jobId
 * so re-scheduling on startup is safe.
 *
 * Metrics: alert_rule_evaluation_total, alert_rule_evaluation_failures_total
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Queue, Worker, type Job } from 'bullmq';
import Redis from 'ioredis';

import { createLogger } from '../lib/logger.js';
import { AlertingService, type AlertRule } from '../services/billing/AlertingService.js';

const logger = createLogger({ component: 'AlertingWorker' });

export const ALERTING_QUEUE_NAME = 'alerting-rule-evaluation';

// ── Job payload ──────────────────────────────────────────────────────────────

export interface AlertRuleEvaluationPayload {
  ruleId: string;
  scheduledAt: string;
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

let _queue: Queue<AlertRuleEvaluationPayload> | null = null;

export function getAlertingQueue(): Queue<AlertRuleEvaluationPayload> {
  if (!_queue) {
    _queue = new Queue<AlertRuleEvaluationPayload>(ALERTING_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 7 * 86_400 },
      },
    });
  }
  return _queue;
}

/**
 * Schedule repeatable evaluation jobs for all enabled alert rules.
 * Safe to call on every startup — BullMQ deduplicates by jobId.
 */
export async function scheduleAlertRuleJobs(rules: AlertRule[]): Promise<void> {
  const queue = getAlertingQueue();

  for (const rule of rules) {
    if (!rule.enabled) continue;

    await queue.add(
      'evaluate-rule',
      { ruleId: rule.id, scheduledAt: new Date().toISOString() },
      {
        repeat: { every: rule.checkIntervalMinutes * 60 * 1000 },
        // Stable jobId ensures re-scheduling on restart doesn't create duplicates
        jobId: `alerting-rule-${rule.id}-repeatable`,
      },
    );

    logger.info('Alert rule scheduled', {
      ruleId: rule.id,
      ruleName: rule.name,
      intervalMinutes: rule.checkIntervalMinutes,
    });
  }
}

// ── Supabase service client ──────────────────────────────────────────────────

function getServiceSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// ── Worker ───────────────────────────────────────────────────────────────────

let _worker: Worker<AlertRuleEvaluationPayload> | null = null;

export function initAlertingWorker(): Worker<AlertRuleEvaluationPayload> {
  if (_worker) return _worker;

  const supabase = getServiceSupabase();
  const alertingService = new AlertingService(supabase);

  _worker = new Worker<AlertRuleEvaluationPayload>(
    ALERTING_QUEUE_NAME,
    async (job: Job<AlertRuleEvaluationPayload>) => {
      const { ruleId } = job.data;

      logger.debug('Evaluating alert rule', { ruleId, jobId: job.id });

      // Delegate to AlertingService.evaluateRule() — a single-rule evaluation
      // method that does not start intervals.
      await alertingService.evaluateRuleById(ruleId);
    },
    {
      connection: getRedis(),
      // Single concurrency: alert evaluation is I/O-bound but low-frequency.
      // Prevents thundering-herd if many rules fire simultaneously.
      concurrency: 2,
    },
  );

  _worker.on('completed', (job) => {
    logger.debug('Alert rule evaluation completed', { ruleId: job.data.ruleId });
  });

  _worker.on('failed', (job, err) => {
    logger.error('Alert rule evaluation failed', err, {
      ruleId: job?.data.ruleId,
      attempt: job?.attemptsMade,
    });
  });

  logger.info(`AlertingWorker listening on queue "${ALERTING_QUEUE_NAME}"`);
  return _worker;
}

/**
 * Gracefully shut down the alerting worker, queue, and Redis connection.
 * Mirrors the pattern used by StripeReconciliationWorker.closeStripeReconciliationWorker().
 * Call this from the process SIGTERM/SIGINT handler.
 */
export async function closeAlertingWorker(): Promise<void> {
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

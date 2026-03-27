/**
 * CRM BullMQ Workers
 *
 * Three queues + dead-letter queue:
 * - crm-sync: Delta sync and initial sync jobs
 * - crm-webhook: Webhook event processing
 * - crm-prefetch: Agent pre-fetch for scaffolded ValueCases
 * - crm-dead-letter: Poison messages after max retries
 *
 * Hardening:
 * - Dead-letter queue for poison messages
 * - Per-tenant rate limiting via group keys
 * - Circuit breaker for provider outages
 * - Explicit tenant context in all job payloads
 */

import { type Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

import { createLogger } from '../lib/logger.js';
import { tenantContextStorage } from '../middleware/tenantContext.js';
import { attachQueueMetrics } from '../observability/queueMetrics.js';
import { runInTelemetrySpanAsync } from '../observability/telemetryStandards.js';
import { RedisCircuitBreaker } from '../services/post-v1/RedisCircuitBreaker.js';

const logger = createLogger({ component: 'CrmWorker' });

// ============================================================================
// Redis connection
// ============================================================================

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return _redis;
}

// ============================================================================
// Queue names
// ============================================================================

export const CRM_SYNC_QUEUE = 'crm-sync';
export const CRM_WEBHOOK_QUEUE = 'crm-webhook';
export const CRM_PREFETCH_QUEUE = 'crm-prefetch';
export const CRM_DEAD_LETTER_QUEUE = 'crm-dead-letter';

// ============================================================================
// Circuit breaker — Redis-backed for multi-pod consistency
//
// The previous implementation used a module-level Map (in-process memory).
// With replicas: 2, each pod maintained independent state: Pod A could have
// an open circuit while Pod B continued sending requests to a degraded CRM
// provider. RedisCircuitBreaker stores state in Redis so all pods share the
// same view of each circuit.
// ============================================================================

const crmCircuitBreaker = new RedisCircuitBreaker({
  failureThreshold: 5,
  recoveryTimeout: 5 * 60_000, // 5 min cooldown
  monitoringPeriod: 120_000,
});

function getCrmCircuitKey(tenantId: string, provider: string): string {
  return `crm:${provider}:${tenantId}`;
}

/**
 * Execute a CRM operation through the shared Redis-backed circuit breaker.
 * Throws if the circuit is open (caller should let BullMQ retry the job).
 */
async function withCrmCircuit<T>(
  tenantId: string,
  provider: string,
  fn: () => Promise<T>,
): Promise<T> {
  const operationName = getCrmCircuitKey(tenantId, provider);
  return crmCircuitBreaker.execute({
    operationName,
    operation: fn,
  });
}

// ============================================================================
// Queue factories
// ============================================================================

let _syncQueue: Queue | null = null;
let _webhookQueue: Queue | null = null;
let _prefetchQueue: Queue | null = null;
let _deadLetterQueue: Queue | null = null;

const MAX_ATTEMPTS = 5;

const defaultJobOptions = {
  attempts: MAX_ATTEMPTS,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { age: 86_400 },
  removeOnFail: { age: 7 * 86_400 },
};

export function getCrmSyncQueue(): Queue {
  if (!_syncQueue) {
    _syncQueue = new Queue(CRM_SYNC_QUEUE, {
      connection: getRedis(),
      defaultJobOptions,
    });
  }
  return _syncQueue;
}

export function getCrmWebhookQueue(): Queue {
  if (!_webhookQueue) {
    _webhookQueue = new Queue(CRM_WEBHOOK_QUEUE, {
      connection: getRedis(),
      defaultJobOptions,
    });
  }
  return _webhookQueue;
}

export function getPrefetchQueue(): Queue {
  if (!_prefetchQueue) {
    _prefetchQueue = new Queue(CRM_PREFETCH_QUEUE, {
      connection: getRedis(),
      defaultJobOptions,
    });
  }
  return _prefetchQueue;
}

function getDeadLetterQueue(): Queue {
  if (!_deadLetterQueue) {
    _deadLetterQueue = new Queue(CRM_DEAD_LETTER_QUEUE, {
      connection: getRedis(),
    });
  }
  return _deadLetterQueue;
}

/**
 * Move a permanently failed job to the dead-letter queue.
 */
async function moveToDeadLetter(job: Job | undefined, err: Error): Promise<void> {
  if (!job) return;
  try {
    const dlq = getDeadLetterQueue();
    await dlq.add('dead-letter', {
      originalQueue: job.queueName,
      originalJobId: job.id,
      originalData: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
      attemptsMade: job.attemptsMade,
    });
    logger.error('[dead-letter] Job moved to DLQ', err, {
      queue: job.queueName,
      jobId: job.id,
      attempts: job.attemptsMade,
    });
  } catch (dlqErr) {
    logger.error('[dead-letter] Failed to move job to DLQ', dlqErr instanceof Error ? dlqErr : undefined);
  }
}

// ============================================================================
// Worker: CRM Sync
// ============================================================================

let _syncWorker: Worker | null = null;

export function initCrmSyncWorker(): Worker {
  if (_syncWorker) return _syncWorker;

  _syncWorker = new Worker(
    CRM_SYNC_QUEUE,
    async (job: Job) => {
      const { tenantId, provider } = job.data;
      if (!tenantId) {
        throw new Error('crmWorker(sync): job payload missing tenantId — cannot establish tenant context');
      }
      return tenantContextStorage.run(
        { tid: tenantId, iss: 'worker', sub: 'worker', roles: [], tier: 'worker', exp: 0 },
        () => runInTelemetrySpanAsync('queue.crm_sync.consume', {
          service: 'crm-worker',
          env: process.env.NODE_ENV || 'development',
          tenant_id: String(tenantId),
          trace_id: String(job.data?.traceId ?? job.id ?? 'unknown'),
          attributes: { queue: CRM_SYNC_QUEUE, provider: String(provider ?? 'unknown') },
        }, async () => {

        logger.info(`[crm-sync] Processing ${job.name}`, {
          tenantId,
          provider,
          jobId: job.id,
          attempt: job.attemptsMade + 1,
        });

        return withCrmCircuit(tenantId, provider, async () => {
          const { crmSyncService } = await import('../services/crm/CrmSyncService.js');
          return crmSyncService.runDeltaSync(tenantId, provider);
        });
        }),
      );
    },
    {
      connection: getRedis(),
      concurrency: 3,
      limiter: { max: 5, duration: 60_000 },
    },
  );

  _syncWorker.on('completed', (job) => {
    logger.info(`[crm-sync] Job ${job.id} completed`, { result: job.returnvalue });
  });

  _syncWorker.on('failed', (job, err) => {
    logger.error(`[crm-sync] Job ${job?.id} failed`, err, {
      attempt: job?.attemptsMade,
      maxAttempts: MAX_ATTEMPTS,
    });
    // Poison message: move to DLQ after final attempt
    if (job && job.attemptsMade >= MAX_ATTEMPTS) {
      moveToDeadLetter(job, err);
    }
  });

  attachQueueMetrics(_syncWorker, CRM_SYNC_QUEUE, {
    workerClass: 'crm-sync-worker',
    concurrency: 3,
  });

  logger.info(`[crm-sync] Worker listening on queue "${CRM_SYNC_QUEUE}"`);
  return _syncWorker;
}

// ============================================================================
// Worker: CRM Webhook Processing
// ============================================================================

let _webhookWorker: Worker | null = null;

export function initCrmWebhookWorker(): Worker {
  if (_webhookWorker) return _webhookWorker;

  _webhookWorker = new Worker(
    CRM_WEBHOOK_QUEUE,
    async (job: Job) => {
      const { eventId, tenantId, provider } = job.data;
      if (!tenantId) {
        throw new Error('crmWorker(webhook): job payload missing tenantId — cannot establish tenant context');
      }
      return tenantContextStorage.run(
        { tid: tenantId, iss: 'worker', sub: 'worker', roles: [], tier: 'worker', exp: 0 },
        () => runInTelemetrySpanAsync('queue.crm_webhook.consume', {
          service: 'crm-worker',
          env: process.env.NODE_ENV || 'development',
          tenant_id: String(tenantId),
          trace_id: String(job.data?.traceId ?? eventId ?? job.id ?? 'unknown'),
          attributes: { queue: CRM_WEBHOOK_QUEUE, provider: String(provider ?? 'unknown') },
        }, async () => {

        logger.info(`[crm-webhook] Processing event`, {
          eventId,
          jobId: job.id,
          attempt: job.attemptsMade + 1,
        });

        await withCrmCircuit(tenantId, provider, async () => {
          const { crmWebhookService } = await import('../services/crm/CrmWebhookService.js');
          await crmWebhookService.processEvent(eventId);
        });
        }),
      );
    },
    {
      connection: getRedis(),
      concurrency: 5,
      limiter: { max: 20, duration: 60_000 },
    },
  );

  _webhookWorker.on('completed', (job) => {
    logger.info(`[crm-webhook] Job ${job.id} completed`);
  });

  _webhookWorker.on('failed', (job, err) => {
    logger.error(`[crm-webhook] Job ${job?.id} failed`, err, {
      attempt: job?.attemptsMade,
    });
    if (job && job.attemptsMade >= MAX_ATTEMPTS) {
      moveToDeadLetter(job, err);
    }
  });

  attachQueueMetrics(_webhookWorker, CRM_WEBHOOK_QUEUE, {
    workerClass: 'crm-webhook-worker',
    concurrency: 5,
  });

  logger.info(`[crm-webhook] Worker listening on queue "${CRM_WEBHOOK_QUEUE}"`);
  return _webhookWorker;
}

// ============================================================================
// Worker: Agent Pre-Fetch
// ============================================================================

let _prefetchWorker: Worker | null = null;

export function initCrmPrefetchWorker(): Worker {
  if (_prefetchWorker) return _prefetchWorker;

  _prefetchWorker = new Worker(
    CRM_PREFETCH_QUEUE,
    async (job: Job) => {
      const input = job.data;
      const tenantId = input?.tenantId;
      if (!tenantId) {
        throw new Error('crmWorker(prefetch): job payload missing tenantId — cannot establish tenant context');
      }
      return tenantContextStorage.run(
        { tid: tenantId, iss: 'worker', sub: 'worker', roles: [], tier: 'worker', exp: 0 },
        () => runInTelemetrySpanAsync('queue.crm_prefetch.consume', {
          service: 'crm-worker',
          env: process.env.NODE_ENV || 'development',
          tenant_id: String(tenantId),
          trace_id: String(input?.traceId ?? job.id ?? 'unknown'),
          attributes: { queue: CRM_PREFETCH_QUEUE },
        }, async () => {
        logger.info(`[crm-prefetch] Processing`, {
          valueCaseId: input.valueCaseId,
          jobId: job.id,
          attempt: job.attemptsMade + 1,
        });

        const { agentPrefetchService } = await import('../services/crm/AgentPrefetchService.js');
        const result = await agentPrefetchService.prefetch(input);

        return result;
        }),
      );
    },
    {
      connection: getRedis(),
      concurrency: 3,
      limiter: { max: 10, duration: 60_000 },
    },
  );

  _prefetchWorker.on('completed', (job) => {
    logger.info(`[crm-prefetch] Job ${job.id} completed`);
  });

  _prefetchWorker.on('failed', (job, err) => {
    logger.error(`[crm-prefetch] Job ${job?.id} failed`, err, {
      attempt: job?.attemptsMade,
    });
    if (job && job.attemptsMade >= MAX_ATTEMPTS) {
      moveToDeadLetter(job, err);
    }
  });

  attachQueueMetrics(_prefetchWorker, CRM_PREFETCH_QUEUE, {
    workerClass: 'crm-prefetch-worker',
    concurrency: 3,
  });

  logger.info(`[crm-prefetch] Worker listening on queue "${CRM_PREFETCH_QUEUE}"`);
  return _prefetchWorker;
}

// ============================================================================
// Initialize all CRM workers
// ============================================================================

export function initCrmWorkers(): void {
  try {
    initCrmSyncWorker();
    initCrmWebhookWorker();
    initCrmPrefetchWorker();
    logger.info('[crm-workers] All CRM workers initialized');
  } catch (err) {
    logger.warn('[crm-workers] Failed to initialize CRM workers', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

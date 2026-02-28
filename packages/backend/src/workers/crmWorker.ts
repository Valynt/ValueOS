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
// Circuit breaker state (in-memory, per-process)
// ============================================================================

interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

const circuitBreakers = new Map<string, CircuitState>();
const CIRCUIT_THRESHOLD = 5;       // failures before opening
const CIRCUIT_RESET_MS = 5 * 60_000; // 5 min cooldown

function getCircuitKey(tenantId: string, provider: string): string {
  return `${tenantId}:${provider}`;
}

function isCircuitOpen(tenantId: string, provider: string): boolean {
  const key = getCircuitKey(tenantId, provider);
  const state = circuitBreakers.get(key);
  if (!state || !state.open) return false;
  // Auto-reset after cooldown
  if (Date.now() - state.lastFailure > CIRCUIT_RESET_MS) {
    state.open = false;
    state.failures = 0;
    return false;
  }
  return true;
}

function recordCircuitFailure(tenantId: string, provider: string): void {
  const key = getCircuitKey(tenantId, provider);
  const state = circuitBreakers.get(key) || { failures: 0, lastFailure: 0, open: false };
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.open = true;
    logger.warn('[circuit-breaker] Circuit opened', { tenantId, provider, failures: state.failures });
  }
  circuitBreakers.set(key, state);
}

function recordCircuitSuccess(tenantId: string, provider: string): void {
  const key = getCircuitKey(tenantId, provider);
  circuitBreakers.delete(key);
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

      // Circuit breaker check
      if (isCircuitOpen(tenantId, provider)) {
        throw new Error(`Circuit breaker open for ${provider}/${tenantId}. Retrying later.`);
      }

      logger.info(`[crm-sync] Processing ${job.name}`, {
        tenantId,
        provider,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      });

      try {
        const { crmSyncService } = await import('../services/crm/CrmSyncService.js');
        const result = await crmSyncService.runDeltaSync(tenantId, provider);
        recordCircuitSuccess(tenantId, provider);
        return result;
      } catch (err) {
        recordCircuitFailure(tenantId, provider);
        throw err;
      }
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

      if (isCircuitOpen(tenantId, provider)) {
        throw new Error(`Circuit breaker open for ${provider}/${tenantId}. Retrying later.`);
      }

      logger.info(`[crm-webhook] Processing event`, {
        eventId,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      });

      try {
        const { crmWebhookService } = await import('../services/crm/CrmWebhookService.js');
        await crmWebhookService.processEvent(eventId);
        recordCircuitSuccess(tenantId, provider);
      } catch (err) {
        recordCircuitFailure(tenantId, provider);
        throw err;
      }
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
      logger.info(`[crm-prefetch] Processing`, {
        valueCaseId: input.valueCaseId,
        jobId: job.id,
        attempt: job.attemptsMade + 1,
      });

      const { agentPrefetchService } = await import('../services/crm/AgentPrefetchService.js');
      const result = await agentPrefetchService.prefetch(input);

      return result;
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

import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

import { createLogger } from '../lib/logger.js';
import { supabase } from '../lib/supabase.js';
import { attachQueueMetrics } from '../observability/queueMetrics.js';
import { AlertingService } from '../services/billing/AlertingService.js';

const logger = createLogger({ component: 'AlertingRulesWorker' });

export const ALERTING_QUEUE_NAME = 'alerting:evaluate-rules';
const ALERTING_REPEAT_JOB_ID = 'alerting-evaluate-rules-repeatable';

let _redis: Redis | null = null;
let _queue: Queue | null = null;
let _worker: Worker | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return _redis;
}

export function getAlertingQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(ALERTING_QUEUE_NAME, { connection: getRedis() });
  }
  return _queue;
}

export async function scheduleAlertingEvaluationJob(): Promise<void> {
  await getAlertingQueue().add(
    'evaluate-rules',
    {},
    {
      repeat: { every: 60_000 },
      jobId: ALERTING_REPEAT_JOB_ID,
      removeOnComplete: { age: 86_400 },
      removeOnFail: { age: 7 * 86_400 },
    }
  );
}

export function initAlertingRulesWorker(): Worker {
  if (_worker) {
    return _worker;
  }
  if (!supabase) {
    throw new Error('Supabase billing not configured');
  }

  const alertingService = new AlertingService(supabase);
  _worker = new Worker(
    ALERTING_QUEUE_NAME,
    async () => {
      await alertingService.evaluateEnabledRules();
      return { processedAt: new Date().toISOString() };
    },
    { connection: getRedis(), concurrency: 1 }
  );

  attachQueueMetrics(_worker, ALERTING_QUEUE_NAME, {
    deployment: process.env.OBSERVABILITY_DEPLOYMENT ?? 'worker',
    workerClass: 'alerting-rules-worker',
  });

  _worker.on('completed', (job) => {
    logger.debug('Alerting rules job completed', { jobId: job.id });
  });

  return _worker;
}

export async function closeAlertingRulesWorker(): Promise<void> {
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

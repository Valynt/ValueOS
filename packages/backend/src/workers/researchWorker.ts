/**
 * BullMQ worker for onboarding research jobs.
 *
 * Listens on the "onboarding-research" queue and delegates to
 * processResearchJob with a real LLMGateway and Supabase client.
 *
 * Start separately from the main server process:
 *   tsx src/workers/researchWorker.ts
 *
 * Or call initResearchWorker() from the server boot sequence.
 */

import { type Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger.js';
import { processResearchJob, type ResearchJobInput } from '../services/onboarding/ResearchJobWorker.js';
import { LLMGateway } from '../lib/agent-fabric/LLMGateway.js';
import type { LLMGatewayInterface } from '../services/onboarding/SuggestionExtractor.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RESEARCH_QUEUE_NAME = 'onboarding-research';

// ---------------------------------------------------------------------------
// Shared Redis connection (lazy)
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return _redis;
}

// ---------------------------------------------------------------------------
// Queue (used by the API to enqueue jobs)
// ---------------------------------------------------------------------------

let _queue: Queue<ResearchJobInput> | null = null;

export function getResearchQueue(): Queue<ResearchJobInput> {
  if (!_queue) {
    _queue = new Queue<ResearchJobInput>(RESEARCH_QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 86_400 },   // keep 24 h
        removeOnFail: { age: 7 * 86_400 },   // keep 7 d
      },
    });
  }
  return _queue;
}

// ---------------------------------------------------------------------------
// Supabase service-role client (for worker DB writes)
// ---------------------------------------------------------------------------

function getServiceSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for the research worker');
  }
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// LLMGateway adapter
//
// The SuggestionExtractor expects { content, usage? } from complete().
// The real LLMGateway returns LLMResponse which is a superset — wrap it
// so the interface contract is satisfied cleanly.
// ---------------------------------------------------------------------------

function createLLMAdapter(): LLMGatewayInterface {
  const gateway = new LLMGateway({
    provider: (process.env.LLM_PROVIDER as 'openai' | 'anthropic') || 'openai',
    model: process.env.LLM_MODEL || 'gpt-4o',
    temperature: 0.3,
    max_tokens: 4096,
  });

  return {
    async complete(request) {
      const response = await gateway.complete({
        messages: request.messages,
        metadata: request.metadata as any,
      });
      return {
        content: response.content,
        usage: response.usage,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

let _worker: Worker<ResearchJobInput> | null = null;

export function initResearchWorker(): Worker<ResearchJobInput> {
  if (_worker) return _worker;

  const supabase = getServiceSupabase();
  const llm = createLLMAdapter();

  _worker = new Worker<ResearchJobInput>(
    RESEARCH_QUEUE_NAME,
    async (job: Job<ResearchJobInput>) => {
      logger.info(`[research-worker] Processing job ${job.data.jobId} for tenant ${job.data.tenantId}`);
      const result = await processResearchJob(job.data, supabase, llm);

      if (result.status === 'failed') {
        throw new Error(result.error ?? 'Research job failed');
      }

      return result;
    },
    {
      connection: getRedis(),
      concurrency: 3,
      limiter: {
        max: 10,
        duration: 60_000, // max 10 jobs per minute
      },
    },
  );

  _worker.on('completed', (job) => {
    logger.info(`[research-worker] Job ${job.id} completed`);
  });

  _worker.on('failed', (job, err) => {
    console.error(`[research-worker] Job ${job?.id} failed:`, err.message);
  });

  logger.info(`[research-worker] Listening on queue "${RESEARCH_QUEUE_NAME}"`);
  return _worker;
}

// ---------------------------------------------------------------------------
// Standalone entry point
// ---------------------------------------------------------------------------

const isDirectRun = process.argv[1]?.endsWith('researchWorker.ts')
  || process.argv[1]?.endsWith('researchWorker.js');

if (isDirectRun) {
  logger.info("[research-worker] Starting as standalone process");
  initResearchWorker();
}

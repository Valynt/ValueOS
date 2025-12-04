/**
 * Message Queue Service
 * 
 * Async processing for LLM requests using BullMQ and Redis
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import Redis from 'ioredis';
import http from 'http';
import { collectDefaultMetrics, Gauge, Registry } from 'prom-client';
import { logger } from '../utils/logger';
import { llmFallbackWithTracing } from './LLMFallbackWithTracing';
import { promptVersionControl } from './PromptVersionControl';
import { createClient } from '@supabase/supabase-js';

// Redis connection
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

// Job types
export interface LLMJobData {
  type: 'canvas_generation' | 'canvas_refinement' | 'custom_prompt';
  userId: string;
  sessionId?: string;
  promptKey?: string;
  promptVariables?: Record<string, any>;
  prompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, any>;
}

export interface LLMJobResult {
  content: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  latency: number;
  cached: boolean;
}

/**
 * LLM Queue Service
 */
export class LLMQueueService {
  private queue: Queue<LLMJobData, LLMJobResult>;
  private worker: Worker<LLMJobData, LLMJobResult>;
  private events: QueueEvents;
  private supabase: ReturnType<typeof createClient>;
  private metricsRegistry: Registry;
  private queueDepthGauge: Gauge;
  private queueDepth: number = 0;
  private metricsServer?: http.Server;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    );

    this.metricsRegistry = new Registry();
    collectDefaultMetrics({ register: this.metricsRegistry });
    this.queueDepthGauge = new Gauge({
      name: 'message_worker_queue_depth',
      help: 'Current queue depth for message worker backlog',
      labelNames: ['app'],
      registers: [this.metricsRegistry],
    });

    // Create queue
    this.queue = new Queue<LLMJobData, LLMJobResult>('llm-processing', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 3600, // Keep completed jobs for 24 hours
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
      },
    });

    // Create worker
    this.worker = new Worker<LLMJobData, LLMJobResult>(
      'llm-processing',
      this.processJob.bind(this),
      {
        connection: redisConnection,
        concurrency: 10, // Process 10 jobs concurrently
        limiter: {
          max: 100, // Max 100 jobs
          duration: 60000, // per minute
        },
      }
    );

    // Create event listener
    this.events = new QueueEvents('llm-processing', {
      connection: redisConnection,
    });

    this.setupEventListeners();
    this.startMetricsServer();
    this.refreshQueueDepth();
    setInterval(() => {
      this.refreshQueueDepth().catch((error) =>
        logger.warn('Failed to refresh queue depth', error as Error)
      );
    }, 5000);
  }

  /**
   * Add job to queue
   */
  async addJob(
    data: LLMJobData,
    options?: {
      priority?: number;
      delay?: number;
      jobId?: string;
    }
  ): Promise<Job<LLMJobData, LLMJobResult>> {
    const job = await this.queue.add('llm-request', data, {
      priority: options?.priority,
      delay: options?.delay,
      jobId: options?.jobId,
    });

    logger.info('LLM job added to queue', {
      jobId: job.id,
      type: data.type,
      userId: data.userId,
    });

    return job;
  }

  /**
   * Process job
   */
  private async processJob(
    job: Job<LLMJobData, LLMJobResult>
  ): Promise<LLMJobResult> {
    const startTime = Date.now();
    const { data } = job;

    logger.info('Processing LLM job', {
      jobId: job.id,
      type: data.type,
      userId: data.userId,
      attempt: job.attemptsMade + 1,
    });

    try {
      let prompt: string;
      let executionId: string | undefined;

      // Get prompt from version control or use provided prompt
      if (data.promptKey && data.promptVariables) {
        const result = await promptVersionControl.executePrompt(
          data.promptKey,
          data.promptVariables,
          data.userId
        );
        prompt = result.prompt;
        executionId = result.executionId;
      } else if (data.prompt) {
        prompt = data.prompt;
      } else {
        throw new Error('Either promptKey+promptVariables or prompt must be provided');
      }

      // Process with LLM
      const response = await llmFallbackWithTracing.processRequest({
        prompt,
        model: data.model || 'meta-llama/Llama-3-70b-chat-hf',
        maxTokens: data.maxTokens,
        temperature: data.temperature,
        userId: data.userId,
        sessionId: data.sessionId,
      });

      // Record execution if using prompt version control
      if (executionId) {
        await promptVersionControl.recordExecution(executionId, {
          response: response.content,
          latency: response.latency,
          cost: response.cost,
          tokens: {
            prompt: response.promptTokens,
            completion: response.completionTokens,
            total: response.totalTokens,
          },
          success: true,
        });
      }

      // Store result in database
      await this.storeResult(job.id!, data, response);

      const duration = Date.now() - startTime;

      logger.info('LLM job completed', {
        jobId: job.id,
        type: data.type,
        userId: data.userId,
        duration,
        cost: response.cost,
        cached: response.cached,
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('LLM job failed', {
        jobId: job.id,
        type: data.type,
        userId: data.userId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        attempt: job.attemptsMade + 1,
      });

      throw error;
    }
  }

  /**
   * Store result in database
   */
  private async storeResult(
    jobId: string,
    data: LLMJobData,
    result: LLMJobResult
  ): Promise<void> {
    const { error } = await this.supabase.from('llm_job_results').insert({
      job_id: jobId,
      user_id: data.userId,
      type: data.type,
      content: result.content,
      provider: result.provider,
      model: result.model,
      prompt_tokens: result.promptTokens,
      completion_tokens: result.completionTokens,
      total_tokens: result.totalTokens,
      cost_usd: result.cost,
      latency_ms: result.latency,
      cached: result.cached,
      metadata: data.metadata,
    });

    if (error) {
      logger.error('Failed to store LLM job result', error);
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: string;
    progress?: number;
    result?: LLMJobResult;
    error?: string;
  }> {
    const job = await this.queue.getJob(jobId);

    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const progress = job.progress;

    if (state === 'completed') {
      return {
        status: 'completed',
        result: job.returnvalue,
      };
    }

    if (state === 'failed') {
      return {
        status: 'failed',
        error: job.failedReason,
      };
    }

    return {
      status: state,
      progress: typeof progress === 'number' ? progress : undefined,
    };
  }

  /**
   * Get job result from database
   */
  async getJobResult(jobId: string): Promise<LLMJobResult | null> {
    const { data, error } = await this.supabase
      .from('llm_job_results')
      .select('*')
      .eq('job_id', jobId)
      .single();

    if (error || !data) return null;

    return {
      content: data.content,
      provider: data.provider,
      model: data.model,
      promptTokens: data.prompt_tokens,
      completionTokens: data.completion_tokens,
      totalTokens: data.total_tokens,
      cost: data.cost_usd,
      latency: data.latency_ms,
      cached: data.cached,
    };
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info('LLM job cancelled', { jobId });
    }
  }

  /**
   * Get queue metrics
   */
  async getMetrics(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    queueDepth: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    const queueDepth = waiting + active + delayed;
    this.queueDepth = queueDepth;
    this.queueDepthGauge.set({ app: 'message-worker' }, queueDepth);

    return { waiting, active, completed, failed, delayed, queueDepth };
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.worker.on('completed', (job) => {
      logger.info('Job completed', {
        jobId: job.id,
        duration: Date.now() - job.processedOn!,
      });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Job failed', {
        jobId: job?.id,
        error: error.message,
        attempts: job?.attemptsMade,
      });
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn('Job stalled', { jobId });
    });

    this.events.on('waiting', ({ jobId }) => {
      logger.debug('Job waiting', { jobId });
    });

    this.events.on('active', ({ jobId }) => {
      logger.debug('Job active', { jobId });
    });

    this.events.on('progress', ({ jobId, data }) => {
      logger.debug('Job progress', { jobId, progress: data });
    });
  }

  private async refreshQueueDepth(): Promise<void> {
    const [waiting, active, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getDelayedCount(),
    ]);

    this.queueDepth = waiting + active + delayed;
    this.queueDepthGauge.set({ app: 'message-worker' }, this.queueDepth);
  }

  private startMetricsServer(): void {
    const metricsPort = Number(process.env.METRICS_PORT || '9464');

    this.metricsServer = http.createServer(async (_req, res) => {
      res.setHeader('Content-Type', this.metricsRegistry.contentType);
      res.end(await this.metricsRegistry.metrics());
    });

    this.metricsServer.listen(metricsPort, () => {
      logger.info('Message worker metrics server started', { port: metricsPort });
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down LLM queue service');

    await this.worker.close();
    await this.queue.close();
    await this.events.close();
    if (this.metricsServer) {
      await new Promise<void>((resolve) => this.metricsServer?.close(() => resolve()));
    }
    await redisConnection.quit();

    logger.info('LLM queue service shut down');
  }
}

// Export singleton instance
export const llmQueue = new LLMQueueService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await llmQueue.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await llmQueue.shutdown();
  process.exit(0);
});

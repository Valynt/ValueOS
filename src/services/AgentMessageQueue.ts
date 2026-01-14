import { Queue, Worker, QueueScheduler, Job } from "bullmq";
import { logger } from "../lib/logger";
import { getAgentAPI } from "./AgentAPI";
import { getUnifiedOrchestrator } from "./UnifiedAgentOrchestrator";
import { AgentType } from "./agent-types";
import {
  getServiceConfigManager,
  getAgentMessageQueueConfig,
} from "../config/ServiceConfigManager";

export interface AgentInvocationJob {
  agent: AgentType;
  query: string;
  context?: any;
  sessionId: string;
  organizationId: string;
  userId: string;
  traceId: string;
  correlationId?: string;
}

export interface AgentInvocationResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime?: number;
  traceId: string;
}

export class AgentMessageQueue {
  private queue: Queue<AgentInvocationJob>;
  private worker: Worker<AgentInvocationJob>;
  private scheduler: QueueScheduler;
  private agentAPI = getAgentAPI();

  constructor(redisUrl?: string) {
    const config = getAgentMessageQueueConfig();

    // Use provided redisUrl or config default
    const finalRedisUrl = redisUrl || config.redis.url;

    // Create queue with Redis connection
    this.queue = new Queue<AgentInvocationJob>("agent-invocations", {
      connection: {
        url: finalRedisUrl,
      },
      defaultJobOptions: {
        removeOnComplete: config.queue.jobRetention / 1000, // Convert ms to seconds
        removeOnFail: 50,
        attempts: config.retryAttempts,
        backoff: {
          type: "exponential",
          delay: config.retryDelay,
        },
      },
    });

    // Create scheduler for delayed jobs
    this.scheduler = new QueueScheduler("agent-invocations", {
      connection: {
        url: finalRedisUrl,
      },
    });

    // Create worker to process jobs
    this.worker = new Worker<AgentInvocationJob>(
      "agent-invocations",
      this.processAgentInvocation.bind(this),
      {
        connection: {
          url: finalRedisUrl,
        },
        concurrency: config.queue.concurrency,
        limiter: {
          max: config.queue.rateLimitMax,
          duration: config.queue.rateLimitDuration,
        },
      }
    );

    // Event handlers
    this.worker.on("completed", (job) => {
      logger.info("Agent invocation completed", {
        jobId: job.id,
        agent: job.data.agent,
        sessionId: job.data.sessionId,
        executionTime: job.finishedOn! - job.processedOn!,
      });
    });

    this.worker.on("failed", (job, err) => {
      logger.error(
        "Agent invocation failed",
        err instanceof Error ? err : undefined,
        {
          jobId: job?.id,
          agent: job?.data.agent,
          sessionId: job?.data.sessionId,
          attemptsMade: job?.attemptsMade,
          attemptsRemaining: job?.opts.attempts! - (job?.attemptsMade || 0),
        }
      );
    });

    logger.info("Agent Message Queue initialized", {
      redisUrl: redisUrl.replace(/:[^:]*@/, ":***@"), // Hide password in logs
    });
  }

  /**
   * Queue an agent invocation for asynchronous processing
   */
  async queueAgentInvocation(job: AgentInvocationJob): Promise<string> {
    const bullJob = await this.queue.add(`invoke-${job.agent}`, job, {
      priority: this.getJobPriority(job.agent),
      delay: 0, // Process immediately unless specified
      jobId: `${job.sessionId}-${job.agent}-${Date.now()}`, // Unique job ID
    });

    logger.info("Agent invocation queued", {
      jobId: bullJob.id,
      agent: job.agent,
      sessionId: job.sessionId,
      traceId: job.traceId,
    });

    return bullJob.id!;
  }

  /**
   * Get job result (for polling)
   */
  async getJobResult(jobId: string): Promise<AgentInvocationResult | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      return null;
    }

    if (await job.isCompleted()) {
      const result = job.returnvalue as AgentInvocationResult;
      return result;
    }

    if (await job.isFailed()) {
      const failedReason = job.failedReason || "Unknown error";
      return {
        success: false,
        error: failedReason,
        traceId: job.data.traceId,
      };
    }

    // Job is still processing
    return null;
  }

  /**
   * Wait for job completion (with timeout)
   */
  async waitForJobCompletion(
    jobId: string,
    timeoutMs: number = 30000
  ): Promise<AgentInvocationResult> {
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      // Use BullMQ's job.finished() promise with timeout race
      const result = await Promise.race([
        job.finished(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Job ${jobId} timeout`)), timeoutMs)
        ),
      ]);

      return result as AgentInvocationResult;
    } catch (error) {
      if (error instanceof Error && error.message.includes("timeout")) {
        throw new Error(
          `Job ${jobId} did not complete within ${timeoutMs}ms timeout`
        );
      }
      throw error;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaiting(),
      this.queue.getActive(),
      this.queue.getCompleted(),
      this.queue.getFailed(),
      this.queue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      total:
        waiting.length +
        active.length +
        completed.length +
        failed.length +
        delayed.length,
    };
  }

  /**
   * Gracefully shutdown the queue
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down Agent Message Queue");

    await this.worker.close();
    await this.queue.close();
    await this.scheduler.close();

    logger.info("Agent Message Queue shut down");
  }

  /**
   * Process an agent invocation job
   */
  private async processAgentInvocation(
    job: Job<AgentInvocationJob>
  ): Promise<AgentInvocationResult> {
    const {
      agent,
      query,
      context,
      sessionId,
      organizationId,
      userId,
      traceId,
    } = job.data;

    const startTime = Date.now();

    try {
      logger.info("Processing agent invocation", {
        jobId: job.id,
        agent,
        sessionId,
        traceId,
      });

      // Create agent context
      const agentContext = {
        userId,
        sessionId,
        organizationId,
        metadata: context?.metadata || {},
      };

      // Invoke agent via AgentAPI
      const response = await this.agentAPI.invokeAgent({
        agent,
        query,
        context: agentContext,
      });

      const executionTime = Date.now() - startTime;

      const result: AgentInvocationResult = {
        success: response.success,
        data: response.success ? response.data : undefined,
        error: response.success ? undefined : response.error,
        executionTime,
        traceId,
      };

      logger.info("Agent invocation successful", {
        jobId: job.id,
        agent,
        sessionId,
        executionTime,
        success: response.success,
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error(
        "Agent invocation processing failed",
        error instanceof Error ? error : undefined,
        {
          jobId: job.id,
          agent,
          sessionId,
          traceId,
          executionTime,
        }
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime,
        traceId,
      };
    }
  }

  /**
   * Get job priority based on agent type
   */
  private getJobPriority(agent: AgentType): number {
    // Higher numbers = higher priority in BullMQ
    const priorities: Record<AgentType, number> = {
      coordinator: 10, // Highest priority for orchestration
      opportunity: 8,
      target: 8,
      realization: 7,
      expansion: 6,
      integrity: 9, // High priority for safety checks
      communicator: 5,
      "company-intelligence": 6,
      research: 6,
      benchmark: 5,
      "system-mapper": 7,
      "intervention-designer": 7,
      "outcome-engineer": 6,
      "financial-modeling": 6,
      narrative: 5,
    };

    return priorities[agent] || 5;
  }
}

// Singleton instance
let agentMessageQueue: AgentMessageQueue | null = null;

export function getAgentMessageQueue(redisUrl?: string): AgentMessageQueue {
  if (!agentMessageQueue) {
    agentMessageQueue = new AgentMessageQueue(redisUrl);
  }
  return agentMessageQueue;
}

export function resetAgentMessageQueue(): void {
  if (agentMessageQueue) {
    agentMessageQueue.shutdown();
    agentMessageQueue = null;
  }
}

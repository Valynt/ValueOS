/**
 * IdempotentJobProcessor - Base class for BullMQ workers with idempotency support
 *
 * Prevents duplicate job processing using idempotency keys stored in the database.
 * All workers should extend this class for reliable, exactly-once job execution.
 *
 * Features:
 * - Automatic idempotency key generation from job data
 * - Database-backed deduplication with TTL
 * - Duplicate detection and graceful skip
 * - Result caching for cache hits
 * - Integration with tenant context
 *
 * SECURITY: Uses service-role client for system-level job deduplication.
 * This is justified because idempotency is a system reliability mechanism,
 * not tenant-scoped data access. All stored data includes tenant_id for
 * observability but deduplication logic operates across tenant boundaries
 * by design (same job data = same job regardless of tenant).
 */

import type { Job } from 'bullmq';
import { createHash } from 'crypto';

import { logger } from '../lib/logger.js';
import { createServiceRoleSupabaseClient } from '@shared/lib/supabase';

// service-role:justified system-level job deduplication for worker reliability
// This client is used for cross-tenant idempotency tracking, not tenant data access.
const supabase = createServiceRoleSupabaseClient();

export interface IdempotencyConfig {
  /** Enable/disable idempotency (default: true) */
  enabled?: boolean;
  /** TTL in hours for processed job records (default: 168 = 7 days) */
  ttlHours?: number;
  /** Worker instance identifier for tracking */
  workerId?: string;
  /** Fields to include in idempotency key hash (default: all job data) */
  keyFields?: string[];
}

export interface JobContext {
  tenantId?: string;
  organizationId?: string;
  userId?: string;
  traceId?: string;
}

export interface IdempotencyResult {
  shouldProcess: boolean;
  existingResult?: unknown;
  idempotencyKey: string;
}

/**
 * Generate deterministic idempotency key from job data
 */
export function generateIdempotencyKey(
  queueName: string,
  jobName: string,
  jobData: Record<string, unknown>,
  keyFields?: string[]
): string {
  // Extract relevant fields for key generation
  const keyData = keyFields && keyFields.length > 0
    ? keyFields.reduce((acc, field) => {
        acc[field] = jobData[field];
        return acc;
      }, {} as Record<string, unknown>)
    : jobData;

  // Create deterministic hash
  const canonicalData = JSON.stringify(keyData, Object.keys(keyData).sort());
  const hash = createHash('sha256')
    .update(`${queueName}:${jobName}:${canonicalData}`)
    .digest('hex');

  return `idmp_${hash.slice(0, 32)}`;
}

/**
 * Generate hash of job data for integrity verification
 */
export function generateJobDataHash(jobData: Record<string, unknown>): string {
  const canonicalData = JSON.stringify(jobData, Object.keys(jobData).sort());
  return createHash('sha256').update(canonicalData).digest('hex');
}

/**
 * Check if a job has already been processed
 */
export async function checkJobIdempotency(
  queueName: string,
  idempotencyKey: string
): Promise<IdempotencyResult> {
  try {
    const { data, error } = await supabase.rpc('check_job_idempotency_status', {
      p_idempotency_key: idempotencyKey,
      p_queue_name: queueName,
    });

    if (error) {
      logger.error('Idempotency check failed', { error: error.message, queueName, idempotencyKey });
      // SECURITY: Fail closed - prevent duplicate processing during DB degradation
      // This may cause temporary job pile-up but prevents data corruption
      return { shouldProcess: false, idempotencyKey };
    }

    return {
      shouldProcess: data?.should_process ?? true,
      existingResult: data?.result,
      idempotencyKey,
    };
  } catch (err) {
    logger.error('Idempotency check error', { error: err, queueName, idempotencyKey });
    // SECURITY: Fail closed on error to prevent duplicate processing
    return { shouldProcess: false, idempotencyKey };
  }
}

/**
 * Mark a job as processed in the idempotency store
 */
export async function markJobProcessed(
  queueName: string,
  jobName: string,
  idempotencyKey: string,
  jobData: Record<string, unknown>,
  context: JobContext,
  result: unknown,
  config?: IdempotencyConfig
): Promise<void> {
  try {
    const jobDataHash = generateJobDataHash(jobData);
    const resultStatus = result instanceof Error ? 'failed' : 'completed';

    const { error } = await supabase.rpc('mark_job_processed', {
      p_idempotency_key: idempotencyKey,
      p_queue_name: queueName,
      p_job_name: jobName,
      p_job_data_hash: jobDataHash,
      p_tenant_id: context.tenantId,
      p_organization_id: context.organizationId,
      p_processed_by: config?.workerId ?? 'unknown',
      p_result_status: resultStatus,
      p_result_payload: resultStatus === 'completed' ? result : null,
      p_ttl_hours: config?.ttlHours ?? 168,
    });

    if (error) {
      logger.error('Failed to mark job as processed', {
        error: error.message,
        queueName,
        idempotencyKey,
      });
    }
  } catch (err) {
    logger.error('Error marking job processed', { error: err, queueName, idempotencyKey });
  }
}

/**
 * Base class for idempotent job processing
 *
 * Usage:
 * ```typescript
 * class MyWorker extends IdempotentJobProcessor<MyJobData> {
 *   constructor() {
 *     super('my-queue', { enabled: true, ttlHours: 24 });
 *   }
 *
 *   protected async processJob(job: Job<MyJobData>): Promise<void> {
 *     // Your actual job logic here
 *   }
 * }
 * ```
 */
export abstract class IdempotentJobProcessor<T = unknown> {
  protected queueName: string;
  protected config: Required<IdempotencyConfig>;

  constructor(queueName: string, config: IdempotencyConfig = {}) {
    this.queueName = queueName;
    this.config = {
      enabled: config.enabled ?? true,
      ttlHours: config.ttlHours ?? 168,
      workerId: config.workerId ?? `worker_${process.pid}_${Date.now()}`,
      keyFields: config.keyFields ?? [],
    };
  }

  /**
   * Main job handler - checks idempotency then processes
   */
  async handleJob(job: Job<T>): Promise<void> {
    const jobName = job.name;
    const jobData = job.data as Record<string, unknown>;

    // Extract context from job data
    const context: JobContext = {
      tenantId: (jobData as { tenantId?: string }).tenantId,
      organizationId: (jobData as { organizationId?: string }).organizationId,
      userId: (jobData as { requestedBy?: string }).requestedBy,
      traceId: (jobData as { traceId?: string }).traceId,
    };

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(
      this.queueName,
      jobName,
      jobData,
      this.config.keyFields
    );

    // Check idempotency if enabled
    if (this.config.enabled) {
      const checkResult = await checkJobIdempotency(this.queueName, idempotencyKey);

      if (!checkResult.shouldProcess) {
        logger.info('Skipping duplicate job', {
          queue: this.queueName,
          jobId: job.id,
          jobName,
          idempotencyKey,
          tenantId: context.tenantId,
        });

        // Return cached result if available
        if (checkResult.existingResult) {
          logger.debug('Returning cached result', {
            queue: this.queueName,
            idempotencyKey,
          });
        }

        return;
      }
    }

    // Process the job
    let result: unknown;

    try {
      logger.debug('Processing job', {
        queue: this.queueName,
        jobId: job.id,
        jobName,
        idempotencyKey,
        tenantId: context.tenantId,
      });

      result = await this.processJob(job);
    } catch (err) {
      // Do NOT mark failed jobs as processed — let BullMQ retry them.
      // The idempotency store only records successful completions so that
      // re-queued duplicates of an already-succeeded job are skipped.
      // Recording failures here would permanently block retries for transient
      // errors (network blips, DB timeouts, LLM unavailability).
      throw err instanceof Error ? err : new Error(String(err));
    }

    // Only reached on success — record the completion to deduplicate future
    // re-deliveries of the same job (e.g. at-least-once queue semantics).
    if (this.config.enabled) {
      await markJobProcessed(
        this.queueName,
        jobName,
        idempotencyKey,
        jobData,
        context,
        result,
        this.config
      );
    }
  }

  /**
   * Abstract method to implement actual job processing logic
   * Must be implemented by subclasses
   */
  protected abstract processJob(job: Job<T>): Promise<unknown>;
}

/**
 * Helper to wrap existing worker functions with idempotency
 *
 * Usage:
 * ```typescript
 * const worker = new Worker('my-queue', withIdempotency('my-queue', async (job) => {
 *   // Your job logic
 * }));
 * ```
 */
export function withIdempotency<T = unknown>(
  queueName: string,
  processor: (job: Job<T>) => Promise<unknown>,
  config?: IdempotencyConfig
): (job: Job<T>) => Promise<void> {
  const effectiveConfig: Required<IdempotencyConfig> = {
    enabled: config?.enabled ?? true,
    ttlHours: config?.ttlHours ?? 168,
    workerId: config?.workerId ?? `worker_${process.pid}_${Date.now()}`,
    keyFields: config?.keyFields ?? [],
  };

  return async (job: Job<T>): Promise<void> => {
    const jobName = job.name;
    const jobData = job.data as Record<string, unknown>;

    const context: JobContext = {
      tenantId: (jobData as { tenantId?: string }).tenantId,
      organizationId: (jobData as { organizationId?: string }).organizationId,
      userId: (jobData as { requestedBy?: string }).requestedBy,
      traceId: (jobData as { traceId?: string }).traceId,
    };

    const idempotencyKey = generateIdempotencyKey(
      queueName,
      jobName,
      jobData,
      effectiveConfig.keyFields
    );

    if (effectiveConfig.enabled) {
      const checkResult = await checkJobIdempotency(queueName, idempotencyKey);

      if (!checkResult.shouldProcess) {
        logger.info('Skipping duplicate job', {
          queue: queueName,
          jobId: job.id,
          jobName,
          idempotencyKey,
        });
        return;
      }
    }

    let result: unknown;

    try {
      result = await processor(job);
    } catch (err) {
      // Do NOT mark failed jobs as processed — let BullMQ retry them.
      // See IdempotentJobProcessor.handleJob for the full rationale.
      throw err instanceof Error ? err : new Error(String(err));
    }

    // Only reached on success.
    if (effectiveConfig.enabled) {
      await markJobProcessed(
        queueName,
        jobName,
        idempotencyKey,
        jobData,
        context,
        result,
        effectiveConfig
      );
    }
  };
}

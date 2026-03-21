/**
 * Chaos: Redis / BullMQ unavailability.
 *
 * Success criteria:
 * - Jobs are not silently dropped when Redis is unavailable
 * - The system records retry intent while preserving the job in a recoverable backlog
 * - Exhausted jobs move to a DLQ with traceability metadata
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type JobStatus = "queued" | "retry_pending" | "processing" | "completed" | "failed" | "dlq";

interface Job {
  id: string;
  organizationId: string;
  traceId: string;
  payload: Record<string, unknown>;
  attempts: number;
  status: JobStatus;
}

interface QueueResult {
  delivered: boolean;
  dlq: boolean;
  attempts: number;
  status: JobStatus;
}

class RedisUnavailableError extends Error {
  constructor(message = "Redis unavailable") {
    super(message);
    this.name = "RedisUnavailableError";
  }
}

const DEFAULT_MAX_ATTEMPTS = 3;

const backlog = new Map<string, Job>();
const deadLetterQueue = new Map<string, Job>();
const backlogHistory: JobStatus[] = [];
const auditLog: Array<{ event: string; traceId: string; organizationId: string; metadata: Record<string, unknown> }> = [];

const mockLogger = {
  error: vi.fn((msg: string, meta: Record<string, unknown>) => {
    auditLog.push({
      event: msg,
      traceId: String(meta.traceId),
      organizationId: String(meta.organizationId),
      metadata: meta,
    });
  }),
};

const mockQueue = {
  publish: vi.fn<[Job], Promise<void>>(),
  publishToDLQ: vi.fn<[Job], Promise<void>>(),
};

async function deliverWithRetry(job: Job, maxAttempts = 3): Promise<QueueResult> {
  let attempts = 0;
  backlog.set(job.id, { ...job, status: "queued", attempts: 0 });

  while (attempts < maxAttempts) {
    attempts += 1;

    try {
      await mockQueue.publish({ ...job, attempts, status: "processing" });
      backlog.delete(job.id);
      return { delivered: true, dlq: false, attempts, status: "processing" };
    } catch (error) {
      backlog.set(job.id, { ...job, attempts, status: "retry_pending" });
      backlogHistory.push("retry_pending");
      mockLogger.error("Redis/BullMQ publish failed", {
        traceId: job.traceId,
        organizationId: job.organizationId,
        jobId: job.id,
        attempt: attempts,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const dlqJob = { ...job, attempts, status: "dlq" as const };
  backlog.delete(job.id);
  deadLetterQueue.set(job.id, dlqJob);
  await mockQueue.publishToDLQ(dlqJob);

  mockLogger.error("Job moved to DLQ after Redis outage", {
    traceId: job.traceId,
    organizationId: job.organizationId,
    jobId: job.id,
    attempts,
  });

  return { delivered: false, dlq: true, attempts, status: "dlq" };
}

describe("Chaos: Redis / BullMQ unavailability", () => {
  const baseJob: Job = {
    id: "job-chaos-001",
    organizationId: "org-chaos",
    traceId: "trace-queue-001",
    payload: { workflowId: "wf-1", runId: "run-001" },
    attempts: 0,
    status: "queued",
  };

  beforeEach(() => {
    backlog.clear();
    deadLetterQueue.clear();
    backlogHistory.length = 0;
    auditLog.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the job in a recoverable backlog when Redis is unavailable", async () => {
    mockQueue.publish.mockRejectedValueOnce(new RedisUnavailableError());
    mockQueue.publish.mockResolvedValueOnce(undefined);

    const result = await deliverWithRetry(baseJob, DEFAULT_MAX_ATTEMPTS);

    expect(result.delivered).toBe(true);
    expect(result.attempts).toBe(2);
    expect(backlogHistory).toContain("retry_pending");
    expect(backlog.has(baseJob.id)).toBe(false);
    expect(deadLetterQueue.size).toBe(0);
  });

  it("does not silently drop jobs while Redis remains unavailable", async () => {
    mockQueue.publish.mockRejectedValue(new RedisUnavailableError());

    const result = await deliverWithRetry(baseJob, DEFAULT_MAX_ATTEMPTS);

    expect(result.dlq).toBe(true);
    expect(result.status).toBe("dlq");
    expect(deadLetterQueue.get(baseJob.id)).toMatchObject({
      id: baseJob.id,
      status: "dlq",
      attempts: DEFAULT_MAX_ATTEMPTS,
    });
    expect(mockQueue.publish).toHaveBeenCalledTimes(DEFAULT_MAX_ATTEMPTS);
    expect(mockQueue.publishToDLQ).toHaveBeenCalledTimes(1);
  });

  it("captures trace_id and organization_id on Redis/BullMQ failures", async () => {
    mockQueue.publish.mockRejectedValue(new RedisUnavailableError());

    await deliverWithRetry(baseJob, 1);

    expect(auditLog[0]).toMatchObject({
      event: "Redis/BullMQ publish failed",
      traceId: baseJob.traceId,
      organizationId: baseJob.organizationId,
    });
  });

  it("retains the original job id in the DLQ for replay", async () => {
    mockQueue.publish.mockRejectedValue(new RedisUnavailableError());

    await deliverWithRetry(baseJob, 2);

    expect(deadLetterQueue.get(baseJob.id)).toMatchObject({
      id: baseJob.id,
      status: "dlq",
      attempts: 2,
    });
  });
});

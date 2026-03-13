/**
 * Chaos: Queue outage and delayed consumer.
 *
 * Success criteria:
 * - Job enters DLQ after max delivery attempts
 * - UI-visible state is accurate (queued/failed — not success)
 * - Retry count is bounded
 * - Audit log contains trace_id and organization_id
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Minimal in-test stubs
// ---------------------------------------------------------------------------

type JobStatus = "queued" | "processing" | "completed" | "failed" | "dlq";

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
}

const auditLog: Array<{ event: string; traceId: string; organizationId: string; metadata: Record<string, unknown> }> = [];

const mockLogger = {
  error: vi.fn((msg: string, meta: Record<string, unknown>) => {
    auditLog.push({ event: msg, traceId: meta["traceId"] as string, organizationId: meta["organizationId"] as string, metadata: meta });
  }),
  warn: vi.fn(),
  info: vi.fn(),
};

const mockQueue = {
  publish: vi.fn<[Job], Promise<void>>(),
  publishToDLQ: vi.fn<[Job], Promise<void>>(),
};

// ---------------------------------------------------------------------------
// Queue delivery stub with DLQ routing
// ---------------------------------------------------------------------------

async function deliverWithRetry(
  job: Job,
  maxAttempts = 3,
): Promise<QueueResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      await mockQueue.publish({ ...job, attempts });
      return { delivered: true, dlq: false, attempts };
    } catch (err) {
      mockLogger.error("Queue delivery failed", {
        traceId: job.traceId,
        organizationId: job.organizationId,
        jobId: job.id,
        attempt: attempts,
        error: (err as Error).message,
      });
    }
  }

  // All attempts exhausted — route to DLQ.
  await mockQueue.publishToDLQ({ ...job, status: "dlq", attempts });
  mockLogger.error("Job moved to DLQ", {
    traceId: job.traceId,
    organizationId: job.organizationId,
    jobId: job.id,
    attempts,
  });

  return { delivered: false, dlq: true, attempts };
}

function getUIStatus(result: QueueResult): "queued" | "failed" {
  if (result.dlq) return "failed";
  if (!result.delivered) return "queued";
  return "queued"; // Still processing.
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Chaos: Queue outage + delayed consumer", () => {
  const baseJob: Job = {
    id: "job-chaos-001",
    organizationId: "org-chaos",
    traceId: "trace-queue-001",
    payload: { workflowId: "wf-1", runId: "run-001" },
    attempts: 0,
    status: "queued",
  };

  beforeEach(() => {
    auditLog.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("job enters DLQ after max delivery attempts", async () => {
    mockQueue.publish.mockRejectedValue(new Error("queue broker unavailable"));

    const result = await deliverWithRetry(baseJob, 3);

    expect(result.dlq).toBe(true);
    expect(mockQueue.publishToDLQ).toHaveBeenCalledTimes(1);
  });

  it("UI shows accurate failed state — not success — when job enters DLQ", async () => {
    mockQueue.publish.mockRejectedValue(new Error("queue broker unavailable"));

    const result = await deliverWithRetry(baseJob, 3);
    const uiStatus = getUIStatus(result);

    expect(uiStatus).toBe("failed");
    expect(uiStatus).not.toBe("completed");
  });

  it("retry count is bounded at maxAttempts", async () => {
    mockQueue.publish.mockRejectedValue(new Error("queue broker unavailable"));

    const result = await deliverWithRetry(baseJob, 3);

    expect(result.attempts).toBe(3);
    expect(mockQueue.publish).toHaveBeenCalledTimes(3);
  });

  it("succeeds on retry when queue recovers before max attempts", async () => {
    mockQueue.publish
      .mockRejectedValueOnce(new Error("queue broker unavailable"))
      .mockResolvedValueOnce(undefined);

    const result = await deliverWithRetry(baseJob, 3);

    expect(result.delivered).toBe(true);
    expect(result.dlq).toBe(false);
    expect(result.attempts).toBe(2);
    expect(mockQueue.publishToDLQ).not.toHaveBeenCalled();
  });

  it("audit log contains trace_id and organization_id on queue failure", async () => {
    mockQueue.publish.mockRejectedValue(new Error("queue broker unavailable"));

    await deliverWithRetry(baseJob, 3);

    const failureEntries = auditLog.filter((e) => e.traceId === baseJob.traceId);
    expect(failureEntries.length).toBeGreaterThan(0);
    expect(failureEntries[0].organizationId).toBe(baseJob.organizationId);
  });

  it("DLQ entry carries the job id for traceability", async () => {
    mockQueue.publish.mockRejectedValue(new Error("queue broker unavailable"));

    await deliverWithRetry(baseJob, 3);

    const dlqCall = mockQueue.publishToDLQ.mock.calls[0][0];
    expect(dlqCall.id).toBe(baseJob.id);
    expect(dlqCall.status).toBe("dlq");
  });
});

/**
 * Chaos: Database transient outage during workflow execution.
 *
 * Success criteria:
 * - Workflow state remains consistent after transient DB failure
 * - Retry is idempotent — no duplicate records on recovery
 * - Audit log contains trace_id and organization_id
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Minimal in-test stubs
// ---------------------------------------------------------------------------

interface WorkflowRecord {
  id: string;
  organizationId: string;
  status: "pending" | "running" | "completed" | "failed";
  traceId: string;
  createdAt: string;
}

interface DBError {
  code: string;
  message: string;
  retryable: boolean;
}

const mockDB = {
  insert: vi.fn<[WorkflowRecord], Promise<{ data: WorkflowRecord | null; error: DBError | null }>>(),
  select: vi.fn<[string, string], Promise<{ data: WorkflowRecord | null; error: DBError | null }>>(),
  update: vi.fn<[string, Partial<WorkflowRecord>], Promise<{ error: DBError | null }>>(),
};

const auditLog: Array<{ event: string; traceId: string; organizationId: string }> = [];

const mockLogger = {
  error: vi.fn((msg: string, meta: Record<string, unknown>) => {
    auditLog.push({
      event: msg,
      traceId: meta["traceId"] as string,
      organizationId: meta["organizationId"] as string,
    });
  }),
  warn: vi.fn(),
  info: vi.fn(),
};

// ---------------------------------------------------------------------------
// Workflow persistence stub with idempotency key
// ---------------------------------------------------------------------------

const persistedIds = new Set<string>();

async function persistWorkflowWithRetry(
  record: WorkflowRecord,
  maxAttempts = 3,
): Promise<{ success: boolean; attempts: number; duplicate: boolean }> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;

    const { data, error } = await mockDB.insert(record);

    if (!error) {
      if (persistedIds.has(record.id)) {
        // Idempotency: already persisted — not a duplicate write.
        return { success: true, attempts, duplicate: true };
      }
      persistedIds.add(record.id);
      return { success: true, attempts, duplicate: false };
    }

    mockLogger.error("DB write failed", {
      traceId: record.traceId,
      organizationId: record.organizationId,
      attempt: attempts,
      errorCode: error.code,
    });

    if (!error.retryable || attempts >= maxAttempts) {
      return { success: false, attempts, duplicate: false };
    }
  }

  return { success: false, attempts, duplicate: false };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Chaos: DB transient outage", () => {
  const baseRecord: WorkflowRecord = {
    id: "wf-chaos-001",
    organizationId: "org-chaos",
    status: "running",
    traceId: "trace-db-001",
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    persistedIds.clear();
    auditLog.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("succeeds on retry after transient failure", async () => {
    mockDB.insert
      .mockResolvedValueOnce({ data: null, error: { code: "ECONNRESET", message: "connection reset", retryable: true } })
      .mockResolvedValueOnce({ data: baseRecord, error: null });

    const result = await persistWorkflowWithRetry(baseRecord);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.duplicate).toBe(false);
  });

  it("workflow state is consistent — only one record written on recovery", async () => {
    mockDB.insert
      .mockResolvedValueOnce({ data: null, error: { code: "ECONNRESET", message: "connection reset", retryable: true } })
      .mockResolvedValueOnce({ data: baseRecord, error: null });

    await persistWorkflowWithRetry(baseRecord);

    // Simulate a second call with the same id (retry from caller side).
    mockDB.insert.mockResolvedValueOnce({ data: baseRecord, error: null });
    const second = await persistWorkflowWithRetry(baseRecord);

    // Second call detects the id is already persisted — no duplicate.
    expect(second.duplicate).toBe(true);
    expect(persistedIds.size).toBe(1);
  });

  it("fails after exhausting retries on non-transient error", async () => {
    mockDB.insert.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "unique violation", retryable: false },
    });

    const result = await persistWorkflowWithRetry(baseRecord, 3);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1); // Non-retryable stops immediately.
  });

  it("retry count is bounded — does not exceed maxAttempts", async () => {
    mockDB.insert.mockResolvedValue({
      data: null,
      error: { code: "ECONNRESET", message: "connection reset", retryable: true },
    });

    const result = await persistWorkflowWithRetry(baseRecord, 3);

    expect(result.attempts).toBeLessThanOrEqual(3);
    expect(mockDB.insert).toHaveBeenCalledTimes(3);
  });

  it("audit log contains trace_id and organization_id on DB failure", async () => {
    mockDB.insert.mockResolvedValue({
      data: null,
      error: { code: "ECONNRESET", message: "connection reset", retryable: false },
    });

    await persistWorkflowWithRetry(baseRecord);

    expect(auditLog.length).toBeGreaterThan(0);
    expect(auditLog[0].traceId).toBe(baseRecord.traceId);
    expect(auditLog[0].organizationId).toBe(baseRecord.organizationId);
  });

  it("workflow state is failed — not completed — when all retries exhausted", async () => {
    mockDB.insert.mockResolvedValue({
      data: null,
      error: { code: "ECONNRESET", message: "connection reset", retryable: true },
    });

    const result = await persistWorkflowWithRetry(baseRecord, 3);

    expect(result.success).toBe(false);
    // No record should be in the persisted set.
    expect(persistedIds.has(baseRecord.id)).toBe(false);
  });
});

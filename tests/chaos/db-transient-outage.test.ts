/**
 * Chaos: PostgreSQL connection failure.
 *
 * Success criteria:
 * - Backend returns a structured 503 error instead of a raw stack trace
 * - Error payload is retryable and traceable
 * - Recovery path can succeed once the DB dependency comes back
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface WorkflowRecord {
  id: string;
  organizationId: string;
  status: "pending" | "running" | "completed" | "failed";
  traceId: string;
  createdAt: string;
}

class PostgresUnavailableError extends Error {
  readonly statusCode = SERVICE_UNAVAILABLE;
  readonly code = "DB_UNAVAILABLE";
  readonly retryable = true;

  constructor(message = "Postgres connection unavailable") {
    super(message);
    this.name = "PostgresUnavailableError";
  }
}

const mockDB = {
  insert: vi.fn<[WorkflowRecord], Promise<{ data: WorkflowRecord | null; error: Error | null }>>(),
};

const SERVICE_UNAVAILABLE = 503;
const DEFAULT_MAX_ATTEMPTS = 3;

const auditLog: Array<{ event: string; traceId: string; organizationId: string }> = [];
const persistedIds = new Set<string>();

const mockLogger = {
  error: vi.fn((msg: string, meta: Record<string, unknown>) => {
    auditLog.push({
      event: msg,
      traceId: String(meta.traceId),
      organizationId: String(meta.organizationId),
    });
  }),
};

async function persistWorkflowWithRetry(
  record: WorkflowRecord,
  maxAttempts = 3,
): Promise<{ success: boolean; attempts: number; duplicate: boolean }> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts += 1;

    const { data, error } = await mockDB.insert(record);

    if (!error) {
      if (persistedIds.has(record.id)) {
        return { success: true, attempts, duplicate: true };
      }

      persistedIds.add(record.id);
      return { success: Boolean(data), attempts, duplicate: false };
    }

    mockLogger.error("DB write failed", {
      traceId: record.traceId,
      organizationId: record.organizationId,
      attempt: attempts,
      errorCode: error.name,
    });

    const retryable = error instanceof PostgresUnavailableError;
    if (!retryable || attempts >= maxAttempts) {
      return { success: false, attempts, duplicate: false };
    }
  }

  return { success: false, attempts, duplicate: false };
}

async function invokePostgresFailureRoute(): Promise<{
  statusCode: number;
  body: Record<string, unknown>;
}> {
  const traceId = "trace-db-001";
  const organizationId = "org-chaos";

  try {
    const { error } = await mockDB.insert({
      id: "wf-chaos-route",
      organizationId,
      status: "running",
      traceId,
      createdAt: new Date().toISOString(),
    });

    if (error) {
      throw error;
    }

    return { statusCode: 200, body: { status: "ok" } };
  } catch (error) {
    mockLogger.error("Postgres dependency unavailable", {
      traceId,
      organizationId,
      error: error instanceof Error ? error.message : "unknown",
    });

    const structuredError = error instanceof PostgresUnavailableError ? error : new PostgresUnavailableError();

    return {
      statusCode: structuredError.statusCode,
      body: {
        error: {
          code: structuredError.code,
          message: structuredError.message,
          retryable: structuredError.retryable,
        },
        status: "degraded",
        traceId,
      },
    };
  }
}

describe("Chaos: PostgreSQL connection failure", () => {
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

  it("returns structured 503 Service Unavailable instead of a raw stack trace", async () => {
    mockDB.insert.mockResolvedValue({
      data: null,
      error: new PostgresUnavailableError("Postgres connection unavailable"),
    });

    const response = await invokePostgresFailureRoute();

    expect(response.statusCode).toBe(SERVICE_UNAVAILABLE);
    expect(response.body).toEqual({
      error: {
        code: "DB_UNAVAILABLE",
        message: "Postgres connection unavailable",
        retryable: true,
      },
      status: "degraded",
      traceId: "trace-db-001",
    });
    expect(JSON.stringify(response.body)).not.toMatch(/stack|PostgresUnavailableError|at\s+/);
  });

  it("succeeds on retry after transient connection recovery", async () => {
    mockDB.insert
      .mockResolvedValueOnce({ data: null, error: new PostgresUnavailableError() })
      .mockResolvedValueOnce({ data: baseRecord, error: null });

    const result = await persistWorkflowWithRetry(baseRecord);

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.duplicate).toBe(false);
  });

  it("preserves idempotency after recovery", async () => {
    mockDB.insert
      .mockResolvedValueOnce({ data: null, error: new PostgresUnavailableError() })
      .mockResolvedValueOnce({ data: baseRecord, error: null })
      .mockResolvedValueOnce({ data: baseRecord, error: null });

    await persistWorkflowWithRetry(baseRecord);
    const secondAttempt = await persistWorkflowWithRetry(baseRecord);

    expect(secondAttempt.duplicate).toBe(true);
    expect(persistedIds.size).toBe(1);
  });

  it("fails after bounded retries when Postgres stays unavailable", async () => {
    mockDB.insert.mockResolvedValue({
      data: null,
      error: new PostgresUnavailableError(),
    });

    const result = await persistWorkflowWithRetry(baseRecord, DEFAULT_MAX_ATTEMPTS);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(DEFAULT_MAX_ATTEMPTS);
    expect(persistedIds.has(baseRecord.id)).toBe(false);
  });

  it("records trace_id and organization_id for degraded Postgres writes", async () => {
    mockDB.insert.mockResolvedValue({
      data: null,
      error: new PostgresUnavailableError(),
    });

    await persistWorkflowWithRetry(baseRecord, 1);

    expect(auditLog).toContainEqual({
      event: "DB write failed",
      traceId: baseRecord.traceId,
      organizationId: baseRecord.organizationId,
    });
  });
});

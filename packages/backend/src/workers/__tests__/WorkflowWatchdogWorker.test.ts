/**
 * WorkflowWatchdogWorker — unit tests for detectAndResolveStuckWorkflows()
 *
 * Covers:
 *   - No stuck workflows: returns zeros, no DB updates
 *   - Requeue path: iteration_count < MAX_REQUEUE_ATTEMPTS → status='pending'
 *   - Permanent-fail path: iteration_count >= MAX_REQUEUE_ATTEMPTS → status='failed'
 *   - Mixed batch: some requeued, some permanently failed
 *   - DB update error on requeue: logs error, continues with remaining
 *   - DB update error on permanent fail: logs error, continues with remaining
 *   - DB query error: throws
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Metrics mock (must be before worker import) ───────────────────────────────

vi.mock("../../middleware/metricsMiddleware.js", () => ({
  getMetricsRegistry: vi.fn().mockReturnValue({
    registerMetric: vi.fn(),
  }),
}));

vi.mock("prom-client", () => ({
  Counter: vi.fn().mockImplementation(() => ({
    inc: vi.fn(),
  })),
}));

// ── Supabase mock ─────────────────────────────────────────────────────────────

// Mutable state so individual tests can control responses
let mockSelectResult: { data: unknown; error: unknown } = { data: [], error: null };
const mockUpdateCalls: Array<{ status: string; id: string }> = [];
const mockUpdateError: Record<string, unknown> = {};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn().mockImplementation(() => ({
    from: vi.fn().mockImplementation((_table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lt: vi.fn().mockImplementation(() => Promise.resolve(mockSelectResult)),
        }),
      }),
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => ({
        eq: vi.fn().mockImplementation((_col: string, id: string) => {
          mockUpdateCalls.push({ status: payload.status as string, id });
          return Promise.resolve({ error: mockUpdateError[id] ?? null });
        }),
      })),
    })),
  })),
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

const mockLoggerWarn = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("../../lib/logger.js", () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError,
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeExecution(id: string, iterationCount: number) {
  return {
    id,
    tenant_id: `tenant-${id}`,
    workflow_id: `wf-${id}`,
    iteration_count: iterationCount,
    started_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("detectAndResolveStuckWorkflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateCalls.length = 0;
    Object.keys(mockUpdateError).forEach((k) => delete mockUpdateError[k]);
    mockSelectResult = { data: [], error: null };

    process.env.SUPABASE_URL = "http://localhost";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    // MAX_REQUEUE_ATTEMPTS is a module-level constant (default: 2) parsed once at
    // import time. Setting the env var here has no effect on the cached module.
    // Tests below rely on the default value of 2. To test a different threshold,
    // call vi.resetModules() before the dynamic import in that specific test.
  });

  it("returns zeros and makes no DB updates when no workflows are stuck", async () => {
    mockSelectResult = { data: [], error: null };

    const { detectAndResolveStuckWorkflows } = await import("../WorkflowWatchdogWorker.js");
    const result = await detectAndResolveStuckWorkflows(30);

    expect(result).toEqual({ detected: 0, requeued: 0, failed: 0 });
    expect(mockUpdateCalls).toHaveLength(0);
  });

  it("requeues execution when iteration_count < MAX_REQUEUE_ATTEMPTS", async () => {
    // iteration_count=1, MAX_REQUEUE_ATTEMPTS=2 → retryable
    mockSelectResult = { data: [makeExecution("exec-1", 1)], error: null };

    const { detectAndResolveStuckWorkflows } = await import("../WorkflowWatchdogWorker.js");
    const result = await detectAndResolveStuckWorkflows(30);

    expect(result).toEqual({ detected: 1, requeued: 1, failed: 0 });
    expect(mockUpdateCalls).toHaveLength(1);
    expect(mockUpdateCalls[0].status).toBe("pending");
    expect(mockUpdateCalls[0].id).toBe("exec-1");
  });

  it("permanently fails execution when iteration_count >= MAX_REQUEUE_ATTEMPTS", async () => {
    // iteration_count=2, MAX_REQUEUE_ATTEMPTS=2 → not retryable
    mockSelectResult = { data: [makeExecution("exec-2", 2)], error: null };

    const { detectAndResolveStuckWorkflows } = await import("../WorkflowWatchdogWorker.js");
    const result = await detectAndResolveStuckWorkflows(30);

    expect(result).toEqual({ detected: 1, requeued: 0, failed: 1 });
    expect(mockUpdateCalls).toHaveLength(1);
    expect(mockUpdateCalls[0].status).toBe("failed");
    expect(mockUpdateCalls[0].id).toBe("exec-2");
  });

  it("handles a mixed batch: some requeued, some permanently failed", async () => {
    mockSelectResult = {
      data: [
        makeExecution("exec-a", 0), // retryable (0 < 2)
        makeExecution("exec-b", 1), // retryable (1 < 2)
        makeExecution("exec-c", 2), // permanent fail (2 >= 2)
        makeExecution("exec-d", 5), // permanent fail (5 >= 2)
      ],
      error: null,
    };

    const { detectAndResolveStuckWorkflows } = await import("../WorkflowWatchdogWorker.js");
    const result = await detectAndResolveStuckWorkflows(30);

    expect(result).toEqual({ detected: 4, requeued: 2, failed: 2 });
    const pendingUpdates = mockUpdateCalls.filter((u) => u.status === "pending");
    const failedUpdates = mockUpdateCalls.filter((u) => u.status === "failed");
    expect(pendingUpdates.map((u) => u.id)).toEqual(["exec-a", "exec-b"]);
    expect(failedUpdates.map((u) => u.id)).toEqual(["exec-c", "exec-d"]);
  });

  it("logs error and continues when a requeue DB update fails", async () => {
    mockSelectResult = {
      data: [makeExecution("exec-fail", 0), makeExecution("exec-ok", 0)],
      error: null,
    };
    // exec-fail update returns an error
    mockUpdateError["exec-fail"] = { message: "db error" };

    const { detectAndResolveStuckWorkflows } = await import("../WorkflowWatchdogWorker.js");
    const result = await detectAndResolveStuckWorkflows(30);

    // exec-fail errored (not counted as requeued), exec-ok succeeded
    expect(result.detected).toBe(2);
    expect(result.requeued).toBe(1);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining("failed to requeue"),
      expect.anything(),
      expect.objectContaining({ executionId: "exec-fail" }),
    );
  });

  it("logs error and continues when a permanent-fail DB update fails", async () => {
    mockSelectResult = {
      data: [makeExecution("exec-fail", 5), makeExecution("exec-ok", 5)],
      error: null,
    };
    mockUpdateError["exec-fail"] = { message: "db error" };

    const { detectAndResolveStuckWorkflows } = await import("../WorkflowWatchdogWorker.js");
    const result = await detectAndResolveStuckWorkflows(30);

    expect(result.detected).toBe(2);
    expect(result.failed).toBe(1);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.stringContaining("failed to mark execution as failed"),
      expect.anything(),
      expect.objectContaining({ executionId: "exec-fail" }),
    );
  });

  it("throws when the DB query for stuck workflows fails", async () => {
    mockSelectResult = { data: null, error: { message: "query timeout" } };

    const { detectAndResolveStuckWorkflows } = await import("../WorkflowWatchdogWorker.js");
    await expect(detectAndResolveStuckWorkflows(30)).rejects.toThrow("Watchdog query failed");
  });
});

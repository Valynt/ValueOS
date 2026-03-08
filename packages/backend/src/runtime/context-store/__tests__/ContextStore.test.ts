import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContextStore } from "../index.js";

// ============================================================================
// Mocks — hoisted so vi.mock factories can reference them
// ============================================================================

const { mockLoggerError } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { error: mockLoggerError, debug: vi.fn() },
}));

// ============================================================================
// Helpers
// ============================================================================

function makeSupabaseMock(updateResult: { error: { message: string } | null }) {
  const eqChain = {
    eq: vi.fn().mockReturnThis(),
  };
  const updateChain = {
    eq: vi.fn().mockReturnValue(eqChain),
  };
  // The final .eq() in the chain resolves the promise
  eqChain.eq.mockResolvedValue(updateResult);

  return {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue(updateChain),
    }),
    _updateChain: updateChain,
    _eqChain: eqChain,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("ContextStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("handleWorkflowFailure", () => {
    it("updates workflow_executions with failed status, error message, and completed_at", async () => {
      const supabase = makeSupabaseMock({ error: null });
      const store = new ContextStore(supabase as never);

      await store.handleWorkflowFailure("exec-1", "org-1", "something went wrong");

      expect(supabase.from).toHaveBeenCalledWith("workflow_executions");
      const updateCall = supabase.from.mock.results[0].value.update;
      expect(updateCall).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          error_message: "something went wrong",
        }),
      );
    });

    it("filters by both id and organization_id (tenant isolation)", async () => {
      const supabase = makeSupabaseMock({ error: null });
      const store = new ContextStore(supabase as never);

      await store.handleWorkflowFailure("exec-42", "org-99", "timeout");

      const updateChain = supabase.from.mock.results[0].value.update.mock.results[0].value;
      expect(updateChain.eq).toHaveBeenCalledWith("id", "exec-42");
      expect(supabase._eqChain.eq).toHaveBeenCalledWith("organization_id", "org-99");
    });

    it("logs the workflow failure via logger.error", async () => {
      const supabase = makeSupabaseMock({ error: null });
      const store = new ContextStore(supabase as never);

      await store.handleWorkflowFailure("exec-1", "org-1", "agent crashed");

      expect(mockLoggerError).toHaveBeenCalledWith(
        "Workflow failed",
        undefined,
        expect.objectContaining({ executionId: "exec-1", errorMessage: "agent crashed" }),
      );
    });

    it("logs a secondary error when the DB update fails, but does not throw", async () => {
      const supabase = makeSupabaseMock({ error: { message: "connection refused" } });
      const store = new ContextStore(supabase as never);

      // Should not throw even though DB failed
      await expect(
        store.handleWorkflowFailure("exec-1", "org-1", "primary error"),
      ).resolves.toBeUndefined();

      // DB error is logged separately
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to persist workflow failure status",
        expect.any(Error),
        expect.objectContaining({ dbError: "connection refused" }),
      );

      // Primary failure is also logged
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Workflow failed",
        undefined,
        expect.objectContaining({ executionId: "exec-1" }),
      );
    });

    it("sets completed_at to a valid ISO timestamp", async () => {
      const supabase = makeSupabaseMock({ error: null });
      const store = new ContextStore(supabase as never);

      const before = new Date().toISOString();
      await store.handleWorkflowFailure("exec-1", "org-1", "err");
      const after = new Date().toISOString();

      const updateCall = supabase.from.mock.results[0].value.update.mock.calls[0][0];
      expect(updateCall.completed_at >= before).toBe(true);
      expect(updateCall.completed_at <= after).toBe(true);
    });
  });
});

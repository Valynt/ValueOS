import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContextStore } from "../index.js";

// ============================================================================
// Mocks — hoisted so vi.mock factories can reference them
// ============================================================================

const { mockLoggerError } = vi.hoisted(() => ({
  mockLoggerError: vi.fn(),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../../../lib/supabase", () => ({
  supabase: {},
}));

vi.mock("uuid", () => ({
  v4: () => `test-uuid-${Math.random().toString(36).slice(2)}`,
}));

vi.mock("../../../services/workflows/WorkflowExecutionStore", () => ({
  WorkflowExecutionStore: vi.fn(function () {
    return {
      getExecutionStatus: vi.fn().mockResolvedValue(null),
      getExecutionLogs: vi.fn().mockResolvedValue([]),
    };
  }),
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

// ============================================================================
// createInitialState
// ============================================================================

describe('ContextStore.createInitialState', () => {
  let store: ContextStore;

  beforeEach(() => {
    store = new ContextStore(makeSupabaseMock({ error: null }) as never);
  });

  it('returns a state with the given initial stage', () => {
    const state = store.createInitialState('org-1', 'discovery');
    expect(state.currentStage).toBe('discovery');
    expect(state.lifecycle_stage).toBe('discovery');
    expect(state.current_step).toBe('discovery');
  });

  it('sets status to pending with empty completed_steps', () => {
    const state = store.createInitialState('org-1', 'discovery');
    expect(state.status).toBe('pending');
    expect(state.completed_steps).toEqual([]);
  });

  it('initialises conversationHistory as empty array', () => {
    const state = store.createInitialState('org-1', 'discovery');
    expect(state.context?.conversationHistory).toEqual([]);
  });

  it('generates unique ids on each call', () => {
    const a = store.createInitialState('org-1', 'discovery');
    const b = store.createInitialState('org-1', 'discovery');
    expect(a.id).not.toBe(b.id);
    expect(a.execution_id).not.toBe(b.execution_id);
  });

  it('defaults intent to agent-query when not provided', () => {
    const state = store.createInitialState('org-1', 'discovery', {});
    expect((state.context as Record<string, unknown>).intent).toBe('agent-query');
  });
});

// ============================================================================
// updateStage
// ============================================================================

describe('ContextStore.updateStage', () => {
  let store: ContextStore;

  beforeEach(() => {
    store = new ContextStore(makeSupabaseMock({ error: null }) as never);
  });

  it('updates currentStage and status', () => {
    const initial = store.createInitialState('org-1', 'discovery');
    const next = store.updateStage(initial, 'analysis', 'in_progress');
    expect(next.currentStage).toBe('analysis');
    expect(next.status).toBe('in_progress');
  });

  it('appends previous stage to completed_steps when status is completed', () => {
    const initial = store.createInitialState('org-1', 'discovery');
    const next = store.updateStage(initial, 'analysis', 'completed');
    expect(next.completed_steps).toContain('discovery');
  });

  it('does not duplicate a stage already in completed_steps', () => {
    const initial = store.createInitialState('org-1', 'discovery');
    const mid = store.updateStage(initial, 'analysis', 'completed');
    const again = store.updateStage(mid, 'analysis', 'completed');
    const discoveryCount = again.completed_steps.filter((s) => s === 'discovery').length;
    expect(discoveryCount).toBe(1);
  });

  it('does not mutate the original state', () => {
    const initial = store.createInitialState('org-1', 'discovery');
    store.updateStage(initial, 'analysis', 'completed');
    expect(initial.currentStage).toBe('discovery');
    expect(initial.completed_steps).toHaveLength(0);
  });
});

// ============================================================================
// isWorkflowComplete / getProgress
// ============================================================================

describe('ContextStore helpers', () => {
  let store: ContextStore;

  beforeEach(() => {
    store = new ContextStore(makeSupabaseMock({ error: null }) as never);
  });

  it('isWorkflowComplete returns true only for completed status', () => {
    const base = store.createInitialState('org-1', 'discovery');
    expect(store.isWorkflowComplete({ ...base, status: 'completed' })).toBe(true);
    expect(store.isWorkflowComplete({ ...base, status: 'in_progress' })).toBe(false);
    expect(store.isWorkflowComplete({ ...base, status: 'error' })).toBe(false);
  });

  it('getProgress returns 0 with no completed steps', () => {
    const state = store.createInitialState('org-1', 'discovery');
    expect(store.getProgress(state, 5)).toBe(0);
  });

  it('getProgress returns 100 when all stages complete', () => {
    const state = store.createInitialState('org-1', 'discovery');
    const full = { ...state, completed_steps: ['a', 'b', 'c', 'd', 'e'] };
    expect(store.getProgress(full, 5)).toBe(100);
  });
});

// ============================================================================
// getExecutionStatus / getExecutionLogs — delegation
// ============================================================================

describe('ContextStore execution store delegation', () => {
  it('delegates getExecutionStatus to WorkflowExecutionStore', async () => {
    const { WorkflowExecutionStore } = await import('../../../services/workflows/WorkflowExecutionStore.js');
    const statusMock = vi.fn().mockResolvedValue({ status: 'completed' });
    vi.mocked(WorkflowExecutionStore).mockImplementationOnce(function () {
      return { getExecutionStatus: statusMock, getExecutionLogs: vi.fn().mockResolvedValue([]) } as never;
    });

    const store = new ContextStore(makeSupabaseMock({ error: null }) as never);
    const result = await store.getExecutionStatus('exec-1', 'org-1');
    expect(statusMock).toHaveBeenCalledWith('exec-1', 'org-1');
    expect(result).toEqual({ status: 'completed' });
  });

  it('delegates getExecutionLogs to WorkflowExecutionStore', async () => {
    const { WorkflowExecutionStore } = await import('../../../services/workflows/WorkflowExecutionStore.js');
    const logsMock = vi.fn().mockResolvedValue([{ id: 'log-1' }]);
    vi.mocked(WorkflowExecutionStore).mockImplementationOnce(function () {
      return { getExecutionStatus: vi.fn().mockResolvedValue(null), getExecutionLogs: logsMock } as never;
    });

    const store = new ContextStore(makeSupabaseMock({ error: null }) as never);
    const result = await store.getExecutionLogs('exec-1', 'org-1');
    expect(logsMock).toHaveBeenCalledWith('exec-1', 'org-1');
    expect(result).toEqual([{ id: 'log-1' }]);
  });
});

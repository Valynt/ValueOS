import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContextStore } from './index.js';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../lib/supabase', () => ({
  supabase: {},
}));

// uuid is not resolvable in the jsdom/vite test environment from this package;
// mock it so vite's import-analysis doesn't fail during transform.
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${Math.random().toString(36).slice(2)}`,
}));

vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/workflows/WorkflowExecutionStore', () => ({
  WorkflowExecutionStore: vi.fn(() => ({
    getExecutionStatus: vi.fn().mockResolvedValue(null),
    getExecutionLogs: vi.fn().mockResolvedValue([]),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSupabaseMock(updateError: { message: string } | null = null) {
  // Build a chainable mock: .from().update().eq().eq() → resolves { error }
  const terminalEq = vi.fn().mockResolvedValue({ error: updateError });
  const firstEq = vi.fn(() => ({ eq: terminalEq }));
  const updateMock = vi.fn(() => ({ eq: firstEq }));
  return {
    from: vi.fn(() => ({ update: updateMock })),
  };
}

// ---------------------------------------------------------------------------
// createInitialState
// ---------------------------------------------------------------------------

describe('ContextStore.createInitialState', () => {
  let store: ContextStore;

  beforeEach(() => {
    store = new ContextStore(makeSupabaseMock() as never);
  });

  it('returns a state with the given initial stage', () => {
    const state = store.createInitialState('discovery');
    expect(state.currentStage).toBe('discovery');
    expect(state.lifecycle_stage).toBe('discovery');
    expect(state.current_step).toBe('discovery');
  });

  it('sets status to initiated with empty completed_steps', () => {
    const state = store.createInitialState('discovery');
    expect(state.status).toBe('initiated');
    expect(state.completed_steps).toEqual([]);
  });

  it('initialises conversationHistory as empty array', () => {
    const state = store.createInitialState('discovery');
    expect(state.context?.conversationHistory).toEqual([]);
  });

  it('generates unique ids on each call', () => {
    const a = store.createInitialState('discovery');
    const b = store.createInitialState('discovery');
    expect(a.id).not.toBe(b.id);
    expect(a.execution_id).not.toBe(b.execution_id);
  });

  it('defaults intent to agent-query when not provided', () => {
    const state = store.createInitialState('discovery', {});
    expect((state.context as Record<string, unknown>).intent).toBe('agent-query');
  });
});

// ---------------------------------------------------------------------------
// updateStage
// ---------------------------------------------------------------------------

describe('ContextStore.updateStage', () => {
  let store: ContextStore;

  beforeEach(() => {
    store = new ContextStore(makeSupabaseMock() as never);
  });

  it('updates currentStage and status', () => {
    const initial = store.createInitialState('discovery');
    const next = store.updateStage(initial, 'analysis', 'in_progress');
    expect(next.currentStage).toBe('analysis');
    expect(next.status).toBe('in_progress');
  });

  it('appends previous stage to completed_steps when status is completed', () => {
    const initial = store.createInitialState('discovery');
    const next = store.updateStage(initial, 'analysis', 'completed');
    expect(next.completed_steps).toContain('discovery');
  });

  it('does not duplicate a stage already in completed_steps', () => {
    const initial = store.createInitialState('discovery');
    const mid = store.updateStage(initial, 'analysis', 'completed');
    const again = store.updateStage(mid, 'analysis', 'completed');
    const discoveryCount = again.completed_steps.filter((s) => s === 'discovery').length;
    expect(discoveryCount).toBe(1);
  });

  it('does not mutate the original state', () => {
    const initial = store.createInitialState('discovery');
    store.updateStage(initial, 'analysis', 'completed');
    expect(initial.currentStage).toBe('discovery');
    expect(initial.completed_steps).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// isWorkflowComplete / getProgress
// ---------------------------------------------------------------------------

describe('ContextStore helpers', () => {
  let store: ContextStore;

  beforeEach(() => {
    store = new ContextStore(makeSupabaseMock() as never);
  });

  it('isWorkflowComplete returns true only for completed status', () => {
    const base = store.createInitialState('discovery');
    expect(store.isWorkflowComplete({ ...base, status: 'completed' })).toBe(true);
    expect(store.isWorkflowComplete({ ...base, status: 'in_progress' })).toBe(false);
    expect(store.isWorkflowComplete({ ...base, status: 'error' })).toBe(false);
  });

  it('getProgress returns 0 with no completed steps', () => {
    const state = store.createInitialState('discovery');
    expect(store.getProgress(state, 5)).toBe(0);
  });

  it('getProgress returns 100 when all stages complete', () => {
    const state = store.createInitialState('discovery');
    const full = { ...state, completed_steps: ['a', 'b', 'c', 'd', 'e'] };
    expect(store.getProgress(full, 5)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// handleWorkflowFailure
// ---------------------------------------------------------------------------

describe('ContextStore.handleWorkflowFailure', () => {
  it('logs the workflow failure', async () => {
    const { logger } = await import('../../lib/logger.js');
    const store = new ContextStore(makeSupabaseMock() as never);
    await store.handleWorkflowFailure('exec-1', 'org-1', 'something went wrong');
    expect(logger.error).toHaveBeenCalledWith(
      'Workflow failed',
      undefined,
      expect.objectContaining({ executionId: 'exec-1', errorMessage: 'something went wrong' }),
    );
  });

  it('logs a DB error without throwing when the update fails', async () => {
    const { logger } = await import('../../lib/logger.js');
    const store = new ContextStore(makeSupabaseMock({ message: 'RLS violation' }) as never);
    await expect(
      store.handleWorkflowFailure('exec-1', 'org-1', 'failure'),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to record workflow failure in DB',
      undefined,
      expect.objectContaining({ dbError: 'RLS violation' }),
    );
  });
});

// ---------------------------------------------------------------------------
// getExecutionStatus / getExecutionLogs — delegation
// ---------------------------------------------------------------------------

describe('ContextStore execution store delegation', () => {
  it('delegates getExecutionStatus to WorkflowExecutionStore', async () => {
    const { WorkflowExecutionStore } = await import('../../services/workflows/WorkflowExecutionStore.js');
    const statusMock = vi.fn().mockResolvedValue({ status: 'completed' });
    vi.mocked(WorkflowExecutionStore).mockImplementationOnce(() => ({
      getExecutionStatus: statusMock,
      getExecutionLogs: vi.fn().mockResolvedValue([]),
    }) as never);

    const store = new ContextStore(makeSupabaseMock() as never);
    const result = await store.getExecutionStatus('exec-1', 'org-1');
    expect(statusMock).toHaveBeenCalledWith('exec-1', 'org-1');
    expect(result).toEqual({ status: 'completed' });
  });

  it('delegates getExecutionLogs to WorkflowExecutionStore', async () => {
    const { WorkflowExecutionStore } = await import('../../services/workflows/WorkflowExecutionStore.js');
    const logsMock = vi.fn().mockResolvedValue([{ id: 'log-1' }]);
    vi.mocked(WorkflowExecutionStore).mockImplementationOnce(() => ({
      getExecutionStatus: vi.fn().mockResolvedValue(null),
      getExecutionLogs: logsMock,
    }) as never);

    const store = new ContextStore(makeSupabaseMock() as never);
    const result = await store.getExecutionLogs('exec-1', 'org-1');
    expect(logsMock).toHaveBeenCalledWith('exec-1', 'org-1');
    expect(result).toEqual([{ id: 'log-1' }]);
  });
});

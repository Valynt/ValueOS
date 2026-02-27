import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckpointMiddleware } from '../CheckpointMiddleware.js';
import type { AgentMiddlewareContext, AgentResponse } from '../../UnifiedAgentOrchestrator.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function mockDeps() {
  return {
    workspaceStateService: {
      updateState: vi.fn().mockResolvedValue({}),
    },
    realtimeUpdateService: {
      pushUpdate: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function makeContext(overrides: Partial<AgentMiddlewareContext> = {}): AgentMiddlewareContext {
  return {
    envelope: {
      intent: 'general_query',
      actor: { id: 'user-1' },
      organizationId: 'org-1',
      entryPoint: 'processQuery',
      reason: 'test',
      timestamps: { requestedAt: new Date().toISOString() },
    },
    query: 'What is the revenue?',
    currentState: {
      currentStage: 'opportunity',
      status: 'in_progress',
      completedStages: [],
      context: {},
    } as any,
    userId: 'user-1',
    sessionId: 'sess-1',
    traceId: 'trace-1',
    agentType: 'opportunity',
    ...overrides,
  };
}

function safeNext(): () => Promise<AgentResponse> {
  return vi.fn().mockResolvedValue({ type: 'message', payload: { message: 'ok' } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CheckpointMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes through when action is not high-risk', async () => {
    const deps = mockDeps();
    const mw = new CheckpointMiddleware(deps);
    const next = safeNext();

    const result = await mw.execute(makeContext(), next);

    expect(next).toHaveBeenCalled();
    expect(result.payload.message).toBe('ok');
    expect(deps.workspaceStateService.updateState).not.toHaveBeenCalled();
  });

  it('creates a checkpoint when action is high-risk and resumes on approval', async () => {
    const deps = mockDeps();
    const mw = new CheckpointMiddleware(deps, { defaultTimeoutMs: 60_000 });
    const next = safeNext();
    const ctx = makeContext({ agentType: 'financial-modeling' });

    // Start execution (will block waiting for approval)
    const promise = mw.execute(ctx, next);

    // Flush microtasks so the async code before awaitApproval completes
    await vi.advanceTimersByTimeAsync(0);

    // Checkpoint should be pending
    expect(mw.pending.size).toBe(1);
    const checkpointId = Array.from(mw.pending.keys())[0];

    // Verify state was persisted
    expect(deps.workspaceStateService.updateState).toHaveBeenCalled();

    // Verify notification was pushed
    expect(deps.realtimeUpdateService.pushUpdate).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ type: 'human_intervention_required' }),
    );

    // Approve the checkpoint
    const resolved = mw.resolveCheckpoint(checkpointId, 'approved');
    expect(resolved).toBe(true);

    const result = await promise;
    expect(next).toHaveBeenCalled();
    expect(result.payload.message).toBe('ok');
    expect(mw.pending.size).toBe(0);
  });

  it('returns rejection response when checkpoint is rejected', async () => {
    const deps = mockDeps();
    const mw = new CheckpointMiddleware(deps, { defaultTimeoutMs: 60_000 });
    const next = safeNext();
    const ctx = makeContext({ agentType: 'financial-modeling' });

    const promise = mw.execute(ctx, next);
    await vi.advanceTimersByTimeAsync(0);

    const checkpointId = Array.from(mw.pending.keys())[0];
    mw.resolveCheckpoint(checkpointId, 'rejected', {
      reason: 'Too risky',
      resolvedBy: 'admin-1',
    });

    const result = await promise;
    expect(next).not.toHaveBeenCalled();
    expect(result.payload.error).toBe(true);
    expect(result.payload.message).toContain('rejected');
  });

  it('times out and returns abort response', async () => {
    const deps = mockDeps();
    const mw = new CheckpointMiddleware(deps, { defaultTimeoutMs: 1000 });
    const next = safeNext();
    const ctx = makeContext({ agentType: 'financial-modeling' });

    const promise = mw.execute(ctx, next);

    // Advance time past the timeout
    await vi.advanceTimersByTimeAsync(1500);

    const result = await promise;
    expect(next).not.toHaveBeenCalled();
    expect(result.payload.error).toBe(true);
    expect(result.payload.message).toContain('timed out');
    expect(mw.pending.size).toBe(0);
  });

  it('bypasses checkpoint for privileged roles', async () => {
    const deps = mockDeps();
    const mw = new CheckpointMiddleware(deps, { bypassRoles: ['admin'] });
    const next = safeNext();
    const ctx = makeContext({ agentType: 'financial-modeling' });
    ctx.envelope.actor.roles = ['admin'];

    const result = await mw.execute(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(result.payload.message).toBe('ok');
    expect(mw.pending.size).toBe(0);
  });

  it('passes through when disabled', async () => {
    const deps = mockDeps();
    const mw = new CheckpointMiddleware(deps, { enabled: false });
    const next = safeNext();
    const ctx = makeContext({ agentType: 'financial-modeling' });

    const result = await mw.execute(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(result.payload.message).toBe('ok');
  });

  describe('resolveCheckpoint', () => {
    it('returns false for unknown checkpoint ID', () => {
      const deps = mockDeps();
      const mw = new CheckpointMiddleware(deps);

      expect(mw.resolveCheckpoint('nonexistent', 'approved')).toBe(false);
    });
  });

  describe('getCheckpoint', () => {
    it('returns the record for a pending checkpoint', async () => {
      const deps = mockDeps();
      const mw = new CheckpointMiddleware(deps, { defaultTimeoutMs: 60_000 });
      const next = safeNext();
      const ctx = makeContext({ agentType: 'financial-modeling' });

      // Start execution (will block)
      const promise = mw.execute(ctx, next);
      await vi.advanceTimersByTimeAsync(0);

      const checkpointId = Array.from(mw.pending.keys())[0];
      const record = mw.getCheckpoint(checkpointId);

      expect(record).toBeDefined();
      expect(record!.status).toBe('pending');
      expect(record!.agentType).toBe('financial-modeling');

      // Clean up
      mw.resolveCheckpoint(checkpointId, 'approved');
      await promise;
    });

    it('returns undefined for unknown checkpoint', () => {
      const deps = mockDeps();
      const mw = new CheckpointMiddleware(deps);

      expect(mw.getCheckpoint('nonexistent')).toBeUndefined();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HandoverMiddleware } from '../HandoverMiddleware.js';
import type { AgentMiddlewareContext, AgentResponse } from '../../UnifiedAgentOrchestrator.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function mockDeps(overrides: Record<string, any> = {}) {
  return {
    agentRegistry: {
      getAgent: vi.fn().mockReturnValue(undefined),
      getAgentsByLifecycle: vi.fn().mockReturnValue([]),
    },
    messageBroker: {
      sendToAgent: vi.fn().mockResolvedValue({ success: true, data: { result: 42 } }),
    },
    toolRegistry: {
      get: vi.fn().mockReturnValue(undefined),
      execute: vi.fn().mockResolvedValue({ success: true, data: { toolResult: 'ok' } }),
    },
    collaborationService: {
      emit: vi.fn(),
    },
    ...overrides,
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

function nextWithCapabilityRequest(
  capReq: Record<string, unknown>,
): () => Promise<AgentResponse> {
  return vi.fn().mockResolvedValue({
    type: 'message',
    payload: {
      message: 'base response',
      capabilityRequest: capReq,
    },
  });
}

function nextWithoutCapabilityRequest(): () => Promise<AgentResponse> {
  return vi.fn().mockResolvedValue({
    type: 'message',
    payload: { message: 'plain response' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HandoverMiddleware', () => {
  it('passes through when no CapabilityRequest in response', async () => {
    const deps = mockDeps();
    const mw = new HandoverMiddleware(deps);
    const next = nextWithoutCapabilityRequest();

    const result = await mw.execute(makeContext(), next);

    expect(result.payload.message).toBe('plain response');
    expect(deps.messageBroker.sendToAgent).not.toHaveBeenCalled();
    expect(deps.toolRegistry.execute).not.toHaveBeenCalled();
  });

  it('dispatches to an agent when capability matches', async () => {
    const deps = mockDeps({
      agentRegistry: {
        getAgent: vi.fn(),
        getAgentsByLifecycle: vi.fn().mockImplementation((stage: string) => {
          if (stage === 'opportunity') {
            return [{ id: 'fin-agent-1', capabilities: ['financial_projection'] }];
          }
          return [];
        }),
      },
    });
    const mw = new HandoverMiddleware(deps);
    const next = nextWithCapabilityRequest({
      capability: 'financial_projection',
      inputData: { revenue: 1000 },
      mergeKey: 'projection',
    });

    const result = await mw.execute(makeContext(), next);

    expect(deps.messageBroker.sendToAgent).toHaveBeenCalledWith(
      'orchestrator',
      'fin-agent-1',
      expect.objectContaining({ capability: 'financial_projection' }),
      expect.any(Object),
    );
    expect(result.payload.projection).toEqual({ result: 42 });
    expect(deps.collaborationService.emit).toHaveBeenCalledWith(
      'handover',
      expect.objectContaining({ success: true, toAgent: 'fin-agent-1' }),
    );
  });

  it('falls back to tool registry when no agent matches', async () => {
    const deps = mockDeps({
      toolRegistry: {
        get: vi.fn().mockReturnValue({ name: 'financial_projection' }),
        execute: vi.fn().mockResolvedValue({ success: true, data: { projected: 500 } }),
      },
    });
    const mw = new HandoverMiddleware(deps);
    const next = nextWithCapabilityRequest({
      capability: 'financial_projection',
      inputData: { revenue: 1000 },
      mergeKey: 'projection',
    });

    const result = await mw.execute(makeContext(), next);

    expect(deps.toolRegistry.execute).toHaveBeenCalledWith(
      'financial_projection',
      { revenue: 1000 },
      expect.objectContaining({ userId: 'user-1' }),
    );
    expect(result.payload.projection).toEqual({ projected: 500 });
  });

  it('appends a warning when no agent or tool found', async () => {
    const deps = mockDeps();
    const mw = new HandoverMiddleware(deps);
    const next = nextWithCapabilityRequest({
      capability: 'nonexistent_capability',
      inputData: {},
      mergeKey: 'result',
    });

    const result = await mw.execute(makeContext(), next);

    expect(result.payload.warnings).toBeDefined();
    expect(result.payload.warnings[0]).toContain('nonexistent_capability');
    // Original response data should still be present
    expect(result.payload.message).toBe('base response');
  });

  it('applies output mapping', async () => {
    const deps = mockDeps({
      agentRegistry: {
        getAgent: vi.fn(),
        getAgentsByLifecycle: vi.fn().mockImplementation((stage: string) => {
          if (stage === 'opportunity') {
            return [{ id: 'agent-1', capabilities: ['calc'] }];
          }
          return [];
        }),
      },
      messageBroker: {
        sendToAgent: vi.fn().mockResolvedValue({
          success: true,
          data: { sourceField: 'value123', extra: 'data' },
        }),
      },
    });
    const mw = new HandoverMiddleware(deps);
    const next = nextWithCapabilityRequest({
      capability: 'calc',
      inputData: {},
      mergeKey: 'mapped',
      outputMapping: { sourceField: 'targetField' },
    });

    const result = await mw.execute(makeContext(), next);

    expect(result.payload.mapped.targetField).toBe('value123');
    expect(result.payload.mapped.extra).toBe('data');
  });

  it('logs collaboration event on handover', async () => {
    const deps = mockDeps({
      agentRegistry: {
        getAgent: vi.fn(),
        getAgentsByLifecycle: vi.fn().mockReturnValue([
          { id: 'agent-1', capabilities: ['cap'] },
        ]),
      },
    });
    const mw = new HandoverMiddleware(deps);
    const next = nextWithCapabilityRequest({
      capability: 'cap',
      inputData: {},
      mergeKey: 'out',
    });

    await mw.execute(makeContext(), next);

    expect(deps.collaborationService.emit).toHaveBeenCalledWith(
      'handover',
      expect.objectContaining({
        fromAgent: 'opportunity',
        toAgent: 'agent-1',
        capability: 'cap',
        success: true,
      }),
    );
  });
});

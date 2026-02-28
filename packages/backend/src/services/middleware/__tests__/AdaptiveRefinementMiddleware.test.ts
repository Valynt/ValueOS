import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentMiddlewareContext, AgentResponse } from '../../UnifiedAgentOrchestrator.js';
import { AdaptiveRefinementMiddleware } from '../AdaptiveRefinementMiddleware.js';

// Mock logger
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

function createMockContext(): AgentMiddlewareContext {
  return {
    envelope: {
      intent: 'test',
      actor: { id: 'user-1' },
      organizationId: 'org-1',
      entryPoint: 'test',
      reason: 'test',
      timestamps: { requestedAt: new Date().toISOString() },
    },
    query: 'Analyze ROI',
    currentState: { currentStage: 'analysis', status: 'in_progress', completedStages: [], context: {} } as any,
    userId: 'user-1',
    sessionId: 'session-1',
    traceId: 'trace-1',
    agentType: 'financial-modeling',
  };
}

describe('AdaptiveRefinementMiddleware', () => {
  let reflectionEngine: any;
  let costAwareRouter: any;
  let costTracker: any;
  let agentAPI: any;
  let middleware: AdaptiveRefinementMiddleware;

  beforeEach(() => {
    reflectionEngine = {
      evaluate: vi.fn().mockResolvedValue({
        overallScore: 8.5,
        passesThreshold: true,
        refinementNeeded: false,
        categoryScores: {},
        criteriaResults: [],
      }),
    };

    costAwareRouter = {
      routeRequest: vi.fn().mockResolvedValue({
        useModel: 'claude-3-sonnet',
        provider: 'anthropic',
        fallbackToBasic: false,
        reason: 'Selected for high priority',
        estimatedCost: 0.005,
      }),
    };

    costTracker = {
      trackUsage: vi.fn().mockResolvedValue(undefined),
    };

    agentAPI = {
      invokeAgent: vi.fn().mockResolvedValue({
        success: true,
        data: { message: 'Refined output' },
        metadata: { agent: 'financial-modeling', duration: 100, timestamp: new Date().toISOString(), tokens: { prompt: 100, completion: 50, total: 150 } },
      }),
    };

    middleware = new AdaptiveRefinementMiddleware(
      reflectionEngine,
      costAwareRouter,
      costTracker,
      agentAPI
    );
  });

  it('implements AgentMiddleware interface', () => {
    expect(middleware.name).toBe('adaptive_refinement');
    expect(typeof middleware.execute).toBe('function');
  });

  it('passes through when score is above threshold', async () => {
    const context = createMockContext();
    const originalResponse: AgentResponse = {
      type: 'message',
      payload: { message: 'Good output' },
    };
    const next = vi.fn().mockResolvedValue(originalResponse);

    const result = await middleware.execute(context, next);

    expect(next).toHaveBeenCalled();
    expect(result.payload.message).toBe('Good output');
    expect((result.metadata as any)?.refinement?.wasRefined).toBe(false);
    expect((result.metadata as any)?.refinement?.originalScore).toBe(8.5);
  });

  it('attempts refinement when score is below threshold', async () => {
    reflectionEngine.evaluate
      .mockResolvedValueOnce({
        overallScore: 5.0,
        passesThreshold: false,
        refinementNeeded: true,
        refinementPlan: ['Improve clarity', 'Add data sources'],
        categoryScores: {},
        criteriaResults: [],
      })
      .mockResolvedValueOnce({
        overallScore: 8.0,
        passesThreshold: true,
        refinementNeeded: false,
        categoryScores: {},
        criteriaResults: [],
      });

    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'Weak output' },
    } as AgentResponse);

    const result = await middleware.execute(context, next);

    expect(agentAPI.invokeAgent).toHaveBeenCalled();
    expect(costTracker.trackUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        caller: 'AdaptiveRefinementMiddleware',
        endpoint: 'adaptive_refinement',
      })
    );
    expect((result.metadata as any)?.refinement?.wasRefined).toBe(true);
    expect((result.metadata as any)?.refinement?.originalScore).toBe(5.0);
    expect((result.metadata as any)?.refinement?.refinedScore).toBe(8.0);
  });

  it('returns original when refinement does not improve score', async () => {
    reflectionEngine.evaluate
      .mockResolvedValueOnce({
        overallScore: 5.0,
        passesThreshold: false,
        refinementNeeded: true,
        refinementPlan: ['Improve clarity'],
        categoryScores: {},
        criteriaResults: [],
      })
      .mockResolvedValueOnce({
        overallScore: 4.0,
        passesThreshold: false,
        refinementNeeded: true,
        categoryScores: {},
        criteriaResults: [],
      });

    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'Weak output' },
    } as AgentResponse);

    const result = await middleware.execute(context, next);

    // Should return original with wasRefined=false since refinement didn't help
    expect((result.metadata as any)?.refinement?.wasRefined).toBe(false);
    expect(result.payload.message).toBe('Weak output');
  });

  it('passes through error responses without evaluation', async () => {
    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'Error occurred', error: true },
    } as AgentResponse);

    const result = await middleware.execute(context, next);

    expect(reflectionEngine.evaluate).not.toHaveBeenCalled();
    expect(result.payload.error).toBe(true);
  });

  it('passes through clarification_needed responses', async () => {
    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'clarification_needed' as any,
      payload: { message: 'Need more info' },
    } as AgentResponse);

    const result = await middleware.execute(context, next);

    expect(reflectionEngine.evaluate).not.toHaveBeenCalled();
    expect(result.type).toBe('clarification_needed');
  });

  it('does not retry more than once', async () => {
    reflectionEngine.evaluate.mockResolvedValue({
      overallScore: 3.0,
      passesThreshold: false,
      refinementNeeded: true,
      refinementPlan: ['Fix everything'],
      categoryScores: {},
      criteriaResults: [],
    });

    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'Bad output' },
    } as AgentResponse);

    await middleware.execute(context, next);

    // agentAPI.invokeAgent should be called exactly once (1 refinement attempt)
    expect(agentAPI.invokeAgent).toHaveBeenCalledTimes(1);
  });

  it('handles reflection engine failure gracefully', async () => {
    reflectionEngine.evaluate.mockRejectedValue(new Error('Reflection failed'));

    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'Output' },
    } as AgentResponse);

    const result = await middleware.execute(context, next);

    // Should pass through the original response
    expect(result.payload.message).toBe('Output');
  });

  it('respects enabled=false config', async () => {
    const disabledMiddleware = new AdaptiveRefinementMiddleware(
      reflectionEngine,
      costAwareRouter,
      costTracker,
      agentAPI,
      { enabled: false }
    );

    reflectionEngine.evaluate.mockResolvedValue({
      overallScore: 3.0,
      passesThreshold: false,
      refinementNeeded: true,
    });

    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'Output' },
    } as AgentResponse);

    const result = await disabledMiddleware.execute(context, next);

    expect(reflectionEngine.evaluate).not.toHaveBeenCalled();
    expect(result.payload.message).toBe('Output');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentMiddlewareContext, AgentResponse } from '../../../types/orchestration.js';
import { SemanticIntentMiddleware } from '../SemanticIntentMiddleware.js';

// Mock logger and supabase
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('../../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn() }) }),
    }),
  },
}));

function createMockContext(overrides: Partial<AgentMiddlewareContext> = {}): AgentMiddlewareContext {
  return {
    envelope: {
      intent: 'test',
      actor: { id: 'user-1' },
      organizationId: 'org-1',
      entryPoint: 'test',
      reason: 'test',
      timestamps: { requestedAt: new Date().toISOString() },
    },
    query: 'Analyze the ROI for our new product',
    currentState: { currentStage: 'analysis', status: 'in_progress', completedStages: [], context: {} } as any,
    userId: 'user-1',
    sessionId: 'session-1',
    traceId: 'trace-1',
    agentType: 'coordinator',
    ...overrides,
  };
}

describe('SemanticIntentMiddleware', () => {
  let embeddingService: any;
  let vectorSearch: any;
  let llmGateway: any;
  let middleware: SemanticIntentMiddleware;

  const fakeEmbedding = [0.1, 0.2, 0.3];

  beforeEach(() => {
    embeddingService = {
      generateEmbedding: vi.fn().mockResolvedValue(fakeEmbedding),
    };

    vectorSearch = {
      searchByEmbedding: vi.fn().mockResolvedValue([]),
    };

    llmGateway = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          intent: 'analyze_roi',
          confidence: 0.9,
          category: 'analysis',
          parameters: [],
          secondaryIntent: null,
          secondaryConfidence: 0,
          resolvedAgent: 'financial-modeling',
        }),
      }),
    };

    middleware = new SemanticIntentMiddleware(embeddingService, vectorSearch, llmGateway);
  });

  it('implements AgentMiddleware interface', () => {
    expect(middleware.name).toBe('semantic_intent');
    expect(typeof middleware.execute).toBe('function');
  });

  it('routes to agent based on LLM classification when no historical match', async () => {
    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'ROI analysis complete' },
    } as AgentResponse);

    const result = await middleware.execute(context, next);

    expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(context.query);
    expect(vectorSearch.searchByEmbedding).toHaveBeenCalled();
    expect(llmGateway.complete).toHaveBeenCalled();
    expect(context.agentType).toBe('financial-modeling');
    expect(next).toHaveBeenCalled();
    expect(result.type).toBe('message');
  });

  it('uses historical match when similarity >= 0.85', async () => {
    vectorSearch.searchByEmbedding.mockResolvedValue([
      {
        memory: {
          id: 'mem-1',
          content: 'analyze roi',
          metadata: { agentType: 'financial-modeling', wasSuccessful: true },
        },
        similarity: 0.92,
      },
    ]);

    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'done' },
    } as AgentResponse);

    await middleware.execute(context, next);

    // Should NOT call LLM since historical match was used
    expect(llmGateway.complete).not.toHaveBeenCalled();
    expect(context.agentType).toBe('financial-modeling');
    expect(next).toHaveBeenCalled();
  });

  it('returns clarification_needed when ambiguity is high', async () => {
    llmGateway.complete.mockResolvedValue({
      content: JSON.stringify({
        intent: 'analyze_roi',
        confidence: 0.5,
        category: 'analysis',
        parameters: [
          { name: 'product', type: 'string', required: true, value: null, description: 'Product name' },
        ],
        secondaryIntent: 'benchmark',
        secondaryConfidence: 0.45,
        resolvedAgent: 'financial-modeling',
      }),
    });

    const context = createMockContext();
    const next = vi.fn();

    const result = await middleware.execute(context, next);

    expect(result.type).toBe('clarification_needed');
    expect(result.payload).toHaveProperty('missingParameters');
    expect(result.payload.missingParameters).toHaveLength(1);
    expect(next).not.toHaveBeenCalled(); // Short-circuited
  });

  it('skips classification when clarification context is provided', async () => {
    const context = createMockContext({
      payload: { clarification: { product: 'Widget Pro' } },
    });
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'done' },
    } as AgentResponse);

    await middleware.execute(context, next);

    expect(embeddingService.generateEmbedding).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('falls through to next() on embedding failure', async () => {
    embeddingService.generateEmbedding.mockRejectedValue(new Error('API down'));

    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'fallback' },
    } as AgentResponse);

    const result = await middleware.execute(context, next);

    expect(next).toHaveBeenCalled();
    expect(result.payload.message).toBe('fallback');
  });
});

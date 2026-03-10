import { describe, expect, it, vi } from 'vitest';

import type { AgentMiddleware, AgentMiddlewareContext, AgentResponse } from '../../../types/orchestration.js';

// Mock logger
vi.mock('../../../lib/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

/**
 * Standalone test for the middleware chain execution logic.
 * We extract the chain-building algorithm to test it independently
 * of the full UnifiedAgentOrchestrator.
 */

async function executeMiddlewareChain(
  middleware: AgentMiddleware[],
  context: AgentMiddlewareContext,
  coreFn: () => Promise<AgentResponse>
): Promise<AgentResponse> {
  if (middleware.length === 0) {
    return coreFn();
  }

  let chain = coreFn;
  for (let i = middleware.length - 1; i >= 0; i--) {
    const mw = middleware[i];
    const nextFn = chain;
    chain = () => mw.execute(context, nextFn);
  }

  return chain();
}

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
    query: 'test query',
    currentState: { currentStage: 'test', status: 'in_progress', completedStages: [], context: {} } as any,
    userId: 'user-1',
    sessionId: 'session-1',
    traceId: 'trace-1',
    agentType: 'coordinator',
  };
}

describe('executeMiddlewareChain', () => {
  it('calls coreFn directly when no middleware', async () => {
    const coreFn = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'core' },
    } as AgentResponse);

    const result = await executeMiddlewareChain([], createMockContext(), coreFn);

    expect(coreFn).toHaveBeenCalledOnce();
    expect(result.payload.message).toBe('core');
  });

  it('executes middleware in order (first middleware is outermost)', async () => {
    const order: string[] = [];

    const mw1: AgentMiddleware = {
      name: 'first',
      execute: async (ctx, next) => {
        order.push('first-before');
        const result = await next();
        order.push('first-after');
        return result;
      },
    };

    const mw2: AgentMiddleware = {
      name: 'second',
      execute: async (ctx, next) => {
        order.push('second-before');
        const result = await next();
        order.push('second-after');
        return result;
      },
    };

    const coreFn = vi.fn().mockImplementation(async () => {
      order.push('core');
      return { type: 'message', payload: { message: 'core' } } as AgentResponse;
    });

    await executeMiddlewareChain([mw1, mw2], createMockContext(), coreFn);

    expect(order).toEqual([
      'first-before',
      'second-before',
      'core',
      'second-after',
      'first-after',
    ]);
  });

  it('allows middleware to short-circuit (not call next)', async () => {
    const shortCircuit: AgentMiddleware = {
      name: 'short_circuit',
      execute: async (_ctx, _next) => {
        return {
          type: 'clarification_needed' as any,
          payload: { message: 'Need more info' },
        };
      },
    };

    const coreFn = vi.fn();

    const result = await executeMiddlewareChain(
      [shortCircuit],
      createMockContext(),
      coreFn
    );

    expect(coreFn).not.toHaveBeenCalled();
    expect(result.type).toBe('clarification_needed');
  });

  it('allows middleware to modify context before next()', async () => {
    const modifier: AgentMiddleware = {
      name: 'modifier',
      execute: async (ctx, next) => {
        ctx.agentType = 'financial-modeling';
        return next();
      },
    };

    const context = createMockContext();
    const coreFn = vi.fn().mockImplementation(async () => {
      return {
        type: 'message',
        payload: { agent: context.agentType },
      } as AgentResponse;
    });

    await executeMiddlewareChain([modifier], context, coreFn);

    expect(context.agentType).toBe('financial-modeling');
  });

  it('allows middleware to modify response after next()', async () => {
    const enricher: AgentMiddleware = {
      name: 'enricher',
      execute: async (_ctx, next) => {
        const response = await next();
        return {
          ...response,
          metadata: { enriched: true } as any,
        };
      },
    };

    const coreFn = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'core' },
    } as AgentResponse);

    const result = await executeMiddlewareChain(
      [enricher],
      createMockContext(),
      coreFn
    );

    expect((result.metadata as any)?.enriched).toBe(true);
  });

  it('propagates errors from middleware', async () => {
    const failing: AgentMiddleware = {
      name: 'failing',
      execute: async () => {
        throw new Error('Middleware error');
      },
    };

    const coreFn = vi.fn();

    await expect(
      executeMiddlewareChain([failing], createMockContext(), coreFn)
    ).rejects.toThrow('Middleware error');
  });

  it('propagates errors from coreFn through middleware', async () => {
    const wrapper: AgentMiddleware = {
      name: 'wrapper',
      execute: async (_ctx, next) => {
        return next();
      },
    };

    const coreFn = vi.fn().mockRejectedValue(new Error('Core error'));

    await expect(
      executeMiddlewareChain([wrapper], createMockContext(), coreFn)
    ).rejects.toThrow('Core error');
  });

  it('handles three middleware in correct order', async () => {
    const order: string[] = [];

    const pre: AgentMiddleware = {
      name: 'pre',
      execute: async (ctx, next) => {
        order.push('pre');
        return next();
      },
    };

    const logger: AgentMiddleware = {
      name: 'logger',
      execute: async (ctx, next) => {
        order.push('logger-start');
        const r = await next();
        order.push('logger-end');
        return r;
      },
    };

    const post: AgentMiddleware = {
      name: 'post',
      execute: async (ctx, next) => {
        const r = await next();
        order.push('post');
        return r;
      },
    };

    const coreFn = vi.fn().mockImplementation(async () => {
      order.push('core');
      return { type: 'message', payload: {} } as AgentResponse;
    });

    await executeMiddlewareChain([pre, logger, post], createMockContext(), coreFn);

    expect(order).toEqual(['pre', 'logger-start', 'core', 'post', 'logger-end']);
  });
});

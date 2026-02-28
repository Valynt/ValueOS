import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentMiddlewareContext, AgentResponse } from '../../UnifiedAgentOrchestrator.js';
import { ReasoningLoggerMiddleware } from '../ReasoningLoggerMiddleware.js';
import type { ReasoningChain } from '../ReasoningLoggerMiddleware.js';

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

describe('ReasoningLoggerMiddleware', () => {
  let broadcasts: Array<{ tenantId: string; chain: ReasoningChain }>;
  let broadcastFn: (tenantId: string, chain: ReasoningChain) => void;
  let middleware: ReasoningLoggerMiddleware;

  beforeEach(() => {
    broadcasts = [];
    broadcastFn = (tenantId, chain) => {
      broadcasts.push({ tenantId, chain: { ...chain, nodes: [...chain.nodes] } });
    };
    middleware = new ReasoningLoggerMiddleware(broadcastFn);
  });

  it('implements AgentMiddleware interface', () => {
    expect(middleware.name).toBe('reasoning_logger');
    expect(typeof middleware.execute).toBe('function');
  });

  it('broadcasts in_progress at start and completed at end', async () => {
    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'done' },
    } as AgentResponse);

    await middleware.execute(context, next);

    expect(broadcasts.length).toBeGreaterThanOrEqual(2);
    expect(broadcasts[0].chain.status).toBe('in_progress');
    expect(broadcasts[broadcasts.length - 1].chain.status).toBe('completed');
    expect(broadcasts[broadcasts.length - 1].chain.endTime).toBeDefined();
    expect(broadcasts[broadcasts.length - 1].chain.totalDuration).toBeGreaterThanOrEqual(0);
  });

  it('broadcasts to the correct tenant', async () => {
    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'done' },
    } as AgentResponse);

    await middleware.execute(context, next);

    for (const b of broadcasts) {
      expect(b.tenantId).toBe('org-1');
    }
  });

  it('broadcasts failed status on error', async () => {
    const context = createMockContext();
    const next = vi.fn().mockRejectedValue(new Error('Agent crashed'));

    await expect(middleware.execute(context, next)).rejects.toThrow('Agent crashed');

    const lastBroadcast = broadcasts[broadcasts.length - 1];
    expect(lastBroadcast.chain.status).toBe('failed');
    expect(lastBroadcast.chain.nodes.some((n) => n.content.includes('Error'))).toBe(true);
  });

  it('extracts reasoning_steps from response payload', async () => {
    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: {
        message: 'done',
        reasoning_steps: [
          { type: 'reasoning', content: 'Analyzing financial data' },
          { type: 'decision', content: 'ROI is 15%' },
        ],
      },
    } as AgentResponse);

    await middleware.execute(context, next);

    const lastBroadcast = broadcasts[broadcasts.length - 1];
    expect(lastBroadcast.chain.nodes.length).toBeGreaterThanOrEqual(2);
    expect(lastBroadcast.chain.nodes.some((n) => n.content.includes('financial data'))).toBe(true);
  });

  it('scrubs PII from reasoning content', async () => {
    const context = createMockContext();
    context.query = 'Query from john@test.com';
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: {
        message: 'done',
        reasoning_steps: [
          { type: 'reasoning', content: 'User email is john@test.com, SSN 123-45-6789' },
        ],
      },
    } as AgentResponse);

    await middleware.execute(context, next);

    const lastBroadcast = broadcasts[broadcasts.length - 1];
    // Check root thought is scrubbed
    expect(lastBroadcast.chain.rootThought).not.toContain('john@test.com');
    // Check reasoning nodes are scrubbed
    for (const node of lastBroadcast.chain.nodes) {
      expect(node.content).not.toContain('john@test.com');
      expect(node.content).not.toContain('123-45-6789');
    }
  });

  it('handles broadcast failures gracefully', async () => {
    const failingBroadcast = vi.fn().mockImplementation(() => {
      throw new Error('WebSocket down');
    });
    const mw = new ReasoningLoggerMiddleware(failingBroadcast);

    const context = createMockContext();
    const next = vi.fn().mockResolvedValue({
      type: 'message',
      payload: { message: 'done' },
    } as AgentResponse);

    // Should not throw even though broadcast fails
    const result = await mw.execute(context, next);
    expect(result.type).toBe('message');
  });
});

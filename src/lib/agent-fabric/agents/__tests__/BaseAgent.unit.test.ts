import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../BaseAgent';
import { z } from 'zod';

class TestAgent extends BaseAgent {
  public lifecycleStage = 'test';
  public version = '1.0';
  public name = 'Test Agent';

  async execute(sessionId: string, input: any) {
    const schema = z.object({ result: z.string(), confidence_level: z.enum(['high', 'medium', 'low']), reasoning: z.string() });
    const secure = await (this as any).secureInvoke(sessionId, input, schema, { trackPrediction: true });
    return secure.result;
  }
}

describe('BaseAgent Secure Invocation', () => {
  const sessionId = 's-1';
  const organizationId = 'org-1';
  let llmGatewayMock: any;
  let memorySystemMock: any;
  let auditLoggerMock: any;

  beforeEach(() => {
    llmGatewayMock = {
      complete: vi.fn(async () => ({
        content: JSON.stringify({ result: 'ok', confidence_level: 'high', reasoning: 'unit test' }),
        tokens_used: 1,
        latency_ms: 5,
        model: 'gpt-test',
      })),
    };

    memorySystemMock = {
      storeSemanticMemory: vi.fn(async () => null),
    };

    auditLoggerMock = {
      logExecution: vi.fn(async () => null),
      logMetric: vi.fn(async () => null),
      logPerformanceMetric: vi.fn(async () => null),
    };
  });

  it('executes secureInvoke through subclass and returns validated result', async () => {
    const config = {
      id: 'test-agent',
      organizationId,
      sessionId,
      llmGateway: llmGatewayMock,
      memorySystem: memorySystemMock,
      auditLogger: auditLoggerMock,
      supabase: {},
    } as any;

    const agent = new TestAgent(config);
    const out = await agent.execute(sessionId, { query: 'hello' });

    expect(llmGatewayMock.complete).toHaveBeenCalled();
    expect(out.result).toBe('ok');
    expect(out.confidence_level).toBe('high');
  });
});

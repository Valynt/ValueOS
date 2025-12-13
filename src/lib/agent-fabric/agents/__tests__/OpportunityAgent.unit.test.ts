import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpportunityAgent } from '../OpportunityAgent';

describe('OpportunityAgent', () => {
  const sessionId = 'session-1';
  const organizationId = 'org-test';
  let llmGatewayMock: any;
  let memorySystemMock: any;
  let auditLoggerMock: any;
  let agent: OpportunityAgent;

  beforeEach(() => {
    llmGatewayMock = {
      complete: vi.fn(async () => ({
        content: JSON.stringify({
          opportunity_summary: 'Test opportunity',
          confidence_level: 'high',
          reasoning: 'Test reasoning',
        }),
        tokens_used: 10,
        latency_ms: 10,
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

    const config = {
      id: 'op-agent-1',
      organizationId,
      sessionId,
      llmGateway: llmGatewayMock,
      memorySystem: memorySystemMock,
      auditLogger: auditLoggerMock,
      supabase: {},
    } as any;

    agent = new OpportunityAgent(config);
    // Replace the internal findRelevantCapabilities to avoid external service calls
    // Keep it synchronous for the unit test
    (agent as any).findRelevantCapabilities = vi.fn(async () => [
      { id: 'cap-1', name: 'Mock Cap' },
    ]);
  });

  it('calls LLM gateway and stores memory with organizationId', async () => {
    const input = {
      discoveryData: ['call transcript 1'],
      customerProfile: { name: 'Acme Corp' },
    } as any;

    const output = await agent.execute(sessionId, input);

    expect(llmGatewayMock.complete).toHaveBeenCalled();
    expect(memorySystemMock.storeSemanticMemory).toHaveBeenCalled();
    const args = memorySystemMock.storeSemanticMemory.mock.calls[0];
    // organizationId should be passed to memory storage for tenant isolation
    expect(args[4]).toBe(organizationId);
    expect(output.opportunitySummary).toBeDefined();
  });
});

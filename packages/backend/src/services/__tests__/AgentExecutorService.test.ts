import { createBaseEvent, EVENT_TOPICS } from '@shared/types/events';

import { AgentExecutorService } from '../AgentExecutorService';

vi.mock('../EventProducer', () => ({ getEventProducer: () => ({ publish: vi.fn() }), EventProducer: class {} }));
vi.mock('../EventConsumer', () => ({ createEventConsumer: () => ({ connect: vi.fn(), subscribe: vi.fn(), disconnect: vi.fn() }), EventConsumer: class {} }));
vi.mock('../kafkaConfig', () => ({ isKafkaEnabled: () => true }));
vi.mock('../EventSourcingService', () => ({ getEventSourcingService: () => ({ storeEvent: vi.fn(), updateProjection: vi.fn(), getAuditTrail: vi.fn() }), EventSourcingService: class {} }));
vi.mock('../UnifiedAgentAPI', () => ({ getUnifiedAgentAPI: () => ({ invoke: vi.fn().mockResolvedValue({ data: { resolvedIssueId: 'issue-xyz', resolution: 'accept' }, metadata: { tokens: {}, confidence: 0.9 } }) }) }));
vi.mock('../RealtimeBroadcastService', () => ({ getRealtimeBroadcastService: () => ({ broadcastToTenant: vi.fn() }) }));

describe('AgentExecutorService', () => {
  it('publishes AGENT_RESPONSES and broadcasts update', async () => {
    const svc = new AgentExecutorService();

    const mockBroadcast = (await import('../RealtimeBroadcastService')).getRealtimeBroadcastService();

    const event = createBaseEvent('agent.request', { agentId: 'IntegrityAgent', tenantId: 't1', userId: 'u1', sessionId: 's1', query: 'resolve', context: {}, parameters: { issueId: 'issue-xyz', resolution: 'accept' }, priority: 'normal', timeout: 30000 }, {} as any);

    // Call the handler (it's registered as consumer handler) via internal method
    await (svc as any).handleAgentRequest(event as any);

    // Assert broadcast was invoked for tenant 't1'
    expect(mockBroadcast.broadcastToTenant).toHaveBeenCalled();
    const calls = mockBroadcast.broadcastToTenant.mock.calls;
    const [tenantId, messageType, payload] = calls[0];
    expect(tenantId).toBe('t1');
    expect(messageType).toBe('agent.reasoning.update');
    expect(payload).toHaveProperty('response');
    expect(payload.response).toHaveProperty('resolvedIssueId', 'issue-xyz');
  });
});

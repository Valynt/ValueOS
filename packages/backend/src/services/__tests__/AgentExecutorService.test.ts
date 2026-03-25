import { createBaseEvent, EVENT_TOPICS } from '@shared/types/events';

import { AgentExecutorService } from '../AgentExecutorService';

vi.mock("../../lib/supabase.js");

vi.mock('../agents/EventProducer.js', () => ({ getEventProducer: () => ({ publish: vi.fn() }), EventProducer: class {} }));
vi.mock('../agents/kafkaConfig.js', () => ({ isKafkaEnabled: () => true, buildKafkaClientConfig: () => ({}) }));
vi.mock('../post-v1/EventSourcingService.js', () => ({ getEventSourcingService: () => ({ storeEvent: vi.fn(), updateProjection: vi.fn(), getAuditTrail: vi.fn() }), EventSourcingService: class {} }));
vi.mock('../agents/UnifiedAgentAPI.js', () => ({ getUnifiedAgentAPI: () => ({ invoke: vi.fn().mockResolvedValue({ data: { resolvedIssueId: 'issue-xyz', resolution: 'accept' }, metadata: { tokens: {}, confidence: 0.9 } }) }) }));
const mockBroadcastToTenant = vi.fn();
vi.mock('../realtime/RealtimeBroadcastService.js', () => ({
  getRealtimeBroadcastService: () => ({ broadcastToTenant: mockBroadcastToTenant }),
}));

// Capture the handler registered with the consumer so we can invoke it without
// touching private methods. The factory is called during AgentExecutorService
// construction (lazy via getter), so we intercept createEventConsumer and store
// the registered handler for the 'agent.request' event type.
let capturedAgentRequestHandler: ((event: unknown) => Promise<void>) | null = null;

vi.mock('../realtime/EventConsumer.js', () => ({
  createEventConsumer: (
    _groupId: string,
    _topics: string[],
    handlers: Array<{ eventType: string; handler: (event: unknown) => Promise<void> }>,
  ) => {
    const agentHandler = handlers.find((h) => h.eventType === 'agent.request');
    if (agentHandler) {
      capturedAgentRequestHandler = agentHandler.handler;
    }
    return { connect: vi.fn(), subscribe: vi.fn(), disconnect: vi.fn(), getMetrics: vi.fn().mockResolvedValue({ connected: true, subscribed: true, processingCount: 0 }) };
  },
  EventConsumer: class {},
}));

describe('AgentExecutorService', () => {
  it('publishes AGENT_RESPONSES and broadcasts update via the registered consumer handler', async () => {
    // Instantiating the service triggers the lazy consumer getter which calls
    // createEventConsumer and populates capturedAgentRequestHandler.
    const svc = new AgentExecutorService();
    // start() triggers the consumer getter, which calls createEventConsumer
    // and registers the handler captured above.
    await svc.start();

    expect(capturedAgentRequestHandler).not.toBeNull();

    const event = createBaseEvent(
      'agent.request',
      { agentId: 'IntegrityAgent', tenantId: 't1', userId: 'u1', sessionId: 's1', query: 'resolve', context: {}, parameters: { issueId: 'issue-xyz', resolution: 'accept' }, priority: 'normal', timeout: 30000 },
      {} as any,
    );

    // Invoke through the publicly registered handler — no private method access
    await capturedAgentRequestHandler!(event);

    expect(mockBroadcastToTenant).toHaveBeenCalled();
    const [tenantId, messageType, payload] = mockBroadcastToTenant.mock.calls[0];
    expect(tenantId).toBe('t1');
    expect(messageType).toBe('agent.reasoning.update');
    expect(payload).toHaveProperty('response');
    expect(payload.response).toHaveProperty('resolvedIssueId', 'issue-xyz');
  });
});

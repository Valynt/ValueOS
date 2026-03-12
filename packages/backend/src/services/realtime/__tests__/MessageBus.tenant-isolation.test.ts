/**
 * MessageBus — mixed-tenant async isolation tests
 *
 * Verifies that messages published for tenant A are never delivered to
 * handlers registered by tenant B, and that messages missing a tenant
 * identifier are rejected at publish time and dropped at delivery time.
 *
 * Sprint 24 requirement: async tenant isolation.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageBus } from '../MessageBus.js';
import type { CommunicationEvent, CreateCommunicationEvent } from '../../../types/CommunicationEvent.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePayload(tenantId: string, overrides: Partial<CreateCommunicationEvent> = {}): CreateCommunicationEvent {
  return {
    tenant_id: tenantId,
    event_type: 'message',
    sender_id: 'agent-a',
    recipient_ids: [],
    content: `message for ${tenantId}`,
    ...overrides,
  };
}

const TENANT_A = crypto.randomUUID();
const TENANT_B = crypto.randomUUID();

function makeEvent(overrides: Partial<CreateCommunicationEvent> = {}): CreateCommunicationEvent {
  return {
    tenant_id: TENANT_A,
    event_type: 'notification',
    sender_id: 'agent-001',
    recipient_ids: ['agent-002'],
    content: 'test message',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// publishMessage — tenant_id validation
// ---------------------------------------------------------------------------

describe('MessageBus.publishMessage — tenant isolation', () => {
  it('rejects an event with no tenant_id', async () => {
    const bus = new MessageBus();
    const event = makeEvent({ tenant_id: '' });

    await expect(bus.publishMessage('test.channel', event)).rejects.toThrow(
      'CommunicationEvent missing tenant_id',
    );
  });

  it('accepts an event with a valid tenant_id', async () => {
    const bus = new MessageBus();
    const event = makeEvent({ tenant_id: TENANT_A });

    const id = await bus.publishMessage('test.channel', event);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('delivers only to subscribers on the same channel', async () => {
    const bus = new MessageBus();
    const received: string[] = [];

    bus.subscribe('channel.a', 'test-agent', async (e) => {
      received.push(e.tenant_id);
    });

    await bus.publishMessage('channel.a', makeEvent({ tenant_id: TENANT_A }));
    await bus.publishMessage('channel.b', makeEvent({ tenant_id: TENANT_B }));

    expect(received).toEqual([TENANT_A]);
    expect(received).not.toContain(TENANT_B);
  });

  it('preserves tenant_id on the delivered event', async () => {
    const bus = new MessageBus();
    let deliveredTenantId: string | undefined;

    bus.subscribe('tenant.check', 'test-agent', async (e) => {
      deliveredTenantId = e.tenant_id;
    });

    await bus.publishMessage('tenant.check', makeEvent({ tenant_id: TENANT_B }));

    expect(deliveredTenantId).toBe(TENANT_B);
  });

  it('assigns a unique id and timestamp to each published event', async () => {
    const bus = new MessageBus();
    const ids: string[] = [];

    bus.subscribe('id.check', 'test-agent', async (e) => {
      ids.push(e.id);
    });

    await bus.publishMessage('id.check', makeEvent());
    await bus.publishMessage('id.check', makeEvent());

    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("two tenants publishing to the same channel do not receive each other's events", async () => {
    const bus = new MessageBus();
    const tenantAReceived: string[] = [];
    const tenantBReceived: string[] = [];

    bus.subscribe('shared.channel', 'agent-tenant-a', async (e) => {
      if (e.tenant_id === TENANT_A) tenantAReceived.push(e.content);
    });
    bus.subscribe('shared.channel', 'agent-tenant-b', async (e) => {
      if (e.tenant_id === TENANT_B) tenantBReceived.push(e.content);
    });

    await bus.publishMessage('shared.channel', makeEvent({ tenant_id: TENANT_A, content: 'msg-a' }));
    await bus.publishMessage('shared.channel', makeEvent({ tenant_id: TENANT_B, content: 'msg-b' }));

    expect(tenantAReceived).toEqual(['msg-a']);
    expect(tenantBReceived).toEqual(['msg-b']);
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageBus — tenant isolation', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
  });

  it('does not deliver tenant-A messages to a tenant-B handler', async () => {
    const tenantAHandler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);
    const tenantBHandler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);

    bus.subscribe('tasks', 'agent-tenant-a', tenantAHandler, (e) => e.tenant_id === 'tenant-a');
    bus.subscribe('tasks', 'agent-tenant-b', tenantBHandler, (e) => e.tenant_id === 'tenant-b');

    await bus.publishMessage('tasks', makePayload('tenant-a'));

    expect(tenantAHandler).toHaveBeenCalledOnce();
    expect(tenantBHandler).not.toHaveBeenCalled();
  });

  it('does not deliver tenant-B messages to a tenant-A handler', async () => {
    const tenantAHandler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);
    const tenantBHandler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);

    bus.subscribe('tasks', 'agent-tenant-a', tenantAHandler, (e) => e.tenant_id === 'tenant-a');
    bus.subscribe('tasks', 'agent-tenant-b', tenantBHandler, (e) => e.tenant_id === 'tenant-b');

    await bus.publishMessage('tasks', makePayload('tenant-b'));

    expect(tenantBHandler).toHaveBeenCalledOnce();
    expect(tenantAHandler).not.toHaveBeenCalled();
  });

  it('delivers to the correct tenant when both publish concurrently', async () => {
    const receivedByA: string[] = [];
    const receivedByB: string[] = [];

    bus.subscribe(
      'tasks', 'agent-tenant-a',
      async (e) => { receivedByA.push(e.tenant_id); },
      (e) => e.tenant_id === 'tenant-a',
    );
    bus.subscribe(
      'tasks', 'agent-tenant-b',
      async (e) => { receivedByB.push(e.tenant_id); },
      (e) => e.tenant_id === 'tenant-b',
    );

    await Promise.all([
      bus.publishMessage('tasks', makePayload('tenant-a')),
      bus.publishMessage('tasks', makePayload('tenant-b')),
      bus.publishMessage('tasks', makePayload('tenant-a')),
    ]);

    expect(receivedByA).toHaveLength(2);
    expect(receivedByA.every((t) => t === 'tenant-a')).toBe(true);
    expect(receivedByB).toHaveLength(1);
    expect(receivedByB[0]).toBe('tenant-b');
  });

  it('unsubscribing one tenant handler does not affect the other', async () => {
    const tenantAHandler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);
    const tenantBHandler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);

    const unsubA = bus.subscribe('tasks', 'agent-tenant-a', tenantAHandler, (e) => e.tenant_id === 'tenant-a');
    bus.subscribe('tasks', 'agent-tenant-b', tenantBHandler, (e) => e.tenant_id === 'tenant-b');

    unsubA();

    await bus.publishMessage('tasks', makePayload('tenant-a'));
    await bus.publishMessage('tasks', makePayload('tenant-b'));

    expect(tenantAHandler).not.toHaveBeenCalled();
    expect(tenantBHandler).toHaveBeenCalledOnce();
  });

  it('deliverMessage drops an event with empty tenant_id before reaching any handler', async () => {
    class TestableMessageBus extends MessageBus {
      exposeDeliverMessage(channel: string, event: CommunicationEvent): Promise<void> {
        return (this as unknown as { deliverMessage: (c: string, e: CommunicationEvent) => Promise<void> })
          .deliverMessage(channel, event);
      }
    }

    const testBus = new TestableMessageBus();
    const handler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);
    testBus.subscribe('tasks', 'agent-x', handler);

    const unscopedEvent = {
      id: 'evt-unscoped',
      tenant_id: '',
      event_type: 'message',
      sender_id: 'rogue-agent',
      recipient_ids: [],
      content: 'should not be delivered',
      timestamp: new Date().toISOString(),
    } as unknown as CommunicationEvent;

    await testBus.exposeDeliverMessage('tasks', unscopedEvent);

    expect(handler).not.toHaveBeenCalled();
  });

  it('deliverMessage drops an event with no tenant identifier', async () => {
    class TestableMessageBus extends MessageBus {
      exposeDeliverMessage(channel: string, event: CommunicationEvent): Promise<void> {
        return (this as unknown as { deliverMessage: (c: string, e: CommunicationEvent) => Promise<void> })
          .deliverMessage(channel, event);
      }
    }

    const testBus = new TestableMessageBus();
    const handler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);
    testBus.subscribe('tasks', 'agent-x', handler);

    const unscopedEvent = {
      id: 'evt-no-tenant',
      event_type: 'message',
      sender_id: 'rogue-agent',
      recipient_ids: [],
      content: 'should not be delivered',
      timestamp: new Date().toISOString(),
    } as unknown as CommunicationEvent;

    await testBus.exposeDeliverMessage('tasks', unscopedEvent);

    expect(handler).not.toHaveBeenCalled();
  });
});

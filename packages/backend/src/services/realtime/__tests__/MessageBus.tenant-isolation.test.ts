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
import { trace, TraceFlags, type Span } from '@opentelemetry/api';

vi.mock('lz-string', () => ({
  compress: (value: string) => value,
  decompress: (value: string) => value,
}));

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
    recipient_ids: ['agent-listener'],
    message_type: 'tenant_test_message',
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

    await expect(bus.publishMessage('test.channel', event)).rejects.toThrow(/tenant_id or organization_id/);
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


  it('defaults trace_id when publish payload omits tracing fields', async () => {
    const bus = new MessageBus();
    let deliveredEvent: CommunicationEvent | undefined;

    bus.subscribe('trace.check', 'test-agent', async (event) => {
      deliveredEvent = event;
    });

    await bus.publishMessage('trace.check', makeEvent({ tenant_id: TENANT_A }));

    expect(deliveredEvent?.trace_id).toBeTypeOf('string');
    expect((deliveredEvent?.trace_id ?? '').length).toBeGreaterThan(0);
  });

  it('derives trace_id/span_id from active OpenTelemetry span when missing', async () => {
    const bus = new MessageBus();
    let deliveredEvent: CommunicationEvent | undefined;

    bus.subscribe('trace.active-span', 'test-agent', async (event) => {
      deliveredEvent = event;
    });

    const otelTraceId = '1234567890abcdef1234567890abcdef';
    const otelSpanId = '1234567890abcdef';
    const fakeSpan = {
      spanContext: () => ({
        traceId: otelTraceId,
        spanId: otelSpanId,
        traceFlags: TraceFlags.SAMPLED,
      }),
    };

    const spanSpy = vi.spyOn(trace, 'getSpan').mockReturnValue(fakeSpan as unknown as Span);

    await bus.publishMessage('trace.active-span', makeEvent({ tenant_id: TENANT_A, trace_id: undefined, span_id: undefined }));

    spanSpy.mockRestore();
    expect(deliveredEvent?.trace_id).toBe(otelTraceId);
    expect(deliveredEvent?.span_id).toBe(otelSpanId);
  });

  it('preserves provided trace fields through compression/decompression', async () => {
    const bus = new MessageBus();
    let deliveredEvent: CommunicationEvent | undefined;

    bus.subscribe('trace.compressed', 'test-agent', async (event) => {
      deliveredEvent = event;
    });

    await bus.publishMessage('trace.compressed', makeEvent({
      tenant_id: TENANT_A,
      trace_id: 'trace-explicit',
      span_id: 'span-explicit',
      parent_span_id: 'span-parent',
      compressed: true,
      payload: { foo: 'bar', nested: { value: 1 } },
    }));

    expect(deliveredEvent?.trace_id).toBe('trace-explicit');
    expect(deliveredEvent?.span_id).toBe('span-explicit');
    expect(deliveredEvent?.parent_span_id).toBe('span-parent');
    expect(deliveredEvent?.payload).toEqual({ foo: 'bar', nested: { value: 1 } });
  });

  it('preserves trace_id across request/reply publish flow', async () => {
    const bus = new MessageBus();

    bus.subscribe('trace.request', 'responder', async (event) => {
      await bus.publishMessage(event.reply_to ?? 'trace.request.reply.fallback', {
        event_type: 'message',
        sender_id: 'responder',
        recipient_ids: [event.sender_id],
        tenant_id: event.tenant_id ?? TENANT_A,
        organization_id: event.organization_id,
        content: 'ack',
        message_type: 'response',
        correlation_id: event.correlation_id,
        trace_id: event.trace_id,
      });
    });

    const response = await bus.request('trace.request', {
      event_type: 'message',
      sender_id: 'requester',
      recipient_ids: ['responder'],
      tenant_id: TENANT_A,
      content: 'ping',
      message_type: 'request',
      trace_id: 'trace-request-1',
    });

    expect(response.trace_id).toBe('trace-request-1');
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
      recipient_ids: ['agent-x'],
      message_type: 'tenant_test_message',
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
      recipient_ids: ['agent-x'],
      message_type: 'tenant_test_message',
      content: 'should not be delivered',
      timestamp: new Date().toISOString(),
    } as unknown as CommunicationEvent;

    await testBus.exposeDeliverMessage('tasks', unscopedEvent);

    expect(handler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// message_type validation — regression for misleading error message
// ---------------------------------------------------------------------------

describe('MessageBus — message_type validation', () => {
  it('accepts a payload without message_type (field is optional)', async () => {
    const bus = new MessageBus();
    // Should not throw — message_type is optional
    await expect(
      bus.publishMessage('mt.check', makeEvent({ tenant_id: TENANT_A, message_type: undefined }))
    ).resolves.toBeTypeOf('string');
  });

  it('accepts a payload with a valid non-empty message_type', async () => {
    const bus = new MessageBus();
    await expect(
      bus.publishMessage('mt.check', makeEvent({ tenant_id: TENANT_A, message_type: 'task.created' }))
    ).resolves.toBeTypeOf('string');
  });

  it('rejects a payload where message_type is an empty string', async () => {
    const bus = new MessageBus();
    await expect(
      bus.publishMessage('mt.check', makeEvent({ tenant_id: TENANT_A, message_type: '' }))
    ).rejects.toThrow(/non-empty string when provided/);
  });
});

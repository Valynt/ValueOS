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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MessageBus — tenant isolation', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
  });

  // ── Cross-tenant delivery isolation ──────────────────────────────────────

  it('does not deliver tenant-A messages to a tenant-B handler', async () => {
    const tenantAHandler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);
    const tenantBHandler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);

    bus.subscribe('tasks', 'agent-tenant-a', tenantAHandler, (e) => (e.tenant_id ?? (e as any).organization_id) === 'tenant-a');
    bus.subscribe('tasks', 'agent-tenant-b', tenantBHandler, (e) => (e.tenant_id ?? (e as any).organization_id) === 'tenant-b');

    await bus.publishMessage('tasks', makePayload('tenant-a'));

    expect(tenantAHandler).toHaveBeenCalledOnce();
    expect(tenantBHandler).not.toHaveBeenCalled();
  });

  it('does not deliver tenant-B messages to a tenant-A handler', async () => {
    const tenantAHandler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);
    const tenantBHandler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);

    bus.subscribe('tasks', 'agent-tenant-a', tenantAHandler, (e) => (e.tenant_id ?? (e as any).organization_id) === 'tenant-a');
    bus.subscribe('tasks', 'agent-tenant-b', tenantBHandler, (e) => (e.tenant_id ?? (e as any).organization_id) === 'tenant-b');

    await bus.publishMessage('tasks', makePayload('tenant-b'));

    expect(tenantBHandler).toHaveBeenCalledOnce();
    expect(tenantAHandler).not.toHaveBeenCalled();
  });

  it('delivers to the correct tenant when both publish concurrently', async () => {
    const receivedByA: string[] = [];
    const receivedByB: string[] = [];

    bus.subscribe(
      'tasks', 'agent-tenant-a',
      async (e) => { receivedByA.push(e.tenant_id ?? (e as any).organization_id); },
      (e) => (e.tenant_id ?? (e as any).organization_id) === 'tenant-a',
    );
    bus.subscribe(
      'tasks', 'agent-tenant-b',
      async (e) => { receivedByB.push(e.tenant_id ?? (e as any).organization_id); },
      (e) => (e.tenant_id ?? (e as any).organization_id) === 'tenant-b',
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

  // ── Unsubscribe does not affect other tenants ─────────────────────────────

  it('unsubscribing one tenant handler does not affect the other', async () => {
    const tenantAHandler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);
    const tenantBHandler = vi.fn<[CommunicationEvent], Promise<void>>().mockResolvedValue(undefined);

    const unsubA = bus.subscribe('tasks', 'agent-tenant-a', tenantAHandler, (e) => (e.tenant_id ?? (e as any).organization_id) === 'tenant-a');
    bus.subscribe('tasks', 'agent-tenant-b', tenantBHandler, (e) => (e.tenant_id ?? (e as any).organization_id) === 'tenant-b');

    unsubA();

    await bus.publishMessage('tasks', makePayload('tenant-a'));
    await bus.publishMessage('tasks', makePayload('tenant-b'));

    expect(tenantAHandler).not.toHaveBeenCalled();
    expect(tenantBHandler).toHaveBeenCalledOnce();
  });

  // ── Delivery-time guard (defence-in-depth) ────────────────────────────────
  // These tests bypass publishMessage and invoke deliverMessage directly via
  // a TestableMessageBus subclass to verify the guard independently.

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

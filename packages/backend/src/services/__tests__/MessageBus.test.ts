import { beforeAll, describe, expect, expectTypeOf, it, vi } from 'vitest';

vi.mock('lz-string', () => ({
  compress: (value: string) => value,
  decompress: (value: string) => value,
}));

vi.mock('uuid', () => ({
  v4: () => 'test-message-id',
}));

let MessageBusCtor: typeof import('../realtime/MessageBus.js').MessageBus;

beforeAll(async () => {
  const messageBusModule = await import('../realtime/MessageBus.js');
  MessageBusCtor = messageBusModule.MessageBus;
});
import type {
  CommunicationEvent,
  CreateCommunicationEvent,
} from '../../types/CommunicationEvent.js';

describe('MessageBus', () => {
  describe('expandMessage', () => {
    it('returns original payload when not compressed', () => {
      const bus = new MessageBusCtor();
      const payload = { foo: 'bar' };
      expect(bus.expandMessage(payload)).toEqual(payload);
    });

    it('decompresses a previously compressed payload', () => {
      const bus = new MessageBusCtor();
      const original = { key: 'value', nested: [1, 2, 3] };
      const compressed = bus.compressMessage(original);

      expect(compressed.__compressed).toBe(true);

      const expanded = bus.expandMessage(compressed);
      expect(expanded).toEqual(original);
    });

    it('returns original payload when decompress returns null (corrupt data)', () => {
      const bus = new MessageBusCtor();
      const badPayload = { __compressed: true, data: 'not-valid-lz-data' };

      const result = bus.expandMessage(badPayload);
      expect(result).toEqual(badPayload);
    });
  });

  describe('compressMessage / expandMessage round-trip', () => {
    it('handles empty objects', () => {
      const bus = new MessageBusCtor();
      const compressed = bus.compressMessage({});
      const expanded = bus.expandMessage(compressed);
      expect(expanded).toEqual({});
    });

    it('handles strings with special characters', () => {
      const bus = new MessageBusCtor();
      const original = { text: "Hello 'world' \"quotes\" & <tags>" };
      const compressed = bus.compressMessage(original);
      const expanded = bus.expandMessage(compressed);
      expect(expanded).toEqual(original);
    });

    it('handles large payloads', () => {
      const bus = new MessageBusCtor();
      const original = { data: 'x'.repeat(5000) };
      const compressed = bus.compressMessage(original);
      expect(compressed.__compressed).toBe(true);
      const expanded = bus.expandMessage(compressed);
      expect(expanded).toEqual(original);
    });
  });

  describe('tenant-aware message contracts', () => {
    it('publishes messages that include tenant context and realtime routing fields', async () => {
      const bus = new MessageBusCtor();
      const published: CommunicationEvent[] = [];

      const unsubscribe = bus.subscribe('tasks', 'TargetAgent', async (event) => {
        published.push(event);
      });

      await bus.publishMessage('tasks', {
        event_type: 'message',
        sender_id: 'coordinator',
        recipient_ids: ['target-agent'],
        recipient_agent: 'TargetAgent',
        message_type: 'task_assignment',
        correlation_id: 'corr-123',
        reply_to: 'tasks.reply.corr-123',
        tenant_id: 'tenant-1',
        organization_id: 'org-1',
        content: 'Run target stage',
        payload: { stage: 'target' },
      });

      unsubscribe();

      expect(published).toHaveLength(1);
      expect(published[0]).toMatchObject({
        tenant_id: 'tenant-1',
        organization_id: 'org-1',
        recipient_agent: 'TargetAgent',
        message_type: 'task_assignment',
        correlation_id: 'corr-123',
        reply_to: 'tasks.reply.corr-123',
      });
      expect(published[0].id).toBeTypeOf('string');
      expect(published[0].timestamp).toBeTypeOf('string');
    });

    it('preserves tenant context for request/reply envelopes', async () => {
      const bus = new MessageBusCtor();

      bus.subscribe('coordinator', 'ResponderAgent', async (event) => {
        await bus.publishMessage(event.reply_to ?? 'coordinator.reply.missing', {
          event_type: 'message',
          sender_id: 'responder',
          recipient_ids: [event.sender_id],
          tenant_id: event.tenant_id ?? 'tenant-from-org',
          organization_id: event.organization_id ?? 'org-from-tenant',
          content: 'Ack',
          correlation_id: event.correlation_id,
          message_type: 'response',
        });
      });

      const response = await bus.request('coordinator', {
        event_type: 'message',
        sender_id: 'requester',
        recipient_ids: ['responder'],
        tenant_id: 'tenant-req',
        organization_id: 'org-req',
        content: 'Need status',
        message_type: 'request',
      });

      expect(response).toMatchObject({
        tenant_id: 'tenant-req',
        organization_id: 'org-req',
        message_type: 'response',
      });
      expect(response.correlation_id).toBeTruthy();
    });

    

    it('rejects publish payloads that do not include tenant identity', async () => {
      const bus = new MessageBusCtor();

      await expect(
        bus.publishMessage('tasks', {
          event_type: 'message',
          sender_id: 'coordinator',
          recipient_ids: ['target-agent'],
          message_type: 'task_assignment',
          content: 'Run target stage',
          payload: { stage: 'target' },
        } as unknown as CreateCommunicationEvent),
      ).rejects.toThrow(/tenant_id or organization_id/);
    });

    it('rejects legacy publish payload field variants', async () => {
      const bus = new MessageBusCtor();

      await expect(
        bus.publishMessage('tasks', {
          event_type: 'message',
          sender_id: 'coordinator',
          recipient_ids: ['target-agent'],
          message_type: 'task_assignment',
          content: 'Run target stage',
          tenant_id: 'tenant-1',
          from_agent: 'coordinator',
        } as unknown as CreateCommunicationEvent),
      ).rejects.toThrow(/legacy field "from_agent"/);
    });

    it('keeps type-level contracts aligned with runtime payloads', () => {
      type TenantPayload = {
        event_type: 'message';
        sender_id: string;
        recipient_ids: string[];
        content: string;
        tenant_id: string;
      };

      expectTypeOf<CreateCommunicationEvent>().toMatchTypeOf<TenantPayload>();
      expectTypeOf<CommunicationEvent>().toMatchTypeOf<CreateCommunicationEvent & {
        id: string;
        timestamp: string;
      }>();

      const runtimeEvent: CommunicationEvent = {
        id: 'msg-1',
        timestamp: new Date().toISOString(),
        event_type: 'message',
        sender_id: 'agent-A',
        recipient_ids: ['agent-B'],
        content: 'payload',
        tenant_id: 'tenant-42',
        message_type: 'status_update',
      };

      expect(runtimeEvent.tenant_id).toBe('tenant-42');
      expect(runtimeEvent.message_type).toBe('status_update');
    });
  });
});

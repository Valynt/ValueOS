/**
 * MessageBus Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MessageBus } from '../../src/services/MessageBus';
import type { CommunicationEvent } from '../../src/types/CommunicationEvent';

describe('MessageBus', () => {
  let messageBus: MessageBus;

  beforeEach(() => {
    messageBus = new MessageBus();
  });

  afterEach(() => {
    // Clean up subscriptions
  });

  describe('publishMessage', () => {
    it('should publish a message to a channel', async () => {
      const messageId = await messageBus.publishMessage('test-channel', {
        channel: 'test-channel',
        message_type: 'status_update',
        sender_agent: 'TestAgent',
        payload: { status: 'ok' },
      });

      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');
    });

    it('should deliver message to subscribers', async () => {
      const received: CommunicationEvent[] = [];

      messageBus.subscribe('test-channel', 'TestSubscriber', async (event) => {
        received.push(event);
      });

      await messageBus.publishMessage('test-channel', {
        channel: 'test-channel',
        message_type: 'broadcast',
        sender_agent: 'TestAgent',
        payload: { message: 'Hello' },
      });

      // Wait for async delivery
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(received.length).toBe(1);
      expect(received[0].payload.message).toBe('Hello');
    });

    it('should compress large payloads', async () => {
      const largePayload = {
        data: 'x'.repeat(2000), // > 1KB
      };

      const messageId = await messageBus.publishMessage('test-channel', {
        channel: 'test-channel',
        message_type: 'data_response',
        sender_agent: 'TestAgent',
        payload: largePayload,
      });

      expect(messageId).toBeDefined();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to a channel', () => {
      const unsubscribe = messageBus.subscribe(
        'test-channel',
        'TestAgent',
        async (event) => {
          // Handler
        }
      );

      expect(typeof unsubscribe).toBe('function');
    });

    it('should receive messages after subscription', async () => {
      let received = false;

      messageBus.subscribe('test-channel', 'TestAgent', async (event) => {
        received = true;
      });

      await messageBus.publishMessage('test-channel', {
        channel: 'test-channel',
        message_type: 'heartbeat',
        sender_agent: 'TestAgent',
        payload: {},
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(received).toBe(true);
    });

    it('should filter messages with filter function', async () => {
      const received: CommunicationEvent[] = [];

      messageBus.subscribe(
        'test-channel',
        'TestAgent',
        async (event) => {
          received.push(event);
        },
        (event) => event.priority === 'high'
      );

      await messageBus.publishMessage('test-channel', {
        channel: 'test-channel',
        message_type: 'status_update',
        sender_agent: 'TestAgent',
        payload: {},
        priority: 'normal',
      });

      await messageBus.publishMessage('test-channel', {
        channel: 'test-channel',
        message_type: 'status_update',
        sender_agent: 'TestAgent',
        payload: {},
        priority: 'high',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(received.length).toBe(1);
      expect(received[0].priority).toBe('high');
    });

    it('should unsubscribe correctly', async () => {
      let count = 0;

      const unsubscribe = messageBus.subscribe('test-channel', 'TestAgent', async () => {
        count++;
      });

      await messageBus.publishMessage('test-channel', {
        channel: 'test-channel',
        message_type: 'heartbeat',
        sender_agent: 'TestAgent',
        payload: {},
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(count).toBe(1);

      unsubscribe();

      await messageBus.publishMessage('test-channel', {
        channel: 'test-channel',
        message_type: 'heartbeat',
        sender_agent: 'TestAgent',
        payload: {},
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(count).toBe(1); // Should not increase
    });
  });

  describe('compressMessage / expandMessage', () => {
    it('should compress and expand messages', () => {
      const original = {
        data: 'This is a test message with some content',
        nested: {
          field: 'value',
        },
      };

      const compressed = messageBus.compressMessage(original);
      expect(compressed.__compressed).toBe(true);

      const expanded = messageBus.expandMessage(compressed);
      expect(expanded).toEqual(original);
    });

    it('should handle non-compressed messages', () => {
      const message = { data: 'test' };
      const expanded = messageBus.expandMessage(message);
      expect(expanded).toEqual(message);
    });
  });

  describe('request', () => {
    it('should send request and receive response', async () => {
      // Set up responder
      messageBus.subscribe('test-channel', 'Responder', async (event) => {
        if (event.reply_to && event.correlation_id) {
          await messageBus.publishMessage(event.reply_to, {
            channel: event.reply_to,
            message_type: 'data_response',
            sender_agent: 'Responder',
            payload: { result: 'success' },
            correlation_id: event.correlation_id,
          });
        }
      });

      const response = await messageBus.request(
        'test-channel',
        {
          channel: 'test-channel',
          message_type: 'data_request',
          sender_agent: 'Requester',
          payload: { query: 'test' },
        },
        1000
      );

      expect(response.payload.result).toBe('success');
    });

    it('should timeout if no response', async () => {
      await expect(
        messageBus.request(
          'test-channel',
          {
            channel: 'test-channel',
            message_type: 'data_request',
            sender_agent: 'Requester',
            payload: {},
          },
          100
        )
      ).rejects.toThrow('timeout');
    });
  });

  describe('broadcast', () => {
    it('should broadcast to all subscribers', async () => {
      const received1: CommunicationEvent[] = [];
      const received2: CommunicationEvent[] = [];

      messageBus.subscribe('broadcast', 'Agent1', async (event) => {
        received1.push(event);
      });

      messageBus.subscribe('broadcast', 'Agent2', async (event) => {
        received2.push(event);
      });

      await messageBus.broadcast({
        channel: 'broadcast',
        message_type: 'broadcast',
        sender_agent: 'System',
        payload: { announcement: 'test' },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(received1.length).toBe(1);
      expect(received2.length).toBe(1);
      expect(received1[0].payload.announcement).toBe('test');
      expect(received2[0].payload.announcement).toBe('test');
    });
  });

  describe('getChannelStats', () => {
    it('should return channel statistics', async () => {
      await messageBus.publishMessage('test-channel', {
        channel: 'test-channel',
        message_type: 'heartbeat',
        sender_agent: 'TestAgent',
        payload: {},
      });

      const stats = messageBus.getChannelStats('test-channel');

      expect(stats).toBeDefined();
      expect(stats?.total_messages).toBeGreaterThan(0);
    });
  });

  describe('getAllStats', () => {
    it('should return all channel statistics', () => {
      const stats = messageBus.getAllStats();

      expect(stats).toBeInstanceOf(Array);
      expect(stats.length).toBeGreaterThan(0);
    });
  });

  describe('getMessageHistory', () => {
    it('should return message history for persistent channels', async () => {
      await messageBus.publishMessage('coordinator', {
        channel: 'coordinator',
        message_type: 'task_assignment',
        sender_agent: 'TestAgent',
        payload: {},
      });

      const history = messageBus.getMessageHistory('coordinator');

      expect(history).toBeInstanceOf(Array);
      expect(history.length).toBeGreaterThan(0);
    });

    it('should limit history size', async () => {
      for (let i = 0; i < 10; i++) {
        await messageBus.publishMessage('coordinator', {
          channel: 'coordinator',
          message_type: 'heartbeat',
          sender_agent: 'TestAgent',
          payload: { index: i },
        });
      }

      const history = messageBus.getMessageHistory('coordinator', 5);

      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  describe('clearHistory', () => {
    it('should clear message history', async () => {
      await messageBus.publishMessage('coordinator', {
        channel: 'coordinator',
        message_type: 'heartbeat',
        sender_agent: 'TestAgent',
        payload: {},
      });

      messageBus.clearHistory('coordinator');

      const history = messageBus.getMessageHistory('coordinator');
      expect(history.length).toBe(0);
    });
  });
});

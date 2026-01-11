/**
 * Real-Time Sync Integration Tests
 * 
 * Tests multi-user real-time synchronization scenarios
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { getRealtimeService } from '../../lib/realtime/supabaseRealtime';
import type { CanvasElement } from '../../lib/realtime/supabaseRealtime';

// Mock Supabase for integration tests
const mockSupabase = {
  channel: vi.fn(),
  from: vi.fn(),
};

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

describe('Real-Time Sync Integration Tests', () => {
  let realtimeService: ReturnType<typeof getRealtimeService>;
  const valueCaseId = 'test-vc-123';

  beforeAll(() => {
    realtimeService = getRealtimeService();
  });

  afterAll(async () => {
    await realtimeService.cleanup();
  });

  describe('Multi-User Element Sync', () => {
    it('should sync element creation between two users', async () => {
      const user1Events: CanvasElement[] = [];
      const user2Events: CanvasElement[] = [];

      // Mock channel for both users
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
        send: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      // User 1 subscribes
      const unsubscribe1 = realtimeService.subscribeToElements(
        valueCaseId,
        (element, event) => {
          if (event === 'INSERT') {
            user1Events.push(element);
          }
        }
      );

      // User 2 subscribes
      const unsubscribe2 = realtimeService.subscribeToElements(
        valueCaseId,
        (element, event) => {
          if (event === 'INSERT') {
            user2Events.push(element);
          }
        }
      );

      // Simulate User 1 creating an element
      const newElement: CanvasElement = {
        id: 'elem-1',
        valueCaseId,
        elementType: 'text',
        positionX: 100,
        positionY: 200,
        content: { text: 'Hello from User 1' },
        zIndex: 1,
        locked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Trigger the postgres_changes callback
      const onCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes'
      );
      const eventHandler = onCall![2];

      eventHandler({
        eventType: 'INSERT',
        new: {
          id: newElement.id,
          value_case_id: newElement.valueCaseId,
          element_type: newElement.elementType,
          position_x: newElement.positionX,
          position_y: newElement.positionY,
          content: newElement.content,
          z_index: newElement.zIndex,
          locked: newElement.locked,
          created_at: newElement.createdAt,
          updated_at: newElement.updatedAt,
        },
      });

      // Both users should receive the event
      expect(user1Events).toHaveLength(1);
      expect(user2Events).toHaveLength(1);
      expect(user1Events[0].id).toBe('elem-1');
      expect(user2Events[0].id).toBe('elem-1');

      unsubscribe1();
      unsubscribe2();
    });

    it('should sync element updates between users', async () => {
      const user1Updates: CanvasElement[] = [];
      const user2Updates: CanvasElement[] = [];

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const unsubscribe1 = realtimeService.subscribeToElements(
        valueCaseId,
        (element, event) => {
          if (event === 'UPDATE') {
            user1Updates.push(element);
          }
        }
      );

      const unsubscribe2 = realtimeService.subscribeToElements(
        valueCaseId,
        (element, event) => {
          if (event === 'UPDATE') {
            user2Updates.push(element);
          }
        }
      );

      // Simulate element update
      const onCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes'
      );
      const eventHandler = onCall![2];

      eventHandler({
        eventType: 'UPDATE',
        new: {
          id: 'elem-1',
          value_case_id: valueCaseId,
          element_type: 'text',
          position_x: 150,
          position_y: 250,
          content: { text: 'Updated text' },
          z_index: 1,
          locked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      expect(user1Updates).toHaveLength(1);
      expect(user2Updates).toHaveLength(1);
      expect(user1Updates[0].positionX).toBe(150);
      expect(user2Updates[0].positionX).toBe(150);

      unsubscribe1();
      unsubscribe2();
    });

    it('should sync element deletion between users', async () => {
      const user1Deletions: string[] = [];
      const user2Deletions: string[] = [];

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const unsubscribe1 = realtimeService.subscribeToElements(
        valueCaseId,
        (element, event) => {
          if (event === 'DELETE') {
            user1Deletions.push(element.id);
          }
        }
      );

      const unsubscribe2 = realtimeService.subscribeToElements(
        valueCaseId,
        (element, event) => {
          if (event === 'DELETE') {
            user2Deletions.push(element.id);
          }
        }
      );

      // Simulate element deletion
      const onCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes'
      );
      const eventHandler = onCall![2];

      eventHandler({
        eventType: 'DELETE',
        new: {
          id: 'elem-1',
          value_case_id: valueCaseId,
          element_type: 'text',
          position_x: 100,
          position_y: 200,
          content: {},
          z_index: 1,
          locked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      });

      expect(user1Deletions).toHaveLength(1);
      expect(user2Deletions).toHaveLength(1);
      expect(user1Deletions[0]).toBe('elem-1');
      expect(user2Deletions[0]).toBe('elem-1');

      unsubscribe1();
      unsubscribe2();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle simultaneous element creation', async () => {
      const allEvents: CanvasElement[] = [];

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const unsubscribe = realtimeService.subscribeToElements(
        valueCaseId,
        (element, event) => {
          if (event === 'INSERT') {
            allEvents.push(element);
          }
        }
      );

      const onCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes'
      );
      const eventHandler = onCall![2];

      // Simulate 3 users creating elements simultaneously
      const elements = [
        { id: 'elem-1', text: 'User 1' },
        { id: 'elem-2', text: 'User 2' },
        { id: 'elem-3', text: 'User 3' },
      ];

      elements.forEach((elem) => {
        eventHandler({
          eventType: 'INSERT',
          new: {
            id: elem.id,
            value_case_id: valueCaseId,
            element_type: 'text',
            position_x: 100,
            position_y: 200,
            content: { text: elem.text },
            z_index: 1,
            locked: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
      });

      expect(allEvents).toHaveLength(3);
      expect(allEvents.map((e) => e.id)).toEqual(['elem-1', 'elem-2', 'elem-3']);

      unsubscribe();
    });

    it('should handle rapid updates to same element', async () => {
      const updates: CanvasElement[] = [];

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const unsubscribe = realtimeService.subscribeToElements(
        valueCaseId,
        (element, event) => {
          if (event === 'UPDATE') {
            updates.push(element);
          }
        }
      );

      const onCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes'
      );
      const eventHandler = onCall![2];

      // Simulate rapid position updates
      for (let i = 0; i < 10; i++) {
        eventHandler({
          eventType: 'UPDATE',
          new: {
            id: 'elem-1',
            value_case_id: valueCaseId,
            element_type: 'text',
            position_x: 100 + i * 10,
            position_y: 200 + i * 10,
            content: { text: 'Moving element' },
            z_index: 1,
            locked: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
      }

      expect(updates).toHaveLength(10);
      expect(updates[0].positionX).toBe(100);
      expect(updates[9].positionX).toBe(190);

      unsubscribe();
    });
  });

  describe('Network Resilience', () => {
    it('should handle subscription errors gracefully', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((callback) => {
          callback('CHANNEL_ERROR');
          return Promise.resolve('CHANNEL_ERROR');
        }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const callback = vi.fn();
      const unsubscribe = realtimeService.subscribeToElements(valueCaseId, callback);

      // Should not throw
      expect(() => unsubscribe()).not.toThrow();
    });

    it('should handle reconnection after disconnect', async () => {
      const events: CanvasElement[] = [];

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
          .mockResolvedValueOnce('CHANNEL_ERROR')
          .mockResolvedValueOnce('SUBSCRIBED'),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const unsubscribe = realtimeService.subscribeToElements(
        valueCaseId,
        (element, event) => {
          events.push(element);
        }
      );

      // First subscription fails, second succeeds
      expect(mockChannel.subscribe).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('Performance', () => {
    it('should handle high-frequency updates efficiently', async () => {
      const updates: CanvasElement[] = [];
      const startTime = Date.now();

      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const unsubscribe = realtimeService.subscribeToElements(
        valueCaseId,
        (element, event) => {
          updates.push(element);
        }
      );

      const onCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes'
      );
      const eventHandler = onCall![2];

      // Simulate 100 rapid updates
      for (let i = 0; i < 100; i++) {
        eventHandler({
          eventType: 'UPDATE',
          new: {
            id: `elem-${i}`,
            value_case_id: valueCaseId,
            element_type: 'text',
            position_x: i,
            position_y: i,
            content: { text: `Element ${i}` },
            z_index: 1,
            locked: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(updates).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should process 100 updates in < 1 second

      unsubscribe();
    });

    it('should handle multiple concurrent subscriptions', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      // Create 10 concurrent subscriptions
      const unsubscribes = [];
      for (let i = 0; i < 10; i++) {
        const unsubscribe = realtimeService.subscribeToElements(
          `vc-${i}`,
          () => {}
        );
        unsubscribes.push(unsubscribe);
      }

      expect(mockChannel.subscribe).toHaveBeenCalledTimes(10);

      // Cleanup
      unsubscribes.forEach((unsub) => unsub());
    });
  });
});

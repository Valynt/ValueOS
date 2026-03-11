/**
 * Presence System Load Tests
 * 
 * Tests presence tracking under various load conditions
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRealtimeService } from '../../lib/realtime/supabaseRealtime';
import type { PresenceUser } from '../../lib/realtime/supabaseRealtime';

// Mock Supabase — must use vi.hoisted so the factory runs before imports
const mockSupabase = vi.hoisted(() => ({
  channel: vi.fn(),
  removeChannel: vi.fn(),
  removeAllChannels: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  createBrowserSupabaseClient: () => mockSupabase,
  supabase: mockSupabase,
}));

describe('Presence System Load Tests', () => {
  let realtimeService: ReturnType<typeof getRealtimeService>;
  const valueCaseId = 'test-vc-123';

  beforeEach(() => {
    vi.clearAllMocks();
    realtimeService = getRealtimeService();
  });

  describe('Multiple Users', () => {
    it('should handle 10 concurrent users', async () => {
      const users: PresenceUser[] = [];
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        track: vi.fn().mockResolvedValue({ error: null }),
        untrack: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
        presenceState: vi.fn().mockReturnValue({}),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      // Simulate 10 users joining
      const subscriptions: Array<{ unsubscribe: () => void; channel: unknown }> = [];
      for (let i = 0; i < 10; i++) {
        const user: PresenceUser = {
          userId: `user-${i}`,
          userName: `User ${i}`,
          userEmail: `user${i}@example.com`,
          status: 'active',
          lastSeen: new Date().toISOString(),
        };

        const subscription = realtimeService.subscribeToPresence(
          valueCaseId,
          user,
          (presenceUsers) => {
            users.push(...presenceUsers);
          }
        );

        subscriptions.push(subscription);
      }

      expect(mockChannel.subscribe).toHaveBeenCalledTimes(10);
      expect(mockChannel.track).toHaveBeenCalledTimes(10);

      // Cleanup
      subscriptions.forEach(({ unsubscribe }) => unsubscribe());
    });

    it('should handle 50 concurrent users', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        track: vi.fn().mockResolvedValue({ error: null }),
        untrack: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
        presenceState: vi.fn().mockReturnValue({}),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const startTime = Date.now();
      const subscriptions: Array<{ unsubscribe: () => void; channel: unknown }> = [];

      for (let i = 0; i < 50; i++) {
        const user: PresenceUser = {
          userId: `user-${i}`,
          userName: `User ${i}`,
          userEmail: `user${i}@example.com`,
          status: 'active',
          lastSeen: new Date().toISOString(),
        };

        const subscription = realtimeService.subscribeToPresence(
          valueCaseId,
          user,
          () => {}
        );

        subscriptions.push(subscription);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(mockChannel.subscribe).toHaveBeenCalledTimes(50);
      expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds

      subscriptions.forEach(({ unsubscribe }) => unsubscribe());
    });

    it('should handle 100 concurrent users', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        track: vi.fn().mockResolvedValue({ error: null }),
        untrack: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
        presenceState: vi.fn().mockReturnValue({}),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const startTime = Date.now();
      const subscriptions: Array<{ unsubscribe: () => void; channel: unknown }> = [];

      for (let i = 0; i < 100; i++) {
        const user: PresenceUser = {
          userId: `user-${i}`,
          userName: `User ${i}`,
          userEmail: `user${i}@example.com`,
          status: 'active',
          lastSeen: new Date().toISOString(),
        };

        const subscription = realtimeService.subscribeToPresence(
          valueCaseId,
          user,
          () => {}
        );

        subscriptions.push(subscription);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(mockChannel.subscribe).toHaveBeenCalledTimes(100);
      expect(duration).toBeLessThan(10000); // Should complete in < 10 seconds

      subscriptions.forEach(({ unsubscribe }) => unsubscribe());
    });
  });

  describe('High-Frequency Updates', () => {
    it('should handle rapid cursor movements', async () => {
      const updates: PresenceUser[] = [];
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        track: vi.fn().mockResolvedValue({ error: null }),
        untrack: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
        presenceState: vi.fn().mockReturnValue({}),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const user: PresenceUser = {
        userId: 'user-1',
        userName: 'Test User',
        userEmail: 'test@example.com',
        status: 'active',
        lastSeen: new Date().toISOString(),
      };

      const { channel } = realtimeService.subscribeToPresence(valueCaseId, user, (users) => {
        updates.push(...users);
      });

      const startTime = Date.now();

      // Simulate 100 cursor movements
      for (let i = 0; i < 100; i++) {
        await realtimeService.updatePresence(channel, {
          cursorX: i * 10,
          cursorY: i * 10,
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(mockChannel.track).toHaveBeenCalledTimes(101); // Initial + 100 updates
      expect(duration).toBeLessThan(2000); // Should complete in < 2 seconds
    });

    it('should handle multiple users moving simultaneously', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        track: vi.fn().mockResolvedValue({ error: null }),
        untrack: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
        presenceState: vi.fn().mockReturnValue({}),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      // 10 users
      const users: PresenceUser[] = Array.from({ length: 10 }, (_, i) => ({
        userId: `user-${i}`,
        userName: `User ${i}`,
        userEmail: `user${i}@example.com`,
        status: 'active' as const,
        lastSeen: new Date().toISOString(),
      }));

      // Subscribe all users, capture channel references
      const channels = users.map((user) => {
        const { channel } = realtimeService.subscribeToPresence(valueCaseId, user, () => {});
        return channel;
      });

      const startTime = Date.now();

      // Each user makes 10 cursor updates using their channel reference
      const updatePromises = channels.map((channel, userIndex) =>
        Promise.all(
          Array.from({ length: 10 }, (_, i) =>
            realtimeService.updatePresence(channel, {
              cursorX: userIndex * 100 + i * 10,
              cursorY: userIndex * 100 + i * 10,
            })
          )
        )
      );

      await Promise.all(updatePromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 10 users * 10 updates = 100 updates + 10 initial tracks
      expect(mockChannel.track).toHaveBeenCalledTimes(110);
      expect(duration).toBeLessThan(3000); // Should complete in < 3 seconds
    });
  });

  describe('User Join/Leave', () => {
    it('should handle rapid user join/leave cycles', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        track: vi.fn().mockResolvedValue({ error: null }),
        untrack: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
        presenceState: vi.fn().mockReturnValue({}),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const startTime = Date.now();

      // 20 users join and leave rapidly
      for (let i = 0; i < 20; i++) {
        const user: PresenceUser = {
          userId: `user-${i}`,
          userName: `User ${i}`,
          userEmail: `user${i}@example.com`,
          status: 'active',
          lastSeen: new Date().toISOString(),
        };

        const { unsubscribe } = realtimeService.subscribeToPresence(
          valueCaseId,
          user,
          () => {}
        );

        // Immediately unsubscribe
        unsubscribe();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(mockChannel.subscribe).toHaveBeenCalledTimes(20);
      expect(mockChannel.untrack).toHaveBeenCalledTimes(20);
      expect(duration).toBeLessThan(2000); // Should complete in < 2 seconds
    });

    it('should handle staggered user joins', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        track: vi.fn().mockResolvedValue({ error: null }),
        untrack: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
        presenceState: vi.fn().mockReturnValue({}),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const subscriptions: Array<{ unsubscribe: () => void; channel: unknown }> = [];

      // Users join at 100ms intervals
      for (let i = 0; i < 10; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10)); // Reduced for test speed

        const user: PresenceUser = {
          userId: `user-${i}`,
          userName: `User ${i}`,
          userEmail: `user${i}@example.com`,
          status: 'active',
          lastSeen: new Date().toISOString(),
        };

        const subscription = realtimeService.subscribeToPresence(
          valueCaseId,
          user,
          () => {}
        );

        subscriptions.push(subscription);
      }

      expect(mockChannel.subscribe).toHaveBeenCalledTimes(10);

      subscriptions.forEach(({ unsubscribe }) => unsubscribe());
    });
  });

  describe('Status Changes', () => {
    it('should handle frequent status changes', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        track: vi.fn().mockResolvedValue({ error: null }),
        untrack: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
        presenceState: vi.fn().mockReturnValue({}),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const user: PresenceUser = {
        userId: 'user-1',
        userName: 'Test User',
        userEmail: 'test@example.com',
        status: 'active',
        lastSeen: new Date().toISOString(),
      };

      const { channel } = realtimeService.subscribeToPresence(valueCaseId, user, () => {});

      const statuses: Array<'active' | 'idle' | 'away'> = ['active', 'idle', 'away'];

      // Cycle through statuses 20 times
      for (let i = 0; i < 20; i++) {
        await realtimeService.updatePresence(channel, {
          status: statuses[i % 3],
        });
      }

      expect(mockChannel.track).toHaveBeenCalledTimes(21); // Initial + 20 updates
    });
  });

  describe('Memory and Performance', () => {
    it('should not leak memory with many subscriptions', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        track: vi.fn().mockResolvedValue({ error: null }),
        untrack: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
        presenceState: vi.fn().mockReturnValue({}),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      // Create and destroy 100 subscriptions
      for (let i = 0; i < 100; i++) {
        const user: PresenceUser = {
          userId: `user-${i}`,
          userName: `User ${i}`,
          userEmail: `user${i}@example.com`,
          status: 'active',
          lastSeen: new Date().toISOString(),
        };

        const { unsubscribe } = realtimeService.subscribeToPresence(
          valueCaseId,
          user,
          () => {}
        );

        unsubscribe();
      }

      expect(mockChannel.untrack).toHaveBeenCalledTimes(100);
      expect(mockChannel.unsubscribe).toHaveBeenCalledTimes(100);
    });

    it('should handle presence state with 100 users', () => {
      const presenceState: Record<string, PresenceUser[]> = {};

      // Simulate 100 users in presence state
      for (let i = 0; i < 100; i++) {
        presenceState[`user-${i}`] = [
          {
            userId: `user-${i}`,
            userName: `User ${i}`,
            userEmail: `user${i}@example.com`,
            cursorX: Math.random() * 1000,
            cursorY: Math.random() * 1000,
            status: 'active',
            lastSeen: new Date().toISOString(),
          },
        ];
      }

      const startTime = Date.now();

      // Parse presence state
      const users: PresenceUser[] = [];
      Object.keys(presenceState).forEach((key) => {
        presenceState[key].forEach((presence) => {
          users.push(presence);
        });
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(users).toHaveLength(100);
      expect(duration).toBeLessThan(100); // Should parse in < 100ms
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with no cursor position', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        track: vi.fn().mockResolvedValue({ error: null }),
        untrack: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
        presenceState: vi.fn().mockReturnValue({}),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const user: PresenceUser = {
        userId: 'user-1',
        userName: 'Test User',
        userEmail: 'test@example.com',
        status: 'active',
        lastSeen: new Date().toISOString(),
        // No cursorX or cursorY
      };

      const { unsubscribe } = realtimeService.subscribeToPresence(
        valueCaseId,
        user,
        () => {}
      );

      expect(mockChannel.track).toHaveBeenCalledWith(user);

      unsubscribe();
    });

    it('should handle user with no selected element', async () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
        track: vi.fn().mockResolvedValue({ error: null }),
        untrack: vi.fn().mockResolvedValue({ error: null }),
        unsubscribe: vi.fn().mockResolvedValue({ error: null }),
        presenceState: vi.fn().mockReturnValue({}),
      };

      mockSupabase.channel.mockReturnValue(mockChannel);

      const user: PresenceUser = {
        userId: 'user-1',
        userName: 'Test User',
        userEmail: 'test@example.com',
        cursorX: 100,
        cursorY: 200,
        status: 'active',
        lastSeen: new Date().toISOString(),
        // No selectedElementId
      };

      const { unsubscribe } = realtimeService.subscribeToPresence(
        valueCaseId,
        user,
        () => {}
      );

      expect(mockChannel.track).toHaveBeenCalledWith(user);

      unsubscribe();
    });
  });
});

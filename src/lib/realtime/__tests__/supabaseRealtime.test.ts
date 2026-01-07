/**
 * Supabase Realtime Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getRealtimeService, PresenceUser, CanvasElement, CanvasComment } from '../supabaseRealtime';

// Mock Supabase
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockResolvedValue('SUBSCRIBED'),
  unsubscribe: vi.fn().mockResolvedValue({ error: null }),
  track: vi.fn().mockResolvedValue({ error: null }),
  untrack: vi.fn().mockResolvedValue({ error: null }),
  send: vi.fn().mockResolvedValue({ error: null }),
  presenceState: vi.fn().mockReturnValue({}),
};

vi.mock('../../supabase', () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
  },
}));

describe('SupabaseRealtimeService', () => {
  let realtimeService: ReturnType<typeof getRealtimeService>;

  beforeEach(() => {
    vi.clearAllMocks();
    realtimeService = getRealtimeService();
  });

  afterEach(async () => {
    await realtimeService.cleanup();
  });

  describe('Element Subscriptions', () => {
    it('should subscribe to canvas elements', () => {
      const callback = vi.fn();
      const valueCaseId = 'vc-123';

      const unsubscribe = realtimeService.subscribeToElements(valueCaseId, callback);

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'canvas_elements',
          filter: `value_case_id=eq.${valueCaseId}`,
        }),
        expect.any(Function)
      );

      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should handle element INSERT events', () => {
      const callback = vi.fn();
      const valueCaseId = 'vc-123';

      realtimeService.subscribeToElements(valueCaseId, callback);

      // Simulate INSERT event
      const onCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes'
      );
      const eventHandler = onCall![2];

      const mockPayload = {
        eventType: 'INSERT',
        new: {
          id: 'elem-1',
          value_case_id: valueCaseId,
          element_type: 'text',
          position_x: 100,
          position_y: 200,
          content: { text: 'Hello' },
          z_index: 1,
          locked: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      eventHandler(mockPayload);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'elem-1',
          elementType: 'text',
          positionX: 100,
          positionY: 200,
        }),
        'INSERT'
      );
    });

    it('should unsubscribe from elements', async () => {
      const callback = vi.fn();
      const valueCaseId = 'vc-123';

      const unsubscribe = realtimeService.subscribeToElements(valueCaseId, callback);
      unsubscribe();

      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Comment Subscriptions', () => {
    it('should subscribe to comments', () => {
      const callback = vi.fn();
      const valueCaseId = 'vc-123';

      const unsubscribe = realtimeService.subscribeToComments(valueCaseId, callback);

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'canvas_comments',
          filter: `value_case_id=eq.${valueCaseId}`,
        }),
        expect.any(Function)
      );

      expect(typeof unsubscribe).toBe('function');
    });

    it('should handle comment INSERT events', () => {
      const callback = vi.fn();
      const valueCaseId = 'vc-123';

      realtimeService.subscribeToComments(valueCaseId, callback);

      const onCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'postgres_changes'
      );
      const eventHandler = onCall![2];

      const mockPayload = {
        eventType: 'INSERT',
        new: {
          id: 'comment-1',
          value_case_id: valueCaseId,
          user_id: 'user-1',
          user_name: 'John Doe',
          content: 'Great work!',
          resolved: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      };

      eventHandler(mockPayload);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'comment-1',
          userName: 'John Doe',
          content: 'Great work!',
        }),
        'INSERT'
      );
    });
  });

  describe('Presence Subscriptions', () => {
    it('should subscribe to presence', async () => {
      const callback = vi.fn();
      const valueCaseId = 'vc-123';
      const currentUser: PresenceUser = {
        userId: 'user-1',
        userName: 'John Doe',
        userEmail: 'john@example.com',
        status: 'active',
        lastSeen: new Date().toISOString(),
      };

      const unsubscribe = realtimeService.subscribeToPresence(
        valueCaseId,
        currentUser,
        callback
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'presence',
        { event: 'sync' },
        expect.any(Function)
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'presence',
        { event: 'join' },
        expect.any(Function)
      );

      expect(mockChannel.on).toHaveBeenCalledWith(
        'presence',
        { event: 'leave' },
        expect.any(Function)
      );

      expect(typeof unsubscribe).toBe('function');
    });

    it('should track presence on subscribe', async () => {
      const callback = vi.fn();
      const valueCaseId = 'vc-123';
      const currentUser: PresenceUser = {
        userId: 'user-1',
        userName: 'John Doe',
        userEmail: 'john@example.com',
        status: 'active',
        lastSeen: new Date().toISOString(),
      };

      realtimeService.subscribeToPresence(valueCaseId, currentUser, callback);

      // Wait for subscription
      await vi.waitFor(() => {
        expect(mockChannel.track).toHaveBeenCalledWith(currentUser);
      });
    });

    it('should update presence', async () => {
      const callback = vi.fn();
      const valueCaseId = 'vc-123';
      const currentUser: PresenceUser = {
        userId: 'user-1',
        userName: 'John Doe',
        userEmail: 'john@example.com',
        status: 'active',
        lastSeen: new Date().toISOString(),
      };

      realtimeService.subscribeToPresence(valueCaseId, currentUser, callback);

      await realtimeService.updatePresence(valueCaseId, {
        cursorX: 150,
        cursorY: 250,
      });

      expect(mockChannel.track).toHaveBeenCalledWith({
        cursorX: 150,
        cursorY: 250,
      });
    });

    it('should handle presence sync events', () => {
      const callback = vi.fn();
      const valueCaseId = 'vc-123';
      const currentUser: PresenceUser = {
        userId: 'user-1',
        userName: 'John Doe',
        userEmail: 'john@example.com',
        status: 'active',
        lastSeen: new Date().toISOString(),
      };

      mockChannel.presenceState.mockReturnValue({
        'user-1': [currentUser],
        'user-2': [
          {
            userId: 'user-2',
            userName: 'Jane Smith',
            userEmail: 'jane@example.com',
            status: 'active',
            lastSeen: new Date().toISOString(),
          },
        ],
      });

      realtimeService.subscribeToPresence(valueCaseId, currentUser, callback);

      const syncCall = mockChannel.on.mock.calls.find(
        (call) => call[0] === 'presence' && call[1].event === 'sync'
      );
      const syncHandler = syncCall![2];

      syncHandler();

      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ userId: 'user-1' }),
          expect.objectContaining({ userId: 'user-2' }),
        ])
      );
    });
  });

  describe('Broadcast', () => {
    it('should broadcast events', async () => {
      const valueCaseId = 'vc-123';
      const callback = vi.fn();

      // Subscribe first to create channel
      realtimeService.subscribeToElements(valueCaseId, callback);

      const event = {
        type: 'cursor_move' as const,
        payload: { x: 100, y: 200 },
        userId: 'user-1',
        timestamp: new Date().toISOString(),
      };

      await realtimeService.broadcast(valueCaseId, event);

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'cursor_move',
        payload: { x: 100, y: 200 },
      });
    });

    it('should subscribe to broadcast events', () => {
      const callback = vi.fn();
      const valueCaseId = 'vc-123';

      const unsubscribe = realtimeService.subscribeToBroadcast(valueCaseId, callback);

      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: '*' },
        expect.any(Function)
      );

      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('Connection Management', () => {
    it('should cleanup all channels', async () => {
      const callback = vi.fn();
      
      realtimeService.subscribeToElements('vc-1', callback);
      realtimeService.subscribeToElements('vc-2', callback);

      await realtimeService.cleanup();

      expect(mockChannel.unsubscribe).toHaveBeenCalledTimes(2);
    });

    it('should get connection status', () => {
      const callback = vi.fn();
      const valueCaseId = 'vc-123';

      const status1 = realtimeService.getConnectionStatus(valueCaseId, 'canvas');
      expect(status1).toBe('disconnected');

      realtimeService.subscribeToElements(valueCaseId, callback);

      const status2 = realtimeService.getConnectionStatus(valueCaseId, 'canvas');
      expect(status2).toBe('connected');
    });
  });
});

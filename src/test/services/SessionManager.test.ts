/**
 * SessionManager Tests
 * Tests for session management including memory leak prevention
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../../services/SessionManager';
import { authService } from '../../services/AuthService';

// Mock authService
vi.mock('../../services/AuthService', () => ({
  authService: {
    isAuthenticated: vi.fn(),
    logout: vi.fn(),
  },
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionManager = new SessionManager();
    
    // Spy on addEventListener and removeEventListener
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    
    // Mock sessionStorage
    const sessionStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', {
      value: sessionStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    sessionManager.terminate();
    vi.restoreAllMocks();
  });

  describe('Activity Listener Management', () => {
    it('should bind activity listeners on initialization', async () => {
      vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
      
      await sessionManager.initialize();
      
      // Should add listeners for all activity events
      const activityEvents = [
        'mousedown',
        'mousemove',
        'keydown',
        'scroll',
        'touchstart',
        'click',
      ];
      
      activityEvents.forEach(event => {
        expect(addEventListenerSpy).toHaveBeenCalledWith(
          event,
          expect.any(Function),
          { passive: true }
        );
      });
    });

    it('should properly unbind activity listeners on termination', async () => {
      vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
      
      await sessionManager.initialize();
      
      // Get the handler functions that were added
      const addedHandlers = new Map<string, Function>();
      addEventListenerSpy.mock.calls.forEach(call => {
        const [event, handler] = call;
        addedHandlers.set(event as string, handler as Function);
      });
      
      sessionManager.terminate();
      
      // Should remove listeners with the same handler references
      addedHandlers.forEach((handler, event) => {
        expect(removeEventListenerSpy).toHaveBeenCalledWith(event, handler);
      });
    });

    it('should not leak event listeners when initialized multiple times', async () => {
      vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
      
      // Initialize multiple times
      await sessionManager.initialize();
      sessionManager.terminate();
      
      await sessionManager.initialize();
      sessionManager.terminate();
      
      await sessionManager.initialize();
      sessionManager.terminate();
      
      // Each initialize should add listeners, each terminate should remove them
      // The number of adds and removes should match
      const addCount = addEventListenerSpy.mock.calls.length;
      const removeCount = removeEventListenerSpy.mock.calls.length;
      
      expect(addCount).toBe(removeCount);
    });

    it('should use the same handler reference for add and remove', async () => {
      vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
      
      await sessionManager.initialize();
      
      // Capture added handlers
      const addedHandlers = new Map<string, Function>();
      addEventListenerSpy.mock.calls.forEach(call => {
        const [event, handler] = call;
        addedHandlers.set(event as string, handler as Function);
      });
      
      sessionManager.terminate();
      
      // Verify removed handlers match added handlers
      removeEventListenerSpy.mock.calls.forEach(call => {
        const [event, handler] = call;
        const addedHandler = addedHandlers.get(event as string);
        expect(handler).toBe(addedHandler);
      });
    });

    it('should not bind listeners if already bound', async () => {
      vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
      
      await sessionManager.initialize();
      const initialCallCount = addEventListenerSpy.mock.calls.length;
      
      // Try to initialize again without terminating
      await sessionManager.initialize();
      
      // Should not add more listeners
      expect(addEventListenerSpy.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Session State Management', () => {
    it('should create new session on initialization', async () => {
      vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
      
      await sessionManager.initialize();
      
      const sessionInfo = sessionManager.getSessionInfo();
      expect(sessionInfo).not.toBeNull();
      expect(sessionInfo?.idleMinutes).toBeLessThan(1);
      expect(sessionInfo?.sessionAgeMinutes).toBeLessThan(1);
    });

    it('should clear session state on termination', async () => {
      vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
      
      await sessionManager.initialize();
      sessionManager.terminate();
      
      const sessionInfo = sessionManager.getSessionInfo();
      expect(sessionInfo).toBeNull();
    });

    it('should extend session when requested', async () => {
      vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
      
      await sessionManager.initialize();
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const infoBefore = sessionManager.getSessionInfo();
      
      sessionManager.extendSession();
      
      const infoAfter = sessionManager.getSessionInfo();
      
      // Idle time should be reset
      expect(infoAfter?.idleMinutes).toBeLessThan(infoBefore?.idleMinutes || 0);
    });
  });

  describe('Event Listeners', () => {
    it('should notify listeners on activity', async () => {
      vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
      
      const listener = vi.fn();
      sessionManager.addEventListener(listener);
      
      await sessionManager.initialize();
      
      // Should have received activity event
      expect(listener).toHaveBeenCalledWith('activity', expect.any(Object));
    });

    it('should remove event listeners', async () => {
      vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
      
      const listener = vi.fn();
      sessionManager.addEventListener(listener);
      
      await sessionManager.initialize();
      
      listener.mockClear();
      
      sessionManager.removeEventListener(listener);
      sessionManager.extendSession();
      
      // Should not receive events after removal
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not accumulate listeners on repeated init/terminate cycles', async () => {
      vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
      
      const cycles = 10;
      
      for (let i = 0; i < cycles; i++) {
        await sessionManager.initialize();
        sessionManager.terminate();
      }
      
      // After all cycles, no listeners should remain
      const finalAddCount = addEventListenerSpy.mock.calls.length;
      const finalRemoveCount = removeEventListenerSpy.mock.calls.length;
      
      expect(finalAddCount).toBe(finalRemoveCount);
    });

    it('should properly clean up throttled handlers', async () => {
      vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
      
      await sessionManager.initialize();
      
      // Get the handlers that were added
      const handlers = addEventListenerSpy.mock.calls.map(call => call[1]);
      
      sessionManager.terminate();
      
      // Get the handlers that were removed
      const removedHandlers = removeEventListenerSpy.mock.calls.map(call => call[1]);
      
      // Every added handler should have been removed
      handlers.forEach(handler => {
        expect(removedHandlers).toContain(handler);
      });
    });
  });
});

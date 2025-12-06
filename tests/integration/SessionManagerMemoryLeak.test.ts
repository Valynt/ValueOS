/**
 * Integration test demonstrating the memory leak fix
 * 
 * This test verifies that event listeners are properly cleaned up
 * when SessionManager is terminated, preventing memory leaks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../../services/SessionManager';

vi.mock('../../services/AuthService', () => ({
  authService: {
    isAuthenticated: vi.fn().mockResolvedValue(true),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('SessionManager Memory Leak Fix', () => {
  let originalAddEventListener: typeof window.addEventListener;
  let originalRemoveEventListener: typeof window.removeEventListener;
  let activeListeners: Map<string, Set<Function>>;

  beforeEach(() => {
    // Track active listeners to simulate browser behavior
    activeListeners = new Map();
    
    originalAddEventListener = window.addEventListener;
    originalRemoveEventListener = window.removeEventListener;

    // Mock addEventListener to track handlers
    window.addEventListener = vi.fn((event: string, handler: any, options?: any) => {
      if (!activeListeners.has(event)) {
        activeListeners.set(event, new Set());
      }
      activeListeners.get(event)!.add(handler);
      return originalAddEventListener.call(window, event, handler, options);
    });

    // Mock removeEventListener to track removals
    window.removeEventListener = vi.fn((event: string, handler: any) => {
      const handlers = activeListeners.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          activeListeners.delete(event);
        }
      }
      return originalRemoveEventListener.call(window, event, handler);
    });

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
      configurable: true,
    });
  });

  afterEach(() => {
    window.addEventListener = originalAddEventListener;
    window.removeEventListener = originalRemoveEventListener;
    vi.restoreAllMocks();
  });

  it('should not leak event listeners after multiple init/terminate cycles', async () => {
    const sessionManager = new SessionManager();
    
    // Simulate multiple session lifecycles
    const cycles = 5;
    
    for (let i = 0; i < cycles; i++) {
      await sessionManager.initialize();
      
      // Verify listeners are added
      expect(activeListeners.size).toBeGreaterThan(0);
      
      sessionManager.terminate();
      
      // Verify all listeners are removed
      expect(activeListeners.size).toBe(0);
    }
    
    // After all cycles, no listeners should remain
    expect(activeListeners.size).toBe(0);
  });

  it('should remove the exact same handler that was added', async () => {
    const sessionManager = new SessionManager();
    
    await sessionManager.initialize();
    
    // Capture the handlers that were added
    const addedHandlers = new Map<string, Function>();
    (window.addEventListener as any).mock.calls.forEach((call: any[]) => {
      const [event, handler] = call;
      addedHandlers.set(event, handler);
    });
    
    sessionManager.terminate();
    
    // Verify the same handlers were removed
    (window.removeEventListener as any).mock.calls.forEach((call: any[]) => {
      const [event, handler] = call;
      const addedHandler = addedHandlers.get(event);
      
      // This is the critical assertion - the handler reference must match
      expect(handler).toBe(addedHandler);
    });
  });

  it('should handle rapid init/terminate without accumulating listeners', async () => {
    const sessionManager = new SessionManager();
    
    // Rapid cycles
    for (let i = 0; i < 20; i++) {
      await sessionManager.initialize();
      sessionManager.terminate();
    }
    
    // No listeners should remain
    expect(activeListeners.size).toBe(0);
  });

  it('should properly clean up throttled handler reference', async () => {
    const sessionManager = new SessionManager();
    
    await sessionManager.initialize();
    
    // Get the number of unique handlers added
    const uniqueHandlers = new Set<Function>();
    (window.addEventListener as any).mock.calls.forEach((call: any[]) => {
      uniqueHandlers.add(call[1]);
    });
    
    sessionManager.terminate();
    
    // Get the number of unique handlers removed
    const removedHandlers = new Set<Function>();
    (window.removeEventListener as any).mock.calls.forEach((call: any[]) => {
      removedHandlers.add(call[1]);
    });
    
    // All unique handlers should have been removed
    expect(removedHandlers.size).toBe(uniqueHandlers.size);
    
    // Each handler that was added should have been removed
    uniqueHandlers.forEach(handler => {
      expect(removedHandlers.has(handler)).toBe(true);
    });
  });

  it('demonstrates the bug would have caused a memory leak', async () => {
    // This test documents what would have happened with the bug
    const sessionManager = new SessionManager();
    
    await sessionManager.initialize();
    
    const initialListenerCount = activeListeners.size;
    expect(initialListenerCount).toBeGreaterThan(0);
    
    sessionManager.terminate();
    
    // With the fix, all listeners are removed
    expect(activeListeners.size).toBe(0);
    
    // Without the fix, listeners would have remained because
    // removeEventListener was called with a different function reference
    // than what was passed to addEventListener
  });
});

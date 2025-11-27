/**
 * SDUI State Manager Tests
 * 
 * Tests for centralized state management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SDUIStateManager, resetSDUIStateManager } from '../../lib/state/SDUIStateManager';

describe('SDUIStateManager', () => {
  let stateManager: SDUIStateManager;

  beforeEach(() => {
    resetSDUIStateManager();
    stateManager = new SDUIStateManager({ debug: false });
  });

  afterEach(() => {
    stateManager.clear();
  });

  describe('Basic Operations', () => {
    it('should set and get state', () => {
      stateManager.set('test', { value: 42 });
      const result = stateManager.get('test');
      
      expect(result).toEqual({ value: 42 });
    });

    it('should return null for non-existent state', () => {
      const result = stateManager.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should check if state exists', () => {
      stateManager.set('test', 'value');
      
      expect(stateManager.has('test')).toBe(true);
      expect(stateManager.has('nonexistent')).toBe(false);
    });

    it('should delete state', () => {
      stateManager.set('test', 'value');
      expect(stateManager.has('test')).toBe(true);
      
      const deleted = stateManager.delete('test');
      
      expect(deleted).toBe(true);
      expect(stateManager.has('test')).toBe(false);
    });

    it('should return false when deleting non-existent state', () => {
      const deleted = stateManager.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should clear all state', () => {
      stateManager.set('key1', 'value1');
      stateManager.set('key2', 'value2');
      stateManager.set('key3', 'value3');
      
      expect(stateManager.size()).toBe(3);
      
      stateManager.clear();
      
      expect(stateManager.size()).toBe(0);
    });

    it('should get all keys', () => {
      stateManager.set('key1', 'value1');
      stateManager.set('key2', 'value2');
      stateManager.set('key3', 'value3');
      
      const keys = stateManager.keys();
      
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should get cache size', () => {
      expect(stateManager.size()).toBe(0);
      
      stateManager.set('key1', 'value1');
      expect(stateManager.size()).toBe(1);
      
      stateManager.set('key2', 'value2');
      expect(stateManager.size()).toBe(2);
      
      stateManager.delete('key1');
      expect(stateManager.size()).toBe(1);
    });
  });

  describe('Update Operations', () => {
    it('should update partial state', () => {
      stateManager.set('user', { name: 'John', age: 30, city: 'NYC' });
      
      stateManager.update('user', { age: 31 });
      
      const result = stateManager.get('user');
      expect(result).toEqual({ name: 'John', age: 31, city: 'NYC' });
    });

    it('should throw when updating non-existent state', () => {
      expect(() => {
        stateManager.update('nonexistent', { value: 42 });
      }).toThrow('Cannot update non-existent state');
    });
  });

  describe('Metadata', () => {
    it('should track version numbers', () => {
      stateManager.set('test', 'value1');
      let metadata = stateManager.getMetadata('test');
      expect(metadata?.version).toBe(1);
      
      stateManager.set('test', 'value2');
      metadata = stateManager.getMetadata('test');
      expect(metadata?.version).toBe(2);
      
      stateManager.set('test', 'value3');
      metadata = stateManager.getMetadata('test');
      expect(metadata?.version).toBe(3);
    });

    it('should track update timestamps', () => {
      const before = Date.now();
      stateManager.set('test', 'value');
      const after = Date.now();
      
      const metadata = stateManager.getMetadata('test');
      
      expect(metadata?.updatedAt).toBeGreaterThanOrEqual(before);
      expect(metadata?.updatedAt).toBeLessThanOrEqual(after);
    });

    it('should track dirty flag', () => {
      stateManager.set('test', 'value');
      
      const metadata = stateManager.getMetadata('test');
      expect(metadata?.dirty).toBe(true);
    });

    it('should return null metadata for non-existent state', () => {
      const metadata = stateManager.getMetadata('nonexistent');
      expect(metadata).toBeNull();
    });
  });

  describe('Subscriptions', () => {
    it('should notify subscribers on state change', () => {
      const callback = vi.fn();
      
      stateManager.subscribe('test', callback);
      stateManager.set('test', 'value');
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'test',
          newValue: 'value',
          oldValue: null,
          source: 'local'
        })
      );
    });

    it('should notify multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      stateManager.subscribe('test', callback1);
      stateManager.subscribe('test', callback2);
      stateManager.set('test', 'value');
      
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      
      const unsubscribe = stateManager.subscribe('test', callback);
      stateManager.set('test', 'value1');
      
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      stateManager.set('test', 'value2');
      
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should notify global subscribers', () => {
      const callback = vi.fn();
      
      stateManager.subscribeAll(callback);
      
      stateManager.set('key1', 'value1');
      stateManager.set('key2', 'value2');
      
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should unsubscribe global subscribers', () => {
      const callback = vi.fn();
      
      const unsubscribe = stateManager.subscribeAll(callback);
      stateManager.set('key1', 'value1');
      
      expect(callback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      stateManager.set('key2', 'value2');
      
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });

    it('should include old value in change event', () => {
      const callback = vi.fn();
      
      stateManager.set('test', 'old');
      stateManager.subscribe('test', callback);
      stateManager.set('test', 'new');
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          oldValue: 'old',
          newValue: 'new'
        })
      );
    });

    it('should notify on delete', () => {
      const callback = vi.fn();
      
      stateManager.set('test', 'value');
      stateManager.subscribe('test', callback);
      stateManager.delete('test');
      
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'test',
          oldValue: 'value',
          newValue: null
        })
      );
    });
  });

  describe('Cache Management', () => {
    it('should enforce max cache size', () => {
      const smallManager = new SDUIStateManager({ maxCacheSize: 3 });
      
      smallManager.set('key1', 'value1');
      smallManager.set('key2', 'value2');
      smallManager.set('key3', 'value3');
      
      expect(smallManager.size()).toBe(3);
      
      // Adding 4th item should evict oldest
      smallManager.set('key4', 'value4');
      
      expect(smallManager.size()).toBe(3);
      expect(smallManager.has('key1')).toBe(false); // Oldest evicted
      expect(smallManager.has('key4')).toBe(true);
    });

    it('should evict least recently updated entry', () => {
      const smallManager = new SDUIStateManager({ maxCacheSize: 3 });
      
      smallManager.set('key1', 'value1');
      smallManager.set('key2', 'value2');
      smallManager.set('key3', 'value3');
      
      // Update key1 to make it more recent
      smallManager.set('key1', 'updated');
      
      // Add key4, should evict key2 (oldest)
      smallManager.set('key4', 'value4');
      
      expect(smallManager.has('key1')).toBe(true);
      expect(smallManager.has('key2')).toBe(false); // Evicted
      expect(smallManager.has('key3')).toBe(true);
      expect(smallManager.has('key4')).toBe(true);
    });
  });

  describe('Type Safety', () => {
    it('should preserve types', () => {
      interface User {
        name: string;
        age: number;
      }

      stateManager.set<User>('user', { name: 'John', age: 30 });
      const user = stateManager.get<User>('user');
      
      expect(user).toEqual({ name: 'John', age: 30 });
      expect(user?.name).toBe('John');
      expect(user?.age).toBe(30);
    });

    it('should handle complex types', () => {
      interface ComplexState {
        users: Array<{ id: string; name: string }>;
        settings: {
          theme: 'light' | 'dark';
          notifications: boolean;
        };
        metadata: Record<string, any>;
      }

      const state: ComplexState = {
        users: [
          { id: '1', name: 'Alice' },
          { id: '2', name: 'Bob' }
        ],
        settings: {
          theme: 'dark',
          notifications: true
        },
        metadata: {
          version: 1,
          lastSync: Date.now()
        }
      };

      stateManager.set('complex', state);
      const result = stateManager.get<ComplexState>('complex');
      
      expect(result).toEqual(state);
    });
  });

  describe('Error Handling', () => {
    it('should handle subscriber errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const goodCallback = vi.fn();
      
      stateManager.subscribe('test', errorCallback);
      stateManager.subscribe('test', goodCallback);
      
      // Should not throw
      expect(() => {
        stateManager.set('test', 'value');
      }).not.toThrow();
      
      // Good callback should still be called
      expect(goodCallback).toHaveBeenCalled();
    });
  });

  describe('Concurrency', () => {
    it('should handle rapid updates', () => {
      const callback = vi.fn();
      stateManager.subscribe('counter', callback);
      
      // Rapid updates
      for (let i = 0; i < 100; i++) {
        stateManager.set('counter', i);
      }
      
      expect(callback).toHaveBeenCalledTimes(100);
      expect(stateManager.get('counter')).toBe(99);
    });

    it('should maintain version consistency', () => {
      for (let i = 0; i < 100; i++) {
        stateManager.set('test', i);
      }
      
      const metadata = stateManager.getMetadata('test');
      expect(metadata?.version).toBe(100);
    });
  });
});

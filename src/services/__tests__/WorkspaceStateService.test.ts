/**
 * Unit tests for WorkspaceStateService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WorkspaceStateService } from '../WorkspaceStateService';
import { WorkspaceState } from '../../types/sdui-integration';
import { CacheService } from '../CacheService';

// Mock dependencies
vi.mock('../CacheService');
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(),
        })),
      })),
      upsert: vi.fn(),
    })),
  },
}));
vi.mock('../../lib/logger');

describe('WorkspaceStateService', () => {
  let service: WorkspaceStateService;
  let mockCacheService: CacheService;

  beforeEach(() => {
    mockCacheService = new CacheService();
    service = new WorkspaceStateService(mockCacheService);
  });

  afterEach(() => {
    service.clearSubscriptions();
  });

  describe('getState', () => {
    it('should return cached state if available', async () => {
      const cachedState: WorkspaceState = {
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        data: {},
        metadata: {},
        lastUpdated: Date.now(),
        version: 1,
      };

      vi.spyOn(mockCacheService, 'get').mockReturnValue(cachedState);

      const state = await service.getState('workspace-1');

      expect(state).toEqual(cachedState);
      expect(mockCacheService.get).toHaveBeenCalledWith('workspace:state:workspace-1');
    });

    it('should return default state if no cache and no database record', async () => {
      vi.spyOn(mockCacheService, 'get').mockReturnValue(null);

      const state = await service.getState('workspace-1');

      expect(state.workspaceId).toBe('workspace-1');
      expect(state.lifecycleStage).toBe('opportunity');
      expect(state.version).toBe(1);
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(mockCacheService, 'get').mockImplementation(() => {
        throw new Error('Test error');
      });

      const state = await service.getState('workspace-1');

      expect(state).toBeDefined();
      expect(state.workspaceId).toBe('workspace-1');
    });
  });

  describe('updateState', () => {
    it('should update state and increment version', async () => {
      const initialState: WorkspaceState = {
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        data: {},
        metadata: {},
        lastUpdated: Date.now(),
        version: 1,
      };

      vi.spyOn(service, 'getState').mockResolvedValue(initialState);
      vi.spyOn(service, 'persistState').mockResolvedValue();
      vi.spyOn(mockCacheService, 'set');

      const updates = {
        lifecycleStage: 'target' as const,
        data: { test: 'value' },
      };

      const newState = await service.updateState('workspace-1', updates);

      expect(newState.lifecycleStage).toBe('target');
      expect(newState.data).toEqual({ test: 'value' });
      expect(newState.version).toBe(2);
      expect(service.persistState).toHaveBeenCalled();
    });

    it('should notify subscribers on state change', async () => {
      const initialState: WorkspaceState = {
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        data: {},
        metadata: {},
        lastUpdated: Date.now(),
        version: 1,
      };

      vi.spyOn(service, 'getState').mockResolvedValue(initialState);
      vi.spyOn(service, 'persistState').mockResolvedValue();

      const callback = vi.fn();
      service.subscribeToChanges('workspace-1', callback);

      await service.updateState('workspace-1', { lifecycleStage: 'target' });

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].lifecycleStage).toBe('target');
    });

    it('should emit state:updated event', async () => {
      const initialState: WorkspaceState = {
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        data: {},
        metadata: {},
        lastUpdated: Date.now(),
        version: 1,
      };

      vi.spyOn(service, 'getState').mockResolvedValue(initialState);
      vi.spyOn(service, 'persistState').mockResolvedValue();

      const eventCallback = vi.fn();
      service.on('state:updated', eventCallback);

      await service.updateState('workspace-1', { lifecycleStage: 'target' });

      expect(eventCallback).toHaveBeenCalled();
    });

    it('should validate state before updating', async () => {
      const initialState: WorkspaceState = {
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        data: {},
        metadata: {},
        lastUpdated: Date.now(),
        version: 1,
      };

      vi.spyOn(service, 'getState').mockResolvedValue(initialState);

      await expect(
        service.updateState('workspace-1', {
          lifecycleStage: 'invalid' as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('subscribeToChanges', () => {
    it('should register callback', () => {
      const callback = vi.fn();
      const unsubscribe = service.subscribeToChanges('workspace-1', callback);

      expect(service.getSubscriptionCount('workspace-1')).toBe(1);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow multiple subscriptions', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      service.subscribeToChanges('workspace-1', callback1);
      service.subscribeToChanges('workspace-1', callback2);

      expect(service.getSubscriptionCount('workspace-1')).toBe(2);
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = service.subscribeToChanges('workspace-1', callback);

      expect(service.getSubscriptionCount('workspace-1')).toBe(1);

      unsubscribe();

      expect(service.getSubscriptionCount('workspace-1')).toBe(0);
    });

    it('should handle multiple unsubscribes', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsubscribe1 = service.subscribeToChanges('workspace-1', callback1);
      const unsubscribe2 = service.subscribeToChanges('workspace-1', callback2);

      expect(service.getSubscriptionCount('workspace-1')).toBe(2);

      unsubscribe1();
      expect(service.getSubscriptionCount('workspace-1')).toBe(1);

      unsubscribe2();
      expect(service.getSubscriptionCount('workspace-1')).toBe(0);
    });
  });

  describe('persistState', () => {
    it('should persist state to database', async () => {
      const state: WorkspaceState = {
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        data: { test: 'value' },
        metadata: { key: 'value' },
        lastUpdated: Date.now(),
        version: 1,
      };

      vi.spyOn(service, 'getState').mockResolvedValue(state);

      await expect(service.persistState('workspace-1', state)).resolves.not.toThrow();
    });

    it('should handle persistence errors', async () => {
      const state: WorkspaceState = {
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        data: {},
        metadata: {},
        lastUpdated: Date.now(),
        version: 1,
      };

      // Mock Supabase error
      const { supabase } = await import('../../lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: new Error('Test error') }),
      } as any);

      await expect(service.persistState('workspace-1', state)).rejects.toThrow();
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate cache', () => {
      vi.spyOn(mockCacheService, 'delete');

      service.invalidateCache('workspace-1');

      expect(mockCacheService.delete).toHaveBeenCalledWith('workspace:state:workspace-1');
    });
  });

  describe('getCurrentVersion', () => {
    it('should return current version', async () => {
      const initialState: WorkspaceState = {
        workspaceId: 'workspace-1',
        lifecycleStage: 'opportunity',
        data: {},
        metadata: {},
        lastUpdated: Date.now(),
        version: 1,
      };

      vi.spyOn(service, 'getState').mockResolvedValue(initialState);
      vi.spyOn(service, 'persistState').mockResolvedValue();

      await service.updateState('workspace-1', { lifecycleStage: 'target' });

      const version = service.getCurrentVersion('workspace-1');
      expect(version).toBe(2);
    });

    it('should return 1 for unknown workspace', () => {
      const version = service.getCurrentVersion('unknown-workspace');
      expect(version).toBe(1);
    });
  });

  describe('clearSubscriptions', () => {
    it('should clear all subscriptions', () => {
      service.subscribeToChanges('workspace-1', vi.fn());
      service.subscribeToChanges('workspace-2', vi.fn());

      expect(service.getSubscriptionCount('workspace-1')).toBe(1);
      expect(service.getSubscriptionCount('workspace-2')).toBe(1);

      service.clearSubscriptions();

      expect(service.getSubscriptionCount('workspace-1')).toBe(0);
      expect(service.getSubscriptionCount('workspace-2')).toBe(0);
    });
  });
});

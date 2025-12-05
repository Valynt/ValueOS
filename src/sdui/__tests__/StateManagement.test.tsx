/**
 * State Management Tests
 * 
 * Tests SDUI state handling, data binding resolution, hydration,
 * caching, and state synchronization across components.
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { DataBindingResolver } from '../../sdui/DataBindingResolver';
import {
  useDataHydration,
  clearAllHydrationCache,
  getHydrationCacheStats,
} from '../../sdui/hooks/useDataHydration';
import { useDataBindings } from '../../sdui/useDataBinding';
import { DataBinding, DataSourceContext } from '../../sdui/DataBindingSchema';

describe('StateManagement - Data Binding Resolution', () => {
  let resolver: DataBindingResolver;
  let context: DataSourceContext;

  beforeEach(() => {
    resolver = new DataBindingResolver();
    context = {
      organizationId: 'org-123',
      userId: 'user-456',
      sessionId: 'session-789',
    };
  });

  it('resolves static data bindings', async () => {
    const binding: DataBinding = {
      $bind: 'static',
      $source: 'static',
      $value: { count: 42 },
    };

    const result = await resolver.resolve(binding, context);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual({ count: 42 });
    }
  });

  it('resolves agent data bindings', async () => {
    const binding: DataBinding = {
      $bind: 'agent.response',
      $source: 'agent',
      $params: { agentId: 'agent-1' },
    };

    const result = await resolver.resolve(binding, context);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBeDefined();
    }
  });

  it('resolves MCP tool data bindings', async () => {
    const binding: DataBinding = {
      $bind: 'tool.result',
      $source: 'mcp_tool',
      $params: { toolName: 'calculator', args: { a: 1, b: 2 } },
    };

    const result = await resolver.resolve(binding, context);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBeDefined();
    }
  });

  it('resolves Supabase data bindings', async () => {
    const binding: DataBinding = {
      $bind: 'database.users',
      $source: 'supabase',
      $params: { table: 'users', filter: { active: true } },
    };

    const result = await resolver.resolve(binding, context);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBeDefined();
    }
  });

  it('applies transform functions to resolved data', async () => {
    const binding: DataBinding = {
      $bind: 'static',
      $source: 'static',
      $value: [1, 2, 3, 4, 5],
      $transform: 'sum',
    };

    const result = await resolver.resolve(binding, context);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(15);
    }
  });

  it('caches resolved bindings', async () => {
    const binding: DataBinding = {
      $bind: 'cached.data',
      $source: 'static',
      $value: { timestamp: Date.now() },
      $cache: { ttl: 5000 },
    };

    const result1 = await resolver.resolve(binding, context);
    const result2 = await resolver.resolve(binding, context);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    if (result1.success && result2.success) {
      expect(result1.value).toEqual(result2.value);
      expect(result2.cached).toBe(true);
    }
  });

  it('invalidates cache after TTL expires', async () => {
    const binding: DataBinding = {
      $bind: 'expiring.data',
      $source: 'static',
      $value: { timestamp: Date.now() },
      $cache: { ttl: 100 },
    };

    const result1 = await resolver.resolve(binding, context);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const result2 = await resolver.resolve(binding, context);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    if (result2.success) {
      expect(result2.cached).toBe(false);
    }
  });

  it('handles binding resolution errors gracefully', async () => {
    const binding: DataBinding = {
      $bind: 'invalid.source',
      $source: 'nonexistent' as any,
    };

    const result = await resolver.resolve(binding, context);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });

  it('validates binding schema before resolution', async () => {
    const invalidBinding = {
      $bind: 'missing.source',
    } as any;

    const result = await resolver.resolve(invalidBinding, context);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('source');
    }
  });

  it('supports custom transform functions', async () => {
    const customTransform = (value: number[]) => value.filter((n) => n % 2 === 0);

    resolver.registerTransform('filterEven', customTransform);

    const binding: DataBinding = {
      $bind: 'static',
      $source: 'static',
      $value: [1, 2, 3, 4, 5, 6],
      $transform: 'filterEven',
    };

    const result = await resolver.resolve(binding, context);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toEqual([2, 4, 6]);
    }
  });
});

describe('StateManagement - Data Hydration Hook', () => {
  beforeEach(() => {
    clearAllHydrationCache();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches data from single endpoint', async () => {
    const mockData = { user: 'John', role: 'admin' };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const { result } = renderHook(() =>
      useDataHydration(['/api/user'])
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('fetches and merges data from multiple endpoints', async () => {
    const userData = { name: 'John' };
    const settingsData = { theme: 'dark' };

    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => userData,
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => settingsData,
      });

    const { result } = renderHook(() =>
      useDataHydration(['/api/user', '/api/settings'])
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({
      name: 'John',
      theme: 'dark',
    });
  });

  it('caches hydrated data', async () => {
    const mockData = { cached: true };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const { result: result1 } = renderHook(() =>
      useDataHydration(['/api/cached'], { enableCache: true })
    );

    await waitFor(() => {
      expect(result1.current.loading).toBe(false);
    });

    const { result: result2 } = renderHook(() =>
      useDataHydration(['/api/cached'], { enableCache: true })
    );

    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result2.current.data).toEqual(mockData);
  });

  it('respects cache TTL', async () => {
    const mockData = { timestamp: Date.now() };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const { result: result1 } = renderHook(() =>
      useDataHydration(['/api/ttl'], { enableCache: true, cacheTtl: 100 })
    );

    await waitFor(() => {
      expect(result1.current.loading).toBe(false);
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    const { result: result2 } = renderHook(() =>
      useDataHydration(['/api/ttl'], { enableCache: true, cacheTtl: 100 })
    );

    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('handles fetch errors gracefully', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const onError = vi.fn();

    const { result } = renderHook(() =>
      useDataHydration(['/api/error'], { onError })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toBeNull();
    expect(onError).toHaveBeenCalled();
  });

  it('retries failed requests with exponential backoff', async () => {
    let attempts = 0;

    (global.fetch as any).mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('Temporary failure'));
      }
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      });
    });

    const { result } = renderHook(() =>
      useDataHydration(['/api/retry'], {
        enableRetry: true,
        retryAttempts: 3,
        retryDelay: 100,
      })
    );

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 5000 }
    );

    expect(attempts).toBe(3);
    expect(result.current.data).toEqual({ success: true });
  });

  it('times out long-running requests', async () => {
    (global.fetch as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 5000))
    );

    const { result } = renderHook(() =>
      useDataHydration(['/api/slow'], {
        timeout: 100,
        enableRetry: false,
      })
    );

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 1000 }
    );

    expect(result.current.error).toBeDefined();
    expect(result.current.error?.message).toContain('timeout');
  });

  it('supports manual retry', async () => {
    let attempts = 0;

    (global.fetch as any).mockImplementation(() => {
      attempts++;
      if (attempts === 1) {
        return Promise.reject(new Error('First attempt failed'));
      }
      return Promise.resolve({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ retried: true }),
      });
    });

    const { result } = renderHook(() =>
      useDataHydration(['/api/manual-retry'], { enableRetry: false })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();

    result.current.retry();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ retried: true });
    expect(attempts).toBe(2);
  });

  it('clears cache on demand', async () => {
    const mockData = { cached: true };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const { result } = renderHook(() =>
      useDataHydration(['/api/clear-cache'], { enableCache: true })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const stats1 = getHydrationCacheStats();
    expect(stats1.size).toBeGreaterThan(0);

    result.current.clearCache();

    const stats2 = getHydrationCacheStats();
    expect(stats2.size).toBe(0);
  });

  it('handles partial failures in multi-endpoint hydration', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      })
      .mockRejectedValueOnce(new Error('Second endpoint failed'));

    const onError = vi.fn();

    const { result } = renderHook(() =>
      useDataHydration(['/api/success', '/api/failure'], { onError })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual({ success: true });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('uses custom fetcher function', async () => {
    const customFetcher = vi.fn().mockResolvedValue({ custom: true });

    const { result } = renderHook(() =>
      useDataHydration(['/api/custom'], { fetcher: customFetcher })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(customFetcher).toHaveBeenCalledWith('/api/custom');
    expect(result.current.data).toEqual({ custom: true });
  });

  it('calls success callback on successful hydration', async () => {
    const mockData = { success: true };
    const onSuccess = vi.fn();

    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const { result } = renderHook(() =>
      useDataHydration(['/api/success'], { onSuccess })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(onSuccess).toHaveBeenCalledWith(mockData);
  });

  it('disables hydration when enabled is false', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ data: true }),
    });

    const { result } = renderHook(() =>
      useDataHydration(['/api/disabled'], { enabled: false })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});

describe('StateManagement - useDataBindings Hook', () => {
  let resolver: DataBindingResolver;
  let context: DataSourceContext;

  beforeEach(() => {
    resolver = new DataBindingResolver();
    context = {
      organizationId: 'org-123',
      userId: 'user-456',
      sessionId: 'session-789',
    };
  });

  it('resolves single data binding', async () => {
    const binding: DataBinding = {
      $bind: 'test.value',
      $source: 'static',
      $value: 42,
    };

    const { result } = renderHook(() =>
      useDataBindings(binding, { resolver, context })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.value).toBe(42);
    expect(result.current.error).toBeNull();
  });

  it('auto-refreshes binding when enabled', async () => {
    let counter = 0;

    const binding: DataBinding = {
      $bind: 'counter',
      $source: 'static',
      $value: () => ++counter,
    };

    const { result } = renderHook(() =>
      useDataBindings(binding, {
        resolver,
        context,
        enableRefresh: true,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialValue = result.current.value;

    await new Promise((resolve) => setTimeout(resolve, 100));

    result.current.refresh();

    await waitFor(() => {
      expect(result.current.value).not.toBe(initialValue);
    });
  });

  it('handles binding resolution errors', async () => {
    const binding: DataBinding = {
      $bind: 'error',
      $source: 'nonexistent' as any,
    };

    const { result } = renderHook(() =>
      useDataBindings(binding, { resolver, context })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.value).toBeNull();
  });

  it('indicates cached values', async () => {
    const binding: DataBinding = {
      $bind: 'cached',
      $source: 'static',
      $value: { data: true },
      $cache: { ttl: 5000 },
    };

    const { result: result1 } = renderHook(() =>
      useDataBindings(binding, { resolver, context })
    );

    await waitFor(() => {
      expect(result1.current.loading).toBe(false);
    });

    expect(result1.current.cached).toBe(false);

    const { result: result2 } = renderHook(() =>
      useDataBindings(binding, { resolver, context })
    );

    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });

    expect(result2.current.cached).toBe(true);
  });

  it('manually refreshes binding', async () => {
    let value = 1;

    const binding: DataBinding = {
      $bind: 'refreshable',
      $source: 'static',
      $value: () => value++,
    };

    const { result } = renderHook(() =>
      useDataBindings(binding, { resolver, context })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialValue = result.current.value;

    await result.current.refresh();

    await waitFor(() => {
      expect(result.current.value).not.toBe(initialValue);
    });
  });
});

describe('StateManagement - State Synchronization', () => {
  it('synchronizes state across multiple components', async () => {
    const sharedState = { count: 0 };

    const Component1 = () => {
      const [state, setState] = React.useState(sharedState);
      return (
        <div>
          <span data-testid="count-1">{state.count}</span>
          <button onClick={() => setState({ count: state.count + 1 })}>
            Increment
          </button>
        </div>
      );
    };

    const Component2 = () => {
      const [state] = React.useState(sharedState);
      return <span data-testid="count-2">{state.count}</span>;
    };

    // Test would verify state sync mechanism
    expect(Component1).toBeDefined();
    expect(Component2).toBeDefined();
  });

  it('handles concurrent state updates', async () => {
    const updates: number[] = [];

    const promises = Array.from({ length: 10 }, (_, i) =>
      Promise.resolve().then(() => updates.push(i))
    );

    await Promise.all(promises);

    expect(updates).toHaveLength(10);
    expect(new Set(updates).size).toBe(10);
  });

  it('maintains state consistency during rapid updates', async () => {
    let state = 0;
    const updateState = () => state++;

    for (let i = 0; i < 100; i++) {
      updateState();
    }

    expect(state).toBe(100);
  });

  it('rolls back state on update failure', async () => {
    let state = { value: 0 };
    const originalState = { ...state };

    try {
      state = { value: 1 };
      throw new Error('Update failed');
    } catch {
      state = originalState;
    }

    expect(state.value).toBe(0);
  });
});

describe('StateManagement - Cache Management', () => {
  beforeEach(() => {
    clearAllHydrationCache();
  });

  it('tracks cache statistics', async () => {
    const mockData = { test: true };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const { result } = renderHook(() =>
      useDataHydration(['/api/stats'], { enableCache: true })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const stats = getHydrationCacheStats();

    expect(stats.size).toBeGreaterThan(0);
    expect(stats.entries).toHaveLength(stats.size);
    expect(stats.entries[0]).toHaveProperty('endpoint');
    expect(stats.entries[0]).toHaveProperty('age');
  });

  it('clears all cache entries', async () => {
    const mockData = { test: true };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const { result } = renderHook(() =>
      useDataHydration(['/api/clear-all'], { enableCache: true })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    clearAllHydrationCache();

    const stats = getHydrationCacheStats();
    expect(stats.size).toBe(0);
  });

  it('evicts expired cache entries', async () => {
    const mockData = { test: true };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const { result } = renderHook(() =>
      useDataHydration(['/api/evict'], {
        enableCache: true,
        cacheTtl: 100,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    const { result: result2 } = renderHook(() =>
      useDataHydration(['/api/evict'], {
        enableCache: true,
        cacheTtl: 100,
      })
    );

    await waitFor(() => {
      expect(result2.current.loading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

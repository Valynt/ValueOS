/**
 * queryConfig — Optimized TanStack Query stale times
 *
 * Caching strategy for Phase 4: Performance (90+ Lighthouse)
 * Different data types have different freshness requirements.
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/caching
 */

import type { QueryClientConfig } from '@tanstack/react-query';

// Stale time constants (in milliseconds)
export const STALE_TIMES = {
  // Case data: changes frequently during editing
  CASE_DATA: 30_000, // 30 seconds

  // Dashboard stats: acceptable to be slightly stale
  DASHBOARD_STATS: 60_000, // 1 minute

  // Warmth history: rarely changes
  WARMTH_HISTORY: 300_000, // 5 minutes

  // Graph data: changes periodically
  GRAPH_DATA: 120_000, // 2 minutes

  // User preferences: only change on explicit edit
  USER_PREFERENCES: Number.POSITIVE_INFINITY,

  // Warmth tokens and config: versioned, cache aggressively
  STATIC_CONFIG: Number.POSITIVE_INFINITY,

  // Realization data: changes infrequently
  REALIZATION_DATA: 300_000, // 5 minutes

  // Evidence: depends on user activity
  EVIDENCE: 60_000, // 1 minute

  // Search results: don't cache
  SEARCH: 0,
} as const;

// Cache time constants (garbage collection time)
export const CACHE_TIMES = {
  // Default: 5 minutes
  DEFAULT: 300_000,

  // Long-lived: 1 hour
  LONG_LIVED: 3_600_000,

  // Short-lived: 1 minute
  SHORT_LIVED: 60_000,
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  // Default retry count
  COUNT: 3,

  // Exponential backoff delay
  DELAY: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30_000),
} as const;

// Prefetch configuration
export const PREFETCH_CONFIG = {
  // Stale time for prefetched data
  STALE_TIME: 60_000,

  // Cache time for prefetched data
  CACHE_TIME: 300_000,
} as const;

// Default query client config for ValyntApp
export const defaultQueryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Stale times are set per-query, but default to 0
      staleTime: 0,

      // Cache time (garbage collection)
      gcTime: CACHE_TIMES.DEFAULT,

      // Retry failed requests
      retry: RETRY_CONFIG.COUNT,
      retryDelay: RETRY_CONFIG.DELAY,

      // Refetch on window focus (disabled for data entry flows)
      refetchOnWindowFocus: false,

      // Refetch on reconnect
      refetchOnReconnect: true,

      // Keep previous data while fetching new
      placeholderData: (previousData: unknown) => previousData,

      // Error handling - don't throw on 404s
      throwOnError: (error: Error) => {
        if (error.message?.includes('404')) return false;
        return true;
      },
    },
    mutations: {
      // Retry mutations only on network errors
      retry: (failureCount: number, error: Error) => {
        if (error.message?.includes('network')) {
          return failureCount < 2;
        }
        return false;
      },

      // Optimistic updates are opt-in per-mutation
    },
  },
};

// Query key factories for consistent cache management
export const queryKeys = {
  // Case-related queries
  cases: {
    all: ['cases'] as const,
    list: (filters: Record<string, unknown>) => ['cases', 'list', filters] as const,
    detail: (caseId: string) => ['cases', 'detail', caseId] as const,
    warmth: (caseId: string) => ['cases', 'warmth', caseId] as const,
    graph: (caseId: string) => ['cases', 'graph', caseId] as const,
    realization: (caseId: string) => ['cases', 'realization', caseId] as const,
  },

  // Dashboard queries
  dashboard: {
    stats: ['dashboard', 'stats'] as const,
    activity: ['dashboard', 'activity'] as const,
  },

  // User queries
  user: {
    profile: ['user', 'profile'] as const,
    preferences: ['user', 'preferences'] as const,
    tenants: ['user', 'tenants'] as const,
  },

  // Workspace queries
  workspace: {
    modes: ['workspace', 'modes'] as const,
    modePreference: (caseId: string) => ['workspace', 'mode-preference', caseId] as const,
  },

  // Static config
  config: {
    warmthTokens: ['config', 'warmth-tokens'] as const,
    sduiSchema: ['config', 'sdui-schema'] as const,
  },
} as const;

// Helper to create query options with proper stale times
export function createQueryOptions<TData>(
  staleTime: number,
  options?: Record<string, unknown>
) {
  return {
    staleTime,
    ...options,
  };
}

// Preset query options for common data types
export const queryOptions = {
  // Case data - changes frequently
  caseData: createQueryOptions(STALE_TIMES.CASE_DATA, {
    gcTime: CACHE_TIMES.SHORT_LIVED,
  }),

  // Dashboard stats - can be slightly stale
  dashboardStats: createQueryOptions(STALE_TIMES.DASHBOARD_STATS),

  // Warmth history - rarely changes
  warmthHistory: createQueryOptions(STALE_TIMES.WARMTH_HISTORY, {
    gcTime: CACHE_TIMES.LONG_LIVED,
  }),

  // Graph data
  graphData: createQueryOptions(STALE_TIMES.GRAPH_DATA),

  // User preferences - cache forever
  userPreferences: createQueryOptions(STALE_TIMES.USER_PREFERENCES, {
    gcTime: CACHE_TIMES.LONG_LIVED,
  }),

  // Static config - cache forever
  staticConfig: createQueryOptions(STALE_TIMES.STATIC_CONFIG, {
    gcTime: Number.POSITIVE_INFINITY,
  }),

  // Realization data
  realizationData: createQueryOptions(STALE_TIMES.REALIZATION_DATA),

  // Evidence
  evidence: createQueryOptions(STALE_TIMES.EVIDENCE),

  // Search - don't cache
  search: createQueryOptions(STALE_TIMES.SEARCH),
};

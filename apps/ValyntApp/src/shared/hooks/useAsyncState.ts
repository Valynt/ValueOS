/**
 * useAsyncState Hook
 *
 * Custom hook for managing asynchronous operations with loading states,
 * error handling, and retry logic. Replaces scattered async state management.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

export interface UseAsyncStateOptions<T> {
  initialData?: T | null;
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  retryAttempts?: number;
  retryDelay?: number;
  cacheTime?: number;
}

export interface AsyncActions<T> {
  execute: (...args: unknown[]) => Promise<T>;
  reset: () => void;
  retry: () => void;
  setData: (data: T) => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAsyncState<T>(
  asyncFunction: (...args: unknown[]) => Promise<T>,
  options: UseAsyncStateOptions<T> = {}
): [AsyncState<T>, AsyncActions<T>] {
  const {
    initialData = null,
    onSuccess,
    onError,
    retryAttempts = 3,
    retryDelay = 1000,
  } = options;

  // State management
  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    loading: false,
    error: null,
    lastUpdated: null,
  });

  // Refs for tracking
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const lastArgsRef = useRef<unknown[] | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Execute async function
  const execute = useCallback(
    async (...args: unknown[]): Promise<T> => {
      // Cancel previous request if still running
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Store args for retry
      lastArgsRef.current = args;

      // Reset state
      setState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const result = await asyncFunction(...args);

        // Check if component is still mounted and request wasn't aborted
        if (!mountedRef.current || abortController.signal.aborted) {
          throw new Error("Request aborted");
        }

        // Update state with success
        setState({
          data: result,
          loading: false,
          error: null,
          lastUpdated: new Date(),
        });

        // Reset retry count
        retryCountRef.current = 0;

        // Call success callback
        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        // Check if component is still mounted
        if (!mountedRef.current) {
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        // Update state with error
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));

        // Call error callback
        if (onError) {
          onError(errorMessage);
        }

        throw error;
      }
    },
    [asyncFunction, onSuccess, onError]
  );

  // Retry last failed request
  const retry = useCallback(async (): Promise<void> => {
    if (retryCountRef.current >= retryAttempts) {
      return;
    }

    retryCountRef.current += 1;

    // Wait before retry
    if (retryDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    // Retry with last args if available
    if (lastArgsRef.current) {
      try {
        await execute(...lastArgsRef.current);
      } catch (_error) {
        // Error is already handled in execute
      }
    }
  }, [execute, retryAttempts, retryDelay]);

  // Reset state
  const reset = useCallback((): void => {
    setState({
      data: initialData,
      loading: false,
      error: null,
      lastUpdated: null,
    });
    retryCountRef.current = 0;
    lastArgsRef.current = null;
  }, [initialData]);

  // Set data directly
  const setData = useCallback((data: T): void => {
    setState({
      data,
      loading: false,
      error: null,
      lastUpdated: new Date(),
    });
  }, []);

  return [state, { execute, reset, retry, setData }];
}

// ============================================================================
// Specialized Hooks
// ============================================================================

/**
 * Hook for API calls with automatic loading and error states
 */
export function useApiCall<T>(
  apiFunction: (...args: unknown[]) => Promise<T>,
  options?: UseAsyncStateOptions<T>
) {
  return useAsyncState(apiFunction, options);
}

/**
 * Hook for cached data with automatic refresh
 */
export function useCachedData<T>(
  key: string,
  fetchFunction: () => Promise<T>,
  options: UseAsyncStateOptions<T> & { refreshInterval?: number } = {}
) {
  const { refreshInterval, ...asyncOptions } = options;
  const [state, actions] = useAsyncState(fetchFunction, asyncOptions);

  // Auto-refresh effect
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      actions.execute();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, actions]);

  // Check cache on mount
  useEffect(() => {
    const cached = localStorage.getItem(`cache_${key}`);
    if (cached && !state.data) {
      try {
        const parsed = JSON.parse(cached);
        const now = Date.now();

        // Check if cache is still valid
        if (now - parsed.timestamp < (options.cacheTime || 300000)) {
          actions.setData(parsed.data);
        } else {
          // Cache expired, fetch fresh data
          actions.execute();
        }
      } catch (_error) {
        // Invalid cache, fetch fresh data
        actions.execute();
      }
    } else if (!state.data && !state.loading) {
      // No cache, fetch data
      actions.execute();
    }
  }, [key, options.cacheTime, actions, state.data, state.loading]);

  // Update cache when data changes
  useEffect(() => {
    if (state.data && state.lastUpdated) {
      const payload = JSON.stringify({
        data: state.data,
        timestamp: state.lastUpdated.getTime(),
      });
      // Skip caching payloads that are likely to exceed the ~5 MB localStorage quota.
      // 4 MB leaves headroom for other stored keys.
      const MAX_CACHE_BYTES = 4 * 1024 * 1024;
      const payloadBytes = new TextEncoder().encode(payload).length;
      if (payloadBytes > MAX_CACHE_BYTES) {
        logger.warn(
          `[useCachedData] Skipping cache write for key "${key}": payload size ${payloadBytes} bytes exceeds limit.`
        );
        return;
      }
      try {
        localStorage.setItem(`cache_${key}`, payload);
      } catch (error) {
        if (error instanceof DOMException && error.name === "QuotaExceededError") {
          logger.warn(
            `[useCachedData] localStorage quota exceeded for key "${key}". Cache write skipped.`,
            error
          );
        } else {
          // Unexpected storage errors: log and notify, but do not throw from inside useEffect.
          logger.error(
            `[useCachedData] Unexpected localStorage error while writing cache for key "${key}". Cache write skipped.`,
            error
          );
          if (options.onError) {
            options.onError(
              `Unexpected localStorage error while caching data for key "${key}".`
            );
          }
        }
      }
    }
  }, [key, state.data, state.lastUpdated, options.onError]);

  return [state, actions] as const;
}

/**
 * Hook for paginated data
 */
export function usePaginatedData<T>(
  fetchFunction: (page: number, limit: number) => Promise<{ data: T[]; total: number }>,
  options: UseAsyncStateOptions<{ data: T[]; total: number }> & { defaultLimit?: number } = {}
) {
  const { defaultLimit = 20, ...asyncOptions } = options;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);

  const [state, actions] = useAsyncState(
    (pageNum: number, pageLimit: number) => fetchFunction(pageNum, pageLimit),
    asyncOptions
  );

  const loadPage = useCallback(
    (newPage: number, newLimit?: number) => {
      const limitToUse = newLimit || limit;
      setPage(newPage);
      if (newLimit) setLimit(newLimit);
      return actions.execute(newPage, limitToUse);
    },
    [actions, limit]
  );

  const nextPage = useCallback(() => {
    if (state.data && page * limit < state.data.total) {
      return loadPage(page + 1);
    }
  }, [page, limit, state.data, loadPage]);

  const prevPage = useCallback(() => {
    if (page > 1) {
      return loadPage(page - 1);
    }
  }, [page, loadPage]);

  const refresh = useCallback(() => {
    return loadPage(page, limit);
  }, [loadPage, page, limit]);

  return {
    ...state,
    page,
    limit,
    totalPages: state.data ? Math.ceil(state.data.total / limit) : 0,
    hasNextPage: state.data ? page * limit < state.data.total : false,
    hasPrevPage: page > 1,
    loadPage,
    nextPage,
    prevPage,
    refresh,
    setLimit,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a debounced version of an async function
 */
export function useDebouncedAsync<T>(
  asyncFunction: (...args: unknown[]) => Promise<T>,
  delay: number = 300
) {
  const debouncedRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: unknown[]) => {
      return new Promise<T>((resolve, reject) => {
        // Clear previous timeout
        if (debouncedRef.current) {
          clearTimeout(debouncedRef.current);
        }

        // Set new timeout
        debouncedRef.current = setTimeout(async () => {
          try {
            const result = await asyncFunction(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, delay);
      });
    },
    [asyncFunction, delay]
  );
}

/**
 * Create a throttled version of an async function
 */
export function useThrottledAsync<T>(
  asyncFunction: (...args: unknown[]) => Promise<T>,
  limit: number = 1000
) {
  const lastExecutionRef = useRef<number>(0);

  return useCallback(
    (...args: unknown[]) => {
      return new Promise<T>((resolve, reject) => {
        const now = Date.now();
        const timeSinceLastExecution = now - lastExecutionRef.current;

        if (timeSinceLastExecution >= limit) {
          lastExecutionRef.current = now;

          asyncFunction(...args)
            .then(resolve)
            .catch(reject);
        } else {
          const delay = limit - timeSinceLastExecution;

          setTimeout(() => {
            lastExecutionRef.current = Date.now();

            asyncFunction(...args)
              .then(resolve)
              .catch(reject);
          }, delay);
        }
      });
    },
    [asyncFunction, limit]
  );
}

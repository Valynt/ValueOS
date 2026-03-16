import { logger } from "@shared/lib/logger";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Options for configuring data hydration behavior
 */
export interface DataHydrationOptions {
  /**
   * Whether hydration is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Callback when hydration succeeds
   */
  onSuccess?: (data: unknown) => void;

  /**
   * Callback when hydration fails
   */
  onError?: (error: Error, endpoint: string) => void;

  /**
   * Maximum time (ms) to wait before timing out
   * @default 10000
   */
  timeout?: number;

  /**
   * Enable automatic retry on failure
   * @default true
   */
  enableRetry?: boolean;

  /**
   * Number of retry attempts
   * @default 3
   */
  retryAttempts?: number;

  /**
   * Delay (ms) between retry attempts (exponential backoff)
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Custom data fetcher function
   */
  fetcher?: (endpoint: string) => Promise<unknown>;

  /**
   * Enable caching of hydrated data
   * @default true
   */
  enableCache?: boolean;

  /**
   * Cache TTL in milliseconds
   * @default 300000 (5 minutes)
   */
  cacheTtl?: number;
}

/**
 * Result of the data hydration hook
 */
export interface DataHydrationResult {
  /**
   * The hydrated data (merged from all endpoints)
   */
  data: Record<string, unknown> | null;

  /**
   * Whether data is currently being fetched
   */
  loading: boolean;

  /**
   * Error if hydration failed
   */
  error: Error | null;

  /**
   * Function to manually retry hydration
   */
  retry: () => void;

  /**
   * Function to clear cached data
   */
  clearCache: () => void;
}

/**
 * Cache entry structure
 */
interface CacheEntry {
  data: unknown;
  timestamp: number;
}

/**
 * Global cache for hydrated data
 */
const hydrationCache = new Map<string, CacheEntry>();

/**
 * Default data fetcher using fetch API
 */
const defaultFetcher = async (endpoint: string): Promise<unknown> => {
  const response = await globalThis.fetch(endpoint);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
};

/**
 * Calculate exponential backoff delay
 */
const calculateBackoff = (attempt: number, baseDelay: number): number => {
  return baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
};

/**
 * Check if cache entry is still valid
 */
const isCacheValid = (entry: CacheEntry, ttl: number): boolean => {
  return Date.now() - entry.timestamp < ttl;
};

/**
 * Hook for hydrating component data from multiple endpoints
 *
 * Supports:
 * - Multiple concurrent endpoint fetches
 * - Automatic retry with exponential backoff
 * - Request timeout
 * - Data caching
 * - Error handling
 *
 * @param endpoints - Array of endpoint URLs to fetch data from
 * @param options - Configuration options
 * @returns DataHydrationResult with data, loading state, and error
 *
 * @example
 * ```tsx
 * const { data, loading, error, retry } = useDataHydration(
 *   ['/api/user', '/api/settings'],
 *   {
 *     onSuccess: (data) => logger.debug('Hydrated:', data),
 *     onError: (error) => logger.error('Failed:', error),
 *     timeout: 5000,
 *   }
 * );
 * ```
 */
export function useDataHydration(
  endpoints: string[],
  options: DataHydrationOptions = {}
): DataHydrationResult {
  const {
    enabled = true,
    onSuccess,
    onError,
    timeout = 10000,
    enableRetry = true,
    retryAttempts = 3,
    retryDelay = 1000,
    fetcher = defaultFetcher,
    enableCache = true,
    cacheTtl = 300000, // 5 minutes
  } = options;

  // Stabilize endpoints array so a new literal on each render doesn't re-trigger effects
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableEndpoints = useMemo(() => endpoints, [endpoints.join(',')]);

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);

  // Use refs to track abort controllers and prevent memory leaks
  const abortControllersRef = useRef<AbortController[]>([]);
  const timeoutIdsRef = useRef<NodeJS.Timeout[]>([]);
  const isMountedRef = useRef<boolean>(true);

  /**
   * Cleanup function to abort pending requests and clear timeouts
   */
  const cleanup = useCallback(() => {
    abortControllersRef.current.forEach((controller) => controller.abort());
    abortControllersRef.current = [];

    timeoutIdsRef.current.forEach((id) => clearTimeout(id));
    timeoutIdsRef.current = [];
  }, []);

  /**
   * Fetch data from a single endpoint with timeout and retry support
   */
  const fetchEndpoint = useCallback(
    async (endpoint: string, attempt: number = 0): Promise<unknown> => {
      // Check cache first
      if (enableCache) {
        const cached = hydrationCache.get(endpoint);
        if (cached && isCacheValid(cached, cacheTtl)) {
          return cached.data;
        }
      }

      // Create abort controller for this request
      const controller = new AbortController();
      abortControllersRef.current.push(controller);

      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          const id = setTimeout(() => {
            controller.abort();
            reject(new Error(`Request timeout after ${timeout}ms`));
          }, timeout);
          timeoutIdsRef.current.push(id);
        });

        // Race between fetch and timeout
        const fetchPromise = fetcher(endpoint);
        const result = await Promise.race([fetchPromise, timeoutPromise]);

        // Cache the result
        if (enableCache) {
          hydrationCache.set(endpoint, {
            data: result,
            timestamp: Date.now(),
          });
        }

        return result;
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));

        // Don't retry if aborted or disabled
        if (error.name === "AbortError" || !enableRetry) {
          throw error;
        }

        // Retry if attempts remaining
        if (attempt < retryAttempts) {
          const delay = calculateBackoff(attempt, retryDelay);
          await new Promise<void>((resolve) => {
            const id = setTimeout(resolve, delay);
            timeoutIdsRef.current.push(id);
          });

          return fetchEndpoint(endpoint, attempt + 1);
        }

        throw error;
      }
    },
    [enableCache, cacheTtl, timeout, fetcher, enableRetry, retryAttempts, retryDelay]
  );

  /**
   * Fetch data from all endpoints and merge results
   */
  const hydrate = useCallback(async () => {
    if (!enabled || stableEndpoints.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all endpoints concurrently
      const results = await Promise.allSettled(
        stableEndpoints.map((endpoint) => fetchEndpoint(endpoint))
      );

      // Check if component is still mounted
      if (!isMountedRef.current) {
        return;
      }

      // Process results
      const mergedData: Record<string, unknown> = {};
      const errors: Array<{ endpoint: string; error: Error }> = [];

      results.forEach((result, index) => {
        const endpoint = stableEndpoints[index] ?? `endpoint_${index}`;

        if (result.status === "fulfilled") {
          // Merge data - if result is object, spread it; otherwise use endpoint as key
          if (typeof result.value === "object" && result.value !== null) {
            Object.assign(mergedData, result.value as Record<string, unknown>);
          } else {
            mergedData[endpoint] = result.value;
          }
        } else {
          errors.push({ endpoint, error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)) });
        }
      });

      // If all requests failed, set error
      if (errors.length === stableEndpoints.length) {
        const firstError = errors[0]?.error ?? new Error("All hydration endpoints failed");
        setError(firstError);
        onError?.(firstError, errors[0]?.endpoint ?? "");
        return;
      }

      // If some requests failed, log warnings but continue
      if (errors.length > 0) {
        logger.warn("Some hydration endpoints failed", { count: errors.length });
        errors.forEach(({ endpoint, error }) => {
          onError?.(error, endpoint);
        });
      }

      // Set merged data
      setData(mergedData);
      onSuccess?.(mergedData);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (isMountedRef.current) {
        setError(error);
        onError?.(error, stableEndpoints[0] ?? "");
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [enabled, stableEndpoints, fetchEndpoint, onSuccess, onError]);

  /**
   * Manual retry function
   */
  const retry = useCallback(() => {
    setRetryCount((prev) => prev + 1);
    hydrate();
  }, [hydrate]);

  /**
   * Clear cache for current endpoints
   */
  const clearCache = useCallback(() => {
    stableEndpoints.forEach((endpoint) => {
      hydrationCache.delete(endpoint);
    });
  }, [stableEndpoints]);

  /**
   * Effect to trigger hydration when endpoints change
   */
  useEffect(() => {
    hydrate();

    // Cleanup on unmount or when endpoints change
    return () => {
      cleanup();
    };
  }, [hydrate, cleanup]);

  /**
   * Effect to track component mount status
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
    retry,
    clearCache,
  };
}

/**
 * Clear all cached hydration data
 */
export function clearAllHydrationCache(): void {
  hydrationCache.clear();
}

/**
 * Get cache statistics
 */
export function getHydrationCacheStats(): {
  size: number;
  entries: Array<{ endpoint: string; age: number }>;
} {
  const entries = Array.from(hydrationCache.entries()).map(([endpoint, entry]) => ({
    endpoint,
    age: Date.now() - entry.timestamp,
  }));

  return {
    size: hydrationCache.size,
    entries,
  };
}
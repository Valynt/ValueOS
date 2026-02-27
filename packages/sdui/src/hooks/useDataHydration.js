"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useDataHydration = useDataHydration;
exports.clearAllHydrationCache = clearAllHydrationCache;
exports.getHydrationCacheStats = getHydrationCacheStats;
const logger_1 = require("@shared/lib/logger");
const react_1 = require("react");
/**
 * Global cache for hydrated data
 */
const hydrationCache = new Map();
/**
 * Default data fetcher using fetch API
 */
const defaultFetcher = async (endpoint) => {
    const response = await fetch(endpoint);
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
const calculateBackoff = (attempt, baseDelay) => {
    return baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
};
/**
 * Check if cache entry is still valid
 */
const isCacheValid = (entry, ttl) => {
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
function useDataHydration(endpoints, options = {}) {
    const { enabled = true, onSuccess, onError, timeout = 10000, enableRetry = true, retryAttempts = 3, retryDelay = 1000, fetcher = defaultFetcher, enableCache = true, cacheTtl = 300000, // 5 minutes
     } = options;
    const [data, setData] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [retryCount, setRetryCount] = (0, react_1.useState)(0);
    // Use refs to track abort controllers and prevent memory leaks
    const abortControllersRef = (0, react_1.useRef)([]);
    const timeoutIdsRef = (0, react_1.useRef)([]);
    const isMountedRef = (0, react_1.useRef)(true);
    /**
     * Cleanup function to abort pending requests and clear timeouts
     */
    const cleanup = (0, react_1.useCallback)(() => {
        abortControllersRef.current.forEach((controller) => controller.abort());
        abortControllersRef.current = [];
        timeoutIdsRef.current.forEach((id) => clearTimeout(id));
        timeoutIdsRef.current = [];
    }, []);
    /**
     * Fetch data from a single endpoint with timeout and retry support
     */
    const fetchEndpoint = (0, react_1.useCallback)(async (endpoint, attempt = 0) => {
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
            const timeoutPromise = new Promise((_, reject) => {
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
        }
        catch (err) {
            const error = err;
            // Don't retry if aborted or disabled
            if (error.name === "AbortError" || !enableRetry) {
                throw error;
            }
            // Retry if attempts remaining
            if (attempt < retryAttempts) {
                const delay = calculateBackoff(attempt, retryDelay);
                await new Promise((resolve) => {
                    const id = setTimeout(resolve, delay);
                    timeoutIdsRef.current.push(id);
                });
                return fetchEndpoint(endpoint, attempt + 1);
            }
            throw error;
        }
    }, [enableCache, cacheTtl, timeout, fetcher, enableRetry, retryAttempts, retryDelay]);
    /**
     * Fetch data from all endpoints and merge results
     */
    const hydrate = (0, react_1.useCallback)(async () => {
        if (!enabled || endpoints.length === 0) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // Fetch all endpoints concurrently
            const results = await Promise.allSettled(endpoints.map((endpoint) => fetchEndpoint(endpoint)));
            // Check if component is still mounted
            if (!isMountedRef.current) {
                return;
            }
            // Process results
            const mergedData = {};
            const errors = [];
            results.forEach((result, index) => {
                const endpoint = endpoints[index];
                if (result.status === "fulfilled") {
                    // Merge data - if result is object, spread it; otherwise use endpoint as key
                    if (typeof result.value === "object" && result.value !== null) {
                        Object.assign(mergedData, result.value);
                    }
                    else {
                        mergedData[endpoint] = result.value;
                    }
                }
                else {
                    errors.push({ endpoint, error: result.reason });
                }
            });
            // If all requests failed, set error
            if (errors.length === endpoints.length) {
                const firstError = errors[0].error;
                setError(firstError);
                onError?.(firstError, errors[0].endpoint);
                return;
            }
            // If some requests failed, log warnings but continue
            if (errors.length > 0) {
                logger_1.logger.warn("Some hydration endpoints failed:", errors);
                errors.forEach(({ endpoint, error }) => {
                    onError?.(error, endpoint);
                });
            }
            // Set merged data
            setData(mergedData);
            onSuccess?.(mergedData);
        }
        catch (err) {
            const error = err;
            if (isMountedRef.current) {
                setError(error);
                onError?.(error, endpoints[0]);
            }
        }
        finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [enabled, endpoints, fetchEndpoint, onSuccess, onError]);
    /**
     * Manual retry function
     */
    const retry = (0, react_1.useCallback)(() => {
        setRetryCount((prev) => prev + 1);
        hydrate();
    }, [hydrate]);
    /**
     * Clear cache for current endpoints
     */
    const clearCache = (0, react_1.useCallback)(() => {
        endpoints.forEach((endpoint) => {
            hydrationCache.delete(endpoint);
        });
    }, [endpoints]);
    /**
     * Effect to trigger hydration when endpoints change
     */
    (0, react_1.useEffect)(() => {
        hydrate();
        // Cleanup on unmount or when endpoints change
        return () => {
            cleanup();
        };
    }, [hydrate, cleanup]);
    /**
     * Effect to track component mount status
     */
    (0, react_1.useEffect)(() => {
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
function clearAllHydrationCache() {
    hydrationCache.clear();
}
/**
 * Get cache statistics
 */
function getHydrationCacheStats() {
    const entries = Array.from(hydrationCache.entries()).map(([endpoint, entry]) => ({
        endpoint,
        age: Date.now() - entry.timestamp,
    }));
    return {
        size: hydrationCache.size,
        entries,
    };
}
//# sourceMappingURL=useDataHydration.js.map
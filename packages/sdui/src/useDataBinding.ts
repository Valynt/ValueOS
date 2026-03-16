/**
 * useDataBindings hook
 *
 * Resolves a single DataBinding using a DataBindingResolver and returns
 * reactive state: value, loading, error, cached, and refresh/clearCache helpers.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { DataBinding, DataSourceContext } from "./DataBindingSchema";
import { DataBindingResolver } from "./DataBindingResolver";

export interface UseDataBindingsOptions {
  resolver: DataBindingResolver;
  context: DataSourceContext;
  /** Auto-refresh interval in ms. If set, re-resolves on that interval. */
  enableRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseDataBindingsResult {
  value: unknown;
  loading: boolean;
  error: string | null;
  cached: boolean;
  refresh: () => Promise<void>;
  clearCache: () => void;
}

export function useDataBindings(
  binding: DataBinding,
  options: UseDataBindingsOptions
): UseDataBindingsResult {
  const { resolver, context, enableRefresh = false, refreshInterval = 5000 } = options;

  const [value, setValue] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resolve = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await resolver.resolve(binding, context);
      if (result.success) {
        setValue(result.value ?? null);
        setCached(result.cached ?? false);
        setError(null);
      } else {
        setValue(null);
        setError(result.error ?? "Resolution failed");
      }
    } catch (err) {
      setValue(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [binding, context, resolver]);

  useEffect(() => {
    void resolve();

    if (enableRefresh) {
      intervalRef.current = setInterval(() => {
        void resolve();
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [resolve, enableRefresh, refreshInterval]);

  const clearCache = useCallback(() => {
    resolver.clearCache?.();
  }, [resolver]);

  return { value, loading, error, cached, refresh: resolve, clearCache };
}

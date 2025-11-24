/**
 * React Hook for Data Binding Resolution
 * 
 * Resolves data bindings in SDUI components with automatic refresh.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { DataBinding, isDataBinding, ResolvedBinding, DataSourceContext } from './DataBindingSchema';
import { DataBindingResolver } from './DataBindingResolver';
import { logger } from '../lib/logger';

/**
 * Hook options
 */
interface UseDataBindingOptions {
  /**
   * Data binding resolver instance
   */
  resolver: DataBindingResolver;

  /**
   * Data source context
   */
  context: DataSourceContext;

  /**
   * Enable automatic refresh
   */
  enableRefresh?: boolean;
}

/**
 * Hook result
 */
interface UseDataBindingResult<T = any> {
  /**
   * Resolved value
   */
  value: T;

  /**
   * Loading state
   */
  loading: boolean;

  /**
   * Error state
   */
  error: string | null;

  /**
   * Manually refresh the binding
   */
  refresh: () => Promise<void>;

  /**
   * Whether the value came from cache
   */
  cached: boolean;

  /**
   * Last update timestamp
   */
  timestamp: string | null;
}

/**
 * Hook to resolve a single data binding
 */
export function useDataBinding<T = any>(
  value: T | DataBinding,
  options: UseDataBindingOptions
): UseDataBindingResult<T> {
  const { resolver, context, enableRefresh = true } = options;

  // If not a binding, return the value as-is
  if (!isDataBinding(value)) {
    return {
      value: value as T,
      loading: false,
      error: null,
      refresh: async () => {},
      cached: false,
      timestamp: null,
    };
  }

  const binding = value as DataBinding;
  const [state, setState] = useState<{
    value: T;
    loading: boolean;
    error: string | null;
    cached: boolean;
    timestamp: string | null;
  }>({
    value: (binding.$fallback ?? null) as T,
    loading: true,
    error: null,
    cached: false,
    timestamp: null,
  });

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const resolve = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const result: ResolvedBinding = await resolver.resolve(binding, context);

      setState({
        value: result.success ? result.value : (binding.$fallback ?? null),
        loading: false,
        error: result.error ?? null,
        cached: result.cached,
        timestamp: result.timestamp,
      });
    } catch (error) {
      logger.error('Failed to resolve data binding', {
        binding: binding.$bind,
        source: binding.$source,
        error: error instanceof Error ? error.message : String(error),
      });

      setState({
        value: (binding.$fallback ?? null) as T,
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        cached: false,
        timestamp: new Date().toISOString(),
      });
    }
  }, [binding, resolver, context]);

  // Initial resolution
  useEffect(() => {
    resolve();
  }, [resolve]);

  // Setup refresh interval
  useEffect(() => {
    if (!enableRefresh || !binding.$refresh) {
      return;
    }

    refreshIntervalRef.current = setInterval(() => {
      resolve();
    }, binding.$refresh);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [binding.$refresh, enableRefresh, resolve]);

  return {
    value: state.value,
    loading: state.loading,
    error: state.error,
    refresh: resolve,
    cached: state.cached,
    timestamp: state.timestamp,
  };
}

/**
 * Hook to resolve multiple data bindings
 */
export function useDataBindings<T extends Record<string, any>>(
  props: T,
  options: UseDataBindingOptions
): {
  props: T;
  loading: boolean;
  errors: Record<string, string>;
  refresh: () => Promise<void>;
} {
  const { resolver, context } = options;

  const [state, setState] = useState<{
    props: T;
    loading: boolean;
    errors: Record<string, string>;
  }>({
    props: props,
    loading: false,
    errors: {},
  });

  const resolve = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      const resolved = await resolver.resolveObject(props, context);
      setState({
        props: resolved,
        loading: false,
        errors: {},
      });
    } catch (error) {
      logger.error('Failed to resolve data bindings', {
        error: error instanceof Error ? error.message : String(error),
      });

      setState((prev) => ({
        ...prev,
        loading: false,
        errors: {
          _global: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  }, [props, resolver, context]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  return {
    props: state.props,
    loading: state.loading,
    errors: state.errors,
    refresh: resolve,
  };
}

/**
 * HOC to wrap a component with data binding resolution
 */
export function withDataBindings<P extends Record<string, any>>(
  Component: React.ComponentType<P>,
  resolver: DataBindingResolver,
  context: DataSourceContext
): React.FC<P> {
  return (props: P) => {
    const { props: resolvedProps, loading, errors } = useDataBindings(props, {
      resolver,
      context,
    });

    if (loading) {
      return (
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      );
    }

    if (Object.keys(errors).length > 0) {
      return (
        <div className="text-red-600 text-sm">
          Failed to load data: {errors._global || 'Unknown error'}
        </div>
      );
    }

    return <Component {...resolvedProps} />;
  };
}

export default useDataBinding;

/**
 * Batched State Updates Hook
 *
 * Optimizes React state updates by batching multiple updates together.
 * Reduces re-renders and improves performance for complex state changes.
 */

import { useCallback, useRef, useEffect } from 'react';
import { unstable_batchedUpdates } from 'react-dom';

interface BatchedStateUpdater {
  <T>(setter: React.Dispatch<React.SetStateAction<T>>): React.Dispatch<React.SetStateAction<T>>;
  flush: () => void;
  isPending: boolean;
}

/**
 * Hook for batching state updates to prevent excessive re-renders
 */
export function useBatchedState(): BatchedStateUpdater {
  const pendingUpdates = useRef<Array<() => void>>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPendingRef = useRef(false);

  const flushUpdates = useCallback(() => {
    if (pendingUpdates.current.length === 0) return;

    const updates = pendingUpdates.current;
    pendingUpdates.current = [];
    isPendingRef.current = false;

    // Use React's unstable_batchedUpdates to batch all state changes
    unstable_batchedUpdates(() => {
      updates.forEach(update => update());
    });

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const batchedSetter = useCallback(<T>(setter: React.Dispatch<React.SetStateAction<T>>) => {
    return (value: React.SetStateAction<T>) => {
      pendingUpdates.current.push(() => setter(value));
      isPendingRef.current = true;

      // Schedule flush if not already scheduled
      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(flushUpdates, 0);
      }
    };
  }, [flushUpdates]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      flushUpdates();
    };
  }, [flushUpdates]);

  const updater = function<T>(setter: React.Dispatch<React.SetStateAction<T>>) {
    return batchedSetter(setter);
  } as BatchedStateUpdater;

  updater.flush = flushUpdates;
  Object.defineProperty(updater, 'isPending', {
    get() {
      return isPendingRef.current;
    }
  });

  return updater;
}

/**
 * Hook for debounced state updates
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 300
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [state, setState] = React.useState<T>(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSetState = useCallback((value: React.SetStateAction<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setState(value);
    }, delay);
  }, [delay]);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, debouncedSetState, flush];
}

/**
 * Hook for optimized memoized computations with dependencies
 */
export function useSmartMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  options?: {
    equalityFn?: (a: T, b: T) => boolean;
    maxSize?: number;
  }
): T {
  const cacheRef = useRef<Map<string, { value: T; timestamp: number }>>(new Map());
  const keyRef = useRef<string>('');

  const key = JSON.stringify(deps);
  const cache = cacheRef.current;

  // Check cache first
  if (cache.has(key)) {
    const cached = cache.get(key)!;
    if (options?.equalityFn) {
      return cached.value;
    }
    return cached.value;
  }

  // Compute new value
  const value = factory();

  // Manage cache size
  if (options?.maxSize && cache.size >= options.maxSize) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  // Store in cache
  cache.set(key, { value, timestamp: Date.now() });
  keyRef.current = key;

  return value;
}

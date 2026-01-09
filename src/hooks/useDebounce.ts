/**
 * Debouncing Hooks
 * 
 * Sprint 2 Enhancement: Debouncing for numeric inputs and search
 * Prevents excessive API calls and improves performance
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================================================
// useDebounce Hook
// ============================================================================

/**
 * Debounce a value - delays updating until user stops typing
 * 
 * @param value - The value to debounce
 * @param delay - Delay in milliseconds (default: 500ms)
 * @returns Debounced value
 * 
 * @example
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 500);
 * 
 * useEffect(() => {
 *   // This only runs 500ms after user stops typing
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// useDebouncedCallback Hook
// ============================================================================

/**
 * Debounce a callback function
 * 
 * @param callback - The function to debounce
 * @param delay - Delay in milliseconds (default: 500ms)
 * @returns Debounced callback
 * 
 * @example
 * ```tsx
 * const debouncedSave = useDebouncedCallback(
 *   (value: number) => updateSetting('timeout', value),
 *   500
 * );
 * 
 * <input onChange={(e) => debouncedSave(parseInt(e.target.value))} />
 * ```
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

// ============================================================================
// useDebouncedState Hook
// ============================================================================

/**
 * State with built-in debouncing
 * 
 * @param initialValue - Initial state value
 * @param delay - Delay in milliseconds (default: 500ms)
 * @returns [value, debouncedValue, setValue]
 * 
 * @example
 * ```tsx
 * const [timeout, debouncedTimeout, setTimeout] = useDebouncedState(60, 500);
 * 
 * // Update immediately in UI
 * <input value={timeout} onChange={(e) => setTimeout(parseInt(e.target.value))} />
 * 
 * // Save to API only after user stops typing
 * useEffect(() => {
 *   updateSetting('timeout', debouncedTimeout);
 * }, [debouncedTimeout]);
 * ```
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = 500
): [T, T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initialValue);
  const debouncedValue = useDebounce(value, delay);

  return [value, debouncedValue, setValue];
}

// ============================================================================
// useThrottle Hook
// ============================================================================

/**
 * Throttle a value - limits update frequency
 * 
 * @param value - The value to throttle
 * @param limit - Minimum time between updates in milliseconds (default: 500ms)
 * @returns Throttled value
 * 
 * @example
 * ```tsx
 * const [scrollPosition, setScrollPosition] = useState(0);
 * const throttledScroll = useThrottle(scrollPosition, 100);
 * 
 * // This only updates every 100ms max
 * useEffect(() => {
 *   updateScrollIndicator(throttledScroll);
 * }, [throttledScroll]);
 * ```
 */
export function useThrottle<T>(value: T, limit: number = 500): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const lastRan = useRef(Date.now());

  useEffect(() => {
    const handler = setTimeout(() => {
      if (Date.now() - lastRan.current >= limit) {
        setThrottledValue(value);
        lastRan.current = Date.now();
      }
    }, limit - (Date.now() - lastRan.current));

    return () => {
      clearTimeout(handler);
    };
  }, [value, limit]);

  return throttledValue;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a debounced function (non-hook version)
 * 
 * @param func - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function
 * 
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => {
 *   fetchResults(query);
 * }, 500);
 * 
 * debouncedSearch('test'); // Only runs after 500ms of no calls
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return function debounced(...args: Parameters<T>) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Create a throttled function (non-hook version)
 * 
 * @param func - Function to throttle
 * @param limit - Minimum time between calls in milliseconds
 * @returns Throttled function
 * 
 * @example
 * ```typescript
 * const throttledScroll = throttle((position: number) => {
 *   updateScrollIndicator(position);
 * }, 100);
 * 
 * window.addEventListener('scroll', () => throttledScroll(window.scrollY));
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function throttled(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Optimistic UI Hook for Settings
 * 
 * Provides "zero latency" interaction by updating UI immediately before server confirmation.
 * Automatically rolls back on failure with user notification.
 * 
 * Strategy:
 * 1. Capture current state before update
 * 2. Update local state immediately (optimistic)
 * 3. Execute API call in background
 * 4. On success: Keep optimistic state
 * 5. On failure: Rollback to previous state + notify user
 * 
 * Benefits:
 * - Instant UI feedback
 * - Automatic error recovery
 * - Better user experience
 * - Reduced perceived latency
 */

import { useCallback, useRef, useState } from 'react';
import { z } from 'zod';

export interface OptimisticUpdateOptions<T> {
  /**
   * Function to execute the actual update (API call)
   */
  updateFn: (data: T) => Promise<void>;
  
  /**
   * Optional validation schema
   */
  schema?: z.ZodSchema<T>;
  
  /**
   * Callback on success
   */
  onSuccess?: (data: T) => void;
  
  /**
   * Callback on error
   */
  onError?: (error: Error, previousData: T) => void;
  
  /**
   * Callback on rollback
   */
  onRollback?: (previousData: T) => void;
}

export interface OptimisticState<T> {
  /**
   * Current data (optimistically updated)
   */
  data: T;
  
  /**
   * Whether an update is in progress
   */
  isUpdating: boolean;
  
  /**
   * Last error if update failed
   */
  error: Error | null;
  
  /**
   * Whether the last update was rolled back
   */
  wasRolledBack: boolean;
}

export interface OptimisticActions<T> {
  /**
   * Update data optimistically
   */
  update: (newData: Partial<T>) => Promise<void>;
  
  /**
   * Set data without triggering update
   */
  setData: (data: T) => void;
  
  /**
   * Clear error state
   */
  clearError: () => void;
  
  /**
   * Reset to initial data
   */
  reset: () => void;
}

/**
 * Hook for optimistic UI updates with automatic rollback
 * 
 * @example
 * ```tsx
 * const { state, actions } = useOptimisticSettings({
 *   initialData: settings,
 *   updateFn: async (data) => {
 *     await api.updateSettings(data);
 *   },
 *   schema: SettingsSchema,
 *   onError: (error) => {
 *     toast.error('Failed to save settings');
 *   },
 * });
 * 
 * // Update optimistically
 * await actions.update({ theme: 'dark' });
 * ```
 */
export function useOptimisticSettings<T extends Record<string, any>>(
  initialData: T,
  options: OptimisticUpdateOptions<T>
): {
  state: OptimisticState<T>;
  actions: OptimisticActions<T>;
} {
  const [data, setData] = useState<T>(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [wasRolledBack, setWasRolledBack] = useState(false);
  
  // Store previous state for rollback
  const previousDataRef = useRef<T>(initialData);
  
  // Store update queue to handle rapid updates
  const updateQueueRef = useRef<Promise<void>>(Promise.resolve());

  const update = useCallback(
    async (newData: Partial<T>) => {
      // Clear previous error and rollback state
      setError(null);
      setWasRolledBack(false);
      
      // Capture current state for potential rollback
      const previousData = { ...data };
      previousDataRef.current = previousData;
      
      // Merge new data with current data
      const mergedData = { ...data, ...newData };
      
      // Validate if schema provided
      if (options.schema) {
        const result = options.schema.safeParse(mergedData);
        if (!result.success) {
          const validationError = new Error(
            `Validation failed: ${result.error.errors.map(e => e.message).join(', ')}`
          );
          setError(validationError);
          if (options.onError) {
            options.onError(validationError, previousData);
          }
          return;
        }
      }
      
      // Update UI immediately (optimistic)
      setData(mergedData);
      setIsUpdating(true);
      
      // Queue the update to handle rapid changes
      updateQueueRef.current = updateQueueRef.current.then(async () => {
        try {
          // Execute actual update
          await options.updateFn(mergedData);
          
          // Success - keep optimistic state
          setIsUpdating(false);
          if (options.onSuccess) {
            options.onSuccess(mergedData);
          }
        } catch (err) {
          // Failure - rollback to previous state
          const updateError = err instanceof Error ? err : new Error(String(err));
          
          setData(previousData);
          setError(updateError);
          setIsUpdating(false);
          setWasRolledBack(true);
          
          if (options.onRollback) {
            options.onRollback(previousData);
          }
          
          if (options.onError) {
            options.onError(updateError, previousData);
          }
        }
      });
      
      await updateQueueRef.current;
    },
    [data, options]
  );

  const setDataDirect = useCallback((newData: T) => {
    setData(newData);
    previousDataRef.current = newData;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setWasRolledBack(false);
  }, []);

  const reset = useCallback(() => {
    setData(initialData);
    setError(null);
    setIsUpdating(false);
    setWasRolledBack(false);
    previousDataRef.current = initialData;
  }, [initialData]);

  return {
    state: {
      data,
      isUpdating,
      error,
      wasRolledBack,
    },
    actions: {
      update,
      setData: setDataDirect,
      clearError,
      reset,
    },
  };
}

/**
 * Simpler hook for single field optimistic updates
 * 
 * @example
 * ```tsx
 * const [value, setValue, { isUpdating, error }] = useOptimisticValue(
 *   initialValue,
 *   async (newValue) => {
 *     await api.updateField(newValue);
 *   }
 * );
 * ```
 */
export function useOptimisticValue<T>(
  initialValue: T,
  updateFn: (value: T) => Promise<void>,
  options?: {
    onError?: (error: Error, previousValue: T) => void;
    onSuccess?: (value: T) => void;
  }
): [
  T,
  (value: T) => Promise<void>,
  { isUpdating: boolean; error: Error | null; wasRolledBack: boolean }
] {
  const [value, setValue] = useState<T>(initialValue);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [wasRolledBack, setWasRolledBack] = useState(false);
  
  const previousValueRef = useRef<T>(initialValue);

  const updateValue = useCallback(
    async (newValue: T) => {
      setError(null);
      setWasRolledBack(false);
      
      const previousValue = value;
      previousValueRef.current = previousValue;
      
      // Update immediately
      setValue(newValue);
      setIsUpdating(true);
      
      try {
        await updateFn(newValue);
        setIsUpdating(false);
        if (options?.onSuccess) {
          options.onSuccess(newValue);
        }
      } catch (err) {
        const updateError = err instanceof Error ? err : new Error(String(err));
        
        // Rollback
        setValue(previousValue);
        setError(updateError);
        setIsUpdating(false);
        setWasRolledBack(true);
        
        if (options?.onError) {
          options.onError(updateError, previousValue);
        }
      }
    },
    [value, updateFn, options]
  );

  return [value, updateValue, { isUpdating, error, wasRolledBack }];
}

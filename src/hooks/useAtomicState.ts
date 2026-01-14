/**
 * Atomic State Management Hook
 *
 * Provides atomic state updates with optimistic locking to prevent race conditions.
 * Uses version numbers and conflict detection/resolution strategies.
 */

import { useState, useCallback, useRef } from 'react';

interface AtomicState<T> {
  value: T;
  version: number;
  lastUpdated: number;
}

interface AtomicUpdateResult<T> {
  success: boolean;
  state: T;
  version: number;
  conflict?: boolean;
}

export function useAtomicState<T>(
  initialValue: T,
  options?: {
    onConflict?: (current: T, attempted: T) => T;
    maxRetries?: number;
  }
) {
  const [atomicState, setAtomicState] = useState<AtomicState<T>>({
    value: initialValue,
    version: 1,
    lastUpdated: Date.now(),
  });

  const pendingUpdates = useRef<Map<number, (state: T) => T>>(new Map());
  const maxRetries = options?.maxRetries || 3;

  const updateAtomic = useCallback((
    updater: (current: T) => T,
    expectedVersion?: number
  ): Promise<AtomicUpdateResult<T>> => {
    return new Promise((resolve) => {
      const updateId = Date.now() + Math.random();

      const attemptUpdate = (retries = 0): void => {
        setAtomicState(currentState => {
          // Version check for optimistic locking
          if (expectedVersion !== undefined && currentState.version !== expectedVersion) {
            // Version conflict
            if (retries >= maxRetries) {
              resolve({
                success: false,
                state: currentState.value,
                version: currentState.version,
                conflict: true
              });
              return currentState;
            }

            // Retry with conflict resolution
            setTimeout(() => attemptUpdate(retries + 1), 100 * Math.pow(2, retries));
            return currentState;
          }

          // Apply update
          try {
            const newValue = updater(currentState.value);
            const newVersion = currentState.version + 1;

            const newState: AtomicState<T> = {
              value: newValue,
              version: newVersion,
              lastUpdated: Date.now(),
            };

            resolve({
              success: true,
              state: newValue,
              version: newVersion,
            });

            return newState;
          } catch (error) {
            console.error('Atomic update failed:', error);
            resolve({
              success: false,
              state: currentState.value,
              version: currentState.version,
            });
            return currentState;
          }
        });
      };

      attemptUpdate();
    });
  }, [maxRetries]);

  const updateWithConflictResolution = useCallback(async (
    updater: (current: T) => T
  ): Promise<T> => {
    const result = await updateAtomic(updater);

    if (!result.success && result.conflict && options?.onConflict) {
      // Apply conflict resolution
      const resolvedValue = options.onConflict(atomicState.value, updater(atomicState.value));
      const retryResult = await updateAtomic(() => resolvedValue);
      return retryResult.success ? retryResult.state : atomicState.value;
    }

    return result.success ? result.state : atomicState.value;
  }, [updateAtomic, atomicState.value, options?.onConflict]);

  const batchUpdates = useCallback(async (
    updates: Array<(current: T) => T>
  ): Promise<T> => {
    let currentState = atomicState.value;
    let currentVersion = atomicState.version;

    for (const updater of updates) {
      const result = await updateAtomic(updater, currentVersion);

      if (!result.success) {
        throw new Error('Batch update failed');
      }

      currentState = result.state;
      currentVersion = result.version;
    }

    return currentState;
  }, [updateAtomic, atomicState.value, atomicState.version]);

  return {
    value: atomicState.value,
    version: atomicState.version,
    update: updateAtomic,
    updateWithConflictResolution,
    batchUpdates,
    reset: useCallback((newValue: T) => {
      setAtomicState({
        value: newValue,
        version: 1,
        lastUpdated: Date.now(),
      });
    }, []),
  };
}

/**
 * Hook for managing concurrent operations with queuing
 */
export function useConcurrentOperations<T>() {
  const operationQueue = useRef<Array<() => Promise<T>>>([]);
  const isProcessing = useRef(false);

  const enqueue = useCallback(async <T>(operation: () => Promise<T>): Promise<T> => {
    return new Promise((resolve, reject) => {
      operationQueue.current.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      processQueue();
    });
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessing.current || operationQueue.current.length === 0) {
      return;
    }

    isProcessing.current = true;

    while (operationQueue.current.length > 0) {
      const operation = operationQueue.current.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error('Queued operation failed:', error);
        }
      }
    }

    isProcessing.current = false;
  }, []);

  const clearQueue = useCallback(() => {
    operationQueue.current = [];
  }, []);

  return {
    enqueue,
    clearQueue,
    isProcessing: () => isProcessing.current,
    queueLength: () => operationQueue.current.length,
  };
}

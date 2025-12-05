/**
 * React Hooks for SDUI State Management
 * 
 * Provides React hooks for accessing and subscribing to SDUI state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSDUIStateManager, StateChangeEvent } from './SDUIStateManager';

/**
 * Hook to use SDUI state
 * 
 * @param key State key
 * @param initialValue Initial value if state doesn't exist
 * @returns [value, setValue, loading]
 */
export function useSDUIState<T>(
  key: string,
  initialValue?: T
): [T | null, (value: T) => void, boolean] {
  const stateManager = getSDUIStateManager();
  const [value, setValue] = useState<T | null>(() => {
    const existing = stateManager.get<T>(key);
    return existing !== null ? existing : (initialValue || null);
  });
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  // Initialize state if it doesn't exist
  useEffect(() => {
    if (initialValue !== undefined && !stateManager.has(key)) {
      stateManager.set(key, initialValue);
    }
  }, [key, initialValue]);

  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = stateManager.subscribe<T>(key, (event: StateChangeEvent<T>) => {
      if (mountedRef.current) {
        setValue(event.newValue);
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribe();
    };
  }, [key]);

  // Load from database on mount
  useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      setLoading(true);
      const loaded = await stateManager.load(key);
      
      if (!cancelled && mountedRef.current) {
        if (loaded) {
          const newValue = stateManager.get<T>(key);
          setValue(newValue);
        }
        setLoading(false);
      }
    };

    loadState();

    return () => {
      cancelled = true;
    };
  }, [key]);

  // Update function
  const updateValue = useCallback((newValue: T) => {
    stateManager.set(key, newValue);
  }, [key]);

  return [value, updateValue, loading];
}

/**
 * Hook to use SDUI state with optimistic updates
 * 
 * @param key State key
 * @param initialValue Initial value
 * @returns [value, setValue, isPending, error]
 */
export function useOptimisticSDUIState<T>(
  key: string,
  initialValue?: T
): [T | null, (value: T) => Promise<void>, boolean, Error | null] {
  const [value, setValue, loading] = useSDUIState<T>(key, initialValue);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const stateManager = getSDUIStateManager();

  const updateValue = useCallback(async (newValue: T) => {
    setIsPending(true);
    setError(null);

    try {
      // Optimistic update
      stateManager.set(key, newValue);

      // Persist to database
      await stateManager.flush();

      setIsPending(false);
    } catch (err) {
      setError(err as Error);
      setIsPending(false);

      // Revert optimistic update
      if (value !== null) {
        stateManager.set(key, value);
      }
    }
  }, [key, value]);

  return [value, updateValue, isPending || loading, error];
}

/**
 * Hook to subscribe to multiple state keys
 * 
 * @param keys Array of state keys
 * @returns Map of key to value
 */
export function useSDUIStates<T>(keys: string[]): Map<string, T | null> {
  const stateManager = getSDUIStateManager();
  const [values, setValues] = useState<Map<string, T | null>>(() => {
    const map = new Map<string, T | null>();
    for (const key of keys) {
      map.set(key, stateManager.get<T>(key));
    }
    return map;
  });

  useEffect(() => {
    const unsubscribes = keys.map(key =>
      stateManager.subscribe<T>(key, (event: StateChangeEvent<T>) => {
        setValues(prev => {
          const next = new Map(prev);
          next.set(key, event.newValue);
          return next;
        });
      })
    );

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [keys.join(',')]);

  return values;
}

/**
 * Hook to subscribe to all state changes
 * 
 * @param callback Callback function
 */
export function useSDUIStateListener(
  callback: (event: StateChangeEvent) => void
): void {
  const stateManager = getSDUIStateManager();

  useEffect(() => {
    const unsubscribe = stateManager.subscribeAll(callback);
    return unsubscribe;
  }, [callback]);
}

/**
 * Hook to get state metadata
 * 
 * @param key State key
 * @returns Metadata or null
 */
export function useSDUIStateMetadata(key: string): {
  version: number;
  updatedAt: number;
  dirty: boolean;
} | null {
  const stateManager = getSDUIStateManager();
  const [metadata, setMetadata] = useState(() => stateManager.getMetadata(key));

  useEffect(() => {
    const unsubscribe = stateManager.subscribe(key, () => {
      setMetadata(stateManager.getMetadata(key));
    });

    return unsubscribe;
  }, [key]);

  return metadata;
}

/**
 * Hook to update partial state (for objects)
 * 
 * @param key State key
 * @param initialValue Initial value
 * @returns [value, updatePartial, loading]
 */
export function useSDUIStatePartial<T extends Record<string, any>>(
  key: string,
  initialValue?: T
): [T | null, (partial: Partial<T>) => void, boolean] {
  const [value, setValue, loading] = useSDUIState<T>(key, initialValue);
  const stateManager = getSDUIStateManager();

  const updatePartial = useCallback((partial: Partial<T>) => {
    if (value) {
      const updated = { ...value, ...partial };
      stateManager.set(key, updated);
    }
  }, [key, value]);

  return [value, updatePartial, loading];
}

/**
 * Hook to delete state
 * 
 * @param key State key
 * @returns delete function
 */
export function useSDUIStateDelete(key: string): () => void {
  const stateManager = getSDUIStateManager();

  return useCallback(() => {
    stateManager.delete(key);
  }, [key]);
}

/**
 * Hook to check if state exists
 * 
 * @param key State key
 * @returns boolean
 */
export function useSDUIStateExists(key: string): boolean {
  const stateManager = getSDUIStateManager();
  const [exists, setExists] = useState(() => stateManager.has(key));

  useEffect(() => {
    const unsubscribe = stateManager.subscribe(key, () => {
      setExists(stateManager.has(key));
    });

    return unsubscribe;
  }, [key]);

  return exists;
}

/**
 * Hook to get all state keys
 * 
 * @returns Array of keys
 */
export function useSDUIStateKeys(): string[] {
  const stateManager = getSDUIStateManager();
  const [keys, setKeys] = useState(() => stateManager.keys());

  useEffect(() => {
    const unsubscribe = stateManager.subscribeAll(() => {
      setKeys(stateManager.keys());
    });

    return unsubscribe;
  }, []);

  return keys;
}

/**
 * Hook to flush dirty state to database
 * 
 * @returns [flush function, isPending, error]
 */
export function useSDUIStateFlush(): [() => Promise<void>, boolean, Error | null] {
  const stateManager = getSDUIStateManager();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const flush = useCallback(async () => {
    setIsPending(true);
    setError(null);

    try {
      await stateManager.flush();
      setIsPending(false);
    } catch (err) {
      setError(err as Error);
      setIsPending(false);
    }
  }, []);

  return [flush, isPending, error];
}

import { useState, useCallback } from 'react';
import { announceToScreenReader } from '../utils/accessibility';

interface OptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  announceSuccess?: string;
  announceError?: string;
}

export const useOptimisticUpdate = <T,>(
  updateFn: (data: T) => Promise<void>,
  options: OptimisticUpdateOptions<T> = {}
) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (optimisticData: T, rollbackData?: T) => {
      setIsLoading(true);
      setError(null);

      try {
        await updateFn(optimisticData);

        if (options.announceSuccess) {
          announceToScreenReader(options.announceSuccess, 'polite');
        }

        options.onSuccess?.(optimisticData);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Update failed');
        setError(error);

        if (rollbackData) {
          await updateFn(rollbackData);
        }

        if (options.announceError) {
          announceToScreenReader(options.announceError, 'assertive');
        }

        options.onError?.(error);
      } finally {
        setIsLoading(false);
      }
    },
    [updateFn, options]
  );

  return { execute, isLoading, error };
};

export const useAsyncAction = <T = void, Args extends any[] = []>(
  action: (...args: Args) => Promise<T>,
  options: {
    onSuccess?: (result: T) => void;
    onError?: (error: Error) => void;
  } = {}
) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const execute = useCallback(
    async (...args: Args) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await action(...args);
        setData(result);
        options.onSuccess?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Action failed');
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [action, options]
  );

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(null);
  }, []);

  return { execute, isLoading, error, data, reset };
};

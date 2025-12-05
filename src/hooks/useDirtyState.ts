import { useState, useEffect, useCallback } from 'react';

export const useDirtyState = <T extends Record<string, any>>(
  initialState: T,
  onDirtyChange?: (isDirty: boolean) => void
) => {
  const [currentState, setCurrentState] = useState<T>(initialState);
  const [originalState, setOriginalState] = useState<T>(initialState);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const dirty = JSON.stringify(currentState) !== JSON.stringify(originalState);
    setIsDirty(dirty);
    onDirtyChange?.(dirty);
  }, [currentState, originalState, onDirtyChange]);

  const updateState = useCallback((updates: Partial<T>) => {
    setCurrentState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetState = useCallback(() => {
    setCurrentState(originalState);
  }, [originalState]);

  const saveState = useCallback(() => {
    setOriginalState(currentState);
    setIsDirty(false);
  }, [currentState]);

  return {
    state: currentState,
    originalState,
    isDirty,
    updateState,
    resetState,
    saveState,
    setState: setCurrentState,
  };
};

export const useBeforeUnload = (isDirty: boolean, message?: string) => {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = message || 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, message]);
};

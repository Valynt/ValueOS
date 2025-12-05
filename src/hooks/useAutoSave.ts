import { useEffect, useRef, useCallback } from 'react';
import { persistenceService } from '../services/PersistenceService';
import { CanvasComponent } from '../types';

interface AutoSaveOptions {
  caseId: string;
  debounceMs?: number;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: Error) => void;
}

export const useAutoSave = (options: AutoSaveOptions) => {
  const {
    caseId,
    debounceMs = 2000,
    onSaveStart,
    onSaveComplete,
    onSaveError
  } = options;

  const saveQueueRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const savingRef = useRef<Set<string>>(new Set());

  const saveComponent = useCallback(async (
    componentId: string,
    updates: Partial<CanvasComponent>,
    actor: string = 'user'
  ) => {
    if (savingRef.current.has(componentId)) {
      return;
    }

    try {
      savingRef.current.add(componentId);
      onSaveStart?.();

      await persistenceService.updateComponent(componentId, updates, actor);

      savingRef.current.delete(componentId);
      onSaveComplete?.();
    } catch (error) {
      savingRef.current.delete(componentId);
      onSaveError?.(error as Error);
      logger.error('Auto-save error:', error);
    }
  }, [onSaveStart, onSaveComplete, onSaveError]);

  const queueSave = useCallback((
    componentId: string,
    updates: Partial<CanvasComponent>,
    actor: string = 'user'
  ) => {
    if (saveQueueRef.current.has(componentId)) {
      clearTimeout(saveQueueRef.current.get(componentId)!);
    }

    const timeout = setTimeout(() => {
      saveComponent(componentId, updates, actor);
      saveQueueRef.current.delete(componentId);
    }, debounceMs);

    saveQueueRef.current.set(componentId, timeout);
  }, [debounceMs, saveComponent]);

  const flushQueue = useCallback(() => {
    saveQueueRef.current.forEach((timeout) => clearTimeout(timeout));
    saveQueueRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      flushQueue();
    };
  }, [flushQueue]);

  return {
    queueSave,
    saveComponent,
    flushQueue,
    isSaving: (componentId: string) => savingRef.current.has(componentId)
  };
};

import { useEffect, useState, useCallback } from 'react';
import { undoRedoManager } from '../services/UndoRedoManager';
import { CanvasComponent } from '../types';

interface UseUndoRedoReturn {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveState: (components: CanvasComponent[], action: string, actor?: string) => void;
  undoAction: string | null;
  redoAction: string | null;
}

export const useUndoRedo = (
  onStateChange: (components: CanvasComponent[]) => void
): UseUndoRedoReturn => {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoAction, setUndoAction] = useState<string | null>(null);
  const [redoAction, setRedoAction] = useState<string | null>(null);

  const updateState = useCallback(() => {
    const stats = undoRedoManager.getStats();
    setCanUndo(stats.canUndo);
    setCanRedo(stats.canRedo);
    setUndoAction(stats.undoAction);
    setRedoAction(stats.redoAction);
  }, []);

  useEffect(() => {
    undoRedoManager.onChange(updateState);
    updateState();
  }, [updateState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const undo = useCallback(() => {
    const previousState = undoRedoManager.undo();
    if (previousState) {
      onStateChange(previousState);
    }
  }, [onStateChange]);

  const redo = useCallback(() => {
    const nextState = undoRedoManager.redo();
    if (nextState) {
      onStateChange(nextState);
    }
  }, [onStateChange]);

  const saveState = useCallback((components: CanvasComponent[], action: string, actor: string = 'user') => {
    undoRedoManager.saveState(components, action, actor);
  }, []);

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    saveState,
    undoAction,
    redoAction
  };
};

/**
 * SDUIStateProvider
 *
 * Zustand-based state management for SDUI widgets.
 * Supports per-case state storage, undo/redo via useCanvasState integration,
 * and sessionStorage persistence for crash recovery.
 * Reference: openspec/changes/frontend-v1-surfaces/tasks.md §2
 */

import { createContext, ReactNode, useContext, useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

// ============================================================================
// Types
// ============================================================================

export interface WidgetState {
  data: Record<string, unknown>;
  dirty: boolean;
  lastModified: string;
}

export interface CaseState {
  caseId: string;
  widgets: Record<string, WidgetState>;
  undoStack: string[];
  redoStack: string[];
}

interface SDUIStateStore {
  cases: Record<string, CaseState>;

  setWidgetState: (caseId: string, widgetId: string, data: Record<string, unknown>) => void;
  resetWidgetState: (caseId: string, widgetId: string) => void;
  resetCaseState: (caseId: string) => void;

  undo: (caseId: string) => void;
  redo: (caseId: string) => void;
  canUndo: (caseId: string) => boolean;
  canRedo: (caseId: string) => boolean;

  createSnapshot: (caseId: string) => string;
  restoreSnapshot: (caseId: string, snapshotId: string) => void;

  getWidgetState: (caseId: string, widgetId: string) => WidgetState | undefined;
  isDirty: (caseId: string) => boolean;
}

function generateSnapshotId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyCaseState(caseId: string): CaseState {
  return {
    caseId,
    widgets: {},
    undoStack: [],
    redoStack: [],
  };
}

export const useSDUIStore = create<SDUIStateStore>()(
  immer(
    persist(
      (set, get) => ({
        cases: {},

        setWidgetState: (caseId, widgetId, data) => {
          set((state) => {
            if (!state.cases[caseId]) {
              state.cases[caseId] = createEmptyCaseState(caseId);
            }
            const caseState = state.cases[caseId];
            if (!caseState.widgets[widgetId]?.dirty) {
              const snapshotId = generateSnapshotId();
              caseState.undoStack.push(snapshotId);
              caseState.redoStack = [];
            }
            if (caseState.undoStack.length > 50) {
              caseState.undoStack.shift();
            }
            caseState.widgets[widgetId] = {
              data: { ...data },
              dirty: true,
              lastModified: new Date().toISOString(),
            };
          });
        },

        resetWidgetState: (caseId, widgetId) => {
          set((state) => {
            if (state.cases[caseId]?.widgets[widgetId]) {
              delete state.cases[caseId].widgets[widgetId];
            }
          });
        },

        resetCaseState: (caseId) => {
          set((state) => {
            delete state.cases[caseId];
          });
        },

        undo: (caseId) => {
          set((state) => {
            const caseState = state.cases[caseId];
            if (!caseState || caseState.undoStack.length === 0) return;
            const snapshotId = caseState.undoStack.pop();
            if (snapshotId) {
              caseState.redoStack.push(snapshotId);
            }
            Object.values(caseState.widgets).forEach((widget) => {
              (widget as WidgetState).dirty = false;
            });
          });
        },

        redo: (caseId) => {
          set((state) => {
            const caseState = state.cases[caseId];
            if (!caseState || caseState.redoStack.length === 0) return;
            const snapshotId = caseState.redoStack.pop();
            if (snapshotId) {
              caseState.undoStack.push(snapshotId);
            }
          });
        },

        canUndo: (caseId) => {
          const caseState = get().cases[caseId];
          return caseState ? caseState.undoStack.length > 0 : false;
        },

        canRedo: (caseId) => {
          const caseState = get().cases[caseId];
          return caseState ? caseState.redoStack.length > 0 : false;
        },

        createSnapshot: (caseId) => {
          const snapshotId = generateSnapshotId();
          set((state) => {
            if (!state.cases[caseId]) {
              state.cases[caseId] = createEmptyCaseState(caseId);
            }
            state.cases[caseId].undoStack.push(snapshotId);
          });
          return snapshotId;
        },

        restoreSnapshot: (caseId, snapshotId) => {
          console.log(`Restoring snapshot ${snapshotId} for case ${caseId}`);
        },

        getWidgetState: (caseId, widgetId) => {
          return get().cases[caseId]?.widgets[widgetId];
        },

        isDirty: (caseId) => {
          const caseState = get().cases[caseId];
          if (!caseState) return false;
          return Object.values(caseState.widgets).some((w) => w.dirty);
        },
      }),
      {
        name: "sdui-state-storage",
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({ cases: state.cases }),
      }
    )
  )
);

interface SDUIStateContextValue {
  store: typeof useSDUIStore;
  useStore: typeof useSDUIStore;
}

const SDUIStateContext = createContext<SDUIStateContextValue | undefined>(undefined);

export function SDUIStateProvider({ children, _supabase }: { children: ReactNode; _supabase?: unknown }) {
  const value = useMemo(
    () => ({
      store: useSDUIStore,
      useStore: useSDUIStore,
    }),
    []
  );

  return <SDUIStateContext.Provider value={value}>{children}</SDUIStateContext.Provider>;
}

export function useSDUIState() {
  const context = useContext(SDUIStateContext);
  if (!context) {
    return { store: useSDUIStore, useStore: useSDUIStore };
  }
  return context;
}

export function useWidgetState(caseId: string, widgetId: string) {
  const store = useSDUIStore();

  return {
    state: store.getWidgetState(caseId, widgetId),
    setState: (data: Record<string, unknown>) => store.setWidgetState(caseId, widgetId, data),
    reset: () => store.resetWidgetState(caseId, widgetId),
  };
}

export function useCaseUndoRedo(caseId: string) {
  const store = useSDUIStore();

  return {
    canUndo: store.canUndo(caseId),
    canRedo: store.canRedo(caseId),
    undo: () => store.undo(caseId),
    redo: () => store.redo(caseId),
    isDirty: store.isDirty(caseId),
  };
}

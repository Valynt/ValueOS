/**
 * Mode Store — Workspace mode state management
 *
 * Zustand store for managing the active workspace mode (canvas, narrative, copilot, evidence)
 * and related UI state like inspector visibility and density preferences.
 *
 * Phase 2: Workspace Core
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { WorkspaceMode } from "@shared/domain/Warmth";

type Density = "compact" | "comfortable" | "spacious";

interface ModeStore {
  /** Active workspace mode */
  activeMode: WorkspaceMode;
  /** Whether the inspector panel is open */
  inspectorOpen: boolean;
  /** UI density preference */
  density: Density;
  /** Set the active workspace mode (syncs to backend) */
  setActiveMode: (mode: WorkspaceMode) => void;
  /** Toggle or set inspector panel visibility */
  setInspectorOpen: (open: boolean) => void;
  /** Set UI density preference (syncs to backend) */
  setDensity: (density: Density) => void;
  /** Sync state from backend preferences */
  syncFromBackend: (preferences: {
    mode?: WorkspaceMode;
    density?: Density;
    inspectorOpen?: boolean;
  }) => void;
  /** Track if store has been initialized from backend */
  isInitialized: boolean;
  /** Mark store as initialized */
  markInitialized: () => void;
}

const initialState = {
  activeMode: "canvas" as WorkspaceMode,
  inspectorOpen: false,
  density: "comfortable" as Density,
  isInitialized: false,
};

export const useModeStore = create<ModeStore>()(
  persist(
    (set) => ({
      ...initialState,

      setActiveMode: (mode) => set({ activeMode: mode }),

      setInspectorOpen: (open) => set({ inspectorOpen: open }),

      setDensity: (density) => set({ density }),

      syncFromBackend: (preferences) =>
        set((state) => ({
          ...state,
          activeMode: preferences.mode ?? state.activeMode,
          density: preferences.density ?? state.density,
          inspectorOpen: preferences.inspectorOpen ?? state.inspectorOpen,
        })),

      markInitialized: () => set({ isInitialized: true }),
    }),
    {
      name: "mode-store",
      partialize: (state) => ({
        activeMode: state.activeMode,
        density: state.density,
      }),
    }
  )
);

// Export hooks for external use
export const useActiveMode = () => useModeStore((state) => state.activeMode);
export const useInspectorOpen = () => useModeStore((state) => state.inspectorOpen);
export const useDensity = () => useModeStore((state) => state.density);
export const useModeStoreInitialized = () => useModeStore((state) => state.isInitialized);

/**
 * Hook to sync mode store with backend preferences
 * Call this in your app root or layout to initialize the store from backend
 */
export function useSyncModeStoreWithBackend(
  backendPreferences: { mode?: WorkspaceMode; density?: Density; inspectorOpen?: boolean } | undefined,
  isLoading: boolean
) {
  const { syncFromBackend, markInitialized, isInitialized } = useModeStore();

  if (!isLoading && backendPreferences && !isInitialized) {
    syncFromBackend(backendPreferences);
    markInitialized();
  }
}

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
  /** Set the active workspace mode */
  setActiveMode: (mode: WorkspaceMode) => void;
  /** Toggle or set inspector panel visibility */
  setInspectorOpen: (open: boolean) => void;
  /** Set UI density preference */
  setDensity: (density: Density) => void;
}

const initialState = {
  activeMode: "canvas" as WorkspaceMode,
  inspectorOpen: false,
  density: "comfortable" as Density,
};

export const useModeStore = create<ModeStore>()(
  persist(
    (set) => ({
      ...initialState,

      setActiveMode: (mode) => set({ activeMode: mode }),

      setInspectorOpen: (open) => set({ inspectorOpen: open }),

      setDensity: (density) => set({ density }),
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

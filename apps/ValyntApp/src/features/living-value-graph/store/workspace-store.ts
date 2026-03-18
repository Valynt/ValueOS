/**
 * Workspace Store - UI state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  BottomTrayTab,
  CanvasView,
  LeftRailTab,
  WorkspaceUIState,
} from '../types/ui.types';
import { WorkflowStep } from '../types/workflow.types';

interface WorkspaceStore extends WorkspaceUIState {
  // Actions
  setSelectedNodeId: (id: string | null) => void;
  setActiveView: (view: CanvasView) => void;
  setLeftRailTab: (tab: LeftRailTab) => void;
  setBottomTrayTab: (tab: BottomTrayTab) => void;
  setWorkflowStep: (step: WorkflowStep) => void;
  setCanvasZoom: (zoom: number) => void;
  setCanvasPan: (x: number, y: number) => void;
  setFilters: (filters: Partial<WorkspaceUIState['filters']>) => void;
  initialize: () => void;
}

const initialState: WorkspaceUIState = {
  selectedNodeId: null,
  activeView: 'tree',
  leftRailTab: 'outline',
  bottomTrayTab: 'workflow',
  workflowStep: 'hypothesis',
  filters: {
    nodeTypes: [],
    minConfidence: null,
    showLockedOnly: false,
    showEvidenceGapsOnly: false,
    showDefensibilityIssues: false,
  },
  canvas: {
    zoom: 1,
    panX: 0,
    panY: 0,
  },
};

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      ...initialState,

      setSelectedNodeId: (id) => set({ selectedNodeId: id }),

      setActiveView: (view) => set({ activeView: view }),

      setLeftRailTab: (tab) => set({ leftRailTab: tab }),

      setBottomTrayTab: (tab) => set({ bottomTrayTab: tab }),

      setWorkflowStep: (step) => set({ workflowStep: step }),

      setCanvasZoom: (zoom) =>
        set((state) => ({
          canvas: { ...state.canvas, zoom: Math.max(0.1, Math.min(2, zoom)) },
        })),

      setCanvasPan: (x, y) =>
        set((state) => ({
          canvas: { ...state.canvas, panX: x, panY: y },
        })),

      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

      initialize: () => set(initialState),
    }),
    {
      name: 'workspace-store',
      partialize: (state) => ({
        activeView: state.activeView,
        leftRailTab: state.leftRailTab,
        bottomTrayTab: state.bottomTrayTab,
        filters: state.filters,
      }),
    }
  )
);

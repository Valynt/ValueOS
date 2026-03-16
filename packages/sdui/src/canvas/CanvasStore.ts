/**
 * Canvas State Management with Zustand
 * 
 * Manages canvas state, history, undo/redo for agentic canvas
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { CanvasPatcher } from './CanvasPatcher';
import { CanvasDelta, CanvasLayout } from './types';
import { SDUIPageDefinition } from '../schema';

interface CanvasState {
  // Current canvas
  current: CanvasLayout | null;
  canvasId: string | null;
  version: number;
  
  // History for undo/redo
  history: CanvasLayout[];
  historyIndex: number;
  
  // Streaming state
  isStreaming: boolean;
  streamChunks: unknown[];
  
  // Metadata
  lastUpdated: number;
  agentId?: string;

  // Page-level API (SDUIPageDefinition-based, parallel to CanvasLayout API)
  currentPage: SDUIPageDefinition | null;
  pageHistory: SDUIPageDefinition[];
  pageHistoryIndex: number;
  
  // Actions
  setCanvas: (layout: CanvasLayout, canvasId: string, agentId?: string) => void;
  patchCanvas: (delta: CanvasDelta) => void;
  startStreaming: () => void;
  addStreamChunk: (chunk: unknown) => void;
  completeStreaming: (finalLayout: CanvasLayout) => void;
  setCurrentPage: (page: SDUIPageDefinition) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  
  // Queries
  canUndo: () => boolean;
  canRedo: () => boolean;
  getComponentById: (componentId: string) => CanvasLayout | null;
}



export const useCanvasStore = create<CanvasState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        current: null,
        canvasId: null,
        version: 0,
        history: [],
        historyIndex: -1,
        isStreaming: false,
        streamChunks: [],
        lastUpdated: 0,
        currentPage: null,
        pageHistory: [],
        pageHistoryIndex: -1,
        
        // Set canvas (full replacement)
        setCanvas: (layout, canvasId, agentId) =>
          set((state) => {
            const newHistory = [...state.history.slice(0, state.historyIndex + 1), layout];
            return {
              current: layout,
              canvasId,
              agentId,
              version: state.version + 1,
              history: newHistory.slice(-50), // Keep last 50 states
              historyIndex: Math.min(newHistory.length - 1, 49),
              lastUpdated: Date.now(),
            };
          }),
        
        // Patch canvas (delta update)
        patchCanvas: (delta) =>
          set((state) => {
            if (!state.current) return state;
            
            const newLayout = CanvasPatcher.applyDelta(state.current, delta);
            const newHistory = [...state.history.slice(0, state.historyIndex + 1), newLayout];
            
            return {
              current: newLayout,
              version: state.version + 1,
              history: newHistory.slice(-50),
              historyIndex: Math.min(newHistory.length - 1, 49),
              lastUpdated: Date.now(),
            };
          }),
        
        // Start streaming
        startStreaming: () =>
          set({
            isStreaming: true,
            streamChunks: [],
          }),
        
        // Add stream chunk
        addStreamChunk: (chunk) =>
          set((state) => ({
            streamChunks: [...state.streamChunks, chunk],
          })),
        
        // Complete streaming
        completeStreaming: (finalLayout) =>
          set((state) => {
            const newHistory = [...state.history.slice(0, state.historyIndex + 1), finalLayout];
            return {
              current: finalLayout,
              version: state.version + 1,
              history: newHistory.slice(-50),
              historyIndex: Math.min(newHistory.length - 1, 49),
              isStreaming: false,
              streamChunks: [],
              lastUpdated: Date.now(),
            };
          }),
        
        // Set current page (SDUIPageDefinition-based history).
        // Also mirrors into the CanvasLayout history so store.history.length
        // stays consistent with pageHistory.length.
        setCurrentPage: (page) => {
          const state = get();
          const newPageHistory = [
            ...state.pageHistory.slice(0, state.pageHistoryIndex + 1),
            page,
          ];
          const newPageIndex = Math.min(newPageHistory.length - 1, 49);
          const pageAsLayout = page as unknown as CanvasLayout;
          const newHistory = [
            ...state.history.slice(0, state.historyIndex + 1),
            pageAsLayout,
          ];
          const newHistoryIndex = Math.min(newHistory.length - 1, 49);
          set({
            currentPage: page,
            pageHistory: newPageHistory.slice(-50),
            pageHistoryIndex: newPageIndex,
            history: newHistory.slice(-50),
            historyIndex: newHistoryIndex,
            lastUpdated: Date.now(),
          });
        },

        // Undo — rewinds both CanvasLayout and SDUIPageDefinition histories
        undo: () => {
          const state = get();
          const update: Partial<CanvasState> = { lastUpdated: Date.now() };
          if (state.historyIndex > 0) {
            update.current = state.history[state.historyIndex - 1];
            update.historyIndex = state.historyIndex - 1;
          }
          if (state.pageHistoryIndex > 0) {
            update.currentPage = state.pageHistory[state.pageHistoryIndex - 1];
            update.pageHistoryIndex = state.pageHistoryIndex - 1;
          }
          set(update);
        },

        // Redo — advances both histories
        redo: () => {
          const state = get();
          const update: Partial<CanvasState> = { lastUpdated: Date.now() };
          if (state.historyIndex < state.history.length - 1) {
            update.current = state.history[state.historyIndex + 1];
            update.historyIndex = state.historyIndex + 1;
          }
          if (state.pageHistoryIndex < state.pageHistory.length - 1) {
            update.currentPage = state.pageHistory[state.pageHistoryIndex + 1];
            update.pageHistoryIndex = state.pageHistoryIndex + 1;
          }
          set(update);
        },
        
        // Reset
        reset: () =>
          set({
            current: null,
            canvasId: null,
            version: 0,
            history: [],
            historyIndex: -1,
            isStreaming: false,
            streamChunks: [],
            lastUpdated: 0,
            agentId: undefined,
            currentPage: null,
            pageHistory: [],
            pageHistoryIndex: -1,
          }),
        
        // Can undo?
        canUndo: () => {
          const state = get();
          return state.historyIndex > 0 || state.pageHistoryIndex > 0;
        },
        
        // Can redo?
        canRedo: () => {
          const state = get();
          return (
            state.historyIndex < state.history.length - 1 ||
            state.pageHistoryIndex < state.pageHistory.length - 1
          );
        },
        
        // Get component by ID
        getComponentById: (componentId) => {
          const state = get();
          if (!state.current) return null;
          return CanvasPatcher.findComponentById(state.current, componentId);
        },
      }),
      {
        name: 'canvas-store',
        partialize: (state) => ({
          current: state.current,
          canvasId: state.canvasId,
          version: state.version,
          currentPage: state.currentPage,
        }),
      }
    )
  )
);



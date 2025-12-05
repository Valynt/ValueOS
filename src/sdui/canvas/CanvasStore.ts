/**
 * Canvas State Management with Zustand
 * 
 * Manages canvas state, history, undo/redo for agentic canvas
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { CanvasLayout, CanvasDelta } from './types';
import { CanvasPatcher } from './CanvasPatcher';

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
  streamChunks: any[];
  
  // Metadata
  lastUpdated: number;
  agentId?: string;
  
  // Actions
  setCanvas: (layout: CanvasLayout, canvasId: string, agentId?: string) => void;
  patchCanvas: (delta: CanvasDelta) => void;
  startStreaming: () => void;
  addStreamChunk: (chunk: any) => void;
  completeStreaming: (finalLayout: CanvasLayout) => void;
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
        
        // Undo
        undo: () =>
          set((state) => {
            if (state.historyIndex <= 0) return state;
            return {
              current: state.history[state.historyIndex - 1],
              historyIndex: state.historyIndex - 1,
              lastUpdated: Date.now(),
            };
          }),
        
        // Redo
        redo: () =>
          set((state) => {
            if (state.historyIndex >= state.history.length - 1) return state;
            return {
              current: state.history[state.historyIndex + 1],
              historyIndex: state.historyIndex + 1,
              lastUpdated: Date.now(),
            };
          }),
        
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
          }),
        
        // Can undo?
        canUndo: () => {
          const state = get();
          return state.historyIndex > 0;
        },
        
        // Can redo?
        canRedo: () => {
          const state = get();
          return state.historyIndex < state.history.length - 1;
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
        }),
      }
    )
  )
);

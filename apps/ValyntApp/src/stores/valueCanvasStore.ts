/**
 * ValueCanvas Store
 *
 * Zustand store for Value Driver Configuration Canvas state management.
 * Manages nodes, edges, driver values, and UI state for real-time calculations.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Node, Edge, addEdge, Connection } from '@xyflow/react';
import { zundo } from 'zundo';

// Types for the store
export interface ValueDriverNode {
  id: string;
  type: 'input' | 'calculated';
  label: string;
  formula?: string;
  value: number;
  format: 'currency' | 'percentage' | 'number';
  position: { x: number; y: number };
}

export interface ValueDriverEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface DriverValues {
  [nodeId: string]: number;
}

export interface DriverDefinitions {
  [nodeId: string]: {
    formula: string;
    format: 'currency' | 'percentage' | 'number';
    label: string;
  };
}

// Store slices
interface GraphSlice {
  nodes: Node[];
  edges: Edge[];
  addNode: (node: Node) => void;
  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  removeNode: (nodeId: string) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (edgeId: string) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
}

interface ModelSlice {
  driverDefinitions: DriverDefinitions;
  driverValues: DriverValues;
  updateDriverDefinition: (nodeId: string, definition: Partial<DriverDefinitions[string]>) => void;
  updateDriverValue: (nodeId: string, value: number) => void;
  batchUpdateValues: (updates: { [nodeId: string]: number }) => void;
  setDriverDefinitions: (definitions: DriverDefinitions) => void;
  setDriverValues: (values: DriverValues) => void;
}

interface UiSlice {
  selectedNodeId: string | null;
  isEditorOpen: boolean;
  isLibraryOpen: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  setSelectedNodeId: (nodeId: string | null) => void;
  setIsEditorOpen: (open: boolean) => void;
  setIsLibraryOpen: (open: boolean) => void;
  setIsSaving: (saving: boolean) => void;
  setLastSaved: (date: Date | null) => void;
  setError: (error: string | null) => void;
}

// Combined store interface
interface ValueCanvasStore extends GraphSlice, ModelSlice, UiSlice {
  // Actions that coordinate across slices
  addDriverNode: (node: ValueDriverNode) => void;
  updateDriverFormula: (nodeId: string, formula: string) => void;
  deleteDriverNode: (nodeId: string) => void;
  loadCanvas: (data: { nodes: Node[]; edges: Edge[]; driverDefinitions: DriverDefinitions; driverValues: DriverValues }) => void;
  reset: () => void;
}

// Initial state
const initialState = {
  // Graph slice
  nodes: [],
  edges: [],

  // Model slice
  driverDefinitions: {},
  driverValues: {},

  // UI slice
  selectedNodeId: null,
  isEditorOpen: false,
  isLibraryOpen: false,
  isSaving: false,
  lastSaved: null,
  error: null,
};

// Create the store with undo/redo middleware
const useValueCanvasStore = create<ValueCanvasStore>()(
  zundo(
    devtools(
      (set, get) => ({
        ...initialState,

        // Graph slice actions
        addNode: (node) => set((state) => ({
          nodes: [...state.nodes, node]
        }), false, 'addNode'),

        updateNode: (nodeId, updates) => set((state) => ({
          nodes: state.nodes.map(node =>
            node.id === nodeId ? { ...node, ...updates } : node
          )
        }), false, 'updateNode'),

        removeNode: (nodeId) => set((state) => ({
          nodes: state.nodes.filter(node => node.id !== nodeId),
          edges: state.edges.filter(edge => edge.source !== nodeId && edge.target !== nodeId)
        }), false, 'removeNode'),

        addEdge: (edge) => set((state) => ({
          edges: addEdge(edge, state.edges)
        }), false, 'addEdge'),

        removeEdge: (edgeId) => set((state) => ({
          edges: state.edges.filter(edge => edge.id !== edgeId)
        }), false, 'removeEdge'),

        onConnect: (connection) => {
          const edge = {
            ...connection,
            id: `edge-${connection.source}-${connection.target}`,
            type: 'default'
          };
          get().addEdge(edge);
        },

        setNodes: (nodes) => set({ nodes }, false, 'setNodes'),
        setEdges: (edges) => set({ edges }, false, 'setEdges'),

        // Model slice actions
        updateDriverDefinition: (nodeId, definition) => set((state) => ({
          driverDefinitions: {
            ...state.driverDefinitions,
            [nodeId]: {
              ...state.driverDefinitions[nodeId],
              ...definition
            }
          }
        }), false, 'updateDriverDefinition'),

        updateDriverValue: (nodeId, value) => set((state) => ({
          driverValues: {
            ...state.driverValues,
            [nodeId]: value
          }
        }), false, 'updateDriverValue'),

        batchUpdateValues: (updates) => set((state) => ({
          driverValues: {
            ...state.driverValues,
            ...updates
          }
        }), false, 'batchUpdateValues'),

        setDriverDefinitions: (definitions) => set({ driverDefinitions: definitions }, false, 'setDriverDefinitions'),
        setDriverValues: (values) => set({ driverValues: values }, false, 'setDriverValues'),

        // UI slice actions
        setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }, false, 'setSelectedNodeId'),
        setIsEditorOpen: (open) => set({ isEditorOpen: open }, false, 'setIsEditorOpen'),
        setIsLibraryOpen: (open) => set({ isLibraryOpen: open }, false, 'setIsLibraryOpen'),
        setIsSaving: (saving) => set({ isSaving: saving }, false, 'setIsSaving'),
        setLastSaved: (date) => set({ lastSaved: date }, false, 'setLastSaved'),
        setError: (error) => set({ error }, false, 'setError'),

        // Coordinated actions
        addDriverNode: (driverNode) => {
          const node: Node = {
            id: driverNode.id,
            type: driverNode.type === 'input' ? 'inputNode' : 'calculatedNode',
            position: driverNode.position,
            data: {
              label: driverNode.label,
              value: driverNode.value,
              format: driverNode.format,
              formula: driverNode.formula
            }
          };

          get().addNode(node);
          get().updateDriverDefinition(driverNode.id, {
            formula: driverNode.formula || '',
            format: driverNode.format,
            label: driverNode.label
          });
          get().updateDriverValue(driverNode.id, driverNode.value);
        },

        updateDriverFormula: (nodeId, formula) => {
          get().updateDriverDefinition(nodeId, { formula });
          // Trigger recalculation will be handled by CalculationEngine
        },

        deleteDriverNode: (nodeId) => {
          get().removeNode(nodeId);
          set((state) => {
            const { [nodeId]: _, ...driverDefinitions } = state.driverDefinitions;
            const { [nodeId]: __, ...driverValues } = state.driverValues;
            return { driverDefinitions, driverValues };
          }, false, 'deleteDriverNode');
        },

        loadCanvas: (data) => set({
          nodes: data.nodes,
          edges: data.edges,
          driverDefinitions: data.driverDefinitions,
          driverValues: data.driverValues
        }, false, 'loadCanvas'),

        reset: () => set(initialState, false, 'reset')
      }),
      { name: 'value-canvas-store' }
    ),
    {
      // zundo options
      handleSet: (handleSet) => (payload, replace) => {
        // Only include actions that should be undoable
        const undoableActions = [
          'addNode', 'updateNode', 'removeNode', 'addEdge', 'removeEdge',
          'updateDriverDefinition', 'updateDriverValue', 'batchUpdateValues',
          'addDriverNode', 'updateDriverFormula', 'deleteDriverNode'
        ];

        if (undoableActions.includes(payload?.type)) {
          handleSet(payload, replace);
        } else {
          // For non-undoable actions, just set without history
          payload?.type && handleSet({ ...payload, type: undefined }, replace);
        }
      }
    }
  )
);

// Export hooks for undo/redo
export const useTemporalStore = () => {
  const store = useValueCanvasStore.temporal;
  return {
    undo: store.undo,
    redo: store.redo,
    clear: store.clear,
    pastStates: store.pastStates,
    futureStates: store.futureStates
  };
};

export default useValueCanvasStore;
/**
 * ValueCanvas Store
 *
 * Zustand store for Value Driver Configuration Canvas state management.
 * Manages nodes, edges, driver values, and UI state for real-time calculations.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { Node, Edge, addEdge, Connection } from "@xyflow/react";
import { zundo } from "zundo";

// Types for the store
export interface ValueDriverNode {
  id: string;
  type: "input" | "calculated";
  label: string;
  formula?: string;
  value: number;
  format: "currency" | "percentage" | "number";
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
    format: "currency" | "percentage" | "number";
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
  loadCanvas: (data: {
    nodes: Node[];
    edges: Edge[];
    driverDefinitions: DriverDefinitions;
    driverValues: DriverValues;
  }) => void;
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
        addNode: (node: Node) =>
          set(
            (state) => ({
              nodes: [...state.nodes, node],
            }),
            false,
            "addNode"
          ),

        updateNode: (nodeId: string, updates: Partial<Node>) =>
          set(
            (state) => ({
              nodes: state.nodes.map((node) =>
                node.id === nodeId ? { ...node, ...updates } : node
              ),
            }),
            false,
            "updateNode"
          ),

        removeNode: (nodeId: string) =>
          set(
            (state) => ({
              nodes: state.nodes.filter((node) => node.id !== nodeId),
              edges: state.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
            }),
            false,
            "removeNode"
          ),

        addEdge: (edge: Edge) =>
          set(
            (state) => ({
              edges: addEdge(edge, state.edges),
            }),
            false,
            "addEdge"
          ),

        removeEdge: (edgeId: string) =>
          set(
            (state) => ({
              edges: state.edges.filter((edge) => edge.id !== edgeId),
            }),
            false,
            "removeEdge"
          ),

        onConnect: (connection: Connection) => {
          const edge = {
            ...connection,
            id: `edge-${connection.source}-${connection.target}`,
            type: "default",
          };
          (get() as ValueCanvasStore).addEdge(edge);
        },

        setNodes: (nodes: Node[]) => set({ nodes }, false, "setNodes"),
        setEdges: (edges: Edge[]) => set({ edges }, false, "setEdges"),

        // Model slice actions
        updateDriverDefinition: (nodeId: string, definition: Partial<DriverDefinitions[string]>) =>
          set(
            (state) => ({
              driverDefinitions: {
                ...state.driverDefinitions,
                [nodeId]: {
                  ...state.driverDefinitions[nodeId],
                  ...definition,
                },
              },
            }),
            false,
            "updateDriverDefinition"
          ),

        updateDriverValue: (nodeId: string, value: number) =>
          set(
            (state) => ({
              driverValues: {
                ...state.driverValues,
                [nodeId]: value,
              },
            }),
            false,
            "updateDriverValue"
          ),

        batchUpdateValues: (updates: { [nodeId: string]: number }) =>
          set(
            (state) => ({
              driverValues: {
                ...state.driverValues,
                ...updates,
              },
            }),
            false,
            "batchUpdateValues"
          ),

        setDriverDefinitions: (definitions: DriverDefinitions) =>
          set({ driverDefinitions: definitions }, false, "setDriverDefinitions"),
        setDriverValues: (values: DriverValues) =>
          set({ driverValues: values }, false, "setDriverValues"),

        // UI slice actions
        setSelectedNodeId: (nodeId: string | null) =>
          set({ selectedNodeId: nodeId }, false, "setSelectedNodeId"),
        setIsEditorOpen: (open: boolean) => set({ isEditorOpen: open }, false, "setIsEditorOpen"),
        setIsLibraryOpen: (open: boolean) =>
          set({ isLibraryOpen: open }, false, "setIsLibraryOpen"),
        setIsSaving: (saving: boolean) => set({ isSaving: saving }, false, "setIsSaving"),
        setLastSaved: (date: Date | null) => set({ lastSaved: date }, false, "setLastSaved"),
        setError: (error: string | null) => set({ error }, false, "setError"),

        // Coordinated actions
        addDriverNode: (driverNode: ValueDriverNode) => {
          const node: Node = {
            id: driverNode.id,
            type: driverNode.type === "input" ? "inputNode" : "calculatedNode",
            position: driverNode.position,
            data: {
              label: driverNode.label,
              value: driverNode.value,
              format: driverNode.format,
              formula: driverNode.formula,
            },
          };

          (get() as ValueCanvasStore).addNode(node);
          (get() as ValueCanvasStore).updateDriverDefinition(driverNode.id, {
            formula: driverNode.formula || "",
            format: driverNode.format,
            label: driverNode.label,
          });
          (get() as ValueCanvasStore).updateDriverValue(driverNode.id, driverNode.value);
        },

        updateDriverFormula: (nodeId: string, formula: string) => {
          (get() as ValueCanvasStore).updateDriverDefinition(nodeId, { formula });
          // Trigger recalculation will be handled by CalculationEngine
        },

        deleteDriverNode: (nodeId: string) => {
          (get() as ValueCanvasStore).removeNode(nodeId);
          set(
            (state) => {
              const { [nodeId]: _, ...driverDefinitions } = state.driverDefinitions;
              const { [nodeId]: __, ...driverValues } = state.driverValues;
              return { driverDefinitions, driverValues };
            },
            false,
            "deleteDriverNode"
          );
        },

        loadCanvas: (data: {
          nodes: Node[];
          edges: Edge[];
          driverDefinitions: DriverDefinitions;
          driverValues: DriverValues;
        }) =>
          set(
            {
              nodes: data.nodes,
              edges: data.edges,
              driverDefinitions: data.driverDefinitions,
              driverValues: data.driverValues,
            },
            false,
            "loadCanvas"
          ),

        reset: () => set(initialState, false, "reset"),
      }),
      { name: "value-canvas-store" }
    ),
    {
      // zundo options
      handleSet: (handleSet: any) => (payload: any, replace: any) => {
        // Only include actions that should be undoable
        const undoableActions = [
          "addNode",
          "updateNode",
          "removeNode",
          "addEdge",
          "removeEdge",
          "updateDriverDefinition",
          "updateDriverValue",
          "batchUpdateValues",
          "addDriverNode",
          "updateDriverFormula",
          "deleteDriverNode",
        ];

        if (undoableActions.includes(payload?.type)) {
          handleSet(payload, replace);
        } else {
          // For non-undoable actions, just set without history
          payload?.type && handleSet({ ...payload, type: undefined }, replace);
        }
      },
    }
  )
);

// Export hooks for undo/redo
export const useTemporalStore = () => {
  const store = (useValueCanvasStore as any).temporal;
  return {
    undo: store.undo,
    redo: store.redo,
    clear: store.clear,
    pastStates: store.pastStates,
    futureStates: store.futureStates,
  };
};

export default useValueCanvasStore;

/**
 * Schema State Management with Zustand
 *
 * Manages SDUI schema state, history, undo/redo for real-time schema-driven UI updates
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { SDUIPageDefinition } from "./schema";
import { SchemaPatcher } from "./SchemaPatcher";
import { createLogger } from "../lib/logger";

const logger = createLogger({ component: "SchemaStore" });

export interface SchemaDelta {
  operations: Array<{
    type: "replace" | "add_section" | "remove_section" | "update_section" | "update_metadata";
    path?: string; // JSON path for updates
    value?: any;
    sectionId?: string;
  }>;
}

interface SchemaState {
  // Current schema
  current: SDUIPageDefinition | null;
  schemaId: string | null;
  version: number;

  // History for undo/redo
  history: SDUIPageDefinition[];
  historyIndex: number;

  // Streaming state
  isStreaming: boolean;
  streamChunks: Partial<SDUIPageDefinition>[];

  // Metadata
  lastUpdated: number;
  agentId?: string;

  // WebSocket connection
  wsConnection: WebSocket | null;
  wsUrl: string | null;

  // Actions
  setSchema: (schema: SDUIPageDefinition, schemaId: string, agentId?: string) => void;
  patchSchema: (delta: SchemaDelta) => void;
  startStreaming: (schemaId: string, wsUrl?: string) => void;
  addStreamChunk: (chunk: Partial<SDUIPageDefinition>) => void;
  completeStreaming: (finalSchema: SDUIPageDefinition) => void;
  stopStreaming: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;

  // Queries
  canUndo: () => boolean;
  canRedo: () => boolean;
  getSectionById: (sectionId: string) => any;
}

export const useSchemaStore = create<SchemaState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        current: null,
        schemaId: null,
        version: 0,
        history: [],
        historyIndex: -1,
        isStreaming: false,
        streamChunks: [],
        lastUpdated: 0,
        wsConnection: null,
        wsUrl: null,

        // Set schema (full replacement)
        setSchema: (schema, schemaId, agentId) =>
          set((state) => {
            const newHistory = [...state.history.slice(0, state.historyIndex + 1), schema];
            return {
              current: schema,
              schemaId,
              agentId,
              version: state.version + 1,
              history: newHistory.slice(-50), // Keep last 50 states
              historyIndex: Math.min(newHistory.length - 1, 49),
              lastUpdated: Date.now(),
            };
          }),

        // Patch schema (delta update)
        patchSchema: (delta) =>
          set((state) => {
            if (!state.current) return state;

            const newSchema = SchemaPatcher.applyDelta(state.current, delta);
            const newHistory = [...state.history.slice(0, state.historyIndex + 1), newSchema];

            return {
              current: newSchema,
              version: state.version + 1,
              history: newHistory.slice(-50),
              historyIndex: Math.min(newHistory.length - 1, 49),
              lastUpdated: Date.now(),
            };
          }),

        // Start streaming
        startStreaming: (schemaId, wsUrl = "/api/sdui/stream") =>
          set((state) => {
            // Close existing connection
            if (state.wsConnection) {
              state.wsConnection.close();
            }

            const ws = new WebSocket(`${wsUrl}/${schemaId}`);

            ws.onopen = () => {
              logger.info("Schema streaming WebSocket connected", { schemaId, wsUrl });
            };

            ws.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data);

                if (data.type === "start") {
                  get().startStreaming(schemaId, wsUrl);
                } else if (data.type === "chunk") {
                  get().addStreamChunk(data.chunk);
                } else if (data.type === "delta") {
                  get().patchSchema(data.delta);
                } else if (data.type === "complete") {
                  get().completeStreaming(data.schema);
                } else if (data.type === "error") {
                  logger.error(
                    "Schema streaming error message received",
                    new Error(String(data.error)),
                    {
                      schemaId,
                    }
                  );
                  get().stopStreaming();
                }
              } catch (error) {
                logger.error("Schema streaming failed to parse message", error as Error, {
                  schemaId,
                });
              }
            };

            ws.onerror = (error) => {
              logger.error("Schema streaming WebSocket error", error as Error, { schemaId });
              get().stopStreaming();
            };

            ws.onclose = () => {
              logger.info("Schema streaming WebSocket disconnected", { schemaId });
              get().stopStreaming();
            };

            return {
              isStreaming: true,
              streamChunks: [],
              wsConnection: ws,
              wsUrl,
              schemaId,
            };
          }),

        // Add stream chunk
        addStreamChunk: (chunk) =>
          set((state) => ({
            isStreaming: true,
            streamChunks: [...state.streamChunks, chunk],
          })),

        // Complete streaming
        completeStreaming: (finalSchema) =>
          set((state) => {
            const newHistory = [...state.history.slice(0, state.historyIndex + 1), finalSchema];
            return {
              current: finalSchema,
              version: state.version + 1,
              history: newHistory.slice(-50),
              historyIndex: Math.min(newHistory.length - 1, 49),
              lastUpdated: Date.now(),
              isStreaming: false,
              streamChunks: [],
            };
          }),

        // Stop streaming
        stopStreaming: () =>
          set((state) => {
            if (state.wsConnection) {
              state.wsConnection.close();
            }
            return {
              isStreaming: false,
              streamChunks: [],
              wsConnection: null,
              wsUrl: null,
            };
          }),

        // Undo
        undo: () =>
          set((state) => {
            if (state.historyIndex > 0) {
              return {
                current: state.history[state.historyIndex - 1],
                historyIndex: state.historyIndex - 1,
                version: state.version + 1,
                lastUpdated: Date.now(),
              };
            }
            return state;
          }),

        // Redo
        redo: () =>
          set((state) => {
            if (state.historyIndex < state.history.length - 1) {
              return {
                current: state.history[state.historyIndex + 1],
                historyIndex: state.historyIndex + 1,
                version: state.version + 1,
                lastUpdated: Date.now(),
              };
            }
            return state;
          }),

        // Reset
        reset: () =>
          set({
            current: null,
            schemaId: null,
            version: 0,
            history: [],
            historyIndex: -1,
            isStreaming: false,
            streamChunks: [],
            lastUpdated: 0,
            wsConnection: null,
            wsUrl: null,
          }),

        // Queries
        canUndo: () => get().historyIndex > 0,
        canRedo: () => get().historyIndex < get().history.length - 1,
        getSectionById: (sectionId) => {
          const schema = get().current;
          if (!schema) return null;
          return schema.sections.find((section) => (section as any).id === sectionId);
        },
      }),
      {
        name: "sdui-schema-store",
        partialize: (state) => ({
          current: state.current,
          schemaId: state.schemaId,
          version: state.version,
          history: state.history.slice(-10), // Only persist last 10 for storage
          historyIndex: state.historyIndex,
          lastUpdated: state.lastUpdated,
        }),
      }
    ),
    {
      name: "SchemaStore",
    }
  )
);

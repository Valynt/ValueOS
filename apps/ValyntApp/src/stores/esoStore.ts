/**
 * ESO (Economic Statistics Organizations) Store
 *
 * Zustand store for managing real-time economic data from SEC, BLS, and Census.
 * Integrates with ValueOS for deterministic B2B value orchestration.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { ESOConfig, ESODataPoint, ESOService } from "../services/ESOService";

export interface ESOData {
  [source: string]: {
    data: any;
    timestamp: string;
    lastUpdated: number;
  };
}

export interface ESOStore {
  // State
  data: ESOData;
  isConnected: boolean;
  isStreaming: boolean;
  error: string | null;
  lastUpdate: number;

  // ESO Service instance
  esoService: ESOService | null;

  // Actions
  initializeESO: (config: ESOConfig) => void;
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  fetchData: (source: "SEC" | "BLS" | "Census", params?: any) => Promise<void>;
  updateData: (dataPoint: ESODataPoint) => void;
  setError: (error: string | null) => void;
  clearData: () => void;
}

export const useESOStore = create<ESOStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      data: {},
      isConnected: false,
      isStreaming: false,
      error: null,
      lastUpdate: 0,
      esoService: null,

      initializeESO: (config: ESOConfig) => {
        const esoService = new ESOService(config);

        // Subscribe to real-time updates
        const unsubscribe = esoService.subscribe((dataPoint) => {
          get().updateData(dataPoint);
        });

        set({
          esoService,
          isConnected: true,
          error: null,
        });

        // Store unsubscribe function for cleanup
        (esoService as any).unsubscribe = unsubscribe;
      },

      startStreaming: async () => {
        // Streaming is managed by the ESO service constructor
        set({ isStreaming: true, error: null });
      },

      stopStreaming: async () => {
        const { esoService } = get();
        if (esoService) {
          await esoService.stopRealtimeStreaming();
        }
        set({ isStreaming: false });
      },

      fetchData: async (source, params) => {
        const { esoService } = get();
        if (!esoService) {
          set({ error: "ESO service not initialized" });
          return;
        }

        try {
          const dataPoint = await esoService.fetchData(source, params);
          get().updateData(dataPoint);
          set({ error: null });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : "Failed to fetch data" });
        }
      },

      updateData: (dataPoint) => {
        set((state) => ({
          data: {
            ...state.data,
            [dataPoint.source]: {
              data: dataPoint.data,
              timestamp: dataPoint.timestamp,
              lastUpdated: Date.now(),
            },
          },
          lastUpdate: Date.now(),
        }));
      },

      setError: (error) => {
        set({ error });
      },

      clearData: () => {
        set({ data: {}, lastUpdate: 0 });
      },
    }),
    {
      name: "eso-store",
    }
  )
);

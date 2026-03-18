/**
 * ESO (Economic Statistics Organizations) Store
 *
 * Zustand store for SEC, BLS, and Census economic data.
 * Consumed by the useESO hook.
 */

import { create } from "zustand";

import { apiClient } from "@/api/client/unified-api-client";

export type ESOSource = "SEC" | "BLS" | "Census";

export interface ESOSourceData {
  records: unknown[];
  fetchedAt: number;
}

interface ESOConfig {
  sec: { baseUrl: string; rateLimit?: number; enableCache?: boolean; cacheTTL?: number };
  bls: { baseUrl: string; apiKey?: string; rateLimit?: number; enableCache?: boolean; cacheTTL?: number };
  census: { baseUrl: string; apiKey?: string; rateLimit?: number; enableCache?: boolean; cacheTTL?: number };
  enableRealtime: boolean;
  websocketUrl?: string;
}

export interface ESOState {
  data: Record<string, ESOSourceData>;
  isConnected: boolean;
  isStreaming: boolean;
  error: string | null;
  lastUpdate: number;
  config: ESOConfig | null;

  initializeESO: (config: ESOConfig) => void;
  startStreaming: () => void;
  stopStreaming: () => void;
  fetchData: (source: ESOSource, params?: Record<string, unknown>) => Promise<void>;
  clearData: () => void;
  setError: (error: string | null) => void;
}

let ws: WebSocket | null = null;

export const useESOStore = create<ESOState>()((set, get) => ({
  data: {},
  isConnected: false,
  isStreaming: false,
  error: null,
  lastUpdate: 0,
  config: null,

  initializeESO: (config: ESOConfig) => {
    set({ config, isConnected: true, error: null });
  },

  startStreaming: () => {
    const { config } = get();
    if (!config?.enableRealtime || !config.websocketUrl) {
      set({ error: "Realtime not configured" });
      return;
    }

    try {
      ws = new WebSocket(config.websocketUrl);
      ws.onopen = () => set({ isStreaming: true });
      ws.onclose = () => set({ isStreaming: false });
      ws.onerror = () => set({ error: "WebSocket connection failed", isStreaming: false });
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data as string) as {
            source: ESOSource;
            records: unknown[];
          };
          set((state) => ({
            data: {
              ...state.data,
              [payload.source]: { records: payload.records, fetchedAt: Date.now() },
            },
            lastUpdate: Date.now(),
          }));
        } catch {
          // ignore malformed WS frames
        }
      };
    } catch {
      set({ error: "Failed to open WebSocket", isStreaming: false });
    }
  },

  stopStreaming: () => {
    if (ws) {
      ws.close();
      ws = null;
    }
    set({ isStreaming: false });
  },

  fetchData: async (source: ESOSource, params?: Record<string, unknown>) => {
    const { config } = get();
    if (!config) {
      set({ error: "ESO not initialized" });
      return;
    }

    try {
      const queryParams = params
        ? `?${new URLSearchParams(
            Object.entries(params).map(([k, v]) => [k, String(v)]),
          ).toString()}`
        : "";

      const res = await apiClient.get<{ records: unknown[] }>(
        `/api/eso/${source.toLowerCase()}${queryParams}`,
      );

      if (!res.success) {
        throw new Error(res.error?.message ?? `Failed to fetch ${source} data`);
      }

      set((state) => ({
        data: {
          ...state.data,
          [source]: { records: res.data?.records ?? [], fetchedAt: Date.now() },
        },
        lastUpdate: Date.now(),
        error: null,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : `Failed to fetch ${source} data` });
    }
  },

  clearData: () => set({ data: {}, lastUpdate: 0 }),

  setError: (error: string | null) => set({ error }),
}));

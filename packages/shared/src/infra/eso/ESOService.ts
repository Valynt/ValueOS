/**
 * ESO (Economic Statistics Organizations) Service
 *
 * Provides real-time economic data ingestion from SEC, BLS, and Census.
 * Integrates with ValueOS for deterministic B2B value orchestration.
 */

import {
  BLSAdapter,
  CensusAdapter,
  DataIngestionAdapter,
  IngestionConfig,
  SECAdapter,
} from "./";

export interface ESODataPoint {
  source: "SEC" | "BLS" | "Census";
  data: unknown;
  timestamp: string;
  id: string;
}

export interface ESOConfig {
  sec: IngestionConfig;
  bls: IngestionConfig;
  census: IngestionConfig;
  enableRealtime: boolean;
}

export class ESOService {
  private adapters: Map<string, DataIngestionAdapter> = new Map();
  private dataCallbacks: Set<(data: ESODataPoint) => void> = new Set();

  constructor(private config: ESOConfig) {
    this.initializeAdapters();
    if (config.enableRealtime) {
      this.startRealtimeStreaming();
    }
  }

  private initializeAdapters() {
    this.adapters.set("SEC", new SECAdapter(this.config.sec));
    this.adapters.set("BLS", new BLSAdapter(this.config.bls));
    this.adapters.set("Census", new CensusAdapter(this.config.census));
  }

  private async startRealtimeStreaming() {
    // Start streaming for each adapter that supports it
    for (const [source, adapter] of Array.from(this.adapters)) {
      if (adapter.startStreaming) {
        try {
          // Set up data callback for this adapter
          const unsubscribe = adapter.onData?.((data) => {
            const dataPoint: ESODataPoint = {
              source: source as "SEC" | "BLS" | "Census",
              data,
              timestamp: new Date().toISOString(),
              id: `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            };
            this.notifyDataCallbacks(dataPoint);
          });

          // Start streaming with default parameters
          await adapter.startStreaming?.();
        } catch (error) {
          console.error(`Failed to start streaming for ${source}:`, error);
        }
      }
    }
  }

  /**
   * Fetch data from a specific ESO source
   */
  async fetchData(
    source: "SEC" | "BLS" | "Census",
    params?: Record<string, unknown>
  ): Promise<ESODataPoint> {
    const adapter = this.adapters.get(source);
    if (!adapter) {
      throw new Error(`Unknown ESO source: ${source}`);
    }

    const rawData = await adapter.fetchData(params);
    const transformedData = await adapter.transformData(rawData);

    const dataPoint: ESODataPoint = {
      source,
      data: transformedData,
      timestamp: new Date().toISOString(),
      id: `${source}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    this.notifyDataCallbacks(dataPoint);
    return dataPoint;
  }

  /**
   * Subscribe to real-time ESO data updates
   */
  subscribe(callback: (data: ESODataPoint) => void): () => void {
    this.dataCallbacks.add(callback);
    return () => this.dataCallbacks.delete(callback);
  }

  private notifyDataCallbacks(data: ESODataPoint) {
    this.dataCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("ESO data callback error:", error);
      }
    });
  }

  /**
   * Stop real-time data streaming
   */
  async stopRealtimeStreaming(): Promise<void> {
    for (const adapter of Array.from(this.adapters.values())) {
      if (adapter.stopStreaming) {
        try {
          await adapter.stopStreaming();
        } catch (error) {
          console.error("Error stopping streaming:", error);
        }
      }
    }
  }

  /**
   * Get available ESO sources
   */
  getSources(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Check if real-time streaming is active
   */
  isRealtimeActive(): boolean {
    // For now, assume streaming is active if enabled
    // In a real implementation, you'd check adapter states
    return this.config.enableRealtime;
  }
}

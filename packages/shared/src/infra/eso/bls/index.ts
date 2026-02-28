import { DataIngestionAdapter, IngestionConfig } from "../types.js";
import { Cache } from "../utils/cache.js";
import { RateLimiter } from "../utils/rateLimiter.js";

export class BLSAdapter implements DataIngestionAdapter {
  name = "BLS";
  private rateLimiter?: RateLimiter;
  private cache?: Cache;
  private ws?: WebSocket;
  private dataCallbacks: Set<(data: any) => void> = new Set();
  private reconnectTimer?: NodeJS.Timeout;
  private isStreaming = false;
  private pollTimer?: NodeJS.Timeout;
  private lastDataTimestamps: Map<string, string> = new Map();

  constructor(private config: IngestionConfig) {
    if (config.rateLimit) {
      this.rateLimiter = new RateLimiter(config.rateLimit, 60000);
    }
    if (config.enableCache) {
      this.cache = new Cache(config.cacheTTL);
    }
  }

  async fetchData(params: {
    seriesId: string;
    startYear?: string;
    endYear?: string;
  }): Promise<any> {
    const cacheKey = `bls-${JSON.stringify(params)}`;
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    if (this.rateLimiter) {
      await this.rateLimiter.waitForToken();
    }

    const url = new URL(`${this.config.baseUrl}/timeseries/data/`);
    url.searchParams.set("seriesid", params.seriesId);
    if (params.startYear) url.searchParams.set("startyear", params.startYear);
    if (params.endYear) url.searchParams.set("endyear", params.endYear);
    if (this.config.apiKey) url.searchParams.set("registrationkey", this.config.apiKey);

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`BLS API error: ${response.status}`);
    }

    const data = await response.json();

    if (this.cache) {
      this.cache.set(cacheKey, data);
    }

    return data;
  }

  async transformData(rawData: any): Promise<any> {
    // Transform BLS data to standardized format
    return {
      source: "BLS",
      data: rawData,
      timestamp: new Date().toISOString(),
    };
  }

  async startStreaming(
    params: { seriesIds?: string[]; pollInterval?: number } = {}
  ): Promise<void> {
    if (this.isStreaming) return;

    this.isStreaming = true;

    // BLS data is typically released on schedules, so we use polling for "real-time"
    // In a production system, you might connect to a real-time economic data service
    const pollInterval = params.pollInterval || 300000; // 5 minutes default

    const poll = async () => {
      if (!this.isStreaming) return;

      try {
        const seriesIds = params.seriesIds || ["CES0000000001"]; // Default: Total nonfarm employment

        for (const seriesId of seriesIds) {
          const data = await this.fetchData({ seriesId });

          // Check if data has been updated
          const latestTimestamp =
            data?.Results?.series?.[0]?.data?.[0]?.year +
            data?.Results?.series?.[0]?.data?.[0]?.period;
          const lastTimestamp = this.lastDataTimestamps.get(seriesId);

          if (latestTimestamp !== lastTimestamp) {
            this.lastDataTimestamps.set(seriesId, latestTimestamp);
            this.notifyDataCallbacks(data);
          }
        }
      } catch (error) {
        console.error("BLS polling error:", error);
      }

      this.pollTimer = setTimeout(poll, pollInterval);
    };

    // Start polling immediately
    poll();
  }

  async stopStreaming(): Promise<void> {
    this.isStreaming = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  onData(callback: (data: any) => void): () => void {
    this.dataCallbacks.add(callback);
    return () => this.dataCallbacks.delete(callback);
  }

  private notifyDataCallbacks(data: any) {
    this.dataCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("BLS data callback error:", error);
      }
    });
  }
}

import { AdapterPayload, DataIngestionAdapter, IngestionConfig } from "../types.js";
import { Cache } from "../utils/cache.js";
import { RateLimiter } from "../utils/rateLimiter.js";

type BLSParams = {
  seriesId: string;
  startYear?: string;
  endYear?: string;
};

type BLSStreamingParams = { seriesIds?: string[]; pollInterval?: number };

type BLSDataPayload = Record<string, unknown> & {
  Results?: {
    series?: Array<{
      data?: Array<{ year?: string; period?: string }>;
    }>;
  };
};

export class BLSAdapter implements DataIngestionAdapter<BLSParams, BLSDataPayload, AdapterPayload> {
  name = "BLS";
  private rateLimiter?: RateLimiter;
  private cache?: Cache<BLSDataPayload>;
  private ws?: WebSocket;
  private dataCallbacks: Set<(data: AdapterPayload) => void> = new Set();
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

  async fetchData(params: BLSParams): Promise<BLSDataPayload> {
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

    const data = (await response.json()) as BLSDataPayload;

    if (this.cache) {
      this.cache.set(cacheKey, data);
    }

    return data;
  }

  async transformData(rawData: BLSDataPayload): Promise<AdapterPayload> {
    // Transform BLS data to standardized format
    return {
      source: "BLS",
      data: rawData,
      timestamp: new Date().toISOString(),
    };
  }

  async startStreaming(
    params: BLSStreamingParams = {}
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
          const latestPoint = data.Results?.series?.[0]?.data?.[0];
          const latestTimestamp = `${latestPoint?.year ?? ""}${latestPoint?.period ?? ""}`;
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

  onData(callback: (data: AdapterPayload) => void): () => void {
    this.dataCallbacks.add(callback);
    return () => this.dataCallbacks.delete(callback);
  }

  private notifyDataCallbacks(data: AdapterPayload) {
    this.dataCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("BLS data callback error:", error);
      }
    });
  }
}

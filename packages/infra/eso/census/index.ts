import { DataIngestionAdapter, IngestionConfig } from "../types.js";
import { Cache } from "../utils/cache.js";
import { RateLimiter } from "../utils/rateLimiter.js";

export class CensusAdapter implements DataIngestionAdapter {
  name = "Census";
  private rateLimiter?: RateLimiter;
  private cache?: Cache;
  private dataCallbacks: Set<(data: any) => void> = new Set();
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
    dataset: string;
    variables: string[];
    geography?: string;
  }): Promise<any> {
    const cacheKey = `census-${JSON.stringify(params)}`;
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    if (this.rateLimiter) {
      await this.rateLimiter.waitForToken();
    }

    const url = new URL(`${this.config.baseUrl}/data/${params.dataset}`);
    url.searchParams.set("get", params.variables.join(","));
    if (params.geography) url.searchParams.set("for", params.geography);
    if (this.config.apiKey) url.searchParams.set("key", this.config.apiKey);

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Census API error: ${response.status}`);
    }

    const data = await response.json();

    if (this.cache) {
      this.cache.set(cacheKey, data);
    }

    return data;
  }

  async transformData(rawData: any): Promise<any> {
    // Transform Census data to standardized format
    return {
      source: "Census",
      data: rawData,
      timestamp: new Date().toISOString(),
    };
  }

  async startStreaming(
    params: {
      datasets?: Array<{ dataset: string; variables: string[]; geography?: string }>;
      pollInterval?: number;
    } = {}
  ): Promise<void> {
    if (this.isStreaming) return;

    this.isStreaming = true;

    // Census data is released on schedules, so we use polling for "real-time"
    const pollInterval = params.pollInterval || 3600000; // 1 hour default (Census data updates less frequently)

    const poll = async () => {
      if (!this.isStreaming) return;

      try {
        const datasets = params.datasets || [
          { dataset: "acs/acs5", variables: ["B01003_001E"], geography: "state:*" }, // Default: Population by state
        ];

        for (const dataset of datasets) {
          const data = await this.fetchData(dataset);

          // Check if data has been updated (simplified check)
          const dataKey = `${dataset.dataset}-${dataset.variables.join(",")}-${dataset.geography}`;
          const currentTimestamp = new Date().toISOString();
          const lastTimestamp = this.lastDataTimestamps.get(dataKey);

          // For demo purposes, we'll emit data on each poll
          // In production, you'd check for actual data changes
          if (!lastTimestamp || Date.now() - new Date(lastTimestamp).getTime() > pollInterval) {
            this.lastDataTimestamps.set(dataKey, currentTimestamp);
            this.notifyDataCallbacks({ ...data, dataset: dataset.dataset });
          }
        }
      } catch (error) {
        console.error("Census polling error:", error);
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
        console.error("Census data callback error:", error);
      }
    });
  }
}

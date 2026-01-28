import { DataIngestionAdapter, IngestionConfig } from "../types.js";
import { RateLimiter } from "../utils/rateLimiter.js";
import { Cache } from "../utils/cache.js";

export class BLSAdapter implements DataIngestionAdapter {
  name = "BLS";
  private rateLimiter?: RateLimiter;
  private cache?: Cache;

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
}

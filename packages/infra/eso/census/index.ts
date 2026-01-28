import { DataIngestionAdapter, IngestionConfig } from "../types.js";
import { RateLimiter } from "../utils/rateLimiter.js";
import { Cache } from "../utils/cache.js";

export class CensusAdapter implements DataIngestionAdapter {
  name = "Census";
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
}

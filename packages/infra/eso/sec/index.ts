import { DataIngestionAdapter, IngestionConfig } from "../types.js";
import { RateLimiter } from "../utils/rateLimiter.js";
import { Cache } from "../utils/cache.js";

export class SECAdapter implements DataIngestionAdapter {
  name = "SEC";
  private rateLimiter?: RateLimiter;
  private cache?: Cache;

  constructor(private config: IngestionConfig) {
    if (config.rateLimit) {
      this.rateLimiter = new RateLimiter(config.rateLimit, 60000); // per minute
    }
    if (config.enableCache) {
      this.cache = new Cache(config.cacheTTL);
    }
  }

  async fetchData(params: { cik?: string; type?: string } = {}): Promise<any> {
    const cacheKey = `sec-${JSON.stringify(params)}`;
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    if (this.rateLimiter) {
      await this.rateLimiter.waitForToken();
    }

    // SEC EDGAR API example
    // For company search: https://www.sec.gov/edgar/searchedgar/cik.htm
    // For filings: https://www.sec.gov/edgar/searchedgar/filings.htm

    const url = new URL(this.config.baseUrl);
    if (params.cik) {
      url.searchParams.set("cik", params.cik);
    }
    if (params.type) {
      url.searchParams.set("type", params.type);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "ValueOS/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`SEC API error: ${response.status}`);
    }

    const data = await response.json();

    if (this.cache) {
      this.cache.set(cacheKey, data);
    }

    return data;
  }

  async transformData(rawData: any): Promise<any> {
    // Transform SEC data to standardized format
    // This would depend on the specific endpoint
    return {
      source: "SEC",
      data: rawData,
      timestamp: new Date().toISOString(),
    };
  }
}

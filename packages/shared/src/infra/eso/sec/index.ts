import { logger } from "../../../lib/logger";
import { DataIngestionAdapter, IngestionConfig } from "../types.js";
import { Cache } from "../utils/cache.js";
import { RateLimiter } from "../utils/rateLimiter.js";

export class SECAdapter implements DataIngestionAdapter {
  name = "SEC";
  private rateLimiter?: RateLimiter;
  private cache?: Cache;
  private ws?: WebSocket;
  private dataCallbacks: Set<(data: any) => void> = new Set();
  private reconnectTimer?: NodeJS.Timeout;
  private isStreaming = false;

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

  async startStreaming(params: { symbols?: string[] } = {}): Promise<void> {
    if (this.isStreaming) return;

    // For real-time SEC data, we might connect to a financial data WebSocket
    // This is a placeholder - in reality, you'd connect to a service like Alpha Vantage, IEX, etc.
    const wsUrl = this.config.baseUrl.replace("https", "wss") + "/stream";

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      logger.info("SEC WebSocket connected");
      this.isStreaming = true;

      // Subscribe to specific symbols or general market data
      const subscription = {
        type: "subscribe",
        symbols: params.symbols || ["market-overview"],
        source: "SEC",
      };
      this.ws?.send(JSON.stringify(subscription));
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.notifyDataCallbacks(data);
      } catch (error) {
        console.error("Failed to parse SEC WebSocket data:", error);
      }
    };

    this.ws.onclose = () => {
      logger.info("SEC WebSocket disconnected");
      this.isStreaming = false;
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("SEC WebSocket error:", error);
    };
  }

  async stopStreaming(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.isStreaming = false;
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
        console.error("SEC data callback error:", error);
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      logger.info("Attempting to reconnect SEC WebSocket...");
      this.startStreaming();
    }, 5000); // Reconnect after 5 seconds
  }
}

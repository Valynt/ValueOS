import { logger } from "../../../lib/logger";

import { DataIngestionAdapter, IngestionConfig } from "../types.js";
import { Cache } from "../utils/cache.js";
import { RateLimiter } from "../utils/rateLimiter.js";

interface MarketDataPoint {
  symbol: string;
  price: number;
  timestamp: string;
  source: "market-data";
}

interface MarketDataProviderConfig {
  websocketUrl?: string;
  symbolsEndpoint?: string;
  provider?: "finnhub" | "polygon";
}

class MarketDataStreamAdapter {
  private ws?: WebSocket;

  constructor(
    private readonly providerConfig: MarketDataProviderConfig,
    private readonly apiKey?: string
  ) {}

  connect(symbols: string[], onData: (data: MarketDataPoint) => void): WebSocket {
    const websocketUrl = this.providerConfig.websocketUrl || "wss://ws.finnhub.io";
    const ws = new WebSocket(`${websocketUrl}?token=${this.apiKey || ""}`);

    ws.onopen = () => {
      for (const symbol of symbols) {
        ws.send(JSON.stringify({ type: "subscribe", symbol }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as { data?: Array<{ s: string; p: number; t: number }> };
        parsed.data?.forEach((point) => {
          onData({
            symbol: point.s,
            price: point.p,
            timestamp: new Date(point.t).toISOString(),
            source: "market-data",
          });
        });
      } catch (error) {
        logger.error("Failed to parse market data websocket payload", error as Error);
      }
    };

    this.ws = ws;
    return ws;
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = undefined;
  }
}

interface SECTransformed {
  source: "SEC-EDGAR";
  ingestionType: "sec_filing";
  data: unknown;
  timestamp: string;
}

export class SECAdapter implements DataIngestionAdapter<unknown, SECTransformed> {
  name = "SEC";
  private rateLimiter?: RateLimiter;
  private cache?: Cache;
  private ws?: WebSocket;
  private dataCallbacks: Set<(data: SECTransformed) => void> = new Set();
  private reconnectTimer?: NodeJS.Timeout;
  private isStreaming = false;
  private marketDataAdapter: MarketDataStreamAdapter;

  constructor(private config: IngestionConfig & { marketData?: MarketDataProviderConfig }) {
    if (config.rateLimit) {
      this.rateLimiter = new RateLimiter(config.rateLimit, 60000);
    }
    if (config.enableCache) {
      this.cache = new Cache(config.cacheTTL);
    }
    this.marketDataAdapter = new MarketDataStreamAdapter(config.marketData || {}, config.apiKey);
  }

  async fetchData(params: { cik?: string; type?: string } = {}): Promise<unknown> {
    const cacheKey = `sec-${JSON.stringify(params)}`;
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }

    if (this.rateLimiter) {
      await this.rateLimiter.waitForToken();
    }

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

  async transformData(rawData: unknown): Promise<SECTransformed> {
    return {
      source: "SEC-EDGAR",
      ingestionType: "sec_filing",
      data: rawData,
      timestamp: new Date().toISOString(),
    };
  }

  async startStreaming(params: { symbols?: string[] } = {}): Promise<void> {
    if (this.isStreaming) return;

    const symbols = params.symbols?.length ? params.symbols : ["AAPL", "MSFT", "GOOGL"];
    this.ws = this.marketDataAdapter.connect(symbols, (data) => {
      void this.transformData(data).then((transformed) => this.notifyDataCallbacks(transformed));
    });

    this.ws.onopen = () => {
      logger.info("Market data websocket connected");
      this.isStreaming = true;
    };

    this.ws.onclose = () => {
      logger.info("Market data websocket disconnected");
      this.isStreaming = false;
      this.scheduleReconnect(symbols);
    };

    this.ws.onerror = (error) => {
      logger.error("Market data websocket error", error instanceof Error ? error : new Error(String(error)));
    };
  }

  async stopStreaming(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.marketDataAdapter.disconnect();
    this.ws = undefined;
    this.isStreaming = false;
  }

  onData(callback: (data: SECTransformed) => void): () => void {
    this.dataCallbacks.add(callback);
    return () => this.dataCallbacks.delete(callback);
  }

  private notifyDataCallbacks(data: SECTransformed) {
    this.dataCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        logger.error("SEC data callback error", error as Error);
      }
    });
  }

  private scheduleReconnect(symbols: string[]) {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      logger.info("Attempting to reconnect market data websocket...");
      this.startStreaming({ symbols });
    }, 5000);
  }
}

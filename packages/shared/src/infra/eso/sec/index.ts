import { logger } from "../../../lib/logger";
import { ESOAdapterBase } from "../base.js";
import { DataIngestionAdapter, IngestionConfig } from "../types.js";

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

interface SECResponse {
  [key: string]: unknown;
}

interface SECTransformed {
  source: "SEC-EDGAR";
  ingestionType: "sec_filing";
  data: unknown;
  timestamp: string;
}

export class SECAdapter
  extends ESOAdapterBase<SECResponse, SECTransformed>
  implements DataIngestionAdapter<SECResponse, SECTransformed, { cik?: string; type?: string }>
{
  name = "SEC";
  private ws?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private isStreaming = false;
  private marketDataAdapter: MarketDataStreamAdapter;

  constructor(config: IngestionConfig & { marketData?: MarketDataProviderConfig }) {
    super(config);
    this.marketDataAdapter = new MarketDataStreamAdapter(config.marketData || {}, config.apiKey);
  }

  async fetchData(params: { cik?: string; type?: string } = {}): Promise<SECResponse> {
    return this.fetchJson({
      cacheKey: `sec-${JSON.stringify(params)}`,
      params,
      buildUrl: (requestParams) => {
        const url = new URL(this.config.baseUrl);
        if (requestParams.cik) {
          url.searchParams.set("cik", requestParams.cik);
        }
        if (requestParams.type) {
          url.searchParams.set("type", requestParams.type);
        }
        return url;
      },
      headers: {
        "User-Agent": "ValueOS/1.0",
      },
      validateResponse: validateSECResponse,
    });
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
    if (this.isStreaming) {
      return;
    }

    const symbols = params.symbols?.length ? params.symbols : ["AAPL", "MSFT", "GOOGL"];
    this.ws = this.marketDataAdapter.connect(symbols, (data) => {
      void this.transformData(data).then((transformed) => this.emitData(transformed));
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
    this.stopPollingLoop();
  }

  protected override handleCallbackError(error: unknown): void {
    logger.error("SEC data callback error", error as Error);
  }

  private scheduleReconnect(symbols: string[]) {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      logger.info("Attempting to reconnect market data websocket...");
      this.reconnectTimer = undefined;
      void this.startStreaming({ symbols });
    }, 5000);
  }
}

function validateSECResponse(data: unknown): SECResponse {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("SEC API returned an invalid response payload");
  }

  return data as SECResponse;
}

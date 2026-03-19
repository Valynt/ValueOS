import { IngestionConfig } from "./types.js";
import { Cache } from "./utils/cache.js";
import { RateLimiter } from "./utils/rateLimiter.js";

interface FetchJsonOptions<TParams, TRaw> {
  cacheKey: string;
  params: TParams;
  buildUrl: (params: TParams) => URL;
  headers?: HeadersInit;
  validateResponse: (data: unknown) => TRaw;
}

interface PollingLoopOptions {
  intervalMs: number;
  poll: () => Promise<void>;
  onError?: (error: unknown) => void;
}

export abstract class ESOAdapterBase<TRaw, TTransformed> {
  protected readonly config: IngestionConfig;
  private readonly rateLimiter?: RateLimiter;
  private readonly cache?: Cache;
  private readonly dataCallbacks = new Set<(data: TTransformed) => void>();
  private pollTimer?: NodeJS.Timeout;
  private isPolling = false;

  protected constructor(config: IngestionConfig) {
    this.config = config;

    if (config.rateLimit) {
      this.rateLimiter = new RateLimiter(config.rateLimit, 60000);
    }

    if (config.enableCache) {
      this.cache = new Cache(config.cacheTTL);
    }
  }

  protected async fetchJson<TParams>({
    cacheKey,
    params,
    buildUrl,
    headers,
    validateResponse,
  }: FetchJsonOptions<TParams, TRaw>): Promise<TRaw> {
    const cached = this.cache?.get(cacheKey);
    if (cached !== null && cached !== undefined) {
      return validateResponse(cached);
    }

    await this.rateLimiter?.waitForToken();

    const response = await fetch(buildUrl(params).toString(), { headers });
    if (!response.ok) {
      throw new Error(`${this.name} API error: ${response.status}`);
    }

    const data: unknown = await response.json();
    const validated = validateResponse(data);
    this.cache?.set(cacheKey, validated);

    return validated;
  }

  protected async startPollingLoop({ intervalMs, poll, onError }: PollingLoopOptions): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;

    const runPoll = async () => {
      if (!this.isPolling) {
        return;
      }

      try {
        await poll();
      } catch (error) {
        onError?.(error);
      }

      if (this.isPolling) {
        this.pollTimer = setTimeout(runPoll, intervalMs);
      }
    };

    void runPoll();
  }

  protected stopPollingLoop(): void {
    this.isPolling = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  protected async mapWithConcurrency<TItem, TResult>(
    items: TItem[],
    concurrency: number,
    mapper: (item: TItem, index: number) => Promise<TResult>
  ): Promise<TResult[]> {
    if (items.length === 0) {
      return [];
    }

    const boundedConcurrency = Math.max(1, Math.min(concurrency, items.length));
    const results = new Array<TResult>(items.length);
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        const item = items[currentIndex];
        if (item === undefined) {
          return;
        }

        results[currentIndex] = await mapper(item, currentIndex);
      }
    };

    await Promise.all(Array.from({ length: boundedConcurrency }, () => worker()));
    return results;
  }

  protected emitData(data: TTransformed): void {
    for (const callback of this.dataCallbacks) {
      try {
        callback(data);
      } catch (error) {
        this.handleCallbackError(error);
      }
    }
  }

  protected handleCallbackError(error: unknown): void {
    console.error(`${this.name} data callback error:`, error);
  }

  protected get pollingActive(): boolean {
    return this.isPolling;
  }

  onData(callback: (data: TTransformed) => void): () => void {
    this.dataCallbacks.add(callback);
    return () => this.dataCallbacks.delete(callback);
  }

  abstract name: string;
}

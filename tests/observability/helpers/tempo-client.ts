/**
 * Tempo Client Helper
 * Utilities for interacting with Tempo in tests
 */

import axios, { AxiosInstance } from "axios";
import { promisify } from "util";

const sleep = promisify(setTimeout);

export interface TempoTrace {
  traceID: string;
  rootServiceName: string;
  rootTraceName: string;
  startTimeUnixNano: string;
  durationMs: number;
  spanCount: number;
}

export interface TempoSpan {
  traceId: string;
  spanId: string;
  operationName: string;
  startTimeUnixNano: string;
  durationNanos: string;
  tags: Array<{ key: string; value: any }>;
  references: Array<{ refType: string; traceId: string; spanId: string }>;
}

export interface TempoSearchResponse {
  traces: TempoTrace[];
  metrics: {
    totalBlocks: number;
  };
}

export class TempoClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:3200") {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  /**
   * Check if Tempo is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.get("/ready");
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get a trace by ID
   */
  async getTrace(traceId: string): Promise<any> {
    const response = await this.client.get(`/api/traces/${traceId}`);
    return response.data;
  }

  /**
   * Search for traces
   */
  async search(
    tags: Record<string, string>,
    start?: Date,
    end?: Date,
    limit: number = 20
  ): Promise<TempoSearchResponse> {
    const params: any = {
      limit,
    };

    // Convert tags to query format
    const tagQueries = Object.entries(tags).map(
      ([key, value]) => `${key}="${value}"`
    );
    if (tagQueries.length > 0) {
      params.q = tagQueries.join(" && ");
    }

    if (start) {
      params.start = Math.floor(start.getTime() / 1000);
    }
    if (end) {
      params.end = Math.floor(end.getTime() / 1000);
    }

    const response = await this.client.get<TempoSearchResponse>("/api/search", {
      params,
    });

    return response.data;
  }

  /**
   * Search for a specific trace by tag
   */
  async searchByTag(
    tagKey: string,
    tagValue: string,
    start?: Date,
    end?: Date
  ): Promise<TempoTrace[]> {
    const result = await this.search({ [tagKey]: tagValue }, start, end);
    return result.traces || [];
  }

  /**
   * Wait for a trace to appear in Tempo
   * Tempo has eventual consistency, so traces may not be immediately queryable
   */
  async waitForTrace(
    traceId: string,
    timeoutMs: number = 15000,
    intervalMs: number = 1000
  ): Promise<any> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const trace = await this.getTrace(traceId);
        if (trace && trace.batches && trace.batches.length > 0) {
          return trace;
        }
      } catch (error: any) {
        if (error.response?.status !== 404) {
          // Unexpected error, rethrow
          throw error;
        }
        // 404 means trace not found yet, continue waiting
      }

      await sleep(intervalMs);
    }

    throw new Error(`Trace ${traceId} not found within ${timeoutMs}ms`);
  }

  /**
   * Wait for traces matching tags to appear
   */
  async waitForTraceByTag(
    tagKey: string,
    tagValue: string,
    timeoutMs: number = 15000,
    intervalMs: number = 1000
  ): Promise<TempoTrace[]> {
    const startTime = Date.now();
    const searchStart = new Date(Date.now() - 120000); // Look back 2 minutes

    while (Date.now() - startTime < timeoutMs) {
      try {
        const traces = await this.searchByTag(tagKey, tagValue, searchStart);
        if (traces.length > 0) {
          return traces;
        }
      } catch {
        // Search failed, retry
      }

      await sleep(intervalMs);
    }

    throw new Error(
      `No traces found with ${tagKey}=${tagValue} within ${timeoutMs}ms`
    );
  }

  /**
   * Get tag keys from Tempo
   */
  async getTagKeys(): Promise<string[]> {
    try {
      const response = await this.client.get("/api/search/tags");
      return response.data.tagNames || [];
    } catch {
      return [];
    }
  }

  /**
   * Get tag values for a specific key
   */
  async getTagValues(tagKey: string): Promise<string[]> {
    try {
      const response = await this.client.get(
        `/api/search/tag/${tagKey}/values`
      );
      return response.data.tagValues || [];
    } catch {
      return [];
    }
  }

  /**
   * Extract spans from a trace
   */
  extractSpans(trace: any): TempoSpan[] {
    const spans: TempoSpan[] = [];

    if (!trace.batches) {
      return spans;
    }

    for (const batch of trace.batches) {
      if (!batch.scopeSpans) continue;

      for (const scopeSpan of batch.scopeSpans) {
        if (!scopeSpan.spans) continue;

        for (const span of scopeSpan.spans) {
          spans.push({
            traceId: span.traceId || trace.traceId,
            spanId: span.spanId,
            operationName: span.name,
            startTimeUnixNano: span.startTimeUnixNano,
            durationNanos: span.endTimeUnixNano - span.startTimeUnixNano,
            tags: span.attributes || [],
            references: [],
          });
        }
      }
    }

    return spans;
  }

  /**
   * Get metrics (build info, etc.)
   */
  async getMetrics(): Promise<string> {
    const response = await this.client.get("/metrics");
    return response.data;
  }
}

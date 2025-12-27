/**
 * Loki Client Helper
 * Utilities for interacting with Loki in tests
 */

import axios, { AxiosInstance } from "axios";
import { promisify } from "util";

const sleep = promisify(setTimeout);

export interface LokiLabel {
  [key: string]: string;
}

export interface LokiLogEntry {
  timestamp: number; // nanoseconds
  line: string;
}

export interface LokiStream {
  stream: LokiLabel;
  values: Array<[string, string]>; // [timestamp_ns, log_line]
}

export interface LokiPushRequest {
  streams: LokiStream[];
}

export interface LokiQueryResponse {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      stream: LokiLabel;
      values: Array<[string, string]>;
    }>;
    stats: any;
  };
}

export class LokiClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:3100") {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  /**
   * Check if Loki is healthy
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
   * Push logs to Loki
   */
  async push(
    labels: LokiLabel,
    logLine: string,
    timestamp?: Date
  ): Promise<void> {
    const ts = timestamp || new Date();
    const timestampNs = (ts.getTime() * 1e6).toString(); // Convert to nanoseconds

    const payload: LokiPushRequest = {
      streams: [
        {
          stream: labels,
          values: [[timestampNs, logLine]],
        },
      ],
    };

    await this.client.post("/loki/api/v1/push", payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Push multiple log entries to Loki
   */
  async pushBatch(labels: LokiLabel, entries: LokiLogEntry[]): Promise<void> {
    const values: Array<[string, string]> = entries.map((entry) => [
      entry.timestamp.toString(),
      entry.line,
    ]);

    const payload: LokiPushRequest = {
      streams: [
        {
          stream: labels,
          values,
        },
      ],
    };

    await this.client.post("/loki/api/v1/push", payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Query logs using LogQL
   */
  async query(
    logQL: string,
    start?: Date,
    end?: Date,
    limit: number = 100
  ): Promise<LokiQueryResponse> {
    const params: any = {
      query: logQL,
      limit,
    };

    if (start) {
      params.start = (start.getTime() * 1e6).toString();
    }
    if (end) {
      params.end = (end.getTime() * 1e6).toString();
    }

    const response = await this.client.get<LokiQueryResponse>(
      "/loki/api/v1/query_range",
      {
        params,
      }
    );

    return response.data;
  }

  /**
   * Wait for a log entry to appear in Loki
   * Useful for testing eventual consistency
   */
  async waitForLog(
    logQL: string,
    expectedContent: string,
    timeoutMs: number = 10000,
    intervalMs: number = 500
  ): Promise<boolean> {
    const startTime = Date.now();
    const queryStart = new Date(Date.now() - 60000); // Look back 1 minute

    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await this.query(logQL, queryStart);

        if (result.data.result.length > 0) {
          const allLogs = result.data.result.flatMap((stream) =>
            stream.values.map(([_, line]) => line)
          );

          if (allLogs.some((line) => line.includes(expectedContent))) {
            return true;
          }
        }
      } catch (error) {
        // Query failed, retry
      }

      await sleep(intervalMs);
    }

    return false;
  }

  /**
   * Get label values for a given label
   */
  async getLabelValues(labelName: string): Promise<string[]> {
    const response = await this.client.get(
      `/loki/api/v1/label/${labelName}/values`
    );
    return response.data.data;
  }

  /**
   * Get all labels
   */
  async getLabels(): Promise<string[]> {
    const response = await this.client.get("/loki/api/v1/labels");
    return response.data.data;
  }

  /**
   * Clear all data (for testing only - requires special config)
   */
  async clearData(): Promise<void> {
    // Note: Loki doesn't have a built-in clear endpoint
    // In tests, we typically just use different labels or restart container
    console.warn("Loki does not support clearing data via API");
  }

  /**
   * Generate test log entry
   */
  static generateTestLog(
    level: "info" | "warn" | "error",
    message: string,
    metadata?: Record<string, any>
  ): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...metadata,
    });
  }
}

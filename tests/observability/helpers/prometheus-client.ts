/**
 * Prometheus Client Helper
 * Utilities for interacting with Prometheus in tests
 */

import axios, { AxiosInstance } from "axios";
import { promisify } from "util";

const sleep = promisify(setTimeout);

export interface PrometheusQueryResult {
  metric: Record<string, string>;
  value?: [number, string]; // [timestamp, value]
  values?: Array<[number, string]>; // time series data
}

export interface PrometheusQueryResponse {
  status: string;
  data: {
    resultType: string;
    result: PrometheusQueryResult[];
  };
}

export interface PrometheusTarget {
  discoveredLabels: Record<string, string>;
  labels: Record<string, string>;
  scrapeUrl: string;
  lastError: string;
  lastScrape: string;
  lastScrapeDuration: number;
  health: string;
}

export class PrometheusClient {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:9090") {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
    });
  }

  /**
   * Check if Prometheus is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await this.client.get("/-/ready");
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Execute an instant query
   */
  async query(promQL: string, time?: Date): Promise<PrometheusQueryResponse> {
    const params: any = {
      query: promQL,
    };

    if (time) {
      params.time = Math.floor(time.getTime() / 1000);
    }

    const response = await this.client.get<PrometheusQueryResponse>(
      "/api/v1/query",
      {
        params,
      }
    );

    return response.data;
  }

  /**
   * Execute a range query
   */
  async queryRange(
    promQL: string,
    start: Date,
    end: Date,
    step: string = "15s"
  ): Promise<PrometheusQueryResponse> {
    const params = {
      query: promQL,
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000),
      step,
    };

    const response = await this.client.get<PrometheusQueryResponse>(
      "/api/v1/query_range",
      {
        params,
      }
    );

    return response.data;
  }

  /**
   * Get all metric names
   */
  async getMetricNames(): Promise<string[]> {
    const response = await this.client.get("/api/v1/label/__name__/values");
    return response.data.data;
  }

  /**
   * Get label values
   */
  async getLabelValues(labelName: string): Promise<string[]> {
    const response = await this.client.get(`/api/v1/label/${labelName}/values`);
    return response.data.data;
  }

  /**
   * Get all targets
   */
  async getTargets(): Promise<{
    activeTargets: PrometheusTarget[];
    droppedTargets: any[];
  }> {
    const response = await this.client.get("/api/v1/targets");
    return response.data.data;
  }

  /**
   * Check if a specific target is being scraped successfully
   */
  async isTargetHealthy(job: string): Promise<boolean> {
    const targets = await this.getTargets();
    const target = targets.activeTargets.find((t) => t.labels.job === job);
    return target?.health === "up";
  }

  /**
   * Wait for a metric to appear
   */
  async waitForMetric(
    metricName: string,
    labels?: Record<string, string>,
    timeoutMs: number = 30000,
    intervalMs: number = 1000
  ): Promise<boolean> {
    const startTime = Date.now();
    let query = metricName;

    if (labels) {
      const labelSelectors = Object.entries(labels)
        .map(([key, value]) => `${key}="${value}"`)
        .join(",");
      query = `${metricName}{${labelSelectors}}`;
    }

    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await this.query(query);
        if (result.data.result.length > 0) {
          return true;
        }
      } catch {
        // Query failed, retry
      }

      await sleep(intervalMs);
    }

    return false;
  }

  /**
   * Wait for a metric to have a specific value
   */
  async waitForMetricValue(
    promQL: string,
    expectedValue: number,
    tolerance: number = 0,
    timeoutMs: number = 30000,
    intervalMs: number = 1000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await this.query(promQL);
        if (result.data.result.length > 0) {
          const value = parseFloat(result.data.result[0].value![1]);
          if (Math.abs(value - expectedValue) <= tolerance) {
            return true;
          }
        }
      } catch {
        // Query failed, retry
      }

      await sleep(intervalMs);
    }

    return false;
  }

  /**
   * Get current value of a metric
   */
  async getMetricValue(promQL: string): Promise<number | null> {
    try {
      const result = await this.query(promQL);
      if (result.data.result.length > 0 && result.data.result[0].value) {
        return parseFloat(result.data.result[0].value[1]);
      }
    } catch {
      // Query failed
    }
    return null;
  }

  /**
   * Check if target is being scraped
   */
  async waitForTarget(
    job: string,
    timeoutMs: number = 30000,
    intervalMs: number = 2000
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        if (await this.isTargetHealthy(job)) {
          return true;
        }
      } catch {
        // Check failed, retry
      }

      await sleep(intervalMs);
    }

    return false;
  }

  /**
   * Reload Prometheus configuration
   */
  async reload(): Promise<void> {
    await this.client.post("/-/reload");
  }
}

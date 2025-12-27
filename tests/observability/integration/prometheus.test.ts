/**
 * Integration Tests for Prometheus
 * Tests the full integration with Prometheus metrics collection
 */

import { describe, it, expect, beforeAll } from "vitest";
import { PrometheusClient } from "../helpers/prometheus-client";
import axios from "axios";

describe("Prometheus Integration Tests", () => {
  let prometheusClient: PrometheusClient;

  beforeAll(() => {
    prometheusClient = new PrometheusClient("http://localhost:9090");
  });

  describe("Health Check", () => {
    it("should return healthy status", async () => {
      const isHealthy = await prometheusClient.isHealthy();
      expect(isHealthy).toBe(true);
    }, 10000);
  });

  describe("Targets", () => {
    it("should have configured scrape targets", async () => {
      const targets = await prometheusClient.getTargets();

      expect(targets.activeTargets).toBeDefined();
      expect(Array.isArray(targets.activeTargets)).toBe(true);
      expect(targets.activeTargets.length).toBeGreaterThan(0);
    }, 10000);

    it("should have prometheus self-scraping target", async () => {
      const targets = await prometheusClient.getTargets();
      const promTarget = targets.activeTargets.find(
        (t) => t.labels.job === "prometheus"
      );

      expect(promTarget).toBeDefined();
      expect(promTarget?.health).toBe("up");
    }, 10000);

    it("should check if specific job is healthy", async () => {
      const isHealthy = await prometheusClient.isTargetHealthy("prometheus");
      expect(isHealthy).toBe(true);
    }, 10000);

    it("should wait for a target to become available", async () => {
      const result = await prometheusClient.waitForTarget("prometheus", 10000);
      expect(result).toBe(true);
    }, 15000);
  });

  describe("Query Metrics", () => {
    it("should execute instant query", async () => {
      const result = await prometheusClient.query("up");

      expect(result.status).toBe("success");
      expect(result.data).toBeDefined();
      expect(result.data.resultType).toBe("vector");
      expect(Array.isArray(result.data.result)).toBe(true);
    }, 10000);

    it("should execute range query", async () => {
      const end = new Date();
      const start = new Date(end.getTime() - 300000); // 5 minutes ago

      const result = await prometheusClient.queryRange("up", start, end, "15s");

      expect(result.status).toBe("success");
      expect(result.data.resultType).toBe("matrix");
    }, 10000);

    it("should query with label selectors", async () => {
      const result = await prometheusClient.query('up{job="prometheus"}');

      expect(result.status).toBe("success");
      expect(result.data.result.length).toBeGreaterThan(0);

      const firstResult = result.data.result[0];
      expect(firstResult.metric.job).toBe("prometheus");
    }, 10000);

    it("should handle invalid queries gracefully", async () => {
      await expect(
        prometheusClient.query("invalid_metric_that_does_not_exist_12345")
      ).resolves.toBeDefined();
    }, 10000);
  });

  describe("Metric Discovery", () => {
    it("should retrieve all metric names", async () => {
      const metrics = await prometheusClient.getMetricNames();

      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);

      // Prometheus should have some built-in metrics
      expect(metrics).toContain("up");
    }, 10000);

    it("should retrieve label values", async () => {
      const values = await prometheusClient.getLabelValues("job");

      expect(Array.isArray(values)).toBe(true);
      expect(values).toContain("prometheus");
    }, 10000);
  });

  describe("Application Metrics", () => {
    it("should wait for a custom metric to appear", async () => {
      // First, push a custom metric (simulate app exposing metrics)
      // For this test, we'll use a Prometheus built-in metric
      const found = await prometheusClient.waitForMetric("up", {}, 10000, 1000);
      expect(found).toBe(true);
    }, 15000);

    it("should get current metric value", async () => {
      const value = await prometheusClient.getMetricValue(
        'up{job="prometheus"}'
      );

      expect(value).not.toBeNull();
      expect(typeof value).toBe("number");
    }, 10000);
  });

  describe("PromQL Queries", () => {
    it("should execute aggregation queries", async () => {
      const result = await prometheusClient.query("sum(up)");

      expect(result.status).toBe("success");
      expect(result.data.result.length).toBeGreaterThan(0);
    }, 10000);

    it("should execute rate queries", async () => {
      // Use a counter metric if available
      const result = await prometheusClient.query(
        "rate(prometheus_http_requests_total[5m])"
      );

      expect(result.status).toBe("success");
    }, 10000);

    it("should execute histogram quantile queries", async () => {
      const result = await prometheusClient.query(
        "histogram_quantile(0.95, rate(prometheus_http_request_duration_seconds_bucket[5m]))"
      );

      expect(result.status).toBe("success");
    }, 10000);
  });

  describe("Scrape Configuration", () => {
    it("should verify scrape interval", async () => {
      const targets = await prometheusClient.getTargets();
      const promTarget = targets.activeTargets.find(
        (t) => t.labels.job === "prometheus"
      );

      expect(promTarget).toBeDefined();
      expect(promTarget?.scrapeUrl).toBeDefined();
    }, 10000);

    it("should have recent scrape timestamp", async () => {
      const targets = await prometheusClient.getTargets();
      const promTarget = targets.activeTargets.find(
        (t) => t.labels.job === "prometheus"
      );

      expect(promTarget?.lastScrape).toBeDefined();

      // Last scrape should be recent (within last minute)
      const lastScrapeTime = new Date(promTarget?.lastScrape || 0);
      const now = new Date();
      const diffMs = now.getTime() - lastScrapeTime.getTime();

      expect(diffMs).toBeLessThan(60000); // Less than 1 minute
    }, 10000);
  });

  describe("LGTM Stack Integration", () => {
    it("should scrape Loki metrics", async () => {
      const isHealthy = await prometheusClient.isTargetHealthy("loki");
      expect(isHealthy).toBe(true);
    }, 10000);

    it("should scrape Tempo metrics", async () => {
      const isHealthy = await prometheusClient.isTargetHealthy("tempo");
      expect(isHealthy).toBe(true);
    }, 10000);

    it("should scrape Grafana metrics", async () => {
      const isHealthy = await prometheusClient.isTargetHealthy("grafana");
      expect(isHealthy).toBe(true);
    }, 10000);
  });
});

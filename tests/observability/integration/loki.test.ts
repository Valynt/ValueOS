/**
 * Integration Tests for Loki
 * Tests the full integration with Loki log aggregation service
 */

import { beforeAll, describe, expect, it } from "vitest";
import { LokiClient } from "../helpers/loki-client";

describe("Loki Integration Tests", () => {
  let lokiClient: LokiClient;

  beforeAll(() => {
    lokiClient = new LokiClient("http://localhost:3100");
  });

  describe("Health Check", () => {
    it("should return healthy status", async () => {
      const isHealthy = await lokiClient.isHealthy();
      expect(isHealthy).toBe(true);
    }, 10000);
  });

  describe("Push Logs", () => {
    it("should successfully push a log entry", async () => {
      const labels = {
        job: "test",
        service: "valueos",
        level: "info",
      };

      const logLine = LokiClient.generateTestLog("info", "Test log entry", {
        test_id: "push-single-log",
      });

      await expect(lokiClient.push(labels, logLine)).resolves.not.toThrow();
    }, 10000);

    it("should push batch of log entries", async () => {
      const labels = {
        job: "test",
        service: "valueos",
        level: "info",
      };

      const now = Date.now();
      const entries = [
        { timestamp: now * 1e6, line: "Log entry 1" },
        { timestamp: (now + 1000) * 1e6, line: "Log entry 2" },
        { timestamp: (now + 2000) * 1e6, line: "Log entry 3" },
      ];

      await expect(
        lokiClient.pushBatch(labels, entries)
      ).resolves.not.toThrow();
    }, 10000);

    it("should correctly apply custom labels", async () => {
      const customLabels = {
        job: "test",
        service: "valueos",
        environment: "test",
        team: "platform",
      };

      const logLine = "Log with custom labels";
      await lokiClient.push(customLabels, logLine);

      // Wait for log to be indexed
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Query with label selector
      const result = await lokiClient.query(
        '{job="test", team="platform"}',
        new Date(Date.now() - 60000)
      );

      expect(result.status).toBe("success");
    }, 15000);
  });

  describe("Query Logs", () => {
    it("should query logs with LogQL", async () => {
      // Push a log first
      const labels = { job: "test", service: "valueos" };
      const uniqueId = `query-test-${Date.now()}`;
      const logLine = LokiClient.generateTestLog("info", "Query test log", {
        unique_id: uniqueId,
      });

      await lokiClient.push(labels, logLine);

      // Wait for indexing
      const found = await lokiClient.waitForLog(
        '{job="test"}',
        uniqueId,
        10000,
        500
      );

      expect(found).toBe(true);
    }, 15000);

    it("should query with time range", async () => {
      const start = new Date(Date.now() - 3600000); // 1 hour ago
      const end = new Date();

      const result = await lokiClient.query('{job="test"}', start, end, 10);

      expect(result.status).toBe("success");
      expect(result.data).toBeDefined();
    }, 10000);

    it("should return empty result for non-existent labels", async () => {
      const result = await lokiClient.query(
        '{job="nonexistent-job-12345"}',
        new Date(Date.now() - 60000)
      );

      expect(result.status).toBe("success");
      expect(result.data.result.length).toBe(0);
    }, 10000);
  });

  describe("Label Management", () => {
    it("should retrieve available labels", async () => {
      const labels = await lokiClient.getLabels();
      expect(Array.isArray(labels)).toBe(true);
      expect(labels.length).toBeGreaterThan(0);
    }, 10000);

    it("should retrieve values for a specific label", async () => {
      // First push a log with a known label
      await lokiClient.push(
        { job: "test-label-values", service: "valueos" },
        "Test log"
      );

      // Wait briefly for indexing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const values = await lokiClient.getLabelValues("job");
      expect(Array.isArray(values)).toBe(true);
    }, 15000);
  });

  describe("Log Levels", () => {
    it("should handle different log levels", async () => {
      const levels = ["info", "warn", "error"] as const;

      for (const level of levels) {
        const labels = { job: "test", level };
        const logLine = LokiClient.generateTestLog(
          level,
          `${level} level test`
        );
        await lokiClient.push(labels, logLine);
      }

      // Query error logs specifically
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const result = await lokiClient.query('{job="test", level="error"}');

      expect(result.status).toBe("success");
    }, 20000);
  });

  describe("Trace Correlation", () => {
    it("should store logs with trace_id for correlation", async () => {
      const traceId = "1234567890abcdef1234567890abcdef";
      const spanId = "abcdef1234567890";

      const labels = { job: "test", service: "valueos" };
      const logLine = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        message: "Log with trace context",
        trace_id: traceId,
        span_id: spanId,
      });

      await lokiClient.push(labels, logLine);

      // Wait for indexing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Query for logs with this trace ID
      const found = await lokiClient.waitForLog('{job="test"}', traceId, 10000);
      expect(found).toBe(true);
    }, 15000);
  });
});

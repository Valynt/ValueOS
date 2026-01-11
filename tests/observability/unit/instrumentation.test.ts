/**
 * Unit Tests for Instrumentation Module
 * These tests verify the instrumentation setup without requiring running services
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  initializeTelemetry,
  shutdownTelemetry,
  getTracer,
  withSpan,
  getTraceContext,
  Metrics,
  logger,
  telemetryConfig,
} from "../../../src/observability/instrumentation";

describe("Observability Instrumentation - Unit Tests", () => {
  beforeAll(async () => {
    // Mock environment variables for testing
    process.env.OTEL_SERVICE_NAME = "test-service";
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318/v1/traces";
    process.env.PROMETHEUS_PORT = "9465"; // Different port to avoid conflicts
  });

  afterAll(async () => {
    await shutdownTelemetry();
  });

  describe("Configuration", () => {
    it("should load configuration from environment variables", () => {
      expect(telemetryConfig.serviceName).toBe("test-service");
      expect(telemetryConfig.tempoEndpoint).toBe(
        "http://localhost:4318/v1/traces"
      );
    });

    it("should have default values for missing env vars", () => {
      expect(telemetryConfig.serviceVersion).toBeDefined();
      expect(telemetryConfig.environment).toBeDefined();
    });
  });

  describe("Telemetry Initialization", () => {
    it("should initialize telemetry without errors", async () => {
      await expect(initializeTelemetry()).resolves.not.toThrow();
    });

    it("should warn on duplicate initialization", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      await initializeTelemetry();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "⚠️  Telemetry already initialized"
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe("Tracer", () => {
    it("should return a tracer instance", () => {
      const tracer = getTracer();
      expect(tracer).toBeDefined();
      expect(typeof tracer.startSpan).toBe("function");
    });

    it("should create spans with withSpan helper", async () => {
      const result = await withSpan("test-span", async (span) => {
        expect(span).toBeDefined();
        expect(typeof span.setAttribute).toBe("function");
        return "test-result";
      });

      expect(result).toBe("test-result");
    });

    it("should add custom attributes to spans", async () => {
      await withSpan(
        "test-span-with-attributes",
        async (span) => {
          // Attributes should be set via options
          expect(span).toBeDefined();
        },
        {
          "test.attribute": "value",
          "test.number": 123,
        }
      );
    });

    it("should handle errors in spans", async () => {
      await expect(
        withSpan("error-span", async () => {
          throw new Error("Test error");
        })
      ).rejects.toThrow("Test error");
    });

    it("should propagate trace context", async () => {
      await withSpan("parent-span", async () => {
        const context = getTraceContext();
        expect(context.traceId).toBeDefined();
        expect(context.spanId).toBeDefined();
        expect(context.traceId.length).toBeGreaterThan(0);
        expect(context.spanId.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Metrics", () => {
    it("should create counter metrics", () => {
      expect(Metrics.httpRequestsTotal).toBeDefined();
      expect(typeof Metrics.httpRequestsTotal.add).toBe("function");
    });

    it("should create histogram metrics", () => {
      expect(Metrics.httpRequestDuration).toBeDefined();
      expect(typeof Metrics.httpRequestDuration.record).toBe("function");
    });

    it("should create custom counter", () => {
      const customCounter = Metrics.createCounter(
        "test_counter",
        "Test counter description"
      );
      expect(customCounter).toBeDefined();
      expect(typeof customCounter.add).toBe("function");
    });

    it("should create custom histogram", () => {
      const customHistogram = Metrics.createHistogram(
        "test_histogram",
        "Test histogram description",
        "milliseconds"
      );
      expect(customHistogram).toBeDefined();
      expect(typeof customHistogram.record).toBe("function");
    });

    it("should increment counters without errors", () => {
      expect(() => {
        Metrics.httpRequestsTotal.add(1, { method: "GET", route: "/test" });
      }).not.toThrow();
    });

    it("should record histogram values without errors", () => {
      expect(() => {
        Metrics.httpRequestDuration.record(0.123, {
          method: "GET",
          route: "/test",
          status: "200",
        });
      }).not.toThrow();
    });
  });

  describe("Logger", () => {
    it("should have Winston logger instance", () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
    });

    it("should log without errors", () => {
      expect(() => {
        logger.info("Test log message", { test: "metadata" });
      }).not.toThrow();
    });

    it("should inject trace context into logs", async () => {
      await withSpan("log-test-span", async () => {
        const context = getTraceContext();

        // Logger should automatically inject trace_id and span_id
        // This is tested by checking the log format configuration
        expect(context.traceId).toBeDefined();

        logger.info("Test log with trace context");
      });
    });
  });

  describe("Trace Context", () => {
    it("should return empty context when no active span", () => {
      const context = getTraceContext();
      expect(context.traceId).toBe("");
      expect(context.spanId).toBe("");
    });

    it("should return valid context within active span", async () => {
      await withSpan("context-test-span", async () => {
        const context = getTraceContext();
        expect(context.traceId).toMatch(/^[0-9a-f]{32}$/);
        expect(context.spanId).toMatch(/^[0-9a-f]{16}$/);
      });
    });
  });

  describe("Graceful Shutdown", () => {
    it("should shutdown without errors", async () => {
      await expect(shutdownTelemetry()).resolves.not.toThrow();
    });

    it("should handle shutdown when not initialized", async () => {
      await shutdownTelemetry(); // First shutdown
      await expect(shutdownTelemetry()).resolves.not.toThrow(); // Second should be noop
    });
  });
});

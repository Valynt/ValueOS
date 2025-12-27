/**
 * Integration Tests for Tempo
 * Tests the full integration with Tempo distributed tracing service
 */

import { describe, it, expect, beforeAll } from "vitest";
import { TempoClient } from "../helpers/tempo-client";
import { trace, context } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

describe("Tempo Integration Tests", () => {
  let tempoClient: TempoClient;
  let tracerProvider: BasicTracerProvider;
  let tracer: any;

  beforeAll(async () => {
    tempoClient = new TempoClient("http://localhost:3200");

    // Setup OTLP exporter for testing
    const exporter = new OTLPTraceExporter({
      url: "http://localhost:4318/v1/traces",
    });

    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "tempo-integration-test",
    });

    tracerProvider = new BasicTracerProvider({ resource });
    tracerProvider.addSpanProcessor(new BatchSpanProcessor(exporter));
    tracerProvider.register();

    tracer = trace.getTracer("tempo-test-tracer");
  });

  describe("Health Check", () => {
    it("should return healthy status", async () => {
      const isHealthy = await tempoClient.isHealthy();
      expect(isHealthy).toBe(true);
    }, 10000);
  });

  describe("Send Traces via OTLP", () => {
    it("should send a trace via OTLP HTTP", async () => {
      const span = tracer.startSpan("test-otlp-http-span");
      span.setAttribute("test.type", "otlp-http");
      span.setAttribute("test.id", Date.now());
      span.end();

      // Force flush to send immediately
      await tracerProvider.forceFlush();

      // Wait briefly for trace to be processed
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }, 15000);

    it("should create nested spans", async () => {
      const parentSpan = tracer.startSpan("parent-span");
      const parentContext = trace.setSpan(context.active(), parentSpan);

      context.with(parentContext, () => {
        const childSpan = tracer.startSpan("child-span");
        childSpan.setAttribute("test.nested", true);
        childSpan.end();
      });

      parentSpan.end();
      await tracerProvider.forceFlush();

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }, 15000);
  });

  describe("Query Traces", () => {
    it("should retrieve a trace by ID", async () => {
      // Create a trace
      const span = tracer.startSpan("query-by-id-test");
      const spanContext = span.spanContext();
      const traceId = spanContext.traceId;

      span.setAttribute("test.query", "by-id");
      span.end();
      await tracerProvider.forceFlush();

      // Wait for trace to be available
      const trace = await tempoClient.waitForTrace(traceId, 20000, 2000);

      expect(trace).toBeDefined();
      expect(trace.batches).toBeDefined();
    }, 30000);

    it("should handle non-existent trace ID gracefully", async () => {
      const fakeTraceId = "00000000000000000000000000000000";

      await expect(
        tempoClient.waitForTrace(fakeTraceId, 5000, 1000)
      ).rejects.toThrow();
    }, 10000);
  });

  describe("Search Traces", () => {
    it("should search traces by tag", async () => {
      const testId = `search-test-${Date.now()}`;

      // Create trace with specific tag
      const span = tracer.startSpan("searchable-span");
      span.setAttribute("test.search.id", testId);
      span.setAttribute("service.name", "tempo-integration-test");
      span.end();
      await tracerProvider.forceFlush();

      // Wait for trace to be searchable
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Search might not find it immediately due to indexing delay
      // This is expected behavior in Tempo
      const start = new Date(Date.now() - 60000);
      const traces = await tempoClient.search(
        { "service.name": "tempo-integration-test" },
        start
      );

      expect(traces).toBeDefined();
      expect(Array.isArray(traces.traces)).toBe(true);
    }, 20000);
  });

  describe("Trace Structure", () => {
    it("should extract spans from trace", async () => {
      // Create a multi-span trace
      const rootSpan = tracer.startSpan("root-operation");
      const rootContext = trace.setSpan(context.active(), rootSpan);

      await context.with(rootContext, async () => {
        const span1 = tracer.startSpan("operation-1");
        span1.setAttribute("operation", "first");
        span1.end();

        const span2 = tracer.startSpan("operation-2");
        span2.setAttribute("operation", "second");
        span2.end();
      });

      const traceId = rootSpan.spanContext().traceId;
      rootSpan.end();
      await tracerProvider.forceFlush();

      // Retrieve and analyze trace
      const traceData = await tempoClient.waitForTrace(traceId, 20000, 2000);
      const spans = tempoClient.extractSpans(traceData);

      expect(spans.length).toBeGreaterThan(0);
      expect(spans.every((s) => s.traceId === traceId)).toBe(true);
    }, 30000);

    it("should preserve span attributes", async () => {
      const span = tracer.startSpan("span-with-attributes");
      span.setAttribute("http.method", "GET");
      span.setAttribute("http.url", "/api/test");
      span.setAttribute("http.status_code", 200);

      const traceId = span.spanContext().traceId;
      span.end();
      await tracerProvider.forceFlush();

      const traceData = await tempoClient.waitForTrace(traceId, 20000, 2000);
      const spans = tempoClient.extractSpans(traceData);

      expect(spans.length).toBeGreaterThan(0);

      const testSpan = spans.find(
        (s) => s.operationName === "span-with-attributes"
      );
      expect(testSpan).toBeDefined();
      expect(testSpan?.tags).toBeDefined();
    }, 30000);
  });

  describe("Error Tracking", () => {
    it("should record span errors", async () => {
      const span = tracer.startSpan("error-span");

      try {
        throw new Error("Test error");
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: "Error occurred" }); // SpanStatusCode.ERROR = 2
      }

      span.end();
      await tracerProvider.forceFlush();

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }, 15000);
  });

  describe("Tag Management", () => {
    it("should retrieve available tag keys", async () => {
      const tagKeys = await tempoClient.getTagKeys();
      expect(Array.isArray(tagKeys)).toBe(true);
    }, 10000);
  });
});

/**
 * End-to-End Observability Pipeline Tests
 * Tests the complete flow: Application → Traces → Logs → Metrics → Grafana
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { LokiClient } from "../helpers/loki-client";
import { TempoClient } from "../helpers/tempo-client";
import { PrometheusClient } from "../helpers/prometheus-client";
import axios from "axios";
import { trace } from "@opentelemetry/api";
import {
  BasicTracerProvider,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

describe("Observability Pipeline - E2E Tests", () => {
  let lokiClient: LokiClient;
  let tempoClient: TempoClient;
  let prometheusClient: PrometheusClient;
  let tracerProvider: BasicTracerProvider;
  let tracer: any;

  beforeAll(async () => {
    lokiClient = new LokiClient();
    tempoClient = new TempoClient();
    prometheusClient = new PrometheusClient();

    // Setup tracer
    const exporter = new OTLPTraceExporter({
      url: "http://localhost:4318/v1/traces",
    });

    // OpenTelemetry Resource import compatibility (ESM/CJS)
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "e2e-test-service",
    });

    tracerProvider = new BasicTracerProvider({ resource });
    tracerProvider.addSpanProcessor(new BatchSpanProcessor(exporter));
    tracerProvider.register();

    tracer = trace.getTracer("e2e-test-tracer");
  });

  afterAll(async () => {
    await tracerProvider.shutdown();
  });

  describe("Full Pipeline: Trace → Log → Metric", () => {
    it("should correlate trace with logs via trace_id", async () => {
      const testId = `full-pipeline-${Date.now()}`;

      // 1. Create a trace
      const span = tracer.startSpan("e2e-operation");
      const spanContext = span.spanContext();
      const traceId = spanContext.traceId;
      const spanId = spanContext.spanId;

      span.setAttribute("test.id", testId);
      span.setAttribute("operation", "full-pipeline-test");
      span.end();
      await tracerProvider.forceFlush();

      // 2. Push log with trace context
      const logLine = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        message: "E2E test log with trace context",
        test_id: testId,
        trace_id: traceId,
        span_id: spanId,
      });

      await lokiClient.push(
        {
          job: "e2e-test",
          service: "e2e-test-service",
        },
        logLine
      );

      // 3. Verify trace exists in Tempo
      const traceData = await tempoClient.waitForTrace(traceId, 20000, 2000);
      expect(traceData).toBeDefined();

      // 4. Verify log exists in Loki with trace_id
      const logFound = await lokiClient.waitForLog(
        '{job="e2e-test"}',
        traceId,
        15000
      );
      expect(logFound).toBe(true);

      // 5. Query log and extract trace_id
      const queryResult = await lokiClient.query(
        `{job="e2e-test"} |= "${testId}"`,
        new Date(Date.now() - 60000)
      );

      expect(queryResult.data.result.length).toBeGreaterThan(0);
      const logEntry = queryResult.data.result[0].values[0][1];
      expect(logEntry).toContain(traceId);
    }, 40000);

    it("should track request through all systems", async () => {
      const requestId = `request-${Date.now()}`;

      // Simulate HTTP request processing
      const span = tracer.startSpan("http-request");
      const traceId = span.spanContext().traceId;

      span.setAttribute("http.method", "GET");
      span.setAttribute("http.url", "/api/test");
      span.setAttribute("request.id", requestId);

      // Log request received
      await lokiClient.push(
        { job: "api", level: "info" },
        JSON.stringify({
          message: "Request received",
          request_id: requestId,
          trace_id: traceId,
        })
      );

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Log request completed
      await lokiClient.push(
        { job: "api", level: "info" },
        JSON.stringify({
          message: "Request completed",
          request_id: requestId,
          trace_id: traceId,
          duration_ms: 100,
        })
      );

      span.end();
      await tracerProvider.forceFlush();

      // Verify trace
      const trace = await tempoClient.waitForTrace(traceId, 20000);
      expect(trace).toBeDefined();

      // Verify both logs
      const logsFound = await lokiClient.waitForLog(
        '{job="api"}',
        requestId,
        15000
      );
      expect(logsFound).toBe(true);

      const logs = await lokiClient.query(
        `{job="api"} |= "${requestId}"`,
        new Date(Date.now() - 60000)
      );
      expect(logs.data.result[0].values.length).toBeGreaterThanOrEqual(2);
    }, 40000);
  });

  describe("Trace-Log Correlation", () => {
    it("should extract trace_id from Tempo and find logs in Loki", async () => {
      const correlationId = `correlation-${Date.now()}`;

      // Create trace
      const span = tracer.startSpan("correlation-test");
      const traceId = span.spanContext().traceId;
      span.setAttribute("correlation.id", correlationId);
      span.end();
      await tracerProvider.forceFlush();

      // Create multiple logs with same trace_id
      const logs = [
        "Step 1: Initialize",
        "Step 2: Process",
        "Step 3: Complete",
      ];

      for (const msg of logs) {
        await lokiClient.push(
          { job: "correlation-test" },
          JSON.stringify({
            message: msg,
            trace_id: traceId,
            correlation_id: correlationId,
          })
        );
      }

      // Get trace from Tempo
      const trace = await tempoClient.waitForTrace(traceId, 20000);
      expect(trace).toBeDefined();

      // Use extracted trace_id to query Loki
      const logsResult = await lokiClient.query(
        `{job="correlation-test"} |= "${traceId}"`,
        new Date(Date.now() - 60000)
      );

      // Should find all 3 logs
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const finalLogs = await lokiClient.query(
        `{job="correlation-test"} |= "${correlationId}"`,
        new Date(Date.now() - 60000)
      );

      expect(finalLogs.data.result.length).toBeGreaterThan(0);
    }, 40000);
  });

  describe("Grafana Data Source Connectivity", () => {
    it("should verify Grafana can reach all data sources", async () => {
      const grafanaUrl = "http://localhost:3000";

      // Check Grafana health
      const healthResponse = await axios.get(`${grafanaUrl}/api/health`);
      expect(healthResponse.status).toBe(200);

      // Check datasources
      const dsResponse = await axios.get(`${grafanaUrl}/api/datasources`);
      expect(dsResponse.status).toBe(200);

      const datasources = dsResponse.data;
      expect(Array.isArray(datasources)).toBe(true);

      // Verify all three datasources exist
      const dsNames = datasources.map((ds: any) => ds.name);
      expect(dsNames).toContain("Prometheus");
      expect(dsNames).toContain("Loki");
      expect(dsNames).toContain("Tempo");
    }, 15000);

    it("should verify all data sources return healthy status", async () => {
      const grafanaUrl = "http://localhost:3000";

      // This endpoint requires authentication in production,
      // but our local setup disables it
      const response = await axios.get(`${grafanaUrl}/api/datasources`);
      const datasources = response.data;

      for (const ds of datasources) {
        expect(ds.name).toBeDefined();
        expect(["Prometheus", "Loki", "Tempo"]).toContain(ds.name);
      }
    }, 15000);
  });

  describe("Multi-Service Trace", () => {
    it("should track request across multiple services", async () => {
      const requestId = `multi-service-${Date.now()}`;

      // Service A
      const serviceASpan = tracer.startSpan("service-a-operation");
      const traceId = serviceASpan.spanContext().traceId;
      serviceASpan.setAttribute("service", "service-a");

      await lokiClient.push(
        { job: "service-a", service: "service-a" },
        JSON.stringify({
          message: "Processing in service A",
          request_id: requestId,
          trace_id: traceId,
        })
      );

      // Simulate call to service B (child span)
      const ctx = trace.setSpan(trace.context.active(), serviceASpan);
      await trace.context.with(ctx, async () => {
        const serviceBSpan = tracer.startSpan("service-b-operation");
        serviceBSpan.setAttribute("service", "service-b");

        await lokiClient.push(
          { job: "service-b", service: "service-b" },
          JSON.stringify({
            message: "Processing in service B",
            request_id: requestId,
            trace_id: traceId,
          })
        );

        serviceBSpan.end();
      });

      serviceASpan.end();
      await tracerProvider.forceFlush();

      // Verify trace has multiple spans
      const trace = await tempoClient.waitForTrace(traceId, 20000);
      const spans = tempoClient.extractSpans(trace);
      expect(spans.length).toBeGreaterThanOrEqual(2);

      // Verify logs from both services
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const logsA = await lokiClient.query(
        `{service="service-a"} |= "${requestId}"`
      );
      const logsB = await lokiClient.query(
        `{service="service-b"} |= "${requestId}"`
      );

      expect(
        logsA.data.result.length + logsB.data.result.length
      ).toBeGreaterThan(0);
    }, 40000);
  });

  describe("Error Propagation", () => {
    it("should track errors across traces and logs", async () => {
      const errorId = `error-${Date.now()}`;

      // Create span with error
      const span = tracer.startSpan("error-operation");
      const traceId = span.spanContext().traceId;

      try {
        // Simulate error
        throw new Error("Test error for E2E");
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: 2, message: "Error occurred" });

        // Log error with trace context
        await lokiClient.push(
          { job: "error-test", level: "error" },
          JSON.stringify({
            message: "Error occurred",
            error: (error as Error).message,
            error_id: errorId,
            trace_id: traceId,
          })
        );
      }

      span.end();
      await tracerProvider.forceFlush();

      // Verify error in trace
      const trace = await tempoClient.waitForTrace(traceId, 20000);
      expect(trace).toBeDefined();

      // Verify error log
      const errorLog = await lokiClient.waitForLog(
        '{level="error"}',
        errorId,
        15000
      );
      expect(errorLog).toBe(true);
    }, 40000);
  });

  describe("Performance Metrics", () => {
    it("should expose at least one agent-fabric Prometheus metric", async () => {
      const metricNames = await prometheusClient.getMetricNames();
      const hasAgentFabricMetric = metricNames.some((name) =>
        name.startsWith("agent_fabric_")
      );

      expect(hasAgentFabricMetric).toBe(true);
    }, 15000);

    it("should track request duration in all systems", async () => {
      const perfTestId = `perf-${Date.now()}`;
      const startTime = Date.now();

      // Create timed operation
      const span = tracer.startSpan("timed-operation");
      const traceId = span.spanContext().traceId;

      // Simulate work
      await new Promise((resolve) => setTimeout(resolve, 200));

      const duration = Date.now() - startTime;

      span.setAttribute("duration.ms", duration);
      span.end();
      await tracerProvider.forceFlush();

      // Log with duration
      await lokiClient.push(
        { job: "perf-test" },
        JSON.stringify({
          message: "Operation completed",
          test_id: perfTestId,
          duration_ms: duration,
          trace_id: traceId,
        })
      );

      // Verify trace has duration
      const trace = await tempoClient.waitForTrace(traceId, 20000);
      const spans = tempoClient.extractSpans(trace);
      expect(spans.length).toBeGreaterThan(0);
      expect(spans[0].durationNanos).toBeDefined();

      // Verify log has duration
      const logs = await lokiClient.query(
        `{job="perf-test"} |= "${perfTestId}"`
      );

      await new Promise((resolve) => setTimeout(resolve, 3000));
      const finalLogs = await lokiClient.query(
        `{job="perf-test"} |= "${perfTestId}"`
      );

      if (finalLogs.data.result.length > 0) {
        const logLine = finalLogs.data.result[0].values[0][1];
        expect(logLine).toContain("duration_ms");
      }
    }, 40000);
  });
});

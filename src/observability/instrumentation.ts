/**
 * OpenTelemetry Instrumentation for ValueOS
 *
 * This module initializes the three pillars of observability:
 * - Traces: Distributed tracing via OTLP to Tempo
 * - Metrics: Application metrics via Prometheus
 * - Logs: Structured logging with trace context
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { trace, metrics, context, SpanStatusCode } from "@opentelemetry/api";
import type {
  Span,
  Tracer,
  Counter,
  Histogram,
  ObservableGauge,
} from "@opentelemetry/api";
import * as winston from "winston";

// Environment configuration with defaults
const config = {
  serviceName: process.env.OTEL_SERVICE_NAME || "valueos",
  serviceVersion: process.env.npm_package_version || "1.0.0",
  environment: process.env.NODE_ENV || "development",

  // Tempo OTLP endpoint (HTTP)
  tempoEndpoint:
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    "http://localhost:4318/v1/traces",

  // Prometheus metrics endpoint (port and path)
  prometheusPort: parseInt(process.env.PROMETHEUS_PORT || "9464", 10),
  prometheusEndpoint: process.env.PROMETHEUS_ENDPOINT || "/metrics",
};

// Resource attributes identify this service instance
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
});

// ============================================================================
// TRACING SETUP
// ============================================================================

// OTLP Trace Exporter - sends traces to Tempo
const traceExporter = new OTLPTraceExporter({
  url: config.tempoEndpoint,
  headers: {},
});

// ============================================================================
// METRICS SETUP
// ============================================================================

// Prometheus Exporter - exposes metrics on /metrics endpoint
const metricsExporter = new PrometheusExporter(
  {
    port: config.prometheusPort,
    endpoint: config.prometheusEndpoint,
  },
  () => {
    console.log(
      `📊 Prometheus metrics available at http://localhost:${config.prometheusPort}${config.prometheusEndpoint}`
    );
  }
);

// ============================================================================
// SDK INITIALIZATION
// ============================================================================

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK
 * Should be called once at application startup
 */
export async function initializeTelemetry(): Promise<void> {
  if (sdk) {
    console.warn("⚠️  Telemetry already initialized");
    return;
  }

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricsExporter,
      exportIntervalMillis: 5000, // Export metrics every 5 seconds
    }),
    spanProcessor: new BatchSpanProcessor(traceExporter, {
      maxQueueSize: 2048,
      scheduledDelayMillis: 5000,
      exportTimeoutMillis: 30000,
      maxExportBatchSize: 512,
    }),
    // Auto-instrumentation for common libraries
    instrumentations: [
      getNodeAutoInstrumentations({
        // Fine-tune auto-instrumentation
        "@opentelemetry/instrumentation-fs": { enabled: false }, // Disable filesystem instrumentation (noisy)
        "@opentelemetry/instrumentation-http": { enabled: true },
        "@opentelemetry/instrumentation-express": { enabled: true },
      }),
    ],
  });

  await sdk.start();
  console.log("✅ OpenTelemetry initialized");

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    await shutdownTelemetry();
    process.exit(0);
  });
}

/**
 * Shutdown OpenTelemetry SDK
 * Flushes all pending telemetry data
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }

  await sdk.shutdown();
  console.log("🛑 OpenTelemetry shut down");
  sdk = null;
}

// ============================================================================
// TRACER
// ============================================================================

let tracer: Tracer;

/**
 * Get the tracer instance
 */
export function getTracer(): Tracer {
  if (!tracer) {
    tracer = trace.getTracer(config.serviceName, config.serviceVersion);
  }
  return tracer;
}

/**
 * Create a new span and execute a function within its context
 *
 * @example
 * const result = await withSpan('processOrder', async (span) => {
 *   span.setAttribute('order.id', orderId);
 *   // ... processing logic
 *   return result;
 * });
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(name, async (span) => {
    try {
      // Add custom attributes
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }

      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Get current trace ID and span ID for log correlation
 */
export function getTraceContext(): { traceId: string; spanId: string } {
  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) {
    return { traceId: "", spanId: "" };
  }

  const spanContext = activeSpan.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

// ============================================================================
// METRICS
// ============================================================================

const meter = metrics.getMeter(config.serviceName, config.serviceVersion);

// Pre-defined metrics
export const Metrics = {
  // HTTP request counter
  httpRequestsTotal: meter.createCounter("http_requests_total", {
    description: "Total number of HTTP requests",
  }),

  // HTTP request duration histogram
  httpRequestDuration: meter.createHistogram("http_request_duration_seconds", {
    description: "HTTP request duration in seconds",
    unit: "seconds",
  }),

  // Active connections gauge (example)
  activeConnections: meter.createObservableGauge("active_connections", {
    description: "Number of active connections",
  }),

  // Custom business metrics
  createCounter(name: string, description: string): Counter {
    return meter.createCounter(name, { description });
  },

  createHistogram(name: string, description: string, unit?: string): Histogram {
    return meter.createHistogram(name, { description, unit });
  },

  createGauge(name: string, description: string): ObservableGauge {
    return meter.createObservableGauge(name, { description });
  },
};

// ============================================================================
// LOGGING WITH TRACE CONTEXT
// ============================================================================

/**
 * Winston logger with trace context injection
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    // Inject trace context
    winston.format((info) => {
      const { traceId, spanId } = getTraceContext();
      if (traceId) {
        info.trace_id = traceId;
        info.span_id = spanId;
      }
      return info;
    })(),
    winston.format.json()
  ),
  defaultMeta: {
    service: config.serviceName,
    environment: config.environment,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // In production, add file/network transport to send logs to Loki
    // new LokiTransport({ ... })
  ],
});

// ============================================================================
// EXPORTS
// ============================================================================

export { config as telemetryConfig, trace, metrics, context, SpanStatusCode };

export type { Span, Tracer, Counter, Histogram };

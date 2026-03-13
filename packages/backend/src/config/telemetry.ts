/**
 * OpenTelemetry Configuration
 *
 * Provides distributed tracing and metrics for LLM calls,
 * database queries, and API requests.
 *
 * Automatically detects browser vs Node.js environment and provides
 * appropriate implementations.
 */

// Detect if we're in a browser environment
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

// Browser imports - use dynamic imports to avoid bundling issues
import type { NextFunction, Request, Response } from "express";
import type { Span as SpanType } from "@opentelemetry/api";
let trace: any, context: any, SpanStatusCode: any, Span: any;

async function initializeTelemetryImports() {
  if (isBrowser) {
    // Browser environment - use OpenTelemetry API only
    const api = await import('@opentelemetry/api');
    trace = api.trace;
    context = api.context;
    SpanStatusCode = api.SpanStatusCode;
    Span = api.Span;
  } else {
    // Node.js environment - use full SDK
    trace = (await import('@opentelemetry/api')).trace;
    context = (await import('@opentelemetry/api')).context;
    SpanStatusCode = (await import('@opentelemetry/api')).SpanStatusCode;
    Span = (await import('@opentelemetry/api')).Span;
  }
}

// Initialize imports immediately
initializeTelemetryImports();

// Service configuration
const SERVICE_NAME = isBrowser ? 'valuecanvas-frontend' : (process.env.OTEL_SERVICE_NAME || 'valuecanvas-api');
const SERVICE_VERSION = isBrowser ? '1.0.0' : (process.env.npm_package_version || '1.0.0');
const ENVIRONMENT = isBrowser ? 'browser' : (process.env.NODE_ENV || 'development');

// No-op implementations for browser environment
const noopSpan = {
  setAttributes: () => {},
  setStatus: () => {},
  recordException: () => {},
  addEvent: () => {},
  end: () => {},
  spanContext: () => ({ traceId: '', spanId: '' })
};

const noopTracer = {
  startSpan: () => noopSpan,
  startActiveSpan: (_name: string, _options: any, fn: (span: SpanType) => any) => fn(noopSpan)
};

// Exporter endpoints (Node.js only)
// Default to otel-collector when running in Docker, localhost for local dev
let OTLP_ENDPOINT: string | undefined, TRACES_ENDPOINT: string | undefined;
if (!isBrowser) {
  OTLP_ENDPOINT = process.env.OTLP_ENDPOINT || 'http://otel-collector:4318';
  TRACES_ENDPOINT = `${OTLP_ENDPOINT}/v1/traces`;
}

/**
 * Initialize OpenTelemetry SDK
 */
export async function initializeTelemetry(): Promise<any> {
  if (isBrowser) {
    // Browser environment - no-op initialization
    logger.info('OpenTelemetry initialized for browser environment');
    return null;
  }

  // Wait for imports to be available
  await initializeTelemetryImports();

  // Node.js environment - tracing only (metrics handled by prom-client)
  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
  const resources = await import('@opentelemetry/resources');
  const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');
  const { logger } = await import('../lib/logger');

  const sdk = new NodeSDK({
    resource: new resources.Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: SERVICE_NAME,
      [SemanticResourceAttributes.SERVICE_VERSION]: SERVICE_VERSION,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: ENVIRONMENT,
    }),
    traceExporter: new OTLPTraceExporter({
      url: TRACES_ENDPOINT,
      headers: {
        'Authorization': `Bearer ${process.env.OTLP_AUTH_TOKEN || ''}`
      }
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false // Disable file system instrumentation (too noisy)
        },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingPaths: ['/health', '/metrics']
        },
        '@opentelemetry/instrumentation-express': {
          enabled: true
        },
        '@opentelemetry/instrumentation-pg': {
          enabled: true
        },
        '@opentelemetry/instrumentation-redis': {
          enabled: true
        }
      })
    ]
  });

  sdk.start();

  logger.info('OpenTelemetry initialized', {
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: ENVIRONMENT,
    endpoint: OTLP_ENDPOINT
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => logger.info('OpenTelemetry shut down successfully'))
      .catch((error) => logger.error('Error shutting down OpenTelemetry', error));
  });

  return sdk;
}

/**
 * Get tracer instance
 */
export function getTracer() {
  if (isBrowser || !trace) {
    return noopTracer;
  }

  return trace.getTracer(SERVICE_NAME, SERVICE_VERSION);
}

/**
 * Create a span for LLM operations
 */
export async function traceLLMOperation<T>(
  operationName: string,
  attributes: {
    provider: 'together_ai' | 'openai' | 'cache';
    model: string;
    userId?: string;
    promptLength?: number;
  },
  operation: (span: SpanType) => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    `llm.${operationName}`,
    {
      attributes: {
        'llm.provider': attributes.provider,
        'llm.model': attributes.model,
        'llm.user_id': attributes.userId || 'anonymous',
        'llm.prompt_length': attributes.promptLength || 0
      }
    },
    async (span) => {
      const startTime = Date.now();

      try {
        const result = await operation(span);

        const duration = Date.now() - startTime;

        span.setAttributes({
          'llm.duration_ms': duration,
          'llm.success': true
        });

        span.setStatus({ code: SpanStatusCode.OK });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        span.setAttributes({
          'llm.duration_ms': duration,
          'llm.success': false,
          'llm.error': error instanceof Error ? error.message : 'Unknown error'
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        });

        span.recordException(error as Error);

        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Create a span for database operations
 */
export async function traceDatabaseOperation<T>(
  operationName: string,
  attributes: {
    table?: string;
    operation?: 'select' | 'insert' | 'update' | 'delete';
  },
  operation: (span: SpanType) => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    `db.${operationName}`,
    {
      attributes: {
        'db.system': 'postgresql',
        'db.table': attributes.table || 'unknown',
        'db.operation': attributes.operation || 'unknown'
      }
    },
    async (span) => {
      try {
        const result = await operation(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Create a span for cache operations
 */
export async function traceCacheOperation<T>(
  operationName: string,
  attributes: {
    cacheKey?: string;
    hit?: boolean;
  },
  operation: (span: SpanType) => Promise<T>
): Promise<T> {
  const tracer = getTracer();

  return tracer.startActiveSpan(
    `cache.${operationName}`,
    {
      attributes: {
        'cache.system': 'redis',
        'cache.key': attributes.cacheKey || 'unknown',
        'cache.hit': attributes.hit !== undefined ? attributes.hit : false
      }
    },
    async (span) => {
      try {
        const result = await operation(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        span.recordException(error as Error);
        throw error;
      } finally {
        span.end();
      }
    }
  );
}

/**
 * Add custom attributes to current span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Add event to current span
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Record exception in current span
 */
export function recordSpanException(error: Error): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
  }
}

/**
 * Get current trace context
 */
export function getCurrentTraceContext(): {
  traceId: string;
  spanId: string;
} | null {
  const span = trace.getActiveSpan();
  if (!span) return null;

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId
  };
}

/**
 * Inject trace context into logger
 */
export function getTraceContextForLogging(): Record<string, string> {
  const traceContext = getCurrentTraceContext();
  if (!traceContext) return {};

  return {
    traceId: traceContext.traceId,
    spanId: traceContext.spanId
  };
}

/**
 * Create custom metric counter
 */
export async function createCounter(name: string, description: string) {
  if (isBrowser) {
    return {
      add: () => {},
      record: () => {}
    };
  }

  const { metrics } = await import('@opentelemetry/api');
  const meter = metrics.getMeter(SERVICE_NAME);
  return meter.createCounter(name, { description });
}

/**
 * Create custom metric histogram
 */
export async function createHistogram(name: string, description: string) {
  if (isBrowser) {
    return {
      record: () => {}
    };
  }

  const { metrics } = await import('@opentelemetry/api');
  const meter = metrics.getMeter(SERVICE_NAME);
  return meter.createHistogram(name, { description });
}

/**
 * Create custom metric gauge
 */
export async function createObservableGauge(
  name: string,
  description: string,
  callback: () => number
) {
  if (isBrowser) {
    return {
      observe: () => {}
    };
  }

  const { metrics } = await import('@opentelemetry/api');
  const meter = metrics.getMeter(SERVICE_NAME);
  return meter.createObservableGauge(name, {
    description
  }, (observableResult) => {
    observableResult.observe(callback());
  });
}

// Pre-defined metrics (async initialization)
export const metrics = {
  get llmRequestsTotal() { return createCounter('llm.requests.total', 'Total number of LLM requests'); },
  get llmRequestDuration() { return createHistogram('llm.request.duration', 'Duration of LLM requests in milliseconds'); },
  get llmCostTotal() { return createCounter('llm.cost.total', 'Total cost of LLM requests in USD'); },
  get llmTokensTotal() { return createCounter('llm.tokens.total', 'Total number of tokens processed'); },
  get cacheHitsTotal() { return createCounter('cache.hits.total', 'Total number of cache hits'); },
  get cacheMissesTotal() { return createCounter('cache.misses.total', 'Total number of cache misses'); },
  get circuitBreakerState() {
    return createObservableGauge(
      'circuit_breaker.state',
      'Circuit breaker state (0=closed, 1=open, 2=half-open)',
      () => 0
    );
  }
};

/**
 * Middleware to add tracing to Express routes
 */
function getHeaderValue(input: string | string[] | undefined): string | undefined {
  if (!input) return undefined;
  return Array.isArray(input) ? input[0] : input;
}

export function tracingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const tracer = getTracer();
    const span = tracer.startSpan(`http.${req.method} ${req.path}`);

    const tenantId =
      getHeaderValue(req.headers["x-tenant-id"]) ??
      getHeaderValue(req.headers["x-organization-id"]) ??
      (typeof req.tenantId === "string" ? req.tenantId : undefined) ??
      "unknown";

    const incomingTraceId = getHeaderValue(req.headers["x-trace-id"]);

    span.setAttributes({
      'http.method': req.method,
      'http.url': req.url,
      'http.target': req.path,
      'http.user_agent': req.get('user-agent') || 'unknown',
      'tenant_id': tenantId,
      'trace_id': incomingTraceId ?? 'unknown',
    });

    const activeCtx = trace.setSpan(context.active(), span);
    context.with(activeCtx, () => {
      req.traceContext = {
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
      };

      res.on('finish', () => {
        span.setAttributes({
          'http.status_code': res.statusCode,
        });

        if (res.statusCode >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${res.statusCode}`,
          });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        span.end();
      });

      next();
    });
  };
}

/**
 * OpenTelemetry Configuration
 * 
 * Provides distributed tracing and metrics for LLM calls,
 * database queries, and API requests.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { trace, context, SpanStatusCode, Span } from '@opentelemetry/api';
import { logger } from '../utils/logger';

// Service configuration
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'valuecanvas-api';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

// Exporter endpoints
const OTLP_ENDPOINT = process.env.OTLP_ENDPOINT || 'http://localhost:4318';
const TRACES_ENDPOINT = `${OTLP_ENDPOINT}/v1/traces`;
const METRICS_ENDPOINT = `${OTLP_ENDPOINT}/v1/metrics`;

/**
 * Initialize OpenTelemetry SDK
 */
export function initializeTelemetry(): NodeSDK {
  const sdk = new NodeSDK({
    resource: new Resource({
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
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({
        url: METRICS_ENDPOINT,
        headers: {
          'Authorization': `Bearer ${process.env.OTLP_AUTH_TOKEN || ''}`
        }
      }),
      exportIntervalMillis: 60000 // Export every 60 seconds
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
  operation: (span: Span) => Promise<T>
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
  operation: (span: Span) => Promise<T>
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
  operation: (span: Span) => Promise<T>
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
export function createCounter(name: string, description: string) {
  const { metrics } = require('@opentelemetry/api');
  const meter = metrics.getMeter(SERVICE_NAME);
  return meter.createCounter(name, { description });
}

/**
 * Create custom metric histogram
 */
export function createHistogram(name: string, description: string) {
  const { metrics } = require('@opentelemetry/api');
  const meter = metrics.getMeter(SERVICE_NAME);
  return meter.createHistogram(name, { description });
}

/**
 * Create custom metric gauge
 */
export function createObservableGauge(
  name: string,
  description: string,
  callback: () => number
) {
  const { metrics } = require('@opentelemetry/api');
  const meter = metrics.getMeter(SERVICE_NAME);
  return meter.createObservableGauge(name, {
    description
  }, (observableResult) => {
    observableResult.observe(callback());
  });
}

// Pre-defined metrics
export const metrics = {
  llmRequestsTotal: createCounter(
    'llm.requests.total',
    'Total number of LLM requests'
  ),
  llmRequestDuration: createHistogram(
    'llm.request.duration',
    'Duration of LLM requests in milliseconds'
  ),
  llmCostTotal: createCounter(
    'llm.cost.total',
    'Total cost of LLM requests in USD'
  ),
  llmTokensTotal: createCounter(
    'llm.tokens.total',
    'Total number of tokens processed'
  ),
  cacheHitsTotal: createCounter(
    'cache.hits.total',
    'Total number of cache hits'
  ),
  cacheMissesTotal: createCounter(
    'cache.misses.total',
    'Total number of cache misses'
  ),
  circuitBreakerState: createObservableGauge(
    'circuit_breaker.state',
    'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    () => {
      // This will be updated by circuit breaker
      return 0;
    }
  )
};

/**
 * Middleware to add tracing to Express routes
 */
export function tracingMiddleware() {
  return (req: any, res: any, next: any) => {
    const tracer = getTracer();
    const span = tracer.startSpan(`http.${req.method} ${req.path}`);

    span.setAttributes({
      'http.method': req.method,
      'http.url': req.url,
      'http.target': req.path,
      'http.user_agent': req.get('user-agent') || 'unknown'
    });

    // Add trace context to request
    req.traceContext = getCurrentTraceContext();

    // End span when response finishes
    res.on('finish', () => {
      span.setAttributes({
        'http.status_code': res.statusCode
      });

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
    });

    next();
  };
}

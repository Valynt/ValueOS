/**
 * Browser-compatible OpenTelemetry Configuration
 * 
 * Provides distributed tracing and metrics for client-side operations.
 * Falls back to no-op implementations when OpenTelemetry is not available.
 */

import { Span, SpanStatusCode, trace } from '@opentelemetry/api';

// Service configuration
const SERVICE_NAME = 'valuecanvas-frontend';
const SERVICE_VERSION = '1.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

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
  startActiveSpan: (_name: string, _options: any, fn: (span: Span) => any) => fn(noopSpan)
};

/**
 * Get tracer instance (browser-compatible)
 */
export function getTracer() {
  try {
    return trace.getTracer(SERVICE_NAME, SERVICE_VERSION);
  } catch {
    return noopTracer;
  }
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
 * Create custom metric counter (no-op for browser)
 */
export function createCounter(_name: string, _description: string) {
  return {
    add: () => {},
    record: () => {}
  };
}

/**
 * Create custom metric histogram (no-op for browser)
 */
export function createHistogram(_name: string, _description: string) {
  return {
    record: () => {}
  };
}

/**
 * Create custom metric gauge (no-op for browser)
 */
export function createObservableGauge(
  name: string,
  description: string,
  _callback: () => number
) {
  return {
    observe: () => {}
  };
}

// Pre-defined metrics (no-op for browser)
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
 * Initialize telemetry (no-op for browser)
 */
export function initializeTelemetry() {
  // No-op for browser environment
  return null;
}

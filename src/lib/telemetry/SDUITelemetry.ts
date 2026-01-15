/**
 * SDUI Telemetry System
 *
 * Captures performance metrics, error states, and user interactions
 * throughout the SDUI rendering pipeline for debugging and monitoring.
 *
 * Phase 3: Telemetry Hooks for Debugging
 */

import { logger } from '../logger';

/**
 * Telemetry event types
 */
export enum TelemetryEventType {
  // Rendering lifecycle
  RENDER_START = 'sdui.render.start',
  RENDER_COMPLETE = 'sdui.render.complete',
  RENDER_ERROR = 'sdui.render.error',

  // Component lifecycle
  COMPONENT_MOUNT = 'sdui.component.mount',
  COMPONENT_UNMOUNT = 'sdui.component.unmount',
  COMPONENT_ERROR = 'sdui.component.error',
  COMPONENT_RESOLVE = 'sdui.component.resolve',
  COMPONENT_HYDRATE = 'sdui.component.hydrate',

  // Data hydration
  HYDRATION_START = 'sdui.hydration.start',
  HYDRATION_COMPLETE = 'sdui.hydration.complete',
  HYDRATION_ERROR = 'sdui.hydration.error',
  HYDRATION_CACHE_HIT = 'sdui.hydration.cache_hit',
  HYDRATION_CACHE_MISS = 'sdui.hydration.cache_miss',

  // User interactions
  USER_INTERACTION = 'sdui.user.interaction',
  USER_ACTION = 'sdui.user.action',

  // Agent chat
  CHAT_REQUEST_START = 'chat.request.start',
  CHAT_REQUEST_COMPLETE = 'chat.request.complete',
  CHAT_REQUEST_ERROR = 'chat.request.error',
  CHAT_RETRY_ATTEMPT = 'chat.retry.attempt',
  CHAT_RETRY_SUCCESS = 'chat.retry.success',
  CHAT_RETRY_FAILED = 'chat.retry.failed',

  // Workflow state
  WORKFLOW_STATE_LOAD = 'workflow.state.load',
  WORKFLOW_STATE_SAVE = 'workflow.state.save',
  WORKFLOW_STATE_SAVE_ERROR = 'workflow.state.save_error',
  WORKFLOW_STAGE_TRANSITION = 'workflow.stage.transition',

  // Circuit breaker
  CIRCUIT_BREAKER_TRIPPED = 'circuit.breaker.tripped',
  CIRCUIT_BREAKER_RESET = 'circuit.breaker.reset',

  // Performance
  PERFORMANCE_MARK = 'performance.mark',
  PERFORMANCE_MEASURE = 'performance.measure',

  // Memory and resources
  MEMORY_USAGE = 'system.memory.usage',
  RESOURCE_TIMING = 'system.resource.timing',
}

/**
 * Telemetry event data
 */
export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: number;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  duration?: number;
  metadata: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Performance metrics for SDUI rendering
 */
export interface RenderMetrics {
  renderStartTime: number;
  renderEndTime?: number;
  renderDuration?: number;
  componentCount: number;
  hydratedComponentCount: number;
  errorCount: number;
  warningCount: number;
}

/**
 * SDUI Telemetry Collector
 */
export class SDUITelemetry {
  private events: TelemetryEvent[] = [];
  private readonly maxEvents = 1000; // Prevent memory leak
  private enabled: boolean;
  private activeSpans: Map<string, number> = new Map();

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  /**
   * Record a telemetry event
   */
  recordEvent(event: Omit<TelemetryEvent, 'timestamp'>): void {
    if (!this.enabled) return;

    const fullEvent: TelemetryEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);

    // Trim old events if needed
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Log important events
    if (event.type.includes('error')) {
      logger.error(`[Telemetry] ${event.type}`, event.error, event.metadata);
    } else if (event.type.includes('complete')) {
      logger.debug(`[Telemetry] ${event.type}`, {
        duration: event.duration,
        ...event.metadata,
      });
    }
  }

  /**
   * Start a performance span
   */
  startSpan(spanId: string, type: TelemetryEventType, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    this.activeSpans.set(spanId, Date.now());

    this.recordEvent({
      type,
      spanId,
      metadata: metadata || {},
    });
  }

  /**
   * End a performance span
   */
  endSpan(
    spanId: string,
    type: TelemetryEventType,
    metadata?: Record<string, any>,
    error?: TelemetryEvent['error']
  ): void {
    if (!this.enabled) return;

    const startTime = this.activeSpans.get(spanId);
    if (!startTime) {
      logger.warn('[Telemetry] Span not found', { spanId });
      return;
    }

    const duration = Date.now() - startTime;
    this.activeSpans.delete(spanId);

    this.recordEvent({
      type,
      spanId,
      duration,
      metadata: metadata || {},
      error,
    });
  }

  /**
   * Record a render cycle
   */
  recordRender(metrics: RenderMetrics): void {
    if (!this.enabled) return;

    this.recordEvent({
      type: TelemetryEventType.RENDER_COMPLETE,
      metadata: {
        componentCount: metrics.componentCount,
        hydratedComponentCount: metrics.hydratedComponentCount,
        errorCount: metrics.errorCount,
        warningCount: metrics.warningCount,
      },
      duration: metrics.renderDuration,
    });
  }

  /**
   * Record a user interaction
   */
  recordInteraction(
    component: string,
    action: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.enabled) return;

    this.recordEvent({
      type: TelemetryEventType.USER_INTERACTION,
      metadata: {
        component,
        action,
        ...metadata,
      },
    });
  }

  /**
   * Record workflow state change
   */
  recordWorkflowStateChange(
    sessionId: string,
    fromStage: string,
    toStage: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.enabled) return;

    this.recordEvent({
      type: TelemetryEventType.WORKFLOW_STAGE_TRANSITION,
      metadata: {
        sessionId,
        fromStage,
        toStage,
        ...metadata,
      },
    });
  }

  /**
   * Get all events
   */
  getEvents(filter?: {
    type?: TelemetryEventType;
    traceId?: string;
    since?: number;
  }): TelemetryEvent[] {
    let filtered = this.events;

    if (filter?.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }

    if (filter?.traceId) {
      filtered = filtered.filter(e => e.traceId === filter.traceId);
    }

    if (filter?.since) {
      filtered = filtered.filter(e => e.timestamp >= filter.since);
    }

    return filtered;
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    avgRenderTime: number;
    avgHydrationTime: number;
    errorRate: number;
    totalEvents: number;
    cacheHitRate: number;
    circuitBreakerTrips: number;
    memoryUsage: number;
  } {
    const renderEvents = this.events.filter(
      e => e.type === TelemetryEventType.RENDER_COMPLETE && e.duration
    );
    const hydrationEvents = this.events.filter(
      e => e.type === TelemetryEventType.HYDRATION_COMPLETE && e.duration
    );
    const errorEvents = this.events.filter(
      e => e.type.includes('error')
    );
    const cacheHits = this.events.filter(
      e => e.type === TelemetryEventType.HYDRATION_CACHE_HIT
    ).length;
    const cacheMisses = this.events.filter(
      e => e.type === TelemetryEventType.HYDRATION_CACHE_MISS
    ).length;
    const circuitBreakerEvents = this.events.filter(
      e => e.type === TelemetryEventType.CIRCUIT_BREAKER_TRIPPED
    ).length;
    const memoryEvents = this.events.filter(
      e => e.type === TelemetryEventType.MEMORY_USAGE
    );

    const avgRenderTime =
      renderEvents.length > 0
        ? renderEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / renderEvents.length
        : 0;

    const avgHydrationTime =
      hydrationEvents.length > 0
        ? hydrationEvents.reduce((sum, e) => sum + (e.duration || 0), 0) / hydrationEvents.length
        : 0;

    const errorRate =
      this.events.length > 0 ? errorEvents.length / this.events.length : 0;

    const cacheHitRate =
      (cacheHits + cacheMisses) > 0 ? cacheHits / (cacheHits + cacheMisses) : 0;

    const avgMemoryUsage =
      memoryEvents.length > 0
        ? memoryEvents.reduce((sum, e) => sum + (e.metadata.used || 0), 0) / memoryEvents.length
        : 0;

    return {
      avgRenderTime,
      avgHydrationTime,
      errorRate,
      totalEvents: this.events.length,
      cacheHitRate,
      circuitBreakerTrips: circuitBreakerEvents,
      memoryUsage: avgMemoryUsage,
    };
  }

  /**
   * Get detailed component performance metrics
   */
  getComponentMetrics(): Array<{
    component: string;
    renderCount: number;
    avgRenderTime: number;
    errorCount: number;
    hydrationCount: number;
    avgHydrationTime: number;
  }> {
    const componentMap = new Map<string, {
      renderCount: number;
      totalRenderTime: number;
      errorCount: number;
      hydrationCount: number;
      totalHydrationTime: number;
    }>();

    // Aggregate component metrics
    this.events.forEach(event => {
      const component = event.metadata.component;
      if (!component) return;

      if (!componentMap.has(component)) {
        componentMap.set(component, {
          renderCount: 0,
          totalRenderTime: 0,
          errorCount: 0,
          hydrationCount: 0,
          totalHydrationTime: 0,
        });
      }

      const metrics = componentMap.get(component)!;

      switch (event.type) {
        case TelemetryEventType.COMPONENT_MOUNT:
        case TelemetryEventType.RENDER_COMPLETE:
          metrics.renderCount++;
          if (event.duration) metrics.totalRenderTime += event.duration;
          break;
        case TelemetryEventType.COMPONENT_ERROR:
        case TelemetryEventType.RENDER_ERROR:
          metrics.errorCount++;
          break;
        case TelemetryEventType.COMPONENT_HYDRATE:
        case TelemetryEventType.HYDRATION_COMPLETE:
          metrics.hydrationCount++;
          if (event.duration) metrics.totalHydrationTime += event.duration;
          break;
      }
    });

    // Convert to array with calculated averages
    return Array.from(componentMap.entries()).map(([component, metrics]) => ({
      component,
      renderCount: metrics.renderCount,
      avgRenderTime: metrics.renderCount > 0 ? metrics.totalRenderTime / metrics.renderCount : 0,
      errorCount: metrics.errorCount,
      hydrationCount: metrics.hydrationCount,
      avgHydrationTime: metrics.hydrationCount > 0 ? metrics.totalHydrationTime / metrics.hydrationCount : 0,
    }));
  }

  /**
   * Get retry metrics
   */
  getRetryMetrics(): {
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    avgRetryAttempts: number;
    services: Array<{
      serviceId: string;
      retries: number;
      successes: number;
      failures: number;
      avgDelay: number;
    }>;
  } {
    const retryEvents = this.events.filter(e =>
      e.type === TelemetryEventType.CHAT_RETRY_ATTEMPT ||
      e.type === TelemetryEventType.CHAT_RETRY_SUCCESS ||
      e.type === TelemetryEventType.CHAT_RETRY_FAILED
    );

    const serviceMap = new Map<string, {
      retries: number;
      successes: number;
      failures: number;
      totalDelay: number;
    }>();

    retryEvents.forEach(event => {
      const serviceId = event.metadata.serviceId || 'unknown';

      if (!serviceMap.has(serviceId)) {
        serviceMap.set(serviceId, {
          retries: 0,
          successes: 0,
          failures: 0,
          totalDelay: 0,
        });
      }

      const metrics = serviceMap.get(serviceId)!;

      switch (event.type) {
        case TelemetryEventType.CHAT_RETRY_ATTEMPT:
          metrics.retries++;
          metrics.totalDelay += event.metadata.delay || 0;
          break;
        case TelemetryEventType.CHAT_RETRY_SUCCESS:
          metrics.successes++;
          break;
        case TelemetryEventType.CHAT_RETRY_FAILED:
          metrics.failures++;
          break;
      }
    });

    const totalRetries = retryEvents.filter(e => e.type === TelemetryEventType.CHAT_RETRY_ATTEMPT).length;
    const successfulRetries = retryEvents.filter(e => e.type === TelemetryEventType.CHAT_RETRY_SUCCESS).length;
    const failedRetries = retryEvents.filter(e => e.type === TelemetryEventType.CHAT_RETRY_FAILED).length;

    return {
      totalRetries,
      successfulRetries,
      failedRetries,
      avgRetryAttempts: totalRetries > 0 ? (successfulRetries + failedRetries) / totalRetries : 0,
      services: Array.from(serviceMap.entries()).map(([serviceId, metrics]) => ({
        serviceId,
        retries: metrics.retries,
        successes: metrics.successes,
        failures: metrics.failures,
        avgDelay: metrics.retries > 0 ? metrics.totalDelay / metrics.retries : 0,
      })),
    };
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    // Get memory usage if available
    const memoryInfo = (performance as any).memory;

    this.recordEvent({
      type: TelemetryEventType.MEMORY_USAGE,
      metadata: {
        used: memoryInfo?.usedJSHeapSize || 0,
        total: memoryInfo?.totalJSHeapSize || 0,
        limit: memoryInfo?.jsHeapSizeLimit || 0,
        ...metadata,
      },
    });
  }

  /**
   * Record resource timing
   */
  recordResourceTiming(url: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    const resources = performance.getEntriesByName(url) as PerformanceResourceTiming[];
    const resource = resources[resources.length - 1]; // Get most recent

    if (resource) {
      this.recordEvent({
        type: TelemetryEventType.RESOURCE_TIMING,
        metadata: {
          url,
          duration: resource.duration,
          size: resource.transferSize || 0,
          startTime: resource.startTime,
          ...metadata,
        },
      });
    }
  }

  /**
   * Create performance mark
   */
  mark(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    performance.mark(name);

    this.recordEvent({
      type: TelemetryEventType.PERFORMANCE_MARK,
      metadata: {
        name,
        ...metadata,
      },
    });
  }

  /**
   * Measure performance between marks
   */
  measure(name: string, startMark: string, endMark?: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;

    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];

      if (measure) {
        this.recordEvent({
          type: TelemetryEventType.PERFORMANCE_MEASURE,
          duration: measure.duration,
          metadata: {
            name,
            startMark,
            endMark,
            ...metadata,
          },
        });
      }
    } catch (error) {
      logger.warn('Performance measurement failed', { name, startMark, endMark, error });
    }
  }

  /**
   * Clear all events
   */
  clear(): void {
    this.events = [];
    this.activeSpans.clear();
  }

  /**
   * Enable/disable telemetry
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Export events for external analytics
   */
  exportEvents(): string {
    return JSON.stringify(this.events, null, 2);
  }
}

/**
 * Global telemetry instance
 */
export const sduiTelemetry = new SDUITelemetry(
  // Enable in development or if explicitly set
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development'
);

/**
 * React hook-friendly telemetry helpers
 */
export const useTelemetry = () => {
  return {
    startSpan: sduiTelemetry.startSpan.bind(sduiTelemetry),
    endSpan: sduiTelemetry.endSpan.bind(sduiTelemetry),
    recordEvent: sduiTelemetry.recordEvent.bind(sduiTelemetry),
    recordInteraction: sduiTelemetry.recordInteraction.bind(sduiTelemetry),
    recordWorkflowStateChange: sduiTelemetry.recordWorkflowStateChange.bind(sduiTelemetry),
  };
};

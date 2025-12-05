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
  
  // Data hydration
  HYDRATION_START = 'sdui.hydration.start',
  HYDRATION_COMPLETE = 'sdui.hydration.complete',
  HYDRATION_ERROR = 'sdui.hydration.error',
  
  // User interactions
  USER_INTERACTION = 'sdui.user.interaction',
  
  // Agent chat
  CHAT_REQUEST_START = 'chat.request.start',
  CHAT_REQUEST_COMPLETE = 'chat.request.complete',
  CHAT_REQUEST_ERROR = 'chat.request.error',
  
  // Workflow state
  WORKFLOW_STATE_LOAD = 'workflow.state.load',
  WORKFLOW_STATE_SAVE = 'workflow.state.save',
  WORKFLOW_STAGE_TRANSITION = 'workflow.stage.transition',
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

    return {
      avgRenderTime,
      avgHydrationTime,
      errorRate,
      totalEvents: this.events.length,
    };
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

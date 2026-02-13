/**
 * Agent Telemetry Service
 *
 * CONSOLIDATION: Comprehensive telemetry and tracing for all agent executions
 *
 * Provides detailed observability into agent performance, behavior, and reliability
 * with structured logging, metrics collection, and distributed tracing.
 */

import {
  AgentRequest,
  AgentResponse,
  AgentHealthStatus,
} from "../core/IAgent";
import { AgentType } from "../../agent-types";
import { logger } from "../../../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { metrics, Counter, Histogram } from "@opentelemetry/api";

// ============================================================================
// Telemetry Types
// ============================================================================

export interface AgentTelemetryEvent {
  /** Unique event ID */
  eventId: string;
  /** Event timestamp */
  timestamp: Date;
  /** Event type */
  type: TelemetryEventType;
  /** Agent type */
  agentType: AgentType;
  /** Session ID */
  sessionId?: string;
  /** User ID */
  userId?: string;
  /** Organization ID */
  organizationId?: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Event severity */
  severity: "debug" | "info" | "warn" | "error";
  /** Event tags */
  tags?: string[];
  /** Event context */
  context?: TelemetryContext;
}

export interface AgentTelemetrySummary {
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Average execution time */
  avgExecutionTime: number;
  /** Success rate */
  successRate: number;
  /** Error rate */
  errorRate: number;
  /** Top error types */
  topErrorTypes: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
  /** Performance metrics */
  performance: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  /** Resource usage averages */
  avgResourceUsage: AgentResourceUsage;
  /** Agent health summary */
  healthSummary: Record<AgentType, AgentHealthStatus>;
  /** Total cost */
  totalCost: number;
  /** Average cost per execution */
  avgCost: number;
}

export interface AgentMetrics {
  executions: number;
  successRate: number;
  avgExecutionTime: number;
  avgCost: number;
  throughput: number; // executions per hour
}

export interface ValueLifecycleMetrics {
  agentMetrics: Record<AgentType, AgentMetrics>;
  totalExecutions: number;
  overallSuccessRate: number;
  totalValueGenerated: number;
  avgValuePerExecution: number;
  totalCost: number;
  roi: number;
}

export interface PerformanceAlert {
  type: "error_rate" | "execution_time" | "p99_latency" | "memory_usage" | "token_usage";
  severity: "info" | "warning" | "critical";
  message: string;
  threshold: number;
  currentValue: number;
  recommendation: string;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  score: number;
  activeTraces: number;
  totalExecutions: number;
  errorRate: number;
  avgResponseTime: number;
  alerts: PerformanceAlert[];
  lastUpdated: Date;
}

export type TelemetryEventType =
  | "agent_execution_start"
  | "agent_execution_complete"
  | "agent_execution_error"
  | "agent_execution_timeout"
  | "agent_cache_hit"
  | "agent_cache_miss"
  | "agent_circuit_breaker_trip"
  | "agent_circuit_breaker_reset"
  | "agent_retry_attempt"
  | "agent_health_check"
  | "agent_configuration_change"
  | "agent_capability_discovery"
  | "agent_performance_anomaly"
  | "agent_security_violation";

export interface TelemetryContext {
  /** Trace ID for distributed tracing */
  traceId?: string;
  /** Span ID for current operation */
  spanId?: string;
  /** Parent span ID */
  parentSpanId?: string;
  /** Request source */
  source?: string;
  /** Request version */
  version?: string;
  /** Environment */
  environment?: string;
}

export interface AgentExecutionTrace {
  /** Trace ID */
  traceId: string;
  /** Agent type */
  agentType: AgentType;
  /** Session ID */
  sessionId?: string;
  /** User ID */
  userId?: string;
  /** Organization ID */
  organizationId?: string;
  /** Execution start time */
  startTime: Date;
  /** Execution end time */
  endTime?: Date;
  /** Total duration */
  duration?: number;
  /** Execution status */
  status: "running" | "completed" | "failed" | "timeout";
  /** Request details */
  request: AgentRequest;
  /** Response details */
  response?: AgentResponse;
  /** Error details */
  error?: AgentExecutionError;
  /** Execution steps */
  steps: AgentExecutionStep[];
  /** Performance metrics */
  metrics: AgentExecutionMetrics;
  /** Resource usage */
  resourceUsage: AgentResourceUsage;
  /** Trace events */
  events: AgentTelemetryEvent[];
  /** Additional data */
  data?: Record<string, unknown>;
}

export interface AgentExecutionStep {
  /** Step ID */
  stepId: string;
  /** Step name */
  name: string;
  /** Step type */
  type: "validation" | "processing" | "caching" | "retry" | "circuit_breaker";
  /** Step start time */
  startTime: Date;
  /** Step end time */
  endTime?: Date;
  /** Step duration */
  duration?: number;
  /** Step status */
  status: "pending" | "running" | "completed" | "failed";
  /** Step input */
  input?: unknown;
  /** Step output */
  output?: unknown;
  /** Step error */
  error?: string;
  /** Step metadata */
  metadata?: Record<string, unknown>;
}

export interface AgentExecutionMetrics {
  /** Token usage */
  tokenUsage: {
    input: number;
    output: number;
    total: number;
    cost: number;
  };
  /** Cache performance */
  cachePerformance: {
    hits: number;
    misses: number;
    hitRate: number;
  };
  /** Retry statistics */
  retryStats: {
    attempts: number;
    maxRetries: number;
    retryReasons: string[];
  };
  /** Circuit breaker state */
  circuitBreakerState: {
    isTripped: boolean;
    failureCount: number;
    lastFailureTime?: Date;
  };
  /** Performance percentiles */
  performance: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export interface AgentResourceUsage {
  /** Memory usage in MB */
  memoryUsage: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Network I/O in bytes */
  networkIO: {
    bytesIn: number;
    bytesOut: number;
  };
  /** Disk I/O in bytes */
  diskIO: {
    bytesRead: number;
    bytesWritten: number;
  };
}

export interface AgentExecutionError {
  /** Error type */
  type: string;
  /** Error message */
  message: string;
  /** Error stack trace */
  stack?: string;
  /** Error code */
  code?: string;
  /** Whether error is retryable */
  retryable: boolean;
  /** Error context */
  context?: Record<string, unknown>;
}

// ============================================================================
// Telemetry Service Implementation
// ============================================================================

/**
 * Agent Telemetry Service
 *
 * Provides comprehensive telemetry collection and analysis for all agent executions
 */
export class AgentTelemetryService {
  private static instance: AgentTelemetryService;
  private activeTraces: Map<string, AgentExecutionTrace> = new Map();
  private completedTraces: AgentExecutionTrace[] = [];
  private telemetryEvents: AgentTelemetryEvent[] = [];
  private maxStoredTraces: number = 1000;
  private maxStoredEvents: number = 10000;
  private meter = metrics.getMeter("agent-fabric");
  private executionCounter: Counter = this.meter.createCounter("agent_fabric_executions_total", {
    description: "Total number of agent execution attempts",
    unit: "{execution}",
  });
  private executionSuccessCounter: Counter = this.meter.createCounter(
    "agent_fabric_execution_success_total",
    {
      description: "Total number of successful agent executions",
      unit: "{execution}",
    }
  );
  private executionFailureCounter: Counter = this.meter.createCounter(
    "agent_fabric_execution_failure_total",
    {
      description: "Total number of failed agent executions",
      unit: "{execution}",
    }
  );
  private executionCompletedCounter: Counter = this.meter.createCounter(
    "agent_fabric_executions_completed_total",
    {
      description: "Total number of completed agent executions (success + failure)",
      unit: "{execution}",
    }
  );
  private executionDurationHistogram: Histogram = this.meter.createHistogram(
    "agent_fabric_execution_duration_seconds",
    {
      description: "Agent execution duration in seconds",
      unit: "s",
    }
  );
  private tokenUsageCounter: Counter = this.meter.createCounter("agent_fabric_token_usage_total", {
    description: "Total tokens consumed by agent executions",
    unit: "{token}",
  });
  private costCounter: Counter = this.meter.createCounter("agent_fabric_cost_usd_total", {
    description: "Total USD cost of agent executions",
    unit: "USD",
  });
  private securityEventCounter: Counter = this.meter.createCounter(
    "agent_fabric_security_events_total",
    {
      description: "Total security-related events emitted by agent fabric",
      unit: "{event}",
    }
  );
  private valueGeneratedCounter: Counter = this.meter.createCounter(
    "agent_fabric_value_generated_usd_total",
    {
      description: "Total business value generated by agent executions in USD",
      unit: "USD",
    }
  );

  private constructor() {
    logger.info("AgentTelemetryService initialized");
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentTelemetryService {
    if (!AgentTelemetryService.instance) {
      AgentTelemetryService.instance = new AgentTelemetryService();
    }
    return AgentTelemetryService.instance;
  }

  /**
   * Start tracing an agent execution
   */
  startExecutionTrace(request: AgentRequest): string {
    const traceId = uuidv4();
    const trace: AgentExecutionTrace = {
      traceId,
      agentType: request.agentType,
      sessionId: request.sessionId,
      userId: request.userId,
      organizationId: request.organizationId,
      startTime: new Date(),
      status: "running",
      request,
      steps: [],
      metrics: {
        tokenUsage: { input: 0, output: 0, total: 0, cost: 0 },
        cachePerformance: { hits: 0, misses: 0, hitRate: 0 },
        retryStats: { attempts: 0, maxRetries: 0, retryReasons: [] },
        circuitBreakerState: { isTripped: false, failureCount: 0 },
        performance: { p50: 0, p90: 0, p95: 0, p99: 0 },
      },
      resourceUsage: {
        memoryUsage: 0,
        cpuUsage: 0,
        networkIO: { bytesIn: 0, bytesOut: 0 },
        diskIO: { bytesRead: 0, bytesWritten: 0 },
      },
      events: [],
    };

    this.activeTraces.set(traceId, trace);

    this.executionCounter.add(1, {
      agent_type: request.agentType,
      organization_id: request.organizationId || "unknown",
    });

    // Record start event
    this.recordTelemetryEvent({
      type: "agent_execution_start",
      agentType: request.agentType,
      sessionId: request.sessionId,
      userId: request.userId,
      organizationId: request.organizationId,
      data: {
        traceId,
        query: request.query,
        parameters: request.parameters,
      },
      severity: "info",
      context: {
        traceId,
        spanId: traceId,
        source: "agent-telemetry",
      },
    });

    logger.debug("Agent execution trace started", {
      traceId,
      agentType: request.agentType,
      sessionId: request.sessionId,
    });

    return traceId;
  }

  /**
   * Complete an execution trace
   */
  completeExecutionTrace(
    traceId: string,
    response: AgentResponse,
    resourceUsage?: Partial<AgentResourceUsage>
  ): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn("Attempted to complete non-existent trace", { traceId });
      return;
    }

    trace.endTime = new Date();
    trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    trace.status = "completed";
    trace.response = response;

    // Update resource usage if provided
    if (resourceUsage) {
      trace.resourceUsage = { ...trace.resourceUsage, ...resourceUsage };
    }

    // Update metrics from response
    if (response.metadata) {
      trace.metrics.tokenUsage = response.metadata.tokenUsage;
      trace.metrics.retryStats.attempts = response.metadata.retryCount;

      this.tokenUsageCounter.add(response.metadata.tokenUsage.total, {
        agent_type: trace.agentType,
      });
      this.costCounter.add(response.metadata.tokenUsage.cost, {
        agent_type: trace.agentType,
      });
    }

    this.executionDurationHistogram.record((trace.duration || 0) / 1000, {
      agent_type: trace.agentType,
      status: response.success ? "success" : "failure",
    });
    this.executionCompletedCounter.add(1, { agent_type: trace.agentType });
    if (response.success) {
      this.executionSuccessCounter.add(1, { agent_type: trace.agentType });
    } else {
      this.executionFailureCounter.add(1, { agent_type: trace.agentType });
    }

    const generatedValue = this.extractGeneratedValue(response.data);
    if (generatedValue > 0) {
      this.valueGeneratedCounter.add(generatedValue, {
        agent_type: trace.agentType,
      });
    }

    // Move to completed traces
    this.activeTraces.delete(traceId);
    this.completedTraces.push(trace);

    // Cleanup old traces
    this.cleanupOldTraces();

    // Record completion event
    this.recordTelemetryEvent({
      type: "agent_execution_complete",
      agentType: trace.agentType,
      sessionId: trace.sessionId,
      userId: trace.userId,
      organizationId: trace.organizationId,
      data: {
        traceId,
        duration: trace.duration,
        confidence: response.confidence,
        success: response.success,
        tokenUsage: trace.metrics.tokenUsage,
      },
      severity: "info",
      context: {
        traceId,
        spanId: traceId,
        source: "agent-telemetry",
      },
    });

    logger.info("Agent execution trace completed", {
      traceId,
      agentType: trace.agentType,
      duration: trace.duration,
      success: response.success,
    });
  }

  /**
   * Record an execution error
   */
  recordExecutionError(
    traceId: string,
    error: Error | AgentExecutionError,
    resourceUsage?: Partial<AgentResourceUsage>
  ): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn("Attempted to record error for non-existent trace", { traceId });
      return;
    }

    const executionError: AgentExecutionError =
      error instanceof Error
        ? {
            type: error.constructor.name,
            message: error.message,
            stack: error.stack,
            retryable: false,
          }
        : error;

    trace.endTime = new Date();
    trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    trace.status = "failed";
    trace.error = executionError;

    // Update resource usage if provided
    if (resourceUsage) {
      trace.resourceUsage = { ...trace.resourceUsage, ...resourceUsage };
    }

    // Move to completed traces
    this.executionDurationHistogram.record((trace.duration || 0) / 1000, {
      agent_type: trace.agentType,
      status: "error",
    });
    this.executionCompletedCounter.add(1, { agent_type: trace.agentType });
    this.executionFailureCounter.add(1, { agent_type: trace.agentType });

    this.activeTraces.delete(traceId);
    this.completedTraces.push(trace);

    // Cleanup old traces
    this.cleanupOldTraces();

    // Record error event
    this.recordTelemetryEvent({
      type: "agent_execution_error",
      agentType: trace.agentType,
      sessionId: trace.sessionId,
      userId: trace.userId,
      organizationId: trace.organizationId,
      data: {
        traceId,
        error: executionError,
        duration: trace.duration,
      },
      severity: "error",
      context: {
        traceId,
        spanId: traceId,
        source: "agent-telemetry",
      },
    });

    logger.error("Agent execution trace failed", undefined, {
      traceId,
      agentType: trace.agentType,
      error: executionError.message,
      duration: trace.duration,
    });
  }

  /**
   * Add an execution step
   */
  addExecutionStep(traceId: string, step: Omit<AgentExecutionStep, "stepId" | "startTime">): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn("Attempted to add step to non-existent trace", { traceId });
      return;
    }

    const executionStep: AgentExecutionStep = {
      stepId: uuidv4(),
      startTime: new Date(),
      ...step,
    };

    trace.steps.push(executionStep);

    logger.debug("Agent execution step added", {
      traceId,
      stepId: executionStep.stepId,
      stepName: executionStep.name,
      stepType: executionStep.type,
    });
  }

  /**
   * Complete an execution step
   */
  completeExecutionStep(traceId: string, stepId: string, output?: unknown, error?: string): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      logger.warn("Attempted to complete step for non-existent trace", { traceId });
      return;
    }

    const step = trace.steps.find((s) => s.stepId === stepId);
    if (!step) {
      logger.warn("Attempted to complete non-existent step", { traceId, stepId });
      return;
    }

    step.endTime = new Date();
    step.duration = step.endTime.getTime() - step.startTime.getTime();
    step.status = error ? "failed" : "completed";
    step.output = output;
    step.error = error;

    logger.debug("Agent execution step completed", {
      traceId,
      stepId,
      duration: step.duration,
      status: step.status,
    });
  }

  /**
   * Record a telemetry event
   */
  recordTelemetryEvent(event: Omit<AgentTelemetryEvent, "eventId" | "timestamp">): void {
    const telemetryEvent: AgentTelemetryEvent = {
      eventId: uuidv4(),
      timestamp: new Date(),
      ...event,
    };

    this.telemetryEvents.push(telemetryEvent);

    if (telemetryEvent.type === "agent_security_violation") {
      this.securityEventCounter.add(1, {
        agent_type: telemetryEvent.agentType,
        severity: telemetryEvent.severity,
      });
    }

    // Cleanup old events
    if (this.telemetryEvents.length > this.maxStoredEvents) {
      this.telemetryEvents = this.telemetryEvents.slice(-this.maxStoredEvents);
    }

    // Log event based on severity
    const logMethod = {
      debug: logger.debug,
      info: logger.info,
      warn: logger.warn,
      error: logger.error,
    }[event.severity];

    logMethod("Agent telemetry event", undefined, {
      eventId: telemetryEvent.eventId,
      type: event.type,
      agentType: event.agentType,
      data: event.data,
    });
  }

  /**
   * Get execution trace by ID
   */
  getExecutionTrace(traceId: string): AgentExecutionTrace | undefined {
    return (
      this.activeTraces.get(traceId) || this.completedTraces.find((t) => t.traceId === traceId)
    );
  }

  /**
   * Get active traces for an agent type
   */
  getActiveTraces(agentType?: AgentType): AgentExecutionTrace[] {
    const traces = Array.from(this.activeTraces.values());
    return agentType ? traces.filter((t) => t.agentType === agentType) : traces;
  }

  /**
   * Get completed traces for an agent type
   */
  getCompletedTraces(agentType?: AgentType, limit?: number): AgentExecutionTrace[] {
    let traces = this.completedTraces;
    if (agentType) {
      traces = traces.filter((t) => t.agentType === agentType);
    }
    traces = traces.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
    return limit ? traces.slice(0, limit) : traces;
  }

  /**
   * Get telemetry events
   */
  getTelemetryEvents(
    filters?: {
      agentType?: AgentType;
      eventType?: TelemetryEventType;
      severity?: string;
      startTime?: Date;
      endTime?: Date;
    },
    limit?: number
  ): AgentTelemetryEvent[] {
    let events = this.telemetryEvents;

    if (filters) {
      if (filters.agentType) {
        events = events.filter((e) => e.agentType === filters.agentType);
      }
      if (filters.eventType) {
        events = events.filter((e) => e.type === filters.eventType);
      }
      if (filters.severity) {
        events = events.filter((e) => e.severity === filters.severity);
      }
      if (filters.startTime) {
        events = events.filter((e) => e.timestamp >= filters.startTime!);
      }
      if (filters.endTime) {
        events = events.filter((e) => e.timestamp <= filters.endTime!);
      }
    }

    events = events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? events.slice(0, limit) : events;
  }

  /**
   * Get telemetry summary
   */
  getTelemetrySummary(
    agentType?: AgentType,
    timeWindow?: { start: Date; end: Date }
  ): AgentTelemetrySummary {
    let traces = this.completedTraces;

    if (agentType) {
      traces = traces.filter((t) => t.agentType === agentType);
    }

    if (timeWindow) {
      traces = traces.filter(
        (t) => t.startTime >= timeWindow.start && t.startTime <= timeWindow.end
      );
    }

    const totalExecutions = traces.length;
    const successfulExecutions = traces.filter((t) => t.status === "completed").length;
    const failedExecutions = traces.filter((t) => t.status === "failed").length;

    // Calculate performance metrics
    const executionTimes = traces
      .map((t) => (t.endTime ? t.endTime.getTime() - t.startTime.getTime() : 0))
      .filter((t) => t > 0);

    const avgExecutionTime =
      executionTimes.length > 0
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
        : 0;

    // Calculate percentiles
    const sortedTimes = executionTimes.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p90 = sortedTimes[Math.floor(sortedTimes.length * 0.9)] || 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;

    // Calculate error rate
    const errorRate = totalExecutions > 0 ? (failedExecutions / totalExecutions) * 100 : 0;

    // Calculate error types
    const errorTypes = traces
      .filter((t) => t.error)
      .reduce(
        (acc, t) => {
          const type = t.error!.type;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    const topErrorTypes = Object.entries(errorTypes)
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalExecutions > 0 ? (count / totalExecutions) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate resource usage
    const avgResourceUsage = this.calculateAverageResourceUsage(traces);

    // Calculate cost
    const totalCost = traces.reduce((sum, t) => {
      const cost = t.metrics?.tokenUsage?.cost || 0;
      return sum + cost;
    }, 0);

    const avgCost = totalExecutions > 0 ? totalCost / totalExecutions : 0;

    // Calculate health summary - placeholder for now
    const healthSummary = {} as Record<AgentType, AgentHealthStatus>;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      errorRate,
      avgExecutionTime,
      performance: { p50, p90, p95, p99 },
      topErrorTypes,
      avgResourceUsage,
      healthSummary,
      totalCost,
      avgCost,
    };
  }

  /**
   * Get business metrics for value lifecycle
   */
  getValueLifecycleMetrics(timeWindow?: { start: Date; end: Date }): ValueLifecycleMetrics {
    const traces = timeWindow
      ? this.completedTraces.filter(
          (t) => t.startTime >= timeWindow.start && t.startTime <= timeWindow.end
        )
      : this.completedTraces;

    const agentMetrics: Record<AgentType, AgentMetrics> = {} as any;

    // Calculate metrics per agent type
    const agentTypes: AgentType[] = [
      "opportunity",
      "target",
      "expansion",
      "integrity",
      "realization",
    ];

    for (const agentType of agentTypes) {
      const summary = this.getTelemetrySummary(agentType, timeWindow);

      agentMetrics[agentType] = {
        executions: summary.totalExecutions,
        successRate: summary.successRate,
        avgExecutionTime: summary.avgExecutionTime,
        avgCost: summary.avgCost,
        throughput:
          summary.totalExecutions /
          (timeWindow
            ? (timeWindow.end.getTime() - timeWindow.start.getTime()) / (1000 * 60 * 60)
            : 1),
      };
    }

    // Calculate overall lifecycle metrics
    const totalValue = traces.reduce((sum, t) => {
      const value = (t.data?.value as number) || 0;
      return sum + value;
    }, 0);

    const avgValuePerExecution = traces.length > 0 ? totalValue / traces.length : 0;

    const totalCost = traces.reduce((sum, t) => {
      const cost = t.metrics?.tokenUsage?.cost || 0;
      return sum + cost;
    }, 0);

    return {
      agentMetrics,
      totalExecutions: traces.length,
      overallSuccessRate: this.getTelemetrySummary(undefined, timeWindow).successRate,
      totalValueGenerated: totalValue,
      avgValuePerExecution,
      totalCost,
      roi: totalCost > 0 ? (totalValue / totalCost) * 100 : 0,
    };
  }

  /**
   * Check performance thresholds and trigger alerts
   */
  checkPerformanceThresholds(): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];
    const summary = this.getTelemetrySummary();

    // Check error rate threshold
    if (summary.errorRate > 10) {
      alerts.push({
        type: "error_rate",
        severity: "critical",
        message: `High error rate detected: ${summary.errorRate.toFixed(2)}%`,
        threshold: 10,
        currentValue: summary.errorRate,
        recommendation: "Check agent health and system resources",
      });
    }

    // Check average execution time
    if (summary.avgExecutionTime > 10000) {
      // 10 seconds
      alerts.push({
        type: "execution_time",
        severity: "warning",
        message: `High average execution time: ${summary.avgExecutionTime.toFixed(0)}ms`,
        threshold: 10000,
        currentValue: summary.avgExecutionTime,
        recommendation: "Optimize agent logic or increase resources",
      });
    }

    // Check P99 latency
    if (summary.performance.p99 > 30000) {
      // 30 seconds
      alerts.push({
        type: "p99_latency",
        severity: "warning",
        message: `High P99 latency: ${summary.performance.p99.toFixed(0)}ms`,
        threshold: 30000,
        currentValue: summary.performance.p99,
        recommendation: "Investigate performance bottlenecks",
      });
    }

    return alerts;
  }

  /**
   * Get real-time system health status
   */
  getSystemHealth(): SystemHealth {
    const alerts = this.checkPerformanceThresholds();
    const summary = this.getTelemetrySummary();

    const healthScore = Math.max(0, 100 - alerts.length * 20); // Deduct 20 points per alert

    const status = healthScore >= 80 ? "healthy" : healthScore >= 60 ? "degraded" : "unhealthy";

    return {
      status,
      score: healthScore,
      activeTraces: this.activeTraces.size,
      totalExecutions: summary.totalExecutions,
      errorRate: summary.errorRate,
      avgResponseTime: summary.avgExecutionTime,
      alerts: alerts,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get service statistics
   */
  getStatistics(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgExecutionTime: number;
    successRate: number;
    errorRate: number;
    topErrorTypes: Array<{ type: string; count: number; percentage: number }>;
    performance: any;
    avgResourceUsage: any;
  } {
    const traces = [...this.completedTraces];
    const totalExecutions = traces.length;
    const successfulExecutions = traces.filter((t) => t.status === "completed").length;
    const failedExecutions = traces.filter((t) => t.status === "failed").length;
    const successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0;
    const errorRate = totalExecutions > 0 ? failedExecutions / totalExecutions : 0;

    const durations = traces
      .filter((t) => t.duration !== undefined)
      .map((t) => t.duration!)
      .sort((a, b) => a - b);

    const avgExecutionTime =
      durations.length > 0 ? durations.reduce((sum, d) => sum + d, 0) / durations.length : 0;

    const performance = this.calculatePercentiles(durations);

    const errorTypes = traces
      .filter((t) => t.error)
      .reduce(
        (acc, t) => {
          const type = t.error!.type;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    const topErrorTypes = Object.entries(errorTypes)
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalExecutions > 0 ? (count / totalExecutions) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const avgResourceUsage = this.calculateAverageResourceUsage(traces);

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      avgExecutionTime,
      successRate,
      errorRate,
      topErrorTypes,
      performance,
      avgResourceUsage,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Cleanup old traces
   */
  private cleanupOldTraces(): void {
    if (this.completedTraces.length > this.maxStoredTraces) {
      const excess = this.completedTraces.length - this.maxStoredTraces;
      this.completedTraces.splice(0, excess);
    }
  }

  /**
   * Calculate percentiles
   */
  private calculatePercentiles(values: number[]): {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  } {
    if (values.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const getPercentile = (p: number): number => {
      const index = Math.ceil((p / 100) * values.length) - 1;
      return values[Math.max(0, Math.min(index, values.length - 1))]!;
    };

    return {
      p50: getPercentile(50),
      p90: getPercentile(90),
      p95: getPercentile(95),
      p99: getPercentile(99),
    };
  }

  /**
   * Calculate average resource usage
   */
  private calculateAverageResourceUsage(traces: AgentExecutionTrace[]): AgentResourceUsage {
    if (traces.length === 0) {
      return {
        memoryUsage: 0,
        cpuUsage: 0,
        networkIO: { bytesIn: 0, bytesOut: 0 },
        diskIO: { bytesRead: 0, bytesWritten: 0 },
      };
    }

    const total = traces.reduce(
      (acc, trace) => ({
        memoryUsage: acc.memoryUsage + trace.resourceUsage.memoryUsage,
        cpuUsage: acc.cpuUsage + trace.resourceUsage.cpuUsage,
        networkIO: {
          bytesIn: acc.networkIO.bytesIn + trace.resourceUsage.networkIO.bytesIn,
          bytesOut: acc.networkIO.bytesOut + trace.resourceUsage.networkIO.bytesOut,
        },
        diskIO: {
          bytesRead: acc.diskIO.bytesRead + trace.resourceUsage.diskIO.bytesRead,
          bytesWritten: acc.diskIO.bytesWritten + trace.resourceUsage.diskIO.bytesWritten,
        },
      }),
      {
        memoryUsage: 0,
        cpuUsage: 0,
        networkIO: { bytesIn: 0, bytesOut: 0 },
        diskIO: { bytesRead: 0, bytesWritten: 0 },
      }
    );

    const count = traces.length;
    return {
      memoryUsage: total.memoryUsage / count,
      cpuUsage: total.cpuUsage / count,
      networkIO: {
        bytesIn: total.networkIO.bytesIn / count,
        bytesOut: total.networkIO.bytesOut / count,
      },
      diskIO: {
        bytesRead: total.diskIO.bytesRead / count,
        bytesWritten: total.diskIO.bytesWritten / count,
      },
    };
  }

  private extractGeneratedValue(data: unknown): number {
    if (!data || typeof data !== "object") {
      return 0;
    }

    const candidates = ["valueGenerated", "value", "totalValue", "usdValue"];

    for (const key of candidates) {
      const value = (data as Record<string, unknown>)[key];
      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        return value;
      }
    }

    return 0;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const agentTelemetryService = AgentTelemetryService.getInstance();

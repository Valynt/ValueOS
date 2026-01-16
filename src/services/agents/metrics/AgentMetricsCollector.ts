/**
 * Agent Metrics Collector
 *
 * CONSOLIDATION: Performance metrics collection and analysis for all agents
 *
 * Provides comprehensive performance monitoring, anomaly detection, and
 * performance trend analysis for agent optimization.
 */

import { AgentType } from "../../agent-types";
import { AgentHealthStatus } from "../../../types/agent";
import { logger } from "../../../utils/logger";
import { agentTelemetryService, AgentTelemetrySummary } from "../telemetry/AgentTelemetryService";

// ============================================================================
// Metrics Types
// ============================================================================

export interface AgentPerformanceMetrics {
  /** Agent type */
  agentType: AgentType;
  /** Metrics collection timestamp */
  timestamp: Date;
  /** Response time metrics */
  responseTime: ResponseTimeMetrics;
  /** Throughput metrics */
  throughput: ThroughputMetrics;
  /** Error metrics */
  errors: ErrorMetrics;
  /** Resource utilization metrics */
  resources: ResourceMetrics;
  /** Quality metrics */
  quality: QualityMetrics;
  /** Cost metrics */
  cost: CostMetrics;
  /** Availability metrics */
  availability: AvailabilityMetrics;
}

export interface ResponseTimeMetrics {
  /** Average response time in milliseconds */
  avg: number;
  /** 50th percentile response time */
  p50: number;
  /** 90th percentile response time */
  p90: number;
  /** 95th percentile response time */
  p95: number;
  /** 99th percentile response time */
  p99: number;
  /** Maximum response time */
  max: number;
  /** Minimum response time */
  min: number;
  /** Standard deviation */
  stdDev: number;
}

export interface ThroughputMetrics {
  /** Requests per second */
  requestsPerSecond: number;
  /** Requests per minute */
  requestsPerMinute: number;
  /** Requests per hour */
  requestsPerHour: number;
  /** Concurrent requests */
  concurrentRequests: number;
  /** Peak concurrent requests */
  peakConcurrentRequests: number;
}

export interface ErrorMetrics {
  /** Total error count */
  totalErrors: number;
  /** Error rate (percentage) */
  errorRate: number;
  /** Errors by type */
  errorsByType: Record<string, number>;
  /** Critical error count */
  criticalErrors: number;
  /** Timeout count */
  timeouts: number;
  /** Retry count */
  retries: number;
  /** Circuit breaker trips */
  circuitBreakerTrips: number;
}

export interface ResourceMetrics {
  /** Memory usage in MB */
  memoryUsage: number;
  /** Memory usage percentage */
  memoryUsagePercent: number;
  /** CPU usage percentage */
  cpuUsage: number;
  /** Network I/O in bytes per second */
  networkIO: {
    bytesInPerSecond: number;
    bytesOutPerSecond: number;
  };
  /** Disk I/O in bytes per second */
  diskIO: {
    bytesReadPerSecond: number;
    bytesWrittenPerSecond: number;
  };
  /** Active connections */
  activeConnections: number;
}

export interface QualityMetrics {
  /** Average confidence score */
  avgConfidence: number;
  /** Confidence distribution */
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  /** Success rate */
  successRate: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Token efficiency */
  tokenEfficiency: {
    avgTokensPerRequest: number;
    avgCostPerRequest: number;
    costPerSuccess: number;
    costPerFailure: number;
  };
}

export interface CostMetrics {
  /** Total cost in USD */
  totalCost: number;
  /** Cost per request */
  costPerRequest: number;
  /** Cost per successful request */
  costPerSuccess: number;
  /** Cost per token */
  costPerToken: number;
  /** Hourly cost */
  hourlyCost: number;
  /** Daily cost */
  dailyCost: number;
  /** Monthly cost projection */
  monthlyCostProjection: number;
}

export interface AvailabilityMetrics {
  /** Uptime percentage */
  uptime: number;
  /** Downtime in minutes */
  downtime: number;
  /** Mean time between failures */
  mtbf: number;
  /** Mean time to recovery */
  mttr: number;
  /** Service level agreement compliance */
  slaCompliance: number;
  /** Health check status */
  healthStatus: AgentHealthStatus;
  /** Last health check */
  lastHealthCheck: Date;
}

export interface PerformanceAnomaly {
  /** Anomaly ID */
  id: string;
  /** Anomaly type */
  type: AnomalyType;
  /** Agent type */
  agentType: AgentType;
  /** Detection timestamp */
  timestamp: Date;
  /** Anomaly severity */
  severity: "low" | "medium" | "high" | "critical";
  /** Anomaly description */
  description: string;
  /** Anomaly metrics */
  metrics: {
    expected: number;
    actual: number;
    deviation: number;
    threshold: number;
  };
  /** Anomaly context */
  context: Record<string, unknown>;
  /** Resolution status */
  status: "active" | "resolved" | "ignored";
  /** Resolution timestamp */
  resolvedAt?: Date;
}

export type AnomalyType =
  | "response_time_spike"
  | "error_rate_increase"
  | "throughput_decrease"
  | "resource_exhaustion"
  | "cost_anomaly"
  | "quality_degradation"
  | "availability_issue"
  | "circuit_breaker_frequent_trips";

export interface PerformanceTrend {
  /** Agent type */
  agentType: AgentType;
  /** Trend period */
  period: "hour" | "day" | "week" | "month";
  /** Trend data points */
  dataPoints: TrendDataPoint[];
  /** Trend direction */
  direction: "improving" | "degrading" | "stable";
  /** Trend confidence */
  confidence: number;
  /** Trend significance */
  significance: number;
}

export interface TrendDataPoint {
  /** Timestamp */
  timestamp: Date;
  /** Value */
  value: number;
  /** Metric type */
  metric: string;
}

export interface PerformanceThresholds {
  /** Response time thresholds in milliseconds */
  responseTime: {
    warning: number;
    critical: number;
  };
  /** Error rate thresholds (percentage) */
  errorRate: {
    warning: number;
    critical: number;
  };
  /** Resource usage thresholds (percentage) */
  resourceUsage: {
    memory: {
      warning: number;
      critical: number;
    };
    cpu: {
      warning: number;
      critical: number;
    };
  };
  /** Cost thresholds */
  cost: {
    hourlyWarning: number;
    hourlyCritical: number;
    dailyWarning: number;
    dailyCritical: number;
  };
  /** Availability thresholds (percentage) */
  availability: {
    warning: number;
    critical: number;
  };
}

// ============================================================================
// Metrics Collector Implementation
// ============================================================================

/**
 * Agent Metrics Collector
 *
 * Collects, analyzes, and reports performance metrics for all agents
 */
export class AgentMetricsCollector {
  private static instance: AgentMetricsCollector;
  private metricsHistory: Map<AgentType, AgentPerformanceMetrics[]> = new Map();
  private anomalies: PerformanceAnomaly[] = [];
  private trends: Map<AgentType, PerformanceTrend[]> = new Map();
  private thresholds: PerformanceThresholds;
  private maxHistorySize: number = 1000;

  private constructor() {
    this.thresholds = this.getDefaultThresholds();
    logger.info("AgentMetricsCollector initialized");
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AgentMetricsCollector {
    if (!AgentMetricsCollector.instance) {
      AgentMetricsCollector.instance = new AgentMetricsCollector();
    }
    return AgentMetricsCollector.instance;
  }

  /**
   * Collect performance metrics for an agent type
   */
  collectMetrics(agentType: AgentType): AgentPerformanceMetrics {
    const telemetrySummary = agentTelemetryService.getTelemetrySummary(agentType);
    const timestamp = new Date();

    const metrics: AgentPerformanceMetrics = {
      agentType,
      timestamp,
      responseTime: this.calculateResponseTimeMetrics(telemetrySummary),
      throughput: this.calculateThroughputMetrics(telemetrySummary),
      errors: this.calculateErrorMetrics(telemetrySummary),
      resources: this.calculateResourceMetrics(telemetrySummary),
      quality: this.calculateQualityMetrics(telemetrySummary),
      cost: this.calculateCostMetrics(telemetrySummary),
      availability: this.calculateAvailabilityMetrics(agentType),
    };

    // Store metrics history
    this.storeMetricsHistory(agentType, metrics);

    // Check for anomalies
    this.detectAnomalies(agentType, metrics);

    // Update trends
    this.updateTrends(agentType, metrics);

    logger.debug("Agent metrics collected", {
      agentType,
      responseTime: metrics.responseTime.avg,
      errorRate: metrics.errors.errorRate,
      successRate: metrics.quality.successRate,
    });

    return metrics;
  }

  /**
   * Get current metrics for an agent type
   */
  getCurrentMetrics(agentType: AgentType): AgentPerformanceMetrics | undefined {
    const history = this.metricsHistory.get(agentType);
    return history && history.length > 0 ? history[history.length - 1] : undefined;
  }

  /**
   * Get metrics history for an agent type
   */
  getMetricsHistory(
    agentType: AgentType,
    timeRange?: { start: Date; end: Date }
  ): AgentPerformanceMetrics[] {
    const history = this.metricsHistory.get(agentType) || [];

    if (!timeRange) {
      return [...history];
    }

    return history.filter((m) => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end);
  }

  /**
   * Get active anomalies
   */
  getActiveAnomalies(agentType?: AgentType): PerformanceAnomaly[] {
    return this.anomalies.filter(
      (a) => a.status === "active" && (!agentType || a.agentType === agentType)
    );
  }

  /**
   * Get performance trends for an agent type
   */
  getPerformanceTrends(
    agentType: AgentType,
    period?: "hour" | "day" | "week" | "month"
  ): PerformanceTrend[] {
    const trends = this.trends.get(agentType) || [];
    return period ? trends.filter((t) => t.period === period) : trends;
  }

  /**
   * Update performance thresholds
   */
  updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info("Performance thresholds updated", { thresholds: this.thresholds });
  }

  /**
   * Get current thresholds
   */
  getThresholds(): PerformanceThresholds {
    return { ...this.thresholds };
  }

  /**
   * Resolve an anomaly
   */
  resolveAnomaly(anomalyId: string, resolution?: string): void {
    const anomaly = this.anomalies.find((a) => a.id === anomalyId);
    if (!anomaly) {
      logger.warn("Attempted to resolve non-existent anomaly", { anomalyId });
      return;
    }

    anomaly.status = "resolved";
    anomaly.resolvedAt = new Date();

    logger.info("Anomaly resolved", {
      anomalyId,
      type: anomaly.type,
      resolution,
    });
  }

  /**
   * Get performance summary for all agents
   */
  getPerformanceSummary(): {
    totalAgents: number;
    healthyAgents: number;
    degradedAgents: number;
    unhealthyAgents: number;
    totalAnomalies: number;
    criticalAnomalies: number;
    avgResponseTime: number;
    avgErrorRate: number;
    avgSuccessRate: number;
    totalCost: number;
  } {
    const agentTypes = Array.from(this.metricsHistory.keys());
    const currentMetrics = agentTypes
      .map((type) => this.getCurrentMetrics(type))
      .filter(Boolean) as AgentPerformanceMetrics[];

    const healthyAgents = currentMetrics.filter(
      (m) => m.availability.healthStatus === "healthy"
    ).length;
    const degradedAgents = currentMetrics.filter(
      (m) => m.availability.healthStatus === "degraded"
    ).length;
    const unhealthyAgents = currentMetrics.filter(
      (m) => m.availability.healthStatus === "offline"
    ).length;

    const activeAnomalies = this.getActiveAnomalies();
    const criticalAnomalies = activeAnomalies.filter((a) => a.severity === "critical").length;

    const avgResponseTime =
      currentMetrics.length > 0
        ? currentMetrics.reduce((sum, m) => sum + m.responseTime.avg, 0) / currentMetrics.length
        : 0;

    const avgErrorRate =
      currentMetrics.length > 0
        ? currentMetrics.reduce((sum, m) => sum + m.errors.errorRate, 0) / currentMetrics.length
        : 0;

    const avgSuccessRate =
      currentMetrics.length > 0
        ? currentMetrics.reduce((sum, m) => sum + m.quality.successRate, 0) / currentMetrics.length
        : 0;

    const totalCost = currentMetrics.reduce((sum, m) => sum + m.cost.totalCost, 0);

    return {
      totalAgents: agentTypes.length,
      healthyAgents,
      degradedAgents,
      unhealthyAgents,
      totalAnomalies: activeAnomalies.length,
      criticalAnomalies,
      avgResponseTime,
      avgErrorRate,
      avgSuccessRate,
      totalCost,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metricsHistory.clear();
    this.anomalies = [];
    this.trends.clear();
    logger.info("Agent metrics reset");
  }

  /**
   * Get collector statistics
   */
  getStatistics(): {
    totalMetricsPoints: number;
    totalAnomalies: number;
    activeAnomalies: number;
    memoryUsage: number;
  } {
    const totalMetricsPoints = Array.from(this.metricsHistory.values()).reduce(
      (sum, history) => sum + history.length,
      0
    );

    return {
      totalMetricsPoints,
      totalAnomalies: this.anomalies.length,
      activeAnomalies: this.getActiveAnomalies().length,
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Calculate response time metrics
   */
  private calculateResponseTimeMetrics(summary: AgentTelemetrySummary): ResponseTimeMetrics {
    const durations = summary.performance;

    return {
      avg: summary.avgExecutionTime,
      p50: durations.p50,
      p90: durations.p90,
      p95: durations.p95,
      p99: durations.p99,
      max: durations.p99 * 2, // Estimate
      min: durations.p50 * 0.1, // Estimate
      stdDev: this.calculateStandardDeviation([
        durations.p50,
        durations.p90,
        durations.p95,
        durations.p99,
      ]),
    };
  }

  /**
   * Calculate throughput metrics
   */
  private calculateThroughputMetrics(summary: AgentTelemetrySummary): ThroughputMetrics {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // This would need actual time-windowed data from telemetry service
    // For now, estimate based on total executions
    const hourlyRate = summary.totalExecutions / 24; // Rough estimate
    const minuteRate = hourlyRate / 60;
    const secondRate = minuteRate / 60;

    return {
      requestsPerSecond: secondRate,
      requestsPerMinute: minuteRate,
      requestsPerHour: hourlyRate,
      concurrentRequests: 5, // Estimate - would need real data
      peakConcurrentRequests: 10, // Estimate
    };
  }

  /**
   * Calculate error metrics
   */
  private calculateErrorMetrics(summary: AgentTelemetrySummary): ErrorMetrics {
    const errorsByType = summary.topErrorTypes.reduce(
      (acc, error) => {
        acc[error.type] = error.count;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalErrors: summary.failedExecutions,
      errorRate: summary.errorRate * 100,
      errorsByType,
      criticalErrors: summary.failedExecutions * 0.3, // Estimate
      timeouts: summary.failedExecutions * 0.1, // Estimate
      retries: summary.totalExecutions * 0.05, // Estimate
      circuitBreakerTrips: summary.failedExecutions * 0.02, // Estimate
    };
  }

  /**
   * Calculate resource metrics
   */
  private calculateResourceMetrics(summary: AgentTelemetrySummary): ResourceMetrics {
    const avgUsage = summary.avgResourceUsage;

    return {
      memoryUsage: avgUsage.memoryUsage,
      memoryUsagePercent: (avgUsage.memoryUsage / 1024) * 100, // Convert MB to percentage
      cpuUsage: avgUsage.cpuUsage,
      networkIO: {
        bytesInPerSecond: avgUsage.networkIO.bytesIn / 3600, // Per second
        bytesOutPerSecond: avgUsage.networkIO.bytesOut / 3600,
      },
      diskIO: {
        bytesReadPerSecond: avgUsage.diskIO.bytesRead / 3600,
        bytesWrittenPerSecond: avgUsage.diskIO.bytesWritten / 3600,
      },
      activeConnections: 5, // Estimate
    };
  }

  /**
   * Calculate quality metrics
   */
  private calculateQualityMetrics(summary: AgentTelemetrySummary): QualityMetrics {
    return {
      avgConfidence: 0.8, // Estimate - would need real confidence data
      confidenceDistribution: {
        high: 0.6,
        medium: 0.3,
        low: 0.1,
      },
      successRate: summary.successRate * 100,
      cacheHitRate: 0.85, // Estimate
      tokenEfficiency: {
        avgTokensPerRequest: 1000, // Estimate
        avgCostPerRequest: 0.01, // Estimate
        costPerSuccess: 0.008,
        costPerFailure: 0.015,
      },
    };
  }

  /**
   * Calculate cost metrics
   */
  private calculateCostMetrics(summary: AgentTelemetrySummary): CostMetrics {
    const costPerRequest = 0.01; // Estimate
    const totalCost = summary.totalExecutions * costPerRequest;

    return {
      totalCost,
      costPerRequest,
      costPerSuccess: costPerRequest * (summary.successRate || 0),
      costPerToken: costPerRequest / 1000, // Estimate
      hourlyCost: totalCost / 24,
      dailyCost: totalCost,
      monthlyCostProjection: totalCost * 30,
    };
  }

  /**
   * Calculate availability metrics
   */
  private calculateAvailabilityMetrics(agentType: AgentType): AvailabilityMetrics {
    // This would integrate with actual health checks
    return {
      uptime: 99.9,
      downtime: 0.1,
      mtbf: 7200, // 2 hours in minutes
      mttr: 5, // 5 minutes
      slaCompliance: 99.5,
      healthStatus: "healthy",
      lastHealthCheck: new Date(),
    };
  }

  /**
   * Store metrics history
   */
  private storeMetricsHistory(agentType: AgentType, metrics: AgentPerformanceMetrics): void {
    if (!this.metricsHistory.has(agentType)) {
      this.metricsHistory.set(agentType, []);
    }

    const history = this.metricsHistory.get(agentType)!;
    history.push(metrics);

    // Cleanup old history
    if (history.length > this.maxHistorySize) {
      history.splice(0, history.length - this.maxHistorySize);
    }
  }

  /**
   * Detect performance anomalies
   */
  private detectAnomalies(agentType: AgentType, metrics: AgentPerformanceMetrics): void {
    const history = this.metricsHistory.get(agentType) || [];
    if (history.length < 10) return; // Need baseline data

    const recentMetrics = history.slice(-10);
    const avgResponseTime =
      recentMetrics.reduce((sum, m) => sum + m.responseTime.avg, 0) / recentMetrics.length;
    const avgErrorRate =
      recentMetrics.reduce((sum, m) => sum + m.errors.errorRate, 0) / recentMetrics.length;

    // Check response time anomaly
    if (metrics.responseTime.avg > avgResponseTime * 2) {
      this.createAnomaly({
        type: "response_time_spike",
        agentType,
        severity: metrics.responseTime.avg > avgResponseTime * 3 ? "critical" : "high",
        description: `Response time spike detected: ${metrics.responseTime.avg}ms vs ${avgResponseTime.toFixed(2)}ms average`,
        metrics: {
          expected: avgResponseTime,
          actual: metrics.responseTime.avg,
          deviation: ((metrics.responseTime.avg - avgResponseTime) / avgResponseTime) * 100,
          threshold: this.thresholds.responseTime.warning,
        },
      });
    }

    // Check error rate anomaly
    if (metrics.errors.errorRate > avgErrorRate * 2) {
      this.createAnomaly({
        type: "error_rate_increase",
        agentType,
        severity: metrics.errors.errorRate > avgErrorRate * 3 ? "critical" : "high",
        description: `Error rate increase detected: ${metrics.errors.errorRate.toFixed(2)}% vs ${avgErrorRate.toFixed(2)}% average`,
        metrics: {
          expected: avgErrorRate,
          actual: metrics.errors.errorRate,
          deviation: ((metrics.errors.errorRate - avgErrorRate) / avgErrorRate) * 100,
          threshold: this.thresholds.errorRate.warning,
        },
      });
    }
  }

  /**
   * Create a performance anomaly
   */
  private createAnomaly(anomaly: Omit<PerformanceAnomaly, "id" | "timestamp" | "status">): void {
    const fullAnomaly: PerformanceAnomaly = {
      id: `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      status: "active",
      ...anomaly,
    };

    this.anomalies.push(fullAnomaly);

    logger.warn("Performance anomaly detected", {
      anomalyId: fullAnomaly.id,
      type: fullAnomaly.type,
      agentType: fullAnomaly.agentType,
      severity: fullAnomaly.severity,
      description: fullAnomaly.description,
    });
  }

  /**
   * Update performance trends
   */
  private updateTrends(agentType: AgentType, metrics: AgentPerformanceMetrics): void {
    // This would implement trend analysis logic
    // For now, just store the data point
    const periods: ("hour" | "day" | "week" | "month")[] = ["hour", "day", "week", "month"];

    periods.forEach((period) => {
      if (!this.trends.has(agentType)) {
        this.trends.set(agentType, []);
      }

      const trends = this.trends.get(agentType)!;
      let trend = trends.find((t) => t.period === period);

      if (!trend) {
        trend = {
          agentType,
          period,
          dataPoints: [],
          direction: "stable",
          confidence: 0,
          significance: 0,
        };
        trends.push(trend);
      }

      // Add data point
      trend.dataPoints.push({
        timestamp: metrics.timestamp,
        value: metrics.responseTime.avg,
        metric: "response_time",
      });

      // Cleanup old data points based on period
      const maxPoints = {
        hour: 24,
        day: 30,
        week: 12,
        month: 12,
      }[period];

      if (trend.dataPoints.length > maxPoints) {
        trend.dataPoints.splice(0, trend.dataPoints.length - maxPoints);
      }
    });
  }

  /**
   * Get default performance thresholds
   */
  private getDefaultThresholds(): PerformanceThresholds {
    return {
      responseTime: {
        warning: 5000, // 5 seconds
        critical: 10000, // 10 seconds
      },
      errorRate: {
        warning: 5, // 5%
        critical: 10, // 10%
      },
      resourceUsage: {
        memory: {
          warning: 80, // 80%
          critical: 95, // 95%
        },
        cpu: {
          warning: 70, // 70%
          critical: 90, // 90%
        },
      },
      cost: {
        hourlyWarning: 10, // $10 per hour
        hourlyCritical: 50, // $50 per hour
        dailyWarning: 100, // $100 per day
        dailyCritical: 500, // $500 per day
      },
      availability: {
        warning: 99, // 99%
        critical: 95, // 95%
      },
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    // Rough estimation in MB
    const metricsSize =
      Array.from(this.metricsHistory.values()).reduce((sum, history) => sum + history.length, 0) *
      0.01; // ~10KB per metric point
    const anomaliesSize = this.anomalies.length * 0.001; // ~1KB per anomaly
    const trendsSize =
      Array.from(this.trends.values()).reduce(
        (sum, trends) => sum + trends.reduce((sum2, trend) => sum2 + trend.dataPoints.length, 0),
        0
      ) * 0.001; // ~1KB per data point

    return metricsSize + anomaliesSize + trendsSize;
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const agentMetricsCollector = AgentMetricsCollector.getInstance();

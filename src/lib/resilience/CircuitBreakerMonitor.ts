/**
 * Circuit Breaker Monitoring and Metrics System
 *
 * Provides comprehensive monitoring for all circuit breakers:
 * - Real-time metrics collection
 * - Health status aggregation
 * - Performance analytics
 * - Alerting integration
 * - Dashboard data provider
 */

import { logger } from "../logger";
import { analyticsClient } from "../analyticsClient";
import { HttpClientFactory } from "./HttpClientWithCircuitBreaker";

export interface CircuitBreakerMetrics {
  serviceName: string;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  failureCount: number;
  successCount: number;
  totalRequests: number;
  failureRate: number;
  averageResponseTime: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  uptime: number;
  healthScore: number;
}

export interface SystemHealthStatus {
  overall: "healthy" | "degraded" | "unhealthy";
  services: CircuitBreakerMetrics[];
  summary: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    overallFailureRate: number;
    averageResponseTime: number;
  };
  timestamp: Date;
}

export interface AlertConfig {
  failureRateThreshold: number;
  responseTimeThreshold: number;
  consecutiveFailuresThreshold: number;
  serviceDownThreshold: number;
}

/**
 * Circuit Breaker Monitor
 */
export class CircuitBreakerMonitor {
  private metricsHistory: Map<string, CircuitBreakerMetrics[]> = new Map();
  private alertConfig: AlertConfig = {
    failureRateThreshold: 0.5, // 50%
    responseTimeThreshold: 5000, // 5 seconds
    consecutiveFailuresThreshold: 5,
    serviceDownThreshold: 0.8, // 80% of services down
  };

  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor() {
    this.startMonitoring();
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      logger.warn("Circuit breaker monitoring already started");
      return;
    }

    this.isMonitoring = true;

    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
      this.checkAlerts();
      this.cleanupOldMetrics();
    }, intervalMs);

    logger.info("Circuit breaker monitoring started", {
      interval: intervalMs,
    });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    logger.info("Circuit breaker monitoring stopped");
  }

  /**
   * Collect metrics from all circuit breakers
   */
  private async collectMetrics(): Promise<void> {
    try {
      const clients = HttpClientFactory.getAllClients();
      const metrics: CircuitBreakerMetrics[] = [];

      for (const [serviceName, client] of clients) {
        const status = client.getCircuitBreakerStatus();
        const healthStatus = await client.getHealthStatus();

        const metric: CircuitBreakerMetrics = {
          serviceName,
          state: status.state,
          failureCount: status.failureCount || 0,
          successCount: this.calculateSuccessCount(status),
          totalRequests: this.calculateTotalRequests(status),
          failureRate: this.calculateFailureRate(status),
          averageResponseTime: this.calculateAverageResponseTime(serviceName),
          lastFailureTime: status.lastFailureTime,
          lastSuccessTime: this.calculateLastSuccessTime(serviceName),
          uptime: this.calculateUptime(serviceName),
          healthScore: this.calculateHealthScore(status, healthStatus.healthy),
        };

        metrics.push(metric);
        this.updateMetricsHistory(serviceName, metric);
      }

      // Send metrics to analytics
      analyticsClient.track("circuit_breaker_metrics", {
        services: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        "Failed to collect circuit breaker metrics",
        error instanceof Error ? error : new Error("Unknown error")
      );
    }
  }

  /**
   * Check for alert conditions
   */
  private checkAlerts(): void {
    const systemHealth = this.getSystemHealthStatus();
    const { summary } = systemHealth;

    // Check overall system health
    if (summary.overallFailureRate > this.alertConfig.failureRateThreshold) {
      this.triggerAlert("HIGH_FAILURE_RATE", {
        failureRate: summary.overallFailureRate,
        threshold: this.alertConfig.failureRateThreshold,
      });
    }

    if (summary.averageResponseTime > this.alertConfig.responseTimeThreshold) {
      this.triggerAlert("HIGH_RESPONSE_TIME", {
        responseTime: summary.averageResponseTime,
        threshold: this.alertConfig.responseTimeThreshold,
      });
    }

    if (summary.unhealthyServices > 0) {
      this.triggerAlert("SERVICES_UNHEALTHY", {
        unhealthyServices: summary.unhealthyServices,
        totalServices: summary.totalServices,
      });
    }

    // Check individual services
    for (const service of systemHealth.services) {
      if (service.failureRate > this.alertConfig.failureRateThreshold) {
        this.triggerAlert("SERVICE_HIGH_FAILURE_RATE", {
          serviceName: service.serviceName,
          failureRate: service.failureRate,
        });
      }

      if (
        service.averageResponseTime > this.alertConfig.responseTimeThreshold
      ) {
        this.triggerAlert("SERVICE_HIGH_RESPONSE_TIME", {
          serviceName: service.serviceName,
          responseTime: service.averageResponseTime,
        });
      }

      if (service.state === "OPEN") {
        this.triggerAlert("SERVICE_CIRCUIT_OPEN", {
          serviceName: service.serviceName,
          failureCount: service.failureCount,
        });
      }
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(alertType: string, data: any): void {
    logger.warn("Circuit breaker alert triggered", {
      alertType,
      data,
      timestamp: new Date().toISOString(),
    });

    analyticsClient.track("circuit_breaker_alert", {
      alertType,
      data,
      timestamp: new Date().toISOString(),
    });

    // Here you could integrate with external alerting systems
    // like PagerDuty, Slack, email, etc.
  }

  /**
   * Get comprehensive system health status
   */
  getSystemHealthStatus(): SystemHealthStatus {
    const clients = HttpClientFactory.getAllClients();
    const services: CircuitBreakerMetrics[] = [];

    let totalRequests = 0;
    let totalFailures = 0;
    let totalResponseTime = 0;
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    for (const [serviceName, client] of clients) {
      const status = client.getCircuitBreakerStatus();
      const healthStatus = { healthy: true }; // Simplified for now

      const metric: CircuitBreakerMetrics = {
        serviceName,
        state: status.state,
        failureCount: status.failureCount || 0,
        successCount: this.calculateSuccessCount(status),
        totalRequests: this.calculateTotalRequests(status),
        failureRate: this.calculateFailureRate(status),
        averageResponseTime: this.calculateAverageResponseTime(serviceName),
        lastFailureTime: status.lastFailureTime,
        lastSuccessTime: this.calculateLastSuccessTime(serviceName),
        uptime: this.calculateUptime(serviceName),
        healthScore: this.calculateHealthScore(status, healthStatus.healthy),
      };

      services.push(metric);

      // Aggregate metrics
      totalRequests += metric.totalRequests;
      totalFailures += metric.failureCount;
      totalResponseTime += metric.averageResponseTime;

      // Count health status
      if (metric.healthScore >= 0.8) {
        healthyCount++;
      } else if (metric.healthScore >= 0.5) {
        degradedCount++;
      } else {
        unhealthyCount++;
      }
    }

    const overallFailureRate =
      totalRequests > 0 ? totalFailures / totalRequests : 0;
    const averageResponseTime =
      services.length > 0 ? totalResponseTime / services.length : 0;

    // Determine overall system health
    let overall: "healthy" | "degraded" | "unhealthy";
    if (unhealthyCount === 0 && degradedCount === 0) {
      overall = "healthy";
    } else if (
      services.length > 0 &&
      unhealthyCount / services.length < this.alertConfig.serviceDownThreshold
    ) {
      overall = "degraded";
    } else {
      overall = "unhealthy";
    }

    return {
      overall,
      services,
      summary: {
        totalServices: services.length,
        healthyServices: healthyCount,
        degradedServices: degradedCount,
        unhealthyServices: unhealthyCount,
        overallFailureRate,
        averageResponseTime,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get metrics history for a service
   */
  getMetricsHistory(
    serviceName: string,
    limit: number = 100
  ): CircuitBreakerMetrics[] {
    const history = this.metricsHistory.get(serviceName) || [];
    return history.slice(-limit);
  }

  /**
   * Get service performance trends
   */
  getPerformanceTrends(
    serviceName: string,
    hours: number = 24
  ): {
    failureRateTrend: number[];
    responseTimeTrend: number[];
    timestamps: Date[];
  } {
    const history = this.getMetricsHistory(serviceName);
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const filteredHistory = history.filter(
      (m) => m.lastFailureTime && m.lastFailureTime > cutoffTime
    );

    return {
      failureRateTrend: filteredHistory.map((m) => m.failureRate),
      responseTimeTrend: filteredHistory.map((m) => m.averageResponseTime),
      timestamps: filteredHistory.map((m) => m.lastFailureTime || new Date()),
    };
  }

  /**
   * Update metrics history
   */
  private updateMetricsHistory(
    serviceName: string,
    metric: CircuitBreakerMetrics
  ): void {
    if (!this.metricsHistory.has(serviceName)) {
      this.metricsHistory.set(serviceName, []);
    }

    const history = this.metricsHistory.get(serviceName)!;
    history.push(metric);

    // Keep only last 1000 entries per service
    if (history.length > 1000) {
      this.metricsHistory.set(serviceName, history.slice(-1000));
    }
  }

  /**
   * Clean up old metrics
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days ago

    for (const [serviceName, history] of this.metricsHistory) {
      const filteredHistory = history.filter(
        (m) => (m.lastFailureTime?.getTime() || 0) > cutoffTime
      );

      if (filteredHistory.length !== history.length) {
        this.metricsHistory.set(serviceName, filteredHistory);
      }
    }
  }

  // Helper methods for metric calculations
  private calculateSuccessCount(serviceName: string): number {
    const history = this.getMetricsHistory(serviceName, 10); // Get last 10 metrics
    if (history.length === 0) return 0;

    // Use the most recent metric's success count, or calculate from total - failures
    const latest = history[0];
    if (latest.successCount !== undefined) {
      return latest.successCount;
    }

    // Fallback: calculate from total requests and failure rate
    const totalRequests = latest.totalRequests || 0;
    const failureRate = latest.failureRate || 0;
    return Math.max(0, totalRequests - Math.floor(totalRequests * failureRate));
  }

  private calculateTotalRequests(serviceName: string): number {
    const history = this.getMetricsHistory(serviceName, 1);
    return history.length > 0 ? history[0].totalRequests || 0 : 0;
  }

  private calculateFailureRate(serviceName: string): number {
    const history = this.getMetricsHistory(serviceName, 1);
    return history.length > 0 ? history[0].failureRate || 0 : 0;
  }

  private calculateAverageResponseTime(serviceName: string): number {
    const history = this.getMetricsHistory(serviceName, 10); // Use recent history for averaging
    if (history.length === 0) return 0;

    const validLatencies = history
      .map((m) => m.averageResponseTime)
      .filter((latency) => latency !== undefined && latency > 0);

    if (validLatencies.length === 0) return 0;

    return (
      validLatencies.reduce((sum, latency) => sum + latency, 0) /
      validLatencies.length
    );
  }

  private calculateLastSuccessTime(serviceName: string): Date | undefined {
    const history = this.getMetricsHistory(serviceName, 50); // Look back further for success time
    const latestSuccess = history.find((m) => m.lastSuccessTime);
    return latestSuccess?.lastSuccessTime;
  }

  private calculateUptime(serviceName: string): number {
    const history = this.getMetricsHistory(serviceName, 100); // Use longer history for uptime
    if (history.length === 0) return 100;

    // Count how many metrics show healthy state (closed or half-open)
    const healthyStates = history.filter(
      (m) => m.state === "CLOSED" || m.state === "HALF_OPEN"
    ).length;

    return history.length > 0 ? (healthyStates / history.length) * 100 : 100;
  }

  private calculateHealthScore(status: any, isHealthy: boolean): number {
    let score = 1.0;

    if (status.state === "OPEN") {
      score = 0.0;
    } else if (status.state === "HALF_OPEN") {
      score = 0.5;
    }

    if (!isHealthy) {
      score *= 0.5;
    }

    const failureRate = this.calculateFailureRate(status);
    score *= 1 - failureRate;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(): {
    timestamp: Date;
    systemHealth: SystemHealthStatus;
    individualServices: Record<string, CircuitBreakerMetrics>;
  } {
    return {
      timestamp: new Date(),
      systemHealth: this.getSystemHealthStatus(),
      individualServices: Object.fromEntries(
        Array.from(HttpClientFactory.getAllClients()).map(([name]) => [
          name,
          this.getMetricsHistory(name, 1)[0] || null,
        ])
      ),
    };
  }

  /**
   * Reset all monitoring data
   */
  reset(): void {
    this.metricsHistory.clear();
    logger.info("Circuit breaker monitor reset");
  }
}

/**
 * Global circuit breaker monitor instance
 */
export const circuitBreakerMonitor = new CircuitBreakerMonitor();

/**
 * Express middleware for circuit breaker health endpoint
 */
export function circuitBreakerHealthMiddleware() {
  return async (req: any, res: any) => {
    try {
      const health = circuitBreakerMonitor.getSystemHealthStatus();
      const statusCode =
        health.overall === "healthy"
          ? 200
          : health.overall === "degraded"
            ? 200
            : 503;

      res.status(statusCode).json({
        service: "circuit-breaker-monitor",
        status: health.overall,
        timestamp: health.timestamp,
        details: health,
      });
    } catch (error) {
      res.status(503).json({
        service: "circuit-breaker-monitor",
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}

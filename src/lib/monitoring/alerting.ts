/**
 * Alerting Service for Critical System Metrics
 *
 * Monitors key metrics and triggers alerts when thresholds are exceeded.
 * Supports multiple alert channels (log, webhook, email, etc.)
 */

import { logger } from "../logger";
import {
  circuitBreakerAlerts,
  agentQueueDepth,
  agentRequestErrorRate,
  redisConnectionHealth,
  systemHealthStatus,
  serviceHealthStatus,
} from "./metrics";

export interface AlertThreshold {
  metric: string;
  condition: "gt" | "gte" | "lt" | "lte" | "eq";
  value: number;
  duration?: number; // seconds to sustain condition before alerting
  severity: "info" | "warning" | "error" | "critical";
  description: string;
}

export interface AlertChannel {
  type: "log" | "webhook" | "email" | "slack";
  config: {
    webhookUrl?: string;
    emailTo?: string;
    slackWebhook?: string;
  };
}

export interface Alert {
  id: string;
  metric: string;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

export class AlertingService {
  private thresholds: AlertThreshold[] = [];
  private channels: AlertChannel[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupDefaultThresholds();
    this.setupDefaultChannels();
  }

  private setupDefaultThresholds(): void {
    this.thresholds = [
      // Circuit breaker alerts
      {
        metric: "circuit_breaker_state",
        condition: "eq",
        value: 1, // Open state
        severity: "error",
        description: "Circuit breaker is open - service unavailable",
      },
      {
        metric: "circuit_breaker_failure_rate",
        condition: "gt",
        value: 0.5, // 50% failure rate
        duration: 60, // 1 minute
        severity: "warning",
        description: "High circuit breaker failure rate detected",
      },

      // Queue depth alerts
      {
        metric: "agent_queue_depth",
        condition: "gt",
        value: 1000,
        severity: "warning",
        description: "Agent queue depth exceeds safe threshold",
      },
      {
        metric: "agent_queue_depth",
        condition: "gt",
        value: 5000,
        severity: "error",
        description: "Agent queue depth critically high",
      },

      // Error rate alerts
      {
        metric: "agent_request_error_rate",
        condition: "gt",
        value: 0.05, // 5% error rate
        duration: 300, // 5 minutes
        severity: "warning",
        description: "Agent request error rate above acceptable threshold",
      },
      {
        metric: "agent_request_error_rate",
        condition: "gt",
        value: 0.15, // 15% error rate
        duration: 60, // 1 minute
        severity: "error",
        description: "Agent request error rate critically high",
      },

      // Redis health alerts
      {
        metric: "redis_connection_health",
        condition: "eq",
        value: 0,
        severity: "critical",
        description: "Redis connection lost - distributed state unavailable",
      },

      // System health alerts
      {
        metric: "system_health_status",
        condition: "gte",
        value: 2, // Unhealthy
        severity: "error",
        description: "System health degraded",
      },
      {
        metric: "system_health_status",
        condition: "eq",
        value: 3, // Critical
        severity: "critical",
        description: "System in critical state",
      },
    ];
  }

  private setupDefaultChannels(): void {
    this.channels = [
      {
        type: "log",
        config: {},
      },
    ];
  }

  /**
   * Add a custom alert threshold
   */
  addThreshold(threshold: AlertThreshold): void {
    this.thresholds.push(threshold);
  }

  /**
   * Add an alert channel
   */
  addChannel(channel: AlertChannel): void {
    this.channels.push(channel);
  }

  /**
   * Start monitoring and alerting
   */
  start(intervalMs: number = 30000): void {
    // Check every 30 seconds
    if (this.checkInterval) {
      this.stop();
    }

    this.checkInterval = setInterval(() => {
      this.checkThresholds();
    }, intervalMs);

    logger.info("Alerting service started", { intervalMs });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info("Alerting service stopped");
    }
  }

  /**
   * Check all thresholds and trigger alerts
   */
  private async checkThresholds(): Promise<void> {
    for (const threshold of this.thresholds) {
      try {
        const currentValue = await this.getMetricValue(threshold.metric);
        if (currentValue === null) continue;

        const conditionMet = this.checkCondition(
          threshold.condition,
          currentValue,
          threshold.value
        );

        if (conditionMet) {
          await this.handleAlertTriggered(threshold, currentValue);
        } else {
          await this.handleAlertResolved(threshold);
        }
      } catch (error) {
        logger.error("Error checking threshold", error as Error, {
          metric: threshold.metric,
        });
      }
    }
  }

  /**
   * Get current value of a metric
   */
  private async getMetricValue(metricName: string): Promise<number | null> {
    // This is a simplified implementation
    // In a real system, you'd query Prometheus or maintain metric state

    switch (metricName) {
      case "circuit_breaker_state":
        // Would query actual circuit breaker states
        return 0; // Placeholder

      case "circuit_breaker_failure_rate":
        // Would calculate from recent metrics
        return 0.02; // Placeholder

      case "agent_queue_depth":
        // Would query queue depths
        return 50; // Placeholder

      case "agent_request_error_rate":
        // Would calculate error rates
        return 0.03; // Placeholder

      case "redis_connection_health":
        // Would check Redis health
        return 1; // Placeholder

      case "system_health_status":
        // Would check overall system health
        return 0; // Placeholder

      default:
        return null;
    }
  }

  /**
   * Check if condition is met
   */
  private checkCondition(
    condition: string,
    current: number,
    threshold: number
  ): boolean {
    switch (condition) {
      case "gt":
        return current > threshold;
      case "gte":
        return current >= threshold;
      case "lt":
        return current < threshold;
      case "lte":
        return current <= threshold;
      case "eq":
        return current === threshold;
      default:
        return false;
    }
  }

  /**
   * Handle alert triggering
   */
  private async handleAlertTriggered(
    threshold: AlertThreshold,
    currentValue: number
  ): Promise<void> {
    const alertId = `${threshold.metric}:${threshold.condition}:${threshold.value}`;

    // Check if alert is already active
    if (this.activeAlerts.has(alertId)) {
      return; // Alert already active
    }

    const alert: Alert = {
      id: alertId,
      metric: threshold.metric,
      severity: threshold.severity,
      message: threshold.description,
      value: currentValue,
      threshold: threshold.value,
      timestamp: new Date(),
    };

    this.activeAlerts.set(alertId, alert);

    // Trigger alerts on all channels
    for (const channel of this.channels) {
      await this.sendAlert(channel, alert);
    }

    // Update Prometheus metric
    circuitBreakerAlerts.inc({
      type: "threshold",
      severity: threshold.severity,
      service: threshold.metric,
    });

    logger.warn("Alert triggered", {
      alertId,
      metric: threshold.metric,
      severity: threshold.severity,
      value: currentValue,
      threshold: threshold.value,
    });
  }

  /**
   * Handle alert resolution
   */
  private async handleAlertResolved(threshold: AlertThreshold): Promise<void> {
    const alertId = `${threshold.metric}:${threshold.condition}:${threshold.value}`;

    const alert = this.activeAlerts.get(alertId);
    if (!alert) return;

    alert.resolved = true;
    alert.resolvedAt = new Date();

    // Send resolution notifications
    const resolutionAlert = { ...alert, message: `RESOLVED: ${alert.message}` };
    for (const channel of this.channels) {
      await this.sendAlert(channel, resolutionAlert);
    }

    this.activeAlerts.delete(alertId);

    logger.info("Alert resolved", {
      alertId,
      metric: threshold.metric,
      duration: alert.resolvedAt.getTime() - alert.timestamp.getTime(),
    });
  }

  /**
   * Send alert through a channel
   */
  private async sendAlert(channel: AlertChannel, alert: Alert): Promise<void> {
    try {
      switch (channel.type) {
        case "log":
          // Already logged above
          break;

        case "webhook":
          if (channel.config.webhookUrl) {
            await fetch(channel.config.webhookUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                alert_id: alert.id,
                severity: alert.severity,
                message: alert.message,
                metric: alert.metric,
                value: alert.value,
                threshold: alert.threshold,
                timestamp: alert.timestamp.toISOString(),
                resolved: alert.resolved,
              }),
            });
          }
          break;

        case "slack":
          if (channel.config.slackWebhook) {
            await fetch(channel.config.slackWebhook, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `[${alert.severity.toUpperCase()}] ${alert.message}`,
                attachments: [
                  {
                    fields: [
                      { title: "Metric", value: alert.metric, short: true },
                      {
                        title: "Value",
                        value: alert.value.toString(),
                        short: true,
                      },
                      {
                        title: "Threshold",
                        value: alert.threshold.toString(),
                        short: true,
                      },
                      {
                        title: "Time",
                        value: alert.timestamp.toISOString(),
                        short: true,
                      },
                    ],
                  },
                ],
              }),
            });
          }
          break;

        case "email":
          // Would integrate with email service
          logger.info("Email alert would be sent", {
            to: channel.config.emailTo,
            subject: `[${alert.severity.toUpperCase()}] ${alert.message}`,
          });
          break;
      }
    } catch (error) {
      logger.error("Failed to send alert", error as Error, {
        channel: channel.type,
        alertId: alert.id,
      });
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(
      (alert) => !alert.resolved
    );
  }

  /**
   * Get alert history
   */
  getAlertHistory(hours: number = 24): Alert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Array.from(this.activeAlerts.values()).filter(
      (alert) => alert.timestamp >= cutoff
    );
  }
}

// Singleton instance
let alertingService: AlertingService | null = null;

export function getAlertingService(): AlertingService {
  if (!alertingService) {
    alertingService = new AlertingService();
  }
  return alertingService;
}

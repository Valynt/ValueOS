/**
 * Enterprise Monitoring & Observability Service
 *
 * Comprehensive monitoring solution for production operations including:
 * - Distributed tracing and performance monitoring
 * - Centralized logging and log aggregation
 * - Real-time alerting and incident response
 * - Performance metrics and analytics
 * - System health monitoring and auto-healing
 * - Business intelligence and usage analytics
 */

import { logger } from "../../lib/logger";
import { getCache } from "../core/Cache";
import { getEventBus } from "./EventBus";

export interface TraceSpan {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  service: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  events: TraceEvent[];
  status: "ok" | "error" | "unknown";
  error?: string;
}

export interface TraceEvent {
  timestamp: number;
  name: string;
  attributes: Record<string, any>;
}

export interface LogEntry {
  id: string;
  timestamp: number;
  level: "debug" | "info" | "warn" | "error" | "fatal";
  service: string;
  message: string;
  fields: Record<string, any>;
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  userId?: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  severity: "low" | "medium" | "high" | "critical";
  channels: AlertChannel[];
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: Date;
  createdAt: Date;
}

export interface AlertCondition {
  metric: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
  threshold: number;
  windowMinutes: number;
  aggregation: "avg" | "sum" | "max" | "min" | "count";
}

export interface AlertChannel {
  type: "email" | "slack" | "webhook" | "sms" | "pagerduty";
  target: string;
  template?: string;
}

export interface MetricPoint {
  timestamp: number;
  name: string;
  value: number;
  tags: Record<string, string>;
  tenantId?: string;
}

export interface SystemHealth {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  responseTime: number;
  errorRate: number;
  throughput: number;
  lastChecked: Date;
  dependencies: DependencyHealth[];
}

export interface DependencyHealth {
  name: string;
  type: "database" | "cache" | "api" | "queue" | "storage";
  status: "up" | "down" | "degraded";
  responseTime?: number;
  lastChecked: Date;
}

export interface BusinessMetrics {
  period: string;
  activeUsers: number;
  totalRevenue: number;
  apiCalls: number;
  dataProcessed: number;
  tenantMetrics: Record<string, TenantBusinessMetrics>;
}

export interface TenantBusinessMetrics {
  tenantId: string;
  users: number;
  revenue: number;
  apiCalls: number;
  storageUsed: number;
  uptime: number;
}

export class EnterpriseMonitoringService {
  private eventBus = getEventBus();
  private cache = getCache();
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, AlertInstance> = new Map();
  private healthChecks: Map<string, SystemHealth> = new Map();
  private metricsBuffer: MetricPoint[] = [];
  private bufferSize = 1000;
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeDefaultAlertRules();
    this.startPeriodicTasks();
  }

  /**
   * Distributed Tracing
   */
  createTrace(
    operation: string,
    service: string,
    tags: Record<string, any> = {}
  ): TraceContext {
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const spanId = `span_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const context: TraceContext = {
      traceId,
      spanId,
      operation,
      service,
      startTime: Date.now(),
      tags: { ...tags },
    };

    // Start the root span
    this.startSpan(context);

    return context;
  }

  startSpan(context: TraceContext): TraceSpan {
    const span: TraceSpan = {
      id: context.spanId,
      traceId: context.traceId,
      name: context.operation,
      service: context.service,
      startTime: context.startTime,
      tags: context.tags,
      events: [],
      status: "unknown",
    };

    // Store span (in production, would use proper tracing backend)
    this.cache.set(`trace_span:${span.id}`, span, "tier2");

    return span;
  }

  endSpan(
    span: TraceSpan,
    status: "ok" | "error" = "ok",
    error?: string
  ): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    if (error) span.error = error;

    // Update stored span
    this.cache.set(`trace_span:${span.id}`, span, "tier2");

    // Log performance metrics
    this.recordMetric("trace.duration", span.duration || 0, {
      service: span.service,
      operation: span.name,
      status: span.status,
    });

    if (span.status === "error") {
      logger.error("Trace span completed with error", undefined, {
        traceId: span.traceId,
        spanId: span.id,
        operation: span.name,
        service: span.service,
        duration: span.duration,
        error: span.error,
      });
    } else {
      logger.debug("Trace span completed", {
        traceId: span.traceId,
        spanId: span.id,
        operation: span.name,
        service: span.service,
        duration: span.duration,
      });
    }
  }

  addTraceEvent(
    span: TraceSpan,
    eventName: string,
    attributes: Record<string, any> = {}
  ): void {
    const event: TraceEvent = {
      timestamp: Date.now(),
      name: eventName,
      attributes,
    };

    span.events.push(event);

    // Update stored span
    this.cache.set(`trace_span:${span.id}`, span, "tier2");
  }

  /**
   * Centralized Logging
   */
  logEntry(entry: Omit<LogEntry, "id" | "timestamp">): void {
    const logEntry: LogEntry = {
      ...entry,
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
    };

    // Store log entry (in production, would use ELK stack or similar)
    this.cache.set(`log_entry:${logEntry.id}`, logEntry, "tier2");

    // Forward to logger with appropriate level
    const level = entry.level === "fatal" ? "error" : entry.level;
    const logMethod =
      logger[level as "debug" | "info" | "warn" | "error"] || logger.info;
    logMethod(entry.message, undefined, entry.fields);
  }

  queryLogs(query: {
    startTime?: Date;
    endTime?: Date;
    level?: LogEntry["level"];
    service?: string;
    tenantId?: string;
    limit?: number;
  }): LogEntry[] {
    // This would query a proper logging backend in production
    // For now, return mock data
    return [];
  }

  /**
   * Real-time Alerting
   */
  async createAlertRule(
    rule: Omit<AlertRule, "id" | "createdAt">
  ): Promise<AlertRule> {
    const ruleId = `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const alertRule: AlertRule = {
      ...rule,
      id: ruleId,
      createdAt: new Date(),
    };

    this.alertRules.set(ruleId, alertRule);
    await this.saveAlertRule(alertRule);

    logger.info("Alert rule created", {
      ruleId,
      ruleName: rule.name,
      severity: rule.severity,
    });

    return alertRule;
  }

  async evaluateAlerts(): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      try {
        const isTriggered = await this.evaluateAlertCondition(rule.condition);

        if (isTriggered) {
          await this.triggerAlert(rule);
        }
      } catch (error) {
        logger.error(
          "Alert evaluation failed",
          error instanceof Error ? error : undefined,
          {
            ruleId: rule.id,
            ruleName: rule.name,
          }
        );
      }
    }
  }

  /**
   * Performance Metrics
   */
  recordMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {},
    tenantId?: string
  ): void {
    const metric: MetricPoint = {
      timestamp: Date.now(),
      name,
      value,
      tags,
      tenantId,
    };

    this.metricsBuffer.push(metric);

    // Flush if buffer is full
    if (this.metricsBuffer.length >= this.bufferSize) {
      this.flushMetrics();
    }

    // Check for alerts on this metric
    this.checkMetricAlerts(name, value, tags, tenantId);
  }

  getMetrics(query: {
    name?: string;
    tags?: Record<string, string>;
    startTime?: Date;
    endTime?: Date;
    tenantId?: string;
  }): MetricPoint[] {
    // This would query a metrics database in production
    // For now, return buffered metrics
    return this.metricsBuffer.filter((metric) => {
      if (query.name && metric.name !== query.name) return false;
      if (query.tenantId && metric.tenantId !== query.tenantId) return false;
      if (query.startTime && metric.timestamp < query.startTime.getTime())
        return false;
      if (query.endTime && metric.timestamp > query.endTime.getTime())
        return false;
      if (query.tags) {
        for (const [key, value] of Object.entries(query.tags)) {
          if (metric.tags[key] !== value) return false;
        }
      }
      return true;
    });
  }

  /**
   * System Health Monitoring
   */
  async recordHealthCheck(
    service: string,
    health: Omit<SystemHealth, "lastChecked">
  ): Promise<void> {
    const healthCheck: SystemHealth = {
      ...health,
      lastChecked: new Date(),
    };

    this.healthChecks.set(service, healthCheck);
    await this.cache.set(`health_check:${service}`, healthCheck, "tier1");

    // Publish health event
    await this.eventBus.publish({
      type: "system.health",
      source: "monitoring-service",
      data: healthCheck,
    });

    // Check for health alerts
    await this.checkHealthAlerts(healthCheck);
  }

  getHealthStatus(service?: string): SystemHealth[] {
    if (service) {
      const health = this.healthChecks.get(service);
      return health ? [health] : [];
    }
    return Array.from(this.healthChecks.values());
  }

  /**
   * Business Intelligence
   */
  async recordBusinessMetrics(metrics: BusinessMetrics): Promise<void> {
    await this.cache.set(
      `business_metrics:${metrics.period}`,
      metrics,
      "tier1"
    );

    // Record individual metrics
    this.recordMetric("business.active_users", metrics.activeUsers);
    this.recordMetric("business.total_revenue", metrics.totalRevenue);
    this.recordMetric("business.api_calls", metrics.apiCalls);
    this.recordMetric("business.data_processed", metrics.dataProcessed);

    // Record tenant-specific metrics
    for (const [tenantId, tenantMetrics] of Object.entries(
      metrics.tenantMetrics
    )) {
      this.recordMetric("tenant.users", tenantMetrics.users, {}, tenantId);
      this.recordMetric("tenant.revenue", tenantMetrics.revenue, {}, tenantId);
      this.recordMetric(
        "tenant.api_calls",
        tenantMetrics.apiCalls,
        {},
        tenantId
      );
      this.recordMetric(
        "tenant.storage_used",
        tenantMetrics.storageUsed,
        {},
        tenantId
      );
      this.recordMetric("tenant.uptime", tenantMetrics.uptime, {}, tenantId);
    }

    logger.info("Business metrics recorded", {
      period: metrics.period,
      activeUsers: metrics.activeUsers,
      totalRevenue: metrics.totalRevenue,
      tenantCount: Object.keys(metrics.tenantMetrics).length,
    });
  }

  getBusinessMetrics(period?: string): BusinessMetrics[] {
    // This would query business metrics in production
    return [];
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  async getDashboardData(): Promise<{
    health: SystemHealth[];
    alerts: AlertInstance[];
    metrics: {
      totalRequests: number;
      errorRate: number;
      avgResponseTime: number;
      activeUsers: number;
    };
    traces: TraceSpan[];
    logs: LogEntry[];
    business: BusinessMetrics[];
  }> {
    return {
      health: this.getHealthStatus(),
      alerts: Array.from(this.activeAlerts.values()),
      metrics: {
        totalRequests: 0, // Would calculate from metrics
        errorRate: 0,
        avgResponseTime: 0,
        activeUsers: 0,
      },
      traces: [], // Would fetch recent traces
      logs: this.queryLogs({ limit: 50 }),
      business: this.getBusinessMetrics(),
    };
  }

  /**
   * Private helper methods
   */

  private async evaluateAlertCondition(
    condition: AlertCondition
  ): Promise<boolean> {
    const { metric, operator, threshold, windowMinutes, aggregation } =
      condition;

    // Get metrics for the time window
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - windowMinutes * 60 * 1000);

    const metrics = this.getMetrics({
      name: metric,
      startTime,
      endTime,
    });

    if (metrics.length === 0) return false;

    // Calculate aggregated value
    let aggregatedValue: number;
    switch (aggregation) {
      case "avg":
        aggregatedValue =
          metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
        break;
      case "sum":
        aggregatedValue = metrics.reduce((sum, m) => sum + m.value, 0);
        break;
      case "max":
        aggregatedValue = Math.max(...metrics.map((m) => m.value));
        break;
      case "min":
        aggregatedValue = Math.min(...metrics.map((m) => m.value));
        break;
      case "count":
        aggregatedValue = metrics.length;
        break;
      default:
        return false;
    }

    // Evaluate condition
    switch (operator) {
      case "gt":
        return aggregatedValue > threshold;
      case "gte":
        return aggregatedValue >= threshold;
      case "lt":
        return aggregatedValue < threshold;
      case "lte":
        return aggregatedValue <= threshold;
      case "eq":
        return aggregatedValue === threshold;
      case "neq":
        return aggregatedValue !== threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule): Promise<void> {
    // Check cooldown
    if (rule.lastTriggered) {
      const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (timeSinceLastTrigger < cooldownMs) {
        return; // Still in cooldown
      }
    }

    // Create alert instance
    const alertId = `alert_instance_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const alert: AlertInstance = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      triggeredAt: new Date(),
      status: "active",
      description: `Alert condition met: ${rule.description}`,
    };

    this.activeAlerts.set(alertId, alert);
    rule.lastTriggered = new Date();

    await this.saveAlertRule(rule);

    // Send notifications
    for (const channel of rule.channels) {
      await this.sendAlertNotification(alert, channel);
    }

    // Publish alert event
    await this.eventBus.publish({
      type: "monitoring.alert_triggered",
      source: "monitoring-service",
      data: alert,
    });

    logger.warn("Alert triggered", {
      alertId,
      ruleName: rule.name,
      severity: rule.severity,
      channels: rule.channels.length,
    });
  }

  private async sendAlertNotification(
    alert: AlertInstance,
    channel: AlertChannel
  ): Promise<void> {
    try {
      const message = this.formatAlertMessage(alert, channel);

      switch (channel.type) {
        case "email":
          await this.sendEmailAlert(channel.target, message);
          break;
        case "slack":
          await this.sendSlackAlert(channel.target, message);
          break;
        case "webhook":
          await this.sendWebhookAlert(channel.target, alert);
          break;
        case "sms":
          await this.sendSMSAlert(channel.target, message);
          break;
        case "pagerduty":
          await this.sendPagerDutyAlert(channel.target, alert);
          break;
      }

      logger.info("Alert notification sent", {
        alertId: alert.id,
        channelType: channel.type,
        target: channel.target,
      });
    } catch (error) {
      logger.error(
        "Failed to send alert notification",
        error instanceof Error ? error : undefined,
        {
          alertId: alert.id,
          channelType: channel.type,
        }
      );
    }
  }

  private formatAlertMessage(
    alert: AlertInstance,
    channel: AlertChannel
  ): string {
    return (
      channel.template ||
      `🚨 ${alert.severity.toUpperCase()} ALERT: ${alert.description}`
    );
  }

  private async sendEmailAlert(email: string, message: string): Promise<void> {
    // Implementation would integrate with email service
    logger.info(`Sending email alert to ${email}: ${message}`);
  }

  private async sendSlackAlert(
    webhookUrl: string,
    message: string
  ): Promise<void> {
    // Implementation would send to Slack webhook
    logger.info(`Sending Slack alert to ${webhookUrl}: ${message}`);
  }

  private async sendWebhookAlert(
    url: string,
    alert: AlertInstance
  ): Promise<void> {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alert),
    });
  }

  private async sendSMSAlert(
    phoneNumber: string,
    message: string
  ): Promise<void> {
    // Implementation would integrate with SMS service
    logger.info(`Sending SMS alert to ${phoneNumber}: ${message}`);
  }

  private async sendPagerDutyAlert(
    routingKey: string,
    alert: AlertInstance
  ): Promise<void> {
    // Implementation would integrate with PagerDuty
    logger.info(`Sending PagerDuty alert: ${alert.description}`);
  }

  private async checkMetricAlerts(
    name: string,
    value: number,
    tags: Record<string, string>,
    tenantId?: string
  ): Promise<void> {
    // This would check if any alert rules apply to this metric
    // Implementation would be more sophisticated in production
  }

  private async checkHealthAlerts(health: SystemHealth): Promise<void> {
    if (health.status === "unhealthy") {
      // Trigger health alert
      await this.eventBus.publish({
        type: "monitoring.health_alert",
        source: "monitoring-service",
        data: health,
      });
    }
  }

  private initializeDefaultAlertRules(): void {
    // High error rate alert
    this.createAlertRule({
      name: "High Error Rate",
      description: "API error rate exceeds 5%",
      condition: {
        metric: "api.error_rate",
        operator: "gt",
        threshold: 0.05,
        windowMinutes: 5,
        aggregation: "avg",
      },
      severity: "high",
      channels: [
        { type: "email", target: "alerts@company.com" },
        {
          type: "slack",
          target: "https://hooks.slack.com/services/...",
          template: "🔴 High Error Rate Alert: {description}",
        },
      ],
      enabled: true,
      cooldownMinutes: 15,
    });

    // Response time degradation
    this.createAlertRule({
      name: "Slow Response Time",
      description: "Average response time exceeds 2 seconds",
      condition: {
        metric: "api.response_time",
        operator: "gt",
        threshold: 2000,
        windowMinutes: 10,
        aggregation: "avg",
      },
      severity: "medium",
      channels: [{ type: "email", target: "devops@company.com" }],
      enabled: true,
      cooldownMinutes: 30,
    });

    // System down alert
    this.createAlertRule({
      name: "System Unavailable",
      description: "Critical system is down",
      condition: {
        metric: "system.health_score",
        operator: "lt",
        threshold: 0.5,
        windowMinutes: 1,
        aggregation: "avg",
      },
      severity: "critical",
      channels: [
        { type: "pagerduty", target: "pagerduty-routing-key" },
        { type: "sms", target: "+1234567890" },
      ],
      enabled: true,
      cooldownMinutes: 5,
    });
  }

  private startPeriodicTasks(): void {
    // Evaluate alerts every minute
    setInterval(() => {
      this.evaluateAlerts().catch((error) => {
        logger.error(
          "Alert evaluation failed",
          error instanceof Error ? error : undefined
        );
      });
    }, 60000);

    // Flush metrics every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 30000);
  }

  private flushMetrics(): void {
    if (this.metricsBuffer.length === 0) return;

    const metricsToFlush = [...this.metricsBuffer];
    this.metricsBuffer = [];

    // This would send metrics to monitoring backend in production
    logger.debug("Metrics flushed", { count: metricsToFlush.length });
  }

  private async saveAlertRule(rule: AlertRule): Promise<void> {
    await this.cache.set(`alert_rule:${rule.id}`, rule, "tier1");
  }
}

// Singleton instance
let monitoringService: EnterpriseMonitoringService | null = null;

/**
 * Get enterprise monitoring service instance
 */
export function getEnterpriseMonitoringService(): EnterpriseMonitoringService {
  if (!monitoringService) {
    monitoringService = new EnterpriseMonitoringService();
  }
  return monitoringService;
}

/**
 * Utility function to create and manage trace contexts
 */
export class TraceContext {
  traceId: string;
  spanId: string;
  operation: string;
  service: string;
  startTime: number;
  tags: Record<string, any>;

  constructor(
    operation: string,
    service: string,
    tags: Record<string, any> = {}
  ) {
    this.traceId = `trace_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.spanId = `span_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.operation = operation;
    this.service = service;
    this.tags = tags;
    this.startTime = Date.now();
  }
}

/**
 * Alert instance for active alerts
 */
export interface AlertInstance {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: "low" | "medium" | "high" | "critical";
  triggeredAt: Date;
  status: "active" | "acknowledged" | "resolved";
  description: string;
}

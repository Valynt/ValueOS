/**
 * Alerting Service
 * 
 * Monitors metrics and triggers alerts when thresholds are exceeded.
 * Integrates with Sentry, email, and webhook notifications.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger';
import { getMetricsCollector } from './MetricsCollector';
import { captureMessage } from '../lib/sentry';

export interface AlertThreshold {
  metricName: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  description: string;
}

export interface Alert {
  id: string;
  metricName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  metadata?: Record\u003cstring, any\u003e;
}

export interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  thresholds: AlertThreshold[];
  checkIntervalMinutes: number;
  notificationChannels: ('sentry' | 'email' | 'webhook')[];
}

/**
 * Default alert rules
 */
const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    enabled: true,
    thresholds: [
      {
        metricName: 'agent.error_rate',
        operator: 'gt',
        threshold: 0.05, // 5%
        severity: 'warning',
        description: 'Agent error rate exceeds 5%'
      },
      {
        metricName: 'agent.error_rate',
        operator: 'gt',
        threshold: 0.10, // 10%
        severity: 'critical',
        description: 'Agent error rate exceeds 10%'
      }
    ],
    checkIntervalMinutes: 5,
    notificationChannels: ['sentry', 'email']
  },
  {
    id: 'high-hallucination-rate',
    name: 'High Hallucination Rate',
    enabled: true,
    thresholds: [
      {
        metricName: 'agent.hallucination_rate',
        operator: 'gt',
        threshold: 0.15, // 15%
        severity: 'warning',
        description: 'Hallucination rate exceeds 15%'
      },
      {
        metricName: 'agent.hallucination_rate',
        operator: 'gt',
        threshold: 0.25, // 25%
        severity: 'critical',
        description: 'Hallucination rate exceeds 25%'
      }
    ],
    checkIntervalMinutes: 10,
    notificationChannels: ['sentry']
  },
  {
    id: 'low-confidence',
    name: 'Low Confidence Rate',
    enabled: true,
    thresholds: [
      {
        metricName: 'agent.low_confidence_rate',
        operator: 'gt',
        threshold: 0.30, // 30%
        severity: 'warning',
        description: 'Low confidence rate exceeds 30%'
      }
    ],
    checkIntervalMinutes: 15,
    notificationChannels: ['sentry']
  },
  {
    id: 'slow-response-time',
    name: 'Slow Response Time',
    enabled: true,
    thresholds: [
      {
        metricName: 'agent.p95_response_time',
        operator: 'gt',
        threshold: 5000, // 5 seconds
        severity: 'warning',
        description: 'P95 response time exceeds 5 seconds'
      },
      {
        metricName: 'agent.p99_response_time',
        operator: 'gt',
        threshold: 10000, // 10 seconds
        severity: 'critical',
        description: 'P99 response time exceeds 10 seconds'
      }
    ],
    checkIntervalMinutes: 5,
    notificationChannels: ['sentry']
  },
  {
    id: 'high-llm-cost',
    name: 'High LLM Cost',
    enabled: true,
    thresholds: [
      {
        metricName: 'llm.hourly_cost',
        operator: 'gt',
        threshold: 10, // $10/hour
        severity: 'warning',
        description: 'LLM cost exceeds $10/hour'
      },
      {
        metricName: 'llm.hourly_cost',
        operator: 'gt',
        threshold: 50, // $50/hour
        severity: 'critical',
        description: 'LLM cost exceeds $50/hour'
      }
    ],
    checkIntervalMinutes: 15,
    notificationChannels: ['sentry', 'email']
  },
  {
    id: 'low-cache-hit-rate',
    name: 'Low Cache Hit Rate',
    enabled: true,
    thresholds: [
      {
        metricName: 'cache.hit_rate',
        operator: 'lt',
        threshold: 0.50, // 50%
        severity: 'warning',
        description: 'Cache hit rate below 50%'
      }
    ],
    checkIntervalMinutes: 30,
    notificationChannels: ['sentry']
  }
];

/**
 * Alerting Service
 */
export class AlertingService {
  private supabase: SupabaseClient;
  private metricsCollector = getMetricsCollector();
  private alertRules: AlertRule[] = DEFAULT_ALERT_RULES;
  private activeAlerts: Map\u003cstring, Alert\u003e = new Map();
  private checkIntervals: Map\u003cstring, NodeJS.Timeout\u003e = new Map();

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Start monitoring with all enabled alert rules
   */
  start(): void {
    logger.info('Starting alerting service', {
      ruleCount: this.alertRules.filter(r =\u003e r.enabled).length
    });

    for (const rule of this.alertRules) {
      if (rule.enabled) {
        this.startRuleMonitoring(rule);
      }
    }
  }

  /**
   * Stop all monitoring
   */
  stop(): void {
    logger.info('Stopping alerting service');

    for (const [ruleId, interval] of this.checkIntervals) {
      clearInterval(interval);
      this.checkIntervals.delete(ruleId);
    }
  }

  /**
   * Start monitoring for a specific rule
   */
  private startRuleMonitoring(rule: AlertRule): void {
    // Initial check
    this.checkRule(rule);

    // Schedule periodic checks
    const interval = setInterval(
      () =\u003e this.checkRule(rule),
      rule.checkIntervalMinutes * 60 * 1000
    );

    this.checkIntervals.set(rule.id, interval);

    logger.debug('Started monitoring for rule', {
      ruleId: rule.id,
      ruleName: rule.name,
      intervalMinutes: rule.checkIntervalMinutes
    });
  }

  /**
   * Check a specific rule
   */
  private async checkRule(rule: AlertRule): Promise\u003cvoid\u003e {
    try {
      for (const threshold of rule.thresholds) {
        const currentValue = await this.getMetricValue(threshold.metricName);
        
        if (this.shouldAlert(currentValue, threshold)) {
          const alert = this.createAlert(rule, threshold, currentValue);
          await this.triggerAlert(alert, rule.notificationChannels);
        }
      }
    } catch (error) {
      logger.error('Failed to check alert rule', error as Error, {
        ruleId: rule.id,
        ruleName: rule.name
      });
    }
  }

  /**
   * Get current value for a metric
   */
  private async getMetricValue(metricName: string): Promise\u003cnumber\u003e {
    const [category, metric] = metricName.split('.');

    switch (category) {
      case 'agent': {
        const metrics = await this.metricsCollector.getAgentMetrics(undefined, 'hour');
        const aggregated = this.aggregateAgentMetrics(metrics);
        
        switch (metric) {
          case 'error_rate':
            return 1 - aggregated.successRate;
          case 'hallucination_rate':
            return aggregated.hallucinationRate;
          case 'low_confidence_rate':
            return aggregated.lowConfidenceRate;
          case 'p95_response_time':
            return aggregated.p95ResponseTime;
          case 'p99_response_time':
            return aggregated.p99ResponseTime;
          default:
            return 0;
        }
      }

      case 'llm': {
        const systemMetrics = await this.metricsCollector.getSystemMetrics('hour');
        
        switch (metric) {
          case 'hourly_cost':
            return systemMetrics.totalCost;
          default:
            return 0;
        }
      }

      case 'cache': {
        const systemMetrics = await this.metricsCollector.getSystemMetrics('hour');
        
        switch (metric) {
          case 'hit_rate':
            return systemMetrics.cacheHitRate;
          default:
            return 0;
        }
      }

      default:
        return 0;
    }
  }

  /**
   * Aggregate metrics across all agents
   */
  private aggregateAgentMetrics(metrics: any[]): {
    successRate: number;
    hallucinationRate: number;
    lowConfidenceRate: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  } {
    if (metrics.length === 0) {
      return {
        successRate: 1,
        hallucinationRate: 0,
        lowConfidenceRate: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      };
    }

    const totalInvocations = metrics.reduce((sum, m) =\u003e sum + m.totalInvocations, 0);
    const successfulInvocations = metrics.reduce((sum, m) =\u003e sum + m.successfulInvocations, 0);
    const hallucinationCount = metrics.reduce(
      (sum, m) =\u003e sum + (m.totalInvocations * m.hallucinationRate),
      0
    );
    const lowConfidenceCount = metrics.reduce(
      (sum, m) =\u003e sum + (m.totalInvocations * (1 - m.avgConfidenceScore)),
      0
    );

    return {
      successRate: successfulInvocations / totalInvocations,
      hallucinationRate: hallucinationCount / totalInvocations,
      lowConfidenceRate: lowConfidenceCount / totalInvocations,
      p95ResponseTime: Math.max(...metrics.map(m =\u003e m.p95ResponseTime)),
      p99ResponseTime: Math.max(...metrics.map(m =\u003e m.p99ResponseTime))
    };
  }

  /**
   * Check if alert should be triggered
   */
  private shouldAlert(currentValue: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case 'gt':
        return currentValue \u003e threshold.threshold;
      case 'lt':
        return currentValue \u003c threshold.threshold;
      case 'gte':
        return currentValue \u003e= threshold.threshold;
      case 'lte':
        return currentValue \u003c= threshold.threshold;
      case 'eq':
        return currentValue === threshold.threshold;
      default:
        return false;
    }
  }

  /**
   * Create alert object
   */
  private createAlert(
    rule: AlertRule,
    threshold: AlertThreshold,
    currentValue: number
  ): Alert {
    return {
      id: `${rule.id}-${Date.now()}`,
      metricName: threshold.metricName,
      severity: threshold.severity,
      message: threshold.description,
      currentValue,
      threshold: threshold.threshold,
      timestamp: new Date(),
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name
      }
    };
  }

  /**
   * Trigger alert through configured channels
   */
  private async triggerAlert(
    alert: Alert,
    channels: ('sentry' | 'email' | 'webhook')[]
  ): Promise\u003cvoid\u003e {
    // Check if alert is already active (debouncing)
    const existingAlert = this.activeAlerts.get(alert.metricName);
    if (existingAlert \u0026\u0026 Date.now() - existingAlert.timestamp.getTime() \u003c 5 * 60 * 1000) {
      // Alert was triggered less than 5 minutes ago, skip
      return;
    }

    this.activeAlerts.set(alert.metricName, alert);

    logger.warn('Alert triggered', {
      alertId: alert.id,
      metricName: alert.metricName,
      severity: alert.severity,
      currentValue: alert.currentValue,
      threshold: alert.threshold
    });

    // Store alert in database
    await this.storeAlert(alert);

    // Send notifications
    for (const channel of channels) {
      try {
        await this.sendNotification(alert, channel);
      } catch (error) {
        logger.error('Failed to send alert notification', error as Error, {
          channel,
          alertId: alert.id
        });
      }
    }
  }

  /**
   * Store alert in database
   */
  private async storeAlert(alert: Alert): Promise\u003cvoid\u003e {
    try {
      await this.supabase.from('alerts').insert({
        id: alert.id,
        metric_name: alert.metricName,
        severity: alert.severity,
        message: alert.message,
        current_value: alert.currentValue,
        threshold: alert.threshold,
        metadata: alert.metadata,
        created_at: alert.timestamp.toISOString()
      });
    } catch (error) {
      logger.error('Failed to store alert', error as Error, {
        alertId: alert.id
      });
    }
  }

  /**
   * Send notification through specific channel
   */
  private async sendNotification(
    alert: Alert,
    channel: 'sentry' | 'email' | 'webhook'
  ): Promise\u003cvoid\u003e {
    switch (channel) {
      case 'sentry':
        captureMessage(
          `[${alert.severity.toUpperCase()}] ${alert.message}`,
          {
            level: alert.severity === 'critical' ? 'error' : 'warning',
            extra: {
              metricName: alert.metricName,
              currentValue: alert.currentValue,
              threshold: alert.threshold,
              metadata: alert.metadata
            }
          }
        );
        break;

      case 'email':
        // TODO: Implement email notification
        logger.info('Email notification not yet implemented', {
          alertId: alert.id
        });
        break;

      case 'webhook':
        // TODO: Implement webhook notification
        logger.info('Webhook notification not yet implemented', {
          alertId: alert.id
        });
        break;
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Clear an alert
   */
  clearAlert(metricName: string): void {
    this.activeAlerts.delete(metricName);
    logger.info('Alert cleared', { metricName });
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    
    if (rule.enabled) {
      this.startRuleMonitoring(rule);
    }

    logger.info('Alert rule added', {
      ruleId: rule.id,
      ruleName: rule.name
    });
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): void {
    const interval = this.checkIntervals.get(ruleId);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(ruleId);
    }

    this.alertRules = this.alertRules.filter(r =\u003e r.id !== ruleId);

    logger.info('Alert rule removed', { ruleId });
  }
}

/**
 * Singleton instance
 */
let alertingServiceInstance: AlertingService | null = null;

/**
 * Get or create alerting service instance
 */
export function getAlertingService(supabase: SupabaseClient): AlertingService {
  if (!alertingServiceInstance) {
    alertingServiceInstance = new AlertingService(supabase);
  }
  return alertingServiceInstance;
}

/**
 * Reset alerting service (for testing)
 */
export function resetAlertingService(): void {
  if (alertingServiceInstance) {
    alertingServiceInstance.stop();
  }
  alertingServiceInstance = null;
}

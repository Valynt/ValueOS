/**
 * Security Monitor and Alerting System
 *
 * Provides real-time monitoring of security events,
 * automated alerting, and threat detection.
 */

/* eslint-disable security/detect-object-injection -- Controlled environment variable access with hardcoded keys */

import { logger } from "../../lib/logger.js"
import { AgentAuditLog, getAuditLogger } from "../AgentAuditLogger.js"
import { MessageBus } from "../realtime/MessageBus.js"
import { getSecureSharedContext } from "../SecureSharedContext.js"

// ============================================================================
// Types
// ============================================================================

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: Date;
  source: string;
  description: string;
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export type SecurityEventType =
  | "context_share_denied"
  | "context_share_blocked"
  | "message_signature_invalid"
  | "replay_attack_detected"
  | "agent_compromised"
  | "circuit_breaker_opened"
  | "high_sensitivity_data_access"
  | "unauthorized_communication_attempt"
  | "encryption_failure"
  | "audit_log_anomaly";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export interface SecurityAlert {
  id: string;
  eventId: string;
  type: AlertType;
  severity: SecuritySeverity;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  escalationLevel: number;
  autoResolved: boolean;
}

export type AlertType =
  | "immediate_notification"
  | "email_alert"
  | "slack_notification"
  | "pager_duty"
  | "security_team_escalation"
  | "management_escalation";

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsBySeverity: Record<SecuritySeverity, number>;
  activeAlerts: number;
  acknowledgedAlerts: number;
  escalatedAlerts: number;
  meanTimeToResolution: number;
  compromisedAgents: number;
  blockedCommunications: number;
}

export interface MonitoringConfig {
  alertThresholds: {
    deniedContextShares: number; // per minute
    invalidSignatures: number; // per minute
    replayAttacks: number; // per minute
    compromisedAgents: number; // total
  };
  escalationRules: Partial<Record<SecurityEventType, AlertType[]>>;
  severityRoutingRules: Partial<Record<SecuritySeverity, AlertType[]>>;
  notificationEmails?: string[];
  retentionPeriod: number; // days
}

type AlertChannel = Exclude<AlertType, "immediate_notification"> | "immediate_notification";
type DeliveryStatus = "attempted" | "sent" | "failed" | "skipped_missing_config";

interface AlertDeliveryMetrics {
  attempted: number;
  sent: number;
  failed: number;
  skipped_missing_config: number;
}

interface FallbackAlertRecord {
  queueId: string;
  alertId: string;
  channel: AlertChannel;
  severity: SecuritySeverity;
  reason: string;
  createdAt: Date;
  payload: Record<string, unknown>;
}

// ============================================================================
// Security Monitor Implementation
// ============================================================================

export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private events: Map<string, SecurityEvent> = new Map();
  private alerts: Map<string, SecurityAlert> = new Map();
  private auditLogger = getAuditLogger();
  private sharedContext = getSecureSharedContext();
  private config: MonitoringConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private fallbackMessageBus = new MessageBus();
  private fallbackTopic = "security.alerts.delivery-fallback";
  private fallbackQueue: FallbackAlertRecord[] = [];
  private deliveryMetrics: Record<AlertChannel, AlertDeliveryMetrics> = {
    email_alert: { attempted: 0, sent: 0, failed: 0, skipped_missing_config: 0 },
    slack_notification: { attempted: 0, sent: 0, failed: 0, skipped_missing_config: 0 },
    pager_duty: { attempted: 0, sent: 0, failed: 0, skipped_missing_config: 0 },
    security_team_escalation: { attempted: 0, sent: 0, failed: 0, skipped_missing_config: 0 },
    management_escalation: { attempted: 0, sent: 0, failed: 0, skipped_missing_config: 0 },
    immediate_notification: { attempted: 0, sent: 0, failed: 0, skipped_missing_config: 0 },
  };

  private readonly DEFAULT_CONFIG: MonitoringConfig = {
    alertThresholds: {
      deniedContextShares: 5, // 5 per minute
      invalidSignatures: 3, // 3 per minute
      replayAttacks: 1, // 1 per minute
      compromisedAgents: 1, // 1 total
    },
    escalationRules: {
      high_sensitivity_data_access: ["immediate_notification", "email_alert"],
      agent_compromised: ["immediate_notification", "slack_notification", "pager_duty"],
      circuit_breaker_opened: ["immediate_notification", "security_team_escalation"],
    },
    severityRoutingRules: {
      low: ["email_alert"],
      medium: ["email_alert", "slack_notification"],
      high: ["immediate_notification", "security_team_escalation"],
      critical: ["immediate_notification", "pager_duty", "security_team_escalation", "management_escalation"],
    },
    notificationEmails: process.env.SECURITY_ALERT_EMAIL ? [process.env.SECURITY_ALERT_EMAIL] : ['security@valuecanvas.com'],
    retentionPeriod: 30, // 30 days
  };

  private constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
    this.fallbackMessageBus.createChannel({
      name: this.fallbackTopic,
      description: "Fallback delivery channel for security alerts",
      persistent: true,
      message_retention: 10000,
    });
    this.startMonitoring();
  }

  static getInstance(config?: Partial<MonitoringConfig>): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor(config);
    }
    return SecurityMonitor.instance;
  }

  /**
   * Start real-time monitoring
   */
  private startMonitoring(): void {
    // Monitor audit logs every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.analyzeAuditLogs();
    }, 30000);

    // Update metrics every 5 minutes
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 300000);

    logger.info("Security monitoring started", {
      alertThresholds: this.config.alertThresholds,
      escalationRules: Object.keys(this.config.escalationRules),
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    logger.info("Security monitoring stopped");
  }

  /**
   * Record a security event
   */
  recordEvent(
    type: SecurityEventType,
    severity: SecuritySeverity,
    source: string,
    description: string,
    details: Record<string, any>
  ): SecurityEvent {
    const event: SecurityEvent = {
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      timestamp: new Date(),
      source,
      description,
      details,
      resolved: false,
    };

    this.events.set(event.id, event);

    logger.warn("Security event recorded", {
      eventId: event.id,
      type,
      severity,
      source,
      description,
    });

    // Check if alert should be triggered
    this.evaluateAlerting(event);

    return event;
  }

  /**
   * Analyze recent audit logs for anomalies
   */
  private async analyzeAuditLogs(): Promise<void> {
    try {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const organizationId = await this.sharedContext.getOrganizationId();
      const recentLogs = await this.auditLogger.query({
        startDate: oneMinuteAgo,
        limit: 1000,
        organizationId,
      });

      // Analyze for patterns
      await this.analyzeDeniedContextShares(recentLogs);
      await this.analyzeInvalidSignatures(recentLogs);
      await this.analyzeReplayAttacks(recentLogs);
      await this.analyzeHighSensitivityAccess(recentLogs);
      await this.analyzeCommunicationPatterns(recentLogs);
    } catch (error) {
      logger.error("Error analyzing audit logs", error instanceof Error ? error : undefined);
    }
  }

  /**
   * Analyze denied context shares
   */
  private async analyzeDeniedContextShares(logs: AgentAuditLog[]): Promise<void> {
    const deniedShares = logs.filter(
      (log) => log.input_query === "context_share_denied" && !log.success
    );

    if (deniedShares.length >= this.config.alertThresholds.deniedContextShares) {
      this.recordEvent(
        "context_share_denied",
        "high",
        "audit_analysis",
        `High rate of denied context shares: ${deniedShares.length} in last minute`,
        {
          count: deniedShares.length,
          threshold: this.config.alertThresholds.deniedContextShares,
          agents: deniedShares.map((log) => log.agent_name),
          reasons: deniedShares.map((log) => log.error_message),
        }
      );
    }
  }

  /**
   * Analyze invalid signatures
   */
  private async analyzeInvalidSignatures(logs: AgentAuditLog[]): Promise<void> {
    const signatureErrors = logs.filter(
      (log) =>
        log.error_message?.includes("signature") ||
        log.error_message?.includes("Invalid message signature")
    );

    if (signatureErrors.length >= this.config.alertThresholds.invalidSignatures) {
      this.recordEvent(
        "message_signature_invalid",
        "high",
        "audit_analysis",
        `High rate of invalid message signatures: ${signatureErrors.length} in last minute`,
        {
          count: signatureErrors.length,
          threshold: this.config.alertThresholds.invalidSignatures,
          agents: signatureErrors.map((log) => log.agent_name),
        }
      );
    }
  }

  /**
   * Analyze replay attacks
   */
  private async analyzeReplayAttacks(logs: AgentAuditLog[]): Promise<void> {
    const replayAttacks = logs.filter(
      (log) =>
        log.error_message?.includes("replay") ||
        log.error_message?.includes("Replay attack detected")
    );

    if (replayAttacks.length >= this.config.alertThresholds.replayAttacks) {
      this.recordEvent(
        "replay_attack_detected",
        "critical",
        "audit_analysis",
        `Replay attack detected: ${replayAttacks.length} attempts in last minute`,
        {
          count: replayAttacks.length,
          threshold: this.config.alertThresholds.replayAttacks,
          agents: replayAttacks.map((log) => log.agent_name),
        }
      );
    }
  }

  /**
   * Analyze high sensitivity data access
   */
  private async analyzeHighSensitivityAccess(logs: AgentAuditLog[]): Promise<void> {
    const highSensitivityAccess = logs.filter(
      (log) =>
        log.error_message?.includes("trust level") ||
        log.error_message?.includes("sensitive data") ||
        log.context?.metadata?.dataSensitivity === "high"
    );

    if (highSensitivityAccess.length > 0) {
      this.recordEvent(
        "high_sensitivity_data_access",
        "high",
        "audit_analysis",
        `High sensitivity data access attempts: ${highSensitivityAccess.length} in last minute`,
        {
          count: highSensitivityAccess.length,
          agents: highSensitivityAccess.map((log) => log.agent_name),
          contexts: highSensitivityAccess.map((log) => log.context?.metadata),
        }
      );
    }
  }

  /**
   * Analyze communication patterns for anomalies
   */
  private async analyzeCommunicationPatterns(logs: AgentAuditLog[]): Promise<void> {
    // Group by agent pairs
    const agentPairs = new Map<string, number>();

    logs.forEach((log) => {
      if (log.context?.metadata?.toAgent) {
        const pair = `${log.agent_name}-${log.context.metadata.toAgent}`;
        agentPairs.set(pair, (agentPairs.get(pair) || 0) + 1);
      }
    });

    // Look for unusual patterns
    for (const [pair, count] of agentPairs.entries()) {
      if (count > 20) {
        // More than 20 communications per minute
        this.recordEvent(
          "unauthorized_communication_attempt",
          "medium",
          "pattern_analysis",
          `Unusual communication pattern: ${count} messages for ${pair}`,
          {
            agentPair: pair,
            count,
            threshold: 20,
          }
        );
      }
    }
  }

  /**
   * Evaluate if an alert should be triggered
   */
  private evaluateAlerting(event: SecurityEvent): void {
    const eventRules = this.config.escalationRules[event.type] || [];
    const severityRules = this.config.severityRoutingRules[event.severity] || [];
    const alertTypes = Array.from(new Set<AlertType>([...eventRules, ...severityRules, "immediate_notification"]));

    alertTypes.forEach((alertType) => {
      this.createAlert(event.id, alertType, event.severity);
    });
  }

  /**
   * Create a security alert
   */
  private createAlert(eventId: string, type: AlertType, severity: SecuritySeverity): SecurityAlert {
    const alert: SecurityAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventId,
      type,
      severity,
      message: this.generateAlertMessage(eventId, type, severity),
      timestamp: new Date(),
      acknowledged: false,
      escalationLevel: this.calculateEscalationLevel(severity),
      autoResolved: false,
    };

    this.alerts.set(alert.id, alert);

    // Send alert notification
    this.sendAlert(alert);

    return alert;
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(
    eventId: string,
    type: AlertType,
    severity: SecuritySeverity
  ): string {
    const event = this.events.get(eventId);
    if (!event) return "Security alert generated";

    return `[${severity.toUpperCase()}] ${event.description} (${type})`;
  }

  /**
   * Calculate escalation level
   */
  private calculateEscalationLevel(severity: SecuritySeverity): number {
    switch (severity) {
      case "critical":
        return 3;
      case "high":
        return 2;
      case "medium":
        return 1;
      case "low":
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Send alert notification
   */
  private sendAlert(alert: SecurityAlert): void {
    logger.warn("Security alert triggered", {
      alertId: alert.id,
      eventId: alert.eventId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      escalationLevel: alert.escalationLevel,
    });

    this.recordDeliveryMetric(alert.type, "attempted", alert);

    // In production, integrate with actual notification systems
    switch (alert.type) {
      case "email_alert":
        this.sendEmailAlert(alert);
        break;
      case "slack_notification":
        this.sendSlackAlert(alert);
        break;
      case "pager_duty":
        this.sendPagerDutyAlert(alert);
        break;
      case "security_team_escalation":
        this.escalateToSecurityTeam(alert);
        break;
      case "management_escalation":
        this.escalateToManagement(alert);
        break;
      case "immediate_notification":
        this.sendImmediateNotification(alert);
        break;
    }
  }

  /**
   * Send email alert via SECURITY_EMAIL_WEBHOOK_URL (POST with JSON body).
   * Env var is optional — logs only when not configured.
   */
  private sendEmailAlert(alert: SecurityAlert): void {
    const webhookUrl = process.env["SECURITY_EMAIL_WEBHOOK_URL"];
    if (!webhookUrl) {
      this.recordMissingConfig("email_alert", alert, "SECURITY_EMAIL_WEBHOOK_URL is not configured");
      return;
    }
    this.postWebhook(webhookUrl, {
      type: "email_alert",
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp.toISOString(),
    })
      .then(() => this.recordDeliverySuccess("email_alert", alert))
      .catch((err: Error) =>
        this.recordDeliveryFailure("email_alert", alert, err, "email webhook failed"),
      );
  }

  /**
   * Send Slack alert via SECURITY_SLACK_WEBHOOK_URL (Slack Incoming Webhook format).
   */
  private sendSlackAlert(alert: SecurityAlert): void {
    const webhookUrl = process.env["SECURITY_SLACK_WEBHOOK_URL"];
    if (!webhookUrl) {
      this.recordMissingConfig("slack_notification", alert, "SECURITY_SLACK_WEBHOOK_URL is not configured");
      return;
    }
    const emoji = alert.severity === "critical" ? "🚨" : alert.severity === "high" ? "⚠️" : "ℹ️";
    this.postWebhook(webhookUrl, {
      text: `${emoji} *Security Alert* [${alert.severity.toUpperCase()}]\n${alert.message}`,
      attachments: [
        {
          color: alert.severity === "critical" ? "danger" : alert.severity === "high" ? "warning" : "good",
          fields: [
            { title: "Alert ID", value: alert.id, short: true },
            { title: "Type", value: alert.type, short: true },
            { title: "Escalation Level", value: String(alert.escalationLevel), short: true },
            { title: "Timestamp", value: alert.timestamp.toISOString(), short: true },
          ],
        },
      ],
    })
      .then(() => this.recordDeliverySuccess("slack_notification", alert))
      .catch((err: Error) =>
        this.recordDeliveryFailure("slack_notification", alert, err, "slack webhook failed"),
      );
  }

  /**
   * Send PagerDuty alert via SECURITY_PAGERDUTY_ROUTING_KEY (Events API v2).
   */
  private sendPagerDutyAlert(alert: SecurityAlert): void {
    const routingKey = process.env["SECURITY_PAGERDUTY_ROUTING_KEY"];
    if (!routingKey) {
      this.recordMissingConfig("pager_duty", alert, "SECURITY_PAGERDUTY_ROUTING_KEY is not configured");
      return;
    }
    this.postWebhook("https://events.pagerduty.com/v2/enqueue", {
      routing_key: routingKey,
      event_action: "trigger",
      dedup_key: alert.id,
      payload: {
        summary: alert.message,
        severity: alert.severity === "critical" ? "critical" : alert.severity === "high" ? "error" : "warning",
        source: "ValueOS SecurityMonitor",
        timestamp: alert.timestamp.toISOString(),
        custom_details: {
          alert_id: alert.id,
          alert_type: alert.type,
          escalation_level: alert.escalationLevel,
        },
      },
    })
      .then(() => this.recordDeliverySuccess("pager_duty", alert))
      .catch((err: Error) =>
        this.recordDeliveryFailure("pager_duty", alert, err, "pager duty delivery failed"),
      );
  }

  /**
   * Escalate to security team via SECURITY_TEAM_WEBHOOK_URL.
   * Falls back to Slack webhook if security-team-specific URL is not set.
   */
  private escalateToSecurityTeam(alert: SecurityAlert): void {
    const webhookUrl =
      process.env["SECURITY_TEAM_WEBHOOK_URL"] ?? process.env["SECURITY_SLACK_WEBHOOK_URL"];
    if (!webhookUrl) {
      this.recordMissingConfig(
        "security_team_escalation",
        alert,
        "SECURITY_TEAM_WEBHOOK_URL and SECURITY_SLACK_WEBHOOK_URL are not configured",
      );
      return;
    }
    this.postWebhook(webhookUrl, {
      text: `🔒 *Security Team Escalation* [${alert.severity.toUpperCase()}]\n${alert.message}`,
      attachments: [
        {
          color: "danger",
          fields: [
            { title: "Alert ID", value: alert.id, short: true },
            { title: "Escalation Level", value: String(alert.escalationLevel), short: true },
          ],
        },
      ],
    })
      .then(() => this.recordDeliverySuccess("security_team_escalation", alert))
      .catch((err: Error) =>
        this.recordDeliveryFailure("security_team_escalation", alert, err, "security team escalation failed"),
      );
  }

  /**
   * Escalate to management via SECURITY_MANAGEMENT_WEBHOOK_URL.
   */
  private escalateToManagement(alert: SecurityAlert): void {
    const webhookUrl = process.env["SECURITY_MANAGEMENT_WEBHOOK_URL"];
    if (!webhookUrl) {
      this.recordMissingConfig("management_escalation", alert, "SECURITY_MANAGEMENT_WEBHOOK_URL is not configured");
      return;
    }
    this.postWebhook(webhookUrl, {
      type: "management_escalation",
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
      escalationLevel: alert.escalationLevel,
      timestamp: alert.timestamp.toISOString(),
    })
      .then(() => this.recordDeliverySuccess("management_escalation", alert))
      .catch((err: Error) =>
        this.recordDeliveryFailure("management_escalation", alert, err, "management escalation failed"),
      );
  }

  /**
   * Send immediate notification — fires all configured channels in parallel.
   * Used for the highest-priority alerts that need multi-channel delivery.
   */
  private sendImmediateNotification(alert: SecurityAlert): void {
    let sentChannelCount = 0;
    // Fire all configured channels simultaneously for immediate alerts
    if (process.env["SECURITY_EMAIL_WEBHOOK_URL"]) {
      this.sendEmailAlert(alert);
      sentChannelCount += 1;
    }
    if (process.env["SECURITY_SLACK_WEBHOOK_URL"]) {
      this.sendSlackAlert(alert);
      sentChannelCount += 1;
    }

    if (sentChannelCount === 0) {
      this.recordMissingConfig(
        "immediate_notification",
        alert,
        "SECURITY_EMAIL_WEBHOOK_URL and SECURITY_SLACK_WEBHOOK_URL are not configured",
      );
      return;
    }

    this.recordDeliverySuccess("immediate_notification", alert);
    logger.warn("Immediate notification dispatched", {
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
      sentChannelCount,
    });
  }

  private recordDeliveryMetric(channel: AlertChannel, status: DeliveryStatus, alert: SecurityAlert): void {
    this.deliveryMetrics[channel][status] += 1;
    logger.info("security_alert_delivery_status", {
      alertId: alert.id,
      eventId: alert.eventId,
      severity: alert.severity,
      channel,
      status,
      metrics: this.deliveryMetrics[channel],
    });
  }

  private recordDeliverySuccess(channel: AlertChannel, alert: SecurityAlert): void {
    this.recordDeliveryMetric(channel, "sent", alert);
  }

  private recordDeliveryFailure(channel: AlertChannel, alert: SecurityAlert, error: Error, message: string): void {
    this.recordDeliveryMetric(channel, "failed", alert);
    logger.error(message, error, {
      alertId: alert.id,
      channel,
      severity: alert.severity,
    });
    this.persistToFallbackChannel(alert, channel, `delivery_failed:${error.message}`);
  }

  private recordMissingConfig(channel: AlertChannel, alert: SecurityAlert, reason: string): void {
    this.recordDeliveryMetric(channel, "skipped_missing_config", alert);
    const eventDetails = {
      type: "alert_delivery_unavailable",
      alertId: alert.id,
      eventId: alert.eventId,
      severity: alert.severity,
      channel,
      reason,
      timestamp: new Date().toISOString(),
    };
    logger.warn("alert_delivery_unavailable", eventDetails);
    this.persistToFallbackChannel(alert, channel, reason);
  }

  private persistToFallbackChannel(alert: SecurityAlert, channel: AlertChannel, reason: string): void {
    const queueRecord: FallbackAlertRecord = {
      queueId: `fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      alertId: alert.id,
      channel,
      severity: alert.severity,
      reason,
      createdAt: new Date(),
      payload: {
        eventId: alert.eventId,
        alertType: alert.type,
        message: alert.message,
        escalationLevel: alert.escalationLevel,
        timestamp: alert.timestamp.toISOString(),
      },
    };

    this.fallbackQueue.push(queueRecord);
    void this.fallbackMessageBus.publishMessage(this.fallbackTopic, {
      event_type: "alert",
      sender_id: "SecurityMonitor",
      recipient_ids: ["SecurityDeliveryWorker"],
      recipient_agent: "SecurityDeliveryWorker",
      message_type: "event",
      content: `fallback alert delivery for ${alert.id}`,
      payload: queueRecord,
      metadata: {
        priority: alert.severity === "critical" ? "critical" : "high",
        requires_ack: true,
      },
      organization_id: "system",
    });
  }

  getAlertDeliveryMetrics(): Record<AlertChannel, AlertDeliveryMetrics> {
    return structuredClone(this.deliveryMetrics);
  }

  getFallbackQueue(): FallbackAlertRecord[] {
    return [...this.fallbackQueue];
  }

  /**
   * POST a JSON payload to a webhook URL. Returns a promise so callers
   * can attach error handlers without blocking the alert pipeline.
   */
  private async postWebhook(url: string, body: Record<string, unknown>): Promise<void> {

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`Webhook POST failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Get security metrics
   */
  getMetrics(): SecurityMetrics {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentEvents = Array.from(this.events.values()).filter(
      (event) => event.timestamp >= oneDayAgo
    );

    const eventsByType = recentEvents.reduce(
      (acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      },
      {} as Record<SecurityEventType, number>
    );

    const eventsBySeverity = recentEvents.reduce(
      (acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      },
      {} as Record<SecuritySeverity, number>
    );

    const activeAlerts = Array.from(this.alerts.values()).filter(
      (alert) => !alert.acknowledged && !alert.autoResolved
    );

    const acknowledgedAlerts = Array.from(this.alerts.values()).filter(
      (alert) => alert.acknowledged
    );

    const escalatedAlerts = activeAlerts.filter((alert) => alert.escalationLevel >= 2);

    const resolvedEvents = recentEvents.filter((event) => event.resolved);
    const meanTimeToResolution =
      resolvedEvents.length > 0
        ? resolvedEvents.reduce((sum, event) => {
            const resolutionTime = event.resolvedAt!.getTime() - event.timestamp.getTime();
            return sum + resolutionTime;
          }, 0) /
          resolvedEvents.length /
          1000 /
          60 // Convert to minutes
        : 0;

    const compromisedAgents = recentEvents.filter(
      (event) => event.type === "agent_compromised"
    ).length;

    const blockedCommunications = recentEvents.filter(
      (event) => event.type === "unauthorized_communication_attempt"
    ).length;

    return {
      totalEvents: recentEvents.length,
      eventsByType,
      eventsBySeverity,
      activeAlerts: activeAlerts.length,
      acknowledgedAlerts: acknowledgedAlerts.length,
      escalatedAlerts: escalatedAlerts.length,
      meanTimeToResolution,
      compromisedAgents,
      blockedCommunications,
    };
  }

  /**
   * Update metrics and perform cleanup
   */
  private updateMetrics(): void {
    const metrics = this.getMetrics();

    logger.info("Security metrics updated", metrics);

    // Cleanup old events
    this.cleanupOldEvents();
  }

  /**
   * Cleanup old events and alerts
   */
  private cleanupOldEvents(): void {
    const cutoffDate = new Date(Date.now() - this.config.retentionPeriod * 24 * 60 * 60 * 1000);

    let eventsCleaned = 0;
    for (const [id, event] of this.events.entries()) {
      if (event.timestamp < cutoffDate) {
        this.events.delete(id);
        eventsCleaned++;
      }
    }

    let alertsCleaned = 0;
    for (const [id, alert] of this.alerts.entries()) {
      if (alert.timestamp < cutoffDate) {
        this.alerts.delete(id);
        alertsCleaned++;
      }
    }

    if (eventsCleaned > 0 || alertsCleaned > 0) {
      logger.debug("Security data cleanup completed", {
        eventsCleaned,
        alertsCleaned,
        retentionPeriod: this.config.retentionPeriod,
      });
    }
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    logger.info("Security alert acknowledged", {
      alertId,
      acknowledgedBy,
      acknowledgedAt: alert.acknowledgedAt,
    });

    return true;
  }

  /**
   * Resolve a security event
   */
  resolveEvent(eventId: string, resolvedBy: string): boolean {
    const event = this.events.get(eventId);
    if (!event) return false;

    event.resolved = true;
    event.resolvedAt = new Date();
    event.resolvedBy = resolvedBy;

    // Auto-resolve related alerts
    for (const alert of this.alerts.values()) {
      if (alert.eventId === eventId && !alert.acknowledged) {
        alert.autoResolved = true;
      }
    }

    logger.info("Security event resolved", {
      eventId,
      resolvedBy,
      resolvedAt: event.resolvedAt,
    });

    return true;
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 50): SecurityEvent[] {
    return Array.from(this.events.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return Array.from(this.alerts.values())
      .filter((alert) => !alert.acknowledged && !alert.autoResolved)
      .sort((a, b) => b.escalationLevel - a.escalationLevel);
  }

  /**
   * Get event by ID
   */
  getEvent(eventId: string): SecurityEvent | undefined {
    return this.events.get(eventId);
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId: string): SecurityAlert | undefined {
    return this.alerts.get(alertId);
  }
}

// ============================================================================
// Exports
// ============================================================================

export function getSecurityMonitor(config?: Partial<MonitoringConfig>): SecurityMonitor {
  return SecurityMonitor.getInstance(config);
}

export default {
  SecurityMonitor,
  getSecurityMonitor,
};

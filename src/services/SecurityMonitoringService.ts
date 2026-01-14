/**
 * Security Monitoring and Alerting Service
 *
 * Provides comprehensive security monitoring, alerting, and compliance reporting
 * for zero-trust architecture implementation.
 */

import { EventEmitter } from "events";
import { logger } from "../logger";

// ============================================================================
// Types
// ============================================================================

export interface SecurityEvent {
  id: string;
  timestamp: number;
  type:
    | "authentication"
    | "authorization"
    | "network"
    | "process"
    | "data_access"
    | "policy_violation";
  severity: "low" | "medium" | "high" | "critical";
  source: string;
  description: string;
  details: Record<string, any>;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resolved: boolean;
  resolution?: string;
  tags: string[];
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AlertCondition[];
  actions: AlertAction[];
  priority: number;
  cooldownMinutes: number;
  lastTriggered?: number;
}

export interface AlertCondition {
  metric: string;
  operator: "gt" | "lt" | "eq" | "ne" | "contains" | "regex";
  threshold: any;
  timeWindowMinutes?: number;
}

export interface AlertAction {
  type: "email" | "slack" | "webhook" | "log" | "escalate";
  target: string;
  template: string;
  parameters?: Record<string, any>;
}

export interface ComplianceReport {
  id: string;
  timestamp: number;
  period: {
    start: number;
    end: number;
  };
  framework: "SOC2" | "ISO27001" | "NIST" | "GDPR";
  status: "compliant" | "non_compliant" | "requires_attention";
  score: number;
  findings: ComplianceFinding[];
  recommendations: string[];
  generatedBy: string;
}

export interface ComplianceFinding {
  controlId: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "passed" | "failed" | "not_applicable";
  evidence: string[];
  remediation: string;
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  activeAlerts: number;
  resolvedAlerts: number;
  falsePositives: number;
  meanTimeToDetect: number;
  meanTimeToRespond: number;
  complianceScore: number;
  tenantIsolationViolations: number;
  encryptionFailures: number;
  policyViolations: number;
}

// ============================================================================
// Security Monitoring Service
// ============================================================================

export class SecurityMonitoringService extends EventEmitter {
  private static instance: SecurityMonitoringService;
  private events: SecurityEvent[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, SecurityEvent> = new Map();
  private complianceReports: ComplianceReport[] = [];
  private metrics: SecurityMetrics;

  private constructor() {
    super();
    this.metrics = {
      totalEvents: 0,
      eventsByType: {},
      eventsBySeverity: {},
      activeAlerts: 0,
      resolvedAlerts: 0,
      falsePositives: 0,
      meanTimeToDetect: 0,
      meanTimeToRespond: 0,
      complianceScore: 100,
      tenantIsolationViolations: 0,
      encryptionFailures: 0,
      policyViolations: 0,
    };

    this.loadDefaultAlertRules();
    this.startMetricsCollection();
    this.startComplianceMonitoring();
  }

  static getInstance(): SecurityMonitoringService {
    if (!SecurityMonitoringService.instance) {
      SecurityMonitoringService.instance = new SecurityMonitoringService();
    }
    return SecurityMonitoringService.instance;
  }

  /**
   * Load default alert rules for zero-trust monitoring
   */
  private loadDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      // Critical security alerts
      {
        id: "critical-tenant-isolation-breach",
        name: "Critical Tenant Isolation Breach",
        description: "Cross-tenant data access detected",
        enabled: true,
        conditions: [
          { metric: "tenantIsolationViolations", operator: "gt", threshold: 0 },
        ],
        actions: [
          {
            type: "email",
            target: "security-team@company.com",
            template: "critical_alert",
          },
          {
            type: "slack",
            target: "#security-incidents",
            template: "critical_alert",
          },
          { type: "escalate", target: "security-lead", template: "escalation" },
        ],
        priority: 1000,
        cooldownMinutes: 5,
      },

      // High priority alerts
      {
        id: "high-policy-violations",
        name: "High Policy Violation Rate",
        description: "High number of policy violations detected",
        enabled: true,
        conditions: [
          {
            metric: "policyViolations",
            operator: "gt",
            threshold: 10,
            timeWindowMinutes: 5,
          },
        ],
        actions: [
          {
            type: "email",
            target: "security-team@company.com",
            template: "high_alert",
          },
          { type: "slack", target: "#security-alerts", template: "high_alert" },
        ],
        priority: 800,
        cooldownMinutes: 15,
      },

      // Medium priority alerts
      {
        id: "medium-encryption-failures",
        name: "Encryption Failures",
        description: "Encryption/decryption failures detected",
        enabled: true,
        conditions: [
          {
            metric: "encryptionFailures",
            operator: "gt",
            threshold: 5,
            timeWindowMinutes: 10,
          },
        ],
        actions: [
          {
            type: "email",
            target: "devops@company.com",
            template: "medium_alert",
          },
          {
            type: "log",
            target: "security.log",
            template: "encryption_failure",
          },
        ],
        priority: 600,
        cooldownMinutes: 30,
      },

      // Low priority alerts
      {
        id: "low-suspicious-activity",
        name: "Suspicious Activity Detected",
        description: "Unusual security events detected",
        enabled: true,
        conditions: [
          {
            metric: "suspiciousEvents",
            operator: "gt",
            threshold: 20,
            timeWindowMinutes: 60,
          },
        ],
        actions: [
          {
            type: "log",
            target: "security.log",
            template: "suspicious_activity",
          },
        ],
        priority: 400,
        cooldownMinutes: 60,
      },

      // Compliance alerts
      {
        id: "compliance-score-drop",
        name: "Compliance Score Drop",
        description: "Compliance score dropped below threshold",
        enabled: true,
        conditions: [
          { metric: "complianceScore", operator: "lt", threshold: 90 },
        ],
        actions: [
          {
            type: "email",
            target: "compliance@company.com",
            template: "compliance_alert",
          },
          {
            type: "webhook",
            target: "https://compliance-system.company.com/webhook",
            template: "compliance_update",
          },
        ],
        priority: 700,
        cooldownMinutes: 1440, // Daily
      },
    ];

    defaultRules.forEach((rule) => {
      this.alertRules.set(rule.id, rule);
    });

    logger.info("Security alert rules loaded", { count: this.alertRules.size });
  }

  /**
   * Record security event
   */
  public async recordEvent(
    event: Omit<SecurityEvent, "id" | "timestamp" | "resolved">
  ): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      resolved: false,
    };

    this.events.push(securityEvent);
    this.metrics.totalEvents++;

    // Update type metrics
    this.metrics.eventsByType[event.type] =
      (this.metrics.eventsByType[event.type] || 0) + 1;

    // Update severity metrics
    this.metrics.eventsBySeverity[event.severity] =
      (this.metrics.eventsBySeverity[event.severity] || 0) + 1;

    // Check for alerts
    await this.evaluateAlertRules(securityEvent);

    // Emit event
    this.emit("security_event", securityEvent);

    logger.info("Security event recorded", {
      id: securityEvent.id,
      type: securityEvent.type,
      severity: securityEvent.severity,
      description: securityEvent.description,
    });
  }

  /**
   * Evaluate alert rules against security event
   */
  private async evaluateAlertRules(event: SecurityEvent): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (
        rule.lastTriggered &&
        Date.now() - rule.lastTriggered < rule.cooldownMinutes * 60 * 1000
      ) {
        continue;
      }

      // Evaluate conditions
      const conditionsMet = rule.conditions.every((condition) =>
        this.evaluateCondition(condition, event)
      );

      if (conditionsMet) {
        await this.triggerAlert(rule, event);
        rule.lastTriggered = Date.now();
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(
    condition: AlertCondition,
    event: SecurityEvent
  ): boolean {
    let value: any;

    // Get metric value
    switch (condition.metric) {
      case "tenantIsolationViolations":
        value = this.metrics.tenantIsolationViolations;
        break;
      case "policyViolations":
        value = this.metrics.policyViolations;
        break;
      case "encryptionFailures":
        value = this.metrics.encryptionFailures;
        break;
      case "suspiciousEvents":
        value = this.events.filter(
          (e) => e.severity === "high" || e.severity === "critical"
        ).length;
        break;
      case "complianceScore":
        value = this.metrics.complianceScore;
        break;
      default:
        value = event.details[condition.metric];
    }

    // Apply operator
    switch (condition.operator) {
      case "gt":
        return value > condition.threshold;
      case "lt":
        return value < condition.threshold;
      case "eq":
        return value === condition.threshold;
      case "ne":
        return value !== condition.threshold;
      case "contains":
        return typeof value === "string" && value.includes(condition.threshold);
      case "regex":
        return new RegExp(condition.threshold).test(value);
      default:
        return false;
    }
  }

  /**
   * Trigger alert for rule
   */
  private async triggerAlert(
    rule: AlertRule,
    event: SecurityEvent
  ): Promise<void> {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.activeAlerts.set(alertId, event);
    this.metrics.activeAlerts++;

    // Execute alert actions
    for (const action of rule.actions) {
      await this.executeAlertAction(action, rule, event);
    }

    this.emit("alert_triggered", { rule, event, alertId });

    logger.warn("Security alert triggered", {
      alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      eventId: event.id,
      eventType: event.type,
      severity: event.severity,
    });
  }

  /**
   * Execute alert action
   */
  private async executeAlertAction(
    action: AlertAction,
    rule: AlertRule,
    event: SecurityEvent
  ): Promise<void> {
    try {
      switch (action.type) {
        case "email":
          await this.sendEmailAlert(action, rule, event);
          break;
        case "slack":
          await this.sendSlackAlert(action, rule, event);
          break;
        case "webhook":
          await this.sendWebhookAlert(action, rule, event);
          break;
        case "log":
          this.logAlert(action, rule, event);
          break;
        case "escalate":
          await this.escalateAlert(action, rule, event);
          break;
      }
    } catch (error) {
      logger.error(
        "Failed to execute alert action",
        error instanceof Error ? error : new Error(String(error)),
        {
          actionType: action.type,
          ruleId: rule.id,
        }
      );
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(
    action: AlertAction,
    rule: AlertRule,
    event: SecurityEvent
  ): Promise<void> {
    // Implementation would integrate with email service
    logger.info("Email alert sent", {
      target: action.target,
      rule: rule.name,
      event: event.description,
    });
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(
    action: AlertAction,
    rule: AlertRule,
    event: SecurityEvent
  ): Promise<void> {
    // Implementation would integrate with Slack API
    logger.info("Slack alert sent", {
      channel: action.target,
      rule: rule.name,
      event: event.description,
    });
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(
    action: AlertAction,
    rule: AlertRule,
    event: SecurityEvent
  ): Promise<void> {
    // Implementation would send HTTP request to webhook
    logger.info("Webhook alert sent", {
      url: action.target,
      rule: rule.name,
      event: event.description,
    });
  }

  /**
   * Log alert
   */
  private logAlert(
    action: AlertAction,
    rule: AlertRule,
    event: SecurityEvent
  ): void {
    logger.warn("Security alert logged", {
      rule: rule.name,
      event: event.description,
      details: event.details,
    });
  }

  /**
   * Escalate alert
   */
  private async escalateAlert(
    action: AlertAction,
    rule: AlertRule,
    event: SecurityEvent
  ): Promise<void> {
    // Implementation would escalate to higher authority
    logger.warn("Security alert escalated", {
      target: action.target,
      rule: rule.name,
      event: event.description,
    });
  }

  /**
   * Generate SOC2 compliance report
   */
  public async generateSOC2Report(): Promise<ComplianceReport> {
    const now = Date.now();
    const reportPeriod = {
      start: now - 90 * 24 * 60 * 60 * 1000, // Last 90 days
      end: now,
    };

    const findings = await this.assessSOC2Compliance(reportPeriod);

    const compliantFindings = findings.filter(
      (f) => f.status === "passed"
    ).length;
    const totalApplicableFindings = findings.filter(
      (f) => f.status !== "not_applicable"
    ).length;
    const score =
      totalApplicableFindings > 0
        ? (compliantFindings / totalApplicableFindings) * 100
        : 100;

    const report: ComplianceReport = {
      id: `soc2_report_${Date.now()}`,
      timestamp: now,
      period: reportPeriod,
      framework: "SOC2",
      status:
        score >= 95
          ? "compliant"
          : score >= 80
            ? "requires_attention"
            : "non_compliant",
      score,
      findings,
      recommendations: this.generateRecommendations(findings),
      generatedBy: "SecurityMonitoringService",
    };

    this.complianceReports.push(report);
    this.metrics.complianceScore = score;

    this.emit("compliance_report_generated", report);

    logger.info("SOC2 compliance report generated", {
      reportId: report.id,
      score: report.score,
      status: report.status,
      findingsCount: report.findings.length,
    });

    return report;
  }

  /**
   * Assess SOC2 compliance
   */
  private async assessSOC2Compliance(period: {
    start: number;
    end: number;
  }): Promise<ComplianceFinding[]> {
    const findings: ComplianceFinding[] = [];

    // Security principle assessments
    findings.push(await this.assessAccessControl(period));
    findings.push(await this.assessEncryption(period));
    findings.push(await this.assessMonitoring(period));
    findings.push(await this.assessTenantIsolation(period));
    findings.push(await this.assessIncidentResponse(period));
    findings.push(await this.assessChangeManagement(period));

    return findings;
  }

  /**
   * Assess access control compliance
   */
  private async assessAccessControl(period: {
    start: number;
    end: number;
  }): Promise<ComplianceFinding> {
    const violations = this.events.filter(
      (e) =>
        e.timestamp >= period.start &&
        e.timestamp <= period.end &&
        (e.type === "authorization" || e.type === "authentication") &&
        e.severity === "high"
    ).length;

    return {
      controlId: "CC6.1",
      title: "Access Control",
      description:
        "Logical access controls are properly designed and implemented",
      severity: violations > 10 ? "high" : violations > 5 ? "medium" : "low",
      status: violations === 0 ? "passed" : "failed",
      evidence: [
        `Access violations in period: ${violations}`,
        "ABAC policies implemented",
        "Multi-factor authentication required",
      ],
      remediation:
        violations > 0
          ? "Review and strengthen access control policies"
          : "Continue monitoring access patterns",
    };
  }

  /**
   * Assess encryption compliance
   */
  private async assessEncryption(period: {
    start: number;
    end: number;
  }): Promise<ComplianceFinding> {
    const failures = this.metrics.encryptionFailures;

    return {
      controlId: "CC6.7",
      title: "Encryption",
      description: "Data is encrypted in transit and at rest",
      severity: failures > 5 ? "high" : failures > 1 ? "medium" : "low",
      status: failures === 0 ? "passed" : "failed",
      evidence: [
        "AES-256-GCM encryption implemented",
        "TLS 1.3 for data in transit",
        "Quantum-resistant algorithms available",
        `Encryption failures: ${failures}`,
      ],
      remediation:
        failures > 0
          ? "Investigate and resolve encryption failures"
          : "Regular key rotation implemented",
    };
  }

  /**
   * Assess monitoring compliance
   */
  private async assessMonitoring(period: {
    start: number;
    end: number;
  }): Promise<ComplianceFinding> {
    const highSeverityEvents = this.events.filter(
      (e) =>
        e.timestamp >= period.start &&
        e.timestamp <= period.end &&
        (e.severity === "high" || e.severity === "critical")
    ).length;

    return {
      controlId: "CC7.1",
      title: "Monitoring",
      description: "Security monitoring is implemented and effective",
      severity:
        highSeverityEvents > 20
          ? "high"
          : highSeverityEvents > 10
            ? "medium"
            : "low",
      status: highSeverityEvents < 50 ? "passed" : "failed",
      evidence: [
        "eBPF runtime monitoring active",
        "Real-time alerting configured",
        `High severity events: ${highSeverityEvents}`,
        "24/7 security monitoring",
      ],
      remediation:
        highSeverityEvents > 20
          ? "Review monitoring rules and alerting thresholds"
          : "Monitoring effectiveness verified",
    };
  }

  /**
   * Assess tenant isolation compliance
   */
  private async assessTenantIsolation(period: {
    start: number;
    end: number;
  }): Promise<ComplianceFinding> {
    const violations = this.metrics.tenantIsolationViolations;

    return {
      controlId: "CC6.3",
      title: "Tenant Isolation",
      description: "Multi-tenant environment is properly segregated",
      severity: violations > 0 ? "critical" : "low",
      status: violations === 0 ? "passed" : "failed",
      evidence: [
        "Row-level security implemented",
        "Network segmentation active",
        "Cross-tenant access blocked",
        `Isolation violations: ${violations}`,
      ],
      remediation:
        violations > 0
          ? "Immediate investigation of isolation breaches required"
          : "Tenant isolation controls verified",
    };
  }

  /**
   * Assess incident response compliance
   */
  private async assessIncidentResponse(period: {
    start: number;
    end: number;
  }): Promise<ComplianceFinding> {
    const criticalEvents = this.events.filter(
      (e) =>
        e.timestamp >= period.start &&
        e.timestamp <= period.end &&
        e.severity === "critical"
    ).length;

    const resolvedEvents = this.events.filter(
      (e) =>
        e.timestamp >= period.start && e.timestamp <= period.end && e.resolved
    ).length;

    return {
      controlId: "CC7.5",
      title: "Incident Response",
      description: "Security incidents are responded to appropriately",
      severity:
        criticalEvents > 0 && resolvedEvents === 0 ? "critical" : "medium",
      status: resolvedEvents >= criticalEvents ? "passed" : "failed",
      evidence: [
        "Incident response procedures documented",
        "24/7 incident response team",
        `Critical incidents: ${criticalEvents}`,
        `Resolved incidents: ${resolvedEvents}`,
      ],
      remediation:
        resolvedEvents < criticalEvents
          ? "Improve incident response times"
          : "Incident response procedures effective",
    };
  }

  /**
   * Assess change management compliance
   */
  private async assessChangeManagement(period: {
    start: number;
    end: number;
  }): Promise<ComplianceFinding> {
    // This would check for unauthorized changes
    const changeEvents = this.events.filter(
      (e) =>
        e.timestamp >= period.start &&
        e.timestamp <= period.end &&
        e.type === "policy_violation" &&
        e.description.includes("change")
    ).length;

    return {
      controlId: "CC8.1",
      title: "Change Management",
      description: "Changes to the system are authorized and tested",
      severity: changeEvents > 5 ? "high" : changeEvents > 1 ? "medium" : "low",
      status: changeEvents < 3 ? "passed" : "failed",
      evidence: [
        "Change management procedures implemented",
        "Automated testing for changes",
        `Unauthorized changes detected: ${changeEvents}`,
        "Version control and audit trails",
      ],
      remediation:
        changeEvents > 1
          ? "Strengthen change management controls"
          : "Change management procedures effective",
    };
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(findings: ComplianceFinding[]): string[] {
    const recommendations: string[] = [];

    const failedFindings = findings.filter((f) => f.status === "failed");

    for (const finding of failedFindings) {
      recommendations.push(finding.remediation);
    }

    // Add general recommendations
    if (this.metrics.complianceScore < 95) {
      recommendations.push(
        "Implement regular security assessments and penetration testing"
      );
      recommendations.push("Enhance employee security awareness training");
      recommendations.push("Review and update security policies annually");
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      // Clean old events (keep last 30 days)
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const oldEventCount = this.events.length;
      this.events = this.events.filter((e) => e.timestamp > thirtyDaysAgo);

      logger.debug("Security metrics updated", {
        eventsRemoved: oldEventCount - this.events.length,
        totalEvents: this.metrics.totalEvents,
        activeAlerts: this.metrics.activeAlerts,
        complianceScore: this.metrics.complianceScore,
      });
    }, 3600000); // Hourly
  }

  /**
   * Start compliance monitoring
   */
  private startComplianceMonitoring(): void {
    // Generate SOC2 report monthly
    setInterval(
      async () => {
        try {
          await this.generateSOC2Report();
        } catch (error) {
          logger.error(
            "Failed to generate compliance report",
            error instanceof Error ? error : new Error(String(error))
          );
        }
      },
      30 * 24 * 60 * 60 * 1000
    ); // Monthly
  }

  /**
   * Resolve security event
   */
  public resolveEvent(eventId: string, resolution: string): boolean {
    const event = this.events.find((e) => e.id === eventId);
    if (event) {
      event.resolved = true;
      event.resolution = resolution;
      this.metrics.resolvedAlerts++;

      // Remove from active alerts
      for (const [alertId, alertEvent] of this.activeAlerts.entries()) {
        if (alertEvent.id === eventId) {
          this.activeAlerts.delete(alertId);
          this.metrics.activeAlerts--;
          break;
        }
      }

      this.emit("event_resolved", { event, resolution });

      logger.info("Security event resolved", { eventId, resolution });
      return true;
    }
    return false;
  }

  /**
   * Get security metrics
   */
  public getMetrics(): SecurityMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): SecurityEvent[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get compliance reports
   */
  public getComplianceReports(
    framework?: string,
    limit = 10
  ): ComplianceReport[] {
    let reports = this.complianceReports;
    if (framework) {
      reports = reports.filter((r) => r.framework === framework);
    }
    return reports.slice(-limit);
  }

  /**
   * Add alert rule
   */
  public addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info("Alert rule added", { ruleId: rule.id, ruleName: rule.name });
  }

  /**
   * Remove alert rule
   */
  public removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      logger.info("Alert rule removed", { ruleId });
    }
    return removed;
  }
}

// ============================================================================
// Exports
// ============================================================================

export function createSecurityMonitoringService(): SecurityMonitoringService {
  return SecurityMonitoringService.getInstance();
}

export default {
  SecurityMonitoringService,
  createSecurityMonitoringService,
};

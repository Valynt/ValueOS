/**
 * Security Audit Logger
 * Comprehensive audit logging for compliance and security monitoring
 */

export interface AuditEvent {
  id: string;
  timestamp: number;
  userId?: string;
  email?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  action: string;
  resource: string;
  result: "success" | "failure" | "error";
  details: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
  category: "authentication" | "authorization" | "data_access" | "configuration" | "security";
  source: "frontend" | "backend";
  compliance: boolean; // Whether this is a compliance-relevant event
}

export interface AuditFilter {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: string;
  resource?: string;
  severity?: AuditEvent["severity"];
  category?: AuditEvent["category"];
  result?: AuditEvent["result"];
  compliance?: boolean;
}

export interface AuditSummary {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByResult: Record<string, number>;
  complianceEvents: number;
  criticalEvents: number;
  timeRange: { start: Date; end: Date };
}

class AuditLogger {
  private static instance: AuditLogger;
  private events: AuditEvent[] = [];
  private readonly maxEvents = 10000; // Keep last 10k events
  private readonly batchSize = 100; // Send in batches
  private readonly maxRetries = 3; // Maximum send attempts per batch
  private sendTimer: ReturnType<typeof setInterval> | null = null;
  private pendingEvents: AuditEvent[] = [];
  private retryCount = 0;

  private constructor() {
    this.setupBatchSending();
  }

  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Log an audit event
   */
  logEvent(event: Omit<AuditEvent, "id" | "timestamp" | "source">): void {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now(),
      source: "frontend",
    };

    // Add to in-memory storage
    this.events.push(auditEvent);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Add to pending batch
    this.pendingEvents.push(auditEvent);

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      this.logToConsole(auditEvent);
    }

    // Trigger batch send if needed
    if (this.pendingEvents.length >= this.batchSize) {
      this.sendBatch();
    }
  }

  /**
   * Log authentication events
   */
  logAuthentication(
    action: string,
    result: "success" | "failure",
    details: Record<string, unknown>,
    userId?: string,
    email?: string
  ): void {
    this.logEvent({
      action: `auth.${action}`,
      resource: "authentication",
      result,
      details,
      severity: result === "failure" ? "medium" : "low",
      category: "authentication",
      compliance: true,
      ...(userId && { userId }),
      ...(email && { email }),
    });
  }

  /**
   * Log authorization events
   */
  logAuthorization(
    action: string,
    resource: string,
    result: "success" | "failure",
    details: Record<string, unknown>,
    userId?: string
  ): void {
    this.logEvent({
      action: `authz.${action}`,
      resource,
      result,
      details,
      severity: result === "failure" ? "high" : "low",
      category: "authorization",
      compliance: true,
      ...(userId && { userId }),
    });
  }

  /**
   * Log data access events
   */
  logDataAccess(
    action: string,
    resource: string,
    result: "success" | "failure",
    details: Record<string, unknown>,
    userId?: string
  ): void {
    this.logEvent({
      action: `data.${action}`,
      resource,
      result,
      details,
      severity: "low",
      category: "data_access",
      compliance: true,
      ...(userId && { userId }),
    });
  }

  /**
   * Log configuration changes
   */
  logConfiguration(
    action: string,
    resource: string,
    result: "success" | "failure",
    details: Record<string, unknown>,
    userId?: string
  ): void {
    this.logEvent({
      action: `config.${action}`,
      resource,
      result,
      details,
      severity: "medium",
      category: "configuration",
      compliance: true,
      ...(userId && { userId }),
    });
  }

  /**
   * Log security events
   */
  logSecurity(
    action: string,
    resource: string,
    result: "success" | "failure",
    details: Record<string, unknown>,
    severity: "medium" | "high" | "critical" = "medium",
    userId?: string
  ): void {
    this.logEvent({
      action: `security.${action}`,
      resource,
      result,
      details,
      severity,
      category: "security",
      compliance: true,
      ...(userId && { userId }),
    });
  }

  /**
   * Get audit events with filtering
   */
  getEvents(filter?: AuditFilter): AuditEvent[] {
    let filtered = [...this.events];

    if (filter) {
      if (filter.startDate) {
        const start = filter.startDate.getTime();
        filtered = filtered.filter((event) => event.timestamp >= start);
      }

      if (filter.endDate) {
        const end = filter.endDate.getTime();
        filtered = filtered.filter((event) => event.timestamp <= end);
      }

      if (filter.userId) {
        filtered = filtered.filter((event) => event.userId === filter.userId);
      }

      if (filter.action) {
        filtered = filtered.filter((event) => event.action.includes(filter.action!));
      }

      if (filter.resource) {
        filtered = filtered.filter((event) => event.resource.includes(filter.resource!));
      }

      if (filter.severity) {
        filtered = filtered.filter((event) => event.severity === filter.severity);
      }

      if (filter.category) {
        filtered = filtered.filter((event) => event.category === filter.category);
      }

      if (filter.result) {
        filtered = filtered.filter((event) => event.result === filter.result);
      }

      if (filter.compliance !== undefined) {
        filtered = filtered.filter((event) => event.compliance === filter.compliance);
      }
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get audit summary
   */
  getSummary(filter?: AuditFilter): AuditSummary {
    const events = this.getEvents(filter);

    const summary: AuditSummary = {
      totalEvents: events.length,
      eventsByCategory: {},
      eventsBySeverity: {},
      eventsByResult: {},
      complianceEvents: 0,
      criticalEvents: 0,
      timeRange: {
        start: new Date(Math.min(...events.map((e) => e.timestamp))),
        end: new Date(Math.max(...events.map((e) => e.timestamp))),
      },
    };

    events.forEach((event) => {
      // Category breakdown
      summary.eventsByCategory[event.category] =
        (summary.eventsByCategory[event.category] || 0) + 1;

      // Severity breakdown
      summary.eventsBySeverity[event.severity] =
        (summary.eventsBySeverity[event.severity] || 0) + 1;

      // Result breakdown
      summary.eventsByResult[event.result] = (summary.eventsByResult[event.result] || 0) + 1;

      // Compliance events
      if (event.compliance) {
        summary.complianceEvents++;
      }

      // Critical events
      if (event.severity === "critical") {
        summary.criticalEvents++;
      }
    });

    return summary;
  }

  /**
   * Get compliance report
   */
  getComplianceReport(
    startDate: Date,
    endDate: Date
  ): {
    totalEvents: number;
    complianceEvents: number;
    complianceRate: number;
    violations: Array<{
      timestamp: Date;
      action: string;
      details: Record<string, unknown>;
      severity: string;
    }>;
    recommendations: string[];
  } {
    const filter: AuditFilter = {
      startDate,
      endDate,
      compliance: true,
    };

    const events = this.getEvents(filter);
    const violations = events.filter(
      (event) => event.result === "failure" || event.severity === "critical"
    );

    const recommendations = this.generateComplianceRecommendations(violations);

    return {
      totalEvents: events.length,
      complianceEvents: events.length,
      complianceRate:
        events.length > 0
          ? (events.filter((e) => e.result === "success").length / events.length) * 100
          : 100,
      violations: violations.map((event) => ({
        timestamp: new Date(event.timestamp),
        action: event.action,
        details: event.details,
        severity: event.severity,
      })),
      recommendations,
    };
  }

  /**
   * Export audit data
   */
  exportData(filter?: AuditFilter, format: "json" | "csv" = "json"): string {
    const events = this.getEvents(filter);

    if (format === "csv") {
      return this.exportToCSV(events);
    }

    return JSON.stringify(
      {
        exportDate: new Date().toISOString(),
        filter,
        events,
        summary: this.getSummary(filter),
      },
      null,
      2
    );
  }

  /**
   * Clear audit events
   */
  clear(): void {
    this.events = [];
    this.pendingEvents = [];
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup batch sending
   */
  private setupBatchSending(): void {
    // Send batch every 30 seconds
    this.sendTimer = setInterval(() => {
      if (this.pendingEvents.length > 0) {
        this.sendBatch();
      }
    }, 30000);
  }

  /**
   * Send batch of events to server.
   * Failed batches are re-queued up to maxRetries times; after that the batch
   * is dropped to prevent unbounded memory growth.
   */
  private async sendBatch(): Promise<void> {
    if (this.pendingEvents.length === 0) return;

    const batch = [...this.pendingEvents];
    this.pendingEvents = [];

    try {
      if (process.env.NODE_ENV === "production") {
        await fetch("/api/audit/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            events: batch,
            clientTimestamp: Date.now(),
          }),
        });
      }
      // Reset retry counter on success
      this.retryCount = 0;
    } catch (error) {
      this.retryCount++;
      if (this.retryCount <= this.maxRetries) {
        console.error(`Failed to send audit batch (attempt ${this.retryCount}/${this.maxRetries}):`, error);
        // Re-queue for next interval
        this.pendingEvents.unshift(...batch);
      } else {
        console.error("Audit batch dropped after max retries:", error);
        this.retryCount = 0;
      }
    }
  }

  /**
   * Log to console in development
   */
  private logToConsole(event: AuditEvent): void {
    const logMethod = this.getConsoleMethod(event.severity);
    logMethod(`[AUDIT] ${event.action.toUpperCase()} - ${event.result.toUpperCase()}`, {
      id: event.id,
      userId: event.userId,
      resource: event.resource,
      category: event.category,
      compliance: event.compliance,
      timestamp: new Date(event.timestamp).toISOString(),
      details: event.details,
    });
  }

  /**
   * Get appropriate console method for severity
   */
  private getConsoleMethod(severity: AuditEvent["severity"]): typeof console.log {
    switch (severity) {
      case "critical":
        return console.error;
      case "high":
        return console.warn;
      case "medium":
        return console.warn;
      case "low":
        return console.info;
      default:
        return console.log;
    }
  }

  /**
   * Export events to CSV format
   */
  private exportToCSV(events: AuditEvent[]): string {
    const headers = [
      "ID",
      "Timestamp",
      "User ID",
      "Email",
      "Session ID",
      "IP Address",
      "User Agent",
      "Action",
      "Resource",
      "Result",
      "Severity",
      "Category",
      "Compliance",
      "Details",
    ];

    const rows = events.map((event) => [
      event.id,
      new Date(event.timestamp).toISOString(),
      event.userId || "",
      event.email || "",
      event.sessionId || "",
      event.ipAddress || "",
      event.userAgent || "",
      event.action,
      event.resource,
      event.result,
      event.severity,
      event.category,
      event.compliance,
      JSON.stringify(event.details),
    ]);

    return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
  }

  /**
   * Generate compliance recommendations
   */
  private generateComplianceRecommendations(violations: AuditEvent[]): string[] {
    const recommendations: string[] = [];
    const violationTypes = new Set(violations.map((v) => v.action));

    // Authentication violations
    if (violationTypes.has("auth.login_failure")) {
      recommendations.push("Consider implementing additional authentication security measures");
    }

    // Authorization violations
    if (violationTypes.has("authz.access_denied")) {
      recommendations.push("Review and update access control policies");
    }

    // Security violations
    if (violations.some((v) => v.category === "security")) {
      recommendations.push("Investigate security violations and implement preventive measures");
    }

    // High failure rate
    const failureRate = violations.length / this.events.length;
    if (failureRate > 0.1) {
      // 10% failure rate
      recommendations.push(
        "High failure rate detected - review system reliability and user experience"
      );
    }

    // Critical events
    if (violations.some((v) => v.severity === "critical")) {
      recommendations.push("Critical security events detected - immediate investigation required");
    }

    return recommendations;
  }

  /**
   * Cleanup on page unload
   */
  cleanup(): void {
    if (this.sendTimer) {
      clearInterval(this.sendTimer);
      this.sendTimer = null;
    }

    // Send any remaining events
    if (this.pendingEvents.length > 0) {
      this.sendBatch();
    }
  }
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();

// Setup cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    auditLogger.cleanup();
  });
}

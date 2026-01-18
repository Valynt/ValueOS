/**
 * Security Logger for Authentication Events
 * Provides comprehensive logging for security monitoring and audit trails
 */

export interface SecurityEvent {
  type:
    | "auth_success"
    | "auth_failure"
    | "auth_attempt"
    | "token_issued"
    | "token_refreshed"
    | "token_expired"
    | "session_expired"
    | "rate_limit_exceeded"
    | "csrf_failure"
    | "suspicious_activity"
    | "security_violation";
  severity: "low" | "medium" | "high" | "critical";
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
  details: Record<string, unknown>;
  sessionId?: string;
  source: "frontend" | "backend";
}

export interface SecurityMetrics {
  totalAuthAttempts: number;
  successfulAuths: number;
  failedAuths: number;
  rateLimitHits: number;
  suspiciousActivities: number;
  uniqueUsers: number;
  averageSessionDuration: number;
  tokenRefreshes: number;
  securityViolations: number;
}

class SecurityLogger {
  private static instance: SecurityLogger;
  private events: SecurityEvent[] = [];
  private metrics: SecurityMetrics = {
    totalAuthAttempts: 0,
    successfulAuths: 0,
    failedAuths: 0,
    rateLimitHits: 0,
    suspiciousActivities: 0,
    uniqueUsers: 0,
    averageSessionDuration: 0,
    tokenRefreshes: 0,
    securityViolations: 0,
  };
  private uniqueUserIds = new Set<string>();
  private sessionDurations: number[] = [];
  private readonly maxEvents = 1000; // Keep last 1000 events in memory

  private constructor() {}

  static getInstance(): SecurityLogger {
    if (!SecurityLogger.instance) {
      SecurityLogger.instance = new SecurityLogger();
    }
    return SecurityLogger.instance;
  }

  /**
   * Log a security event
   */
  logEvent(event: Omit<SecurityEvent, "timestamp" | "source">): void {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: Date.now(),
      source: "frontend",
    };

    // Add to events array (keep only last maxEvents)
    this.events.push(securityEvent);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Update metrics
    this.updateMetrics(securityEvent);

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      this.logToConsole(securityEvent);
    }

    // In production, send to monitoring service
    if (process.env.NODE_ENV === "production") {
      this.sendToMonitoringService(securityEvent);
    }
  }

  /**
   * Log authentication attempt
   */
  logAuthAttempt(email: string, ip?: string, userAgent?: string): void {
    this.logEvent({
      type: "auth_attempt",
      severity: "low",
      email,
      ...(ip && { ip }),
      ...(userAgent && { userAgent }),
      details: { action: "login_attempt" },
    });
  }

  /**
   * Log successful authentication
   */
  logAuthSuccess(userId: string, email: string, ip?: string, userAgent?: string): void {
    this.logEvent({
      type: "auth_success",
      severity: "low",
      userId,
      email,
      ...(ip && { ip }),
      ...(userAgent && { userAgent }),
      details: { action: "login_success" },
    });
  }

  /**
   * Log failed authentication
   */
  logAuthFailure(email: string, reason: string, ip?: string, userAgent?: string): void {
    this.logEvent({
      type: "auth_failure",
      severity: "medium",
      email,
      ...(ip && { ip }),
      ...(userAgent && { userAgent }),
      details: { reason, action: "login_failure" },
    });
  }

  /**
   * Log token issuance
   */
  logTokenIssued(userId: string, tokenType: "access" | "refresh", expiresAt: number): void {
    this.logEvent({
      type: "token_issued",
      severity: "low",
      userId,
      details: {
        tokenType,
        expiresAt,
        expiresIn: expiresAt - Date.now(),
      },
    });
  }

  /**
   * Log token refresh
   */
  logTokenRefreshed(userId: string, oldTokenExpiry: number, newTokenExpiry: number): void {
    this.logEvent({
      type: "token_refreshed",
      severity: "low",
      userId,
      details: {
        oldTokenExpiry,
        newTokenExpiry,
        extensionTime: newTokenExpiry - oldTokenExpiry,
      },
    });
  }

  /**
   * Log token expiration
   */
  logTokenExpired(userId: string, tokenType: "access" | "refresh", expiredAt: number): void {
    this.logEvent({
      type: "token_expired",
      severity: "medium",
      userId,
      details: { tokenType, expiredAt },
    });
  }

  /**
   * Log session expiration
   */
  logSessionExpired(userId: string, sessionId: string, duration: number): void {
    this.sessionDurations.push(duration);
    this.logEvent({
      type: "session_expired",
      severity: "medium",
      userId,
      sessionId,
      details: { sessionDuration: duration },
    });
  }

  /**
   * Log rate limit exceeded
   */
  logRateLimitExceeded(
    email: string,
    attempts: number,
    lockoutDuration: number,
    ip?: string
  ): void {
    this.logEvent({
      type: "rate_limit_exceeded",
      severity: "high",
      email,
      ...(ip && { ip }),
      details: {
        attempts,
        lockoutDuration,
        action: "rate_limit_triggered",
      },
    });
  }

  /**
   * Log CSRF failure
   */
  logCsrfFailure(ip?: string, userAgent?: string, endpoint?: string): void {
    this.logEvent({
      type: "csrf_failure",
      severity: "high",
      ...(ip && { ip }),
      ...(userAgent && { userAgent }),
      details: { endpoint, action: "csrf_validation_failed" },
    });
  }

  /**
   * Log suspicious activity
   */
  logSuspiciousActivity(
    type: string,
    severity: "medium" | "high" | "critical",
    details: Record<string, unknown>
  ): void {
    this.logEvent({
      type: "suspicious_activity",
      severity,
      details: { activityType: type, ...details },
    });
  }

  /**
   * Log security violation
   */
  logSecurityViolation(violation: string, details: Record<string, unknown>, userId?: string): void {
    this.logEvent({
      type: "security_violation",
      severity: "critical",
      ...(userId && { userId }),
      details: { violation, ...details },
    });
  }

  /**
   * Get current security metrics
   */
  getMetrics(): SecurityMetrics {
    // Calculate average session duration
    const avgDuration =
      this.sessionDurations.length > 0
        ? this.sessionDurations.reduce((a, b) => a + b, 0) / this.sessionDurations.length
        : 0;

    return {
      ...this.metrics,
      uniqueUsers: this.uniqueUserIds.size,
      averageSessionDuration: Math.round(avgDuration),
    };
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 50): SecurityEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: SecurityEvent["type"], limit?: number): SecurityEvent[] {
    const filtered = this.events.filter((event) => event.type === type);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get events by severity
   */
  getEventsBySeverity(severity: SecurityEvent["severity"], limit?: number): SecurityEvent[] {
    const filtered = this.events.filter((event) => event.severity === severity);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get events for a specific user
   */
  getUserEvents(userId: string, limit?: number): SecurityEvent[] {
    const filtered = this.events.filter((event) => event.userId === userId);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get security summary for dashboard
   */
  getSecuritySummary(): {
    metrics: SecurityMetrics;
    recentCriticalEvents: SecurityEvent[];
    recentSuspiciousActivities: SecurityEvent[];
    topFailedEmails: Array<{ email: string; count: number }>;
  } {
    const recentCriticalEvents = this.getEventsBySeverity("critical", 10);
    const recentSuspiciousActivities = this.getEventsByType("suspicious_activity", 10);

    // Get top failed emails
    const failedAuths = this.getEventsByType("auth_failure");
    const emailCounts = new Map<string, number>();

    failedAuths.forEach((event) => {
      if (event.email) {
        emailCounts.set(event.email, (emailCounts.get(event.email) || 0) + 1);
      }
    });

    const topFailedEmails = Array.from(emailCounts.entries())
      .map(([email, count]) => ({ email, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      metrics: this.getMetrics(),
      recentCriticalEvents,
      recentSuspiciousActivities,
      topFailedEmails,
    };
  }

  /**
   * Clear all events and reset metrics
   */
  clear(): void {
    this.events = [];
    this.metrics = {
      totalAuthAttempts: 0,
      successfulAuths: 0,
      failedAuths: 0,
      rateLimitHits: 0,
      suspiciousActivities: 0,
      uniqueUsers: 0,
      averageSessionDuration: 0,
      tokenRefreshes: 0,
      securityViolations: 0,
    };
    this.uniqueUserIds.clear();
    this.sessionDurations = [];
  }

  /**
   * Update metrics based on event
   */
  private updateMetrics(event: SecurityEvent): void {
    switch (event.type) {
      case "auth_attempt":
        this.metrics.totalAuthAttempts++;
        break;
      case "auth_success":
        this.metrics.successfulAuths++;
        if (event.userId) {
          this.uniqueUserIds.add(event.userId);
        }
        break;
      case "auth_failure":
        this.metrics.failedAuths++;
        break;
      case "rate_limit_exceeded":
        this.metrics.rateLimitHits++;
        break;
      case "suspicious_activity":
        this.metrics.suspiciousActivities++;
        break;
      case "token_refreshed":
        this.metrics.tokenRefreshes++;
        break;
      case "security_violation":
        this.metrics.securityViolations++;
        break;
    }
  }

  /**
   * Log to console in development
   */
  private logToConsole(event: SecurityEvent): void {
    const logMethod = this.getConsoleMethod(event.severity);
    logMethod(`[Security Event] ${event.type.toUpperCase()} - ${event.severity.toUpperCase()}`, {
      userId: event.userId,
      email: event.email,
      timestamp: new Date(event.timestamp).toISOString(),
      details: event.details,
    });
  }

  /**
   * Get appropriate console method for severity
   */
  private getConsoleMethod(severity: SecurityEvent["severity"]): typeof console.log {
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
   * Send event to monitoring service (in production)
   */
  private sendToMonitoringService(_event: SecurityEvent): void {
    // In production, this would send to your monitoring service
    // Examples: Sentry, DataDog, New Relic, etc.
    try {
      // Example for Sentry:
      // Sentry.captureMessage(`Security Event: ${event.type}`, {
      //   level: this.getSentryLevel(event.severity),
      //   tags: { eventType: event.type, severity: event.severity },
      //   extra: event,
      // });
      // Example for custom endpoint:
      // fetch('/api/security/events', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event),
      // });
    } catch (error) {
      console.error("Failed to send security event to monitoring service:", error);
    }
  }
}

// Export singleton instance
export const securityLogger = SecurityLogger.getInstance();

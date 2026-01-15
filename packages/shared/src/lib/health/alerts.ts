/**
 * Health check alert manager
 * Tracks persistent failures and manages alert states
 */

export enum AlertSeverity {
  WARNING = "warning",
  CRITICAL = "critical",
}

export enum AlertState {
  OK = "ok",
  ALERTING = "alerting",
  RESOLVED = "resolved",
}

export interface Alert {
  id: string;
  service: string;
  severity: AlertSeverity;
  state: AlertState;
  message: string;
  startedAt: number;
  resolvedAt?: number;
  lastTriggered: number;
  triggerCount: number;
}

export interface AlertRule {
  service: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  condition: (stats: any) => boolean;
  cooldownMs: number; // Minimum time between alerts
}

class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private rules: AlertRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // High failure rate alert
    this.addRule({
      service: "*",
      name: "high_failure_rate",
      description: "Service has high failure rate (>20%)",
      severity: AlertSeverity.WARNING,
      condition: (stats) => stats.total >= 10 && stats.successRate < 0.8,
      cooldownMs: 300000, // 5 minutes
    });

    // Critical failure alert
    this.addRule({
      service: "*",
      name: "critical_failure",
      description: "Service has critical failure rate (>50%)",
      severity: AlertSeverity.CRITICAL,
      condition: (stats) => stats.total >= 5 && stats.successRate < 0.5,
      cooldownMs: 60000, // 1 minute
    });

    // High latency alert
    this.addRule({
      service: "*",
      name: "high_latency",
      description: "Service has high P95 latency (>2000ms)",
      severity: AlertSeverity.WARNING,
      condition: (stats) => stats.p95Latency > 2000,
      cooldownMs: 300000, // 5 minutes
    });
  }

  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  evaluateRules(serviceStats: Record<string, any>): Alert[] {
    const newAlerts: Alert[] = [];
    const now = Date.now();

    for (const [service, stats] of Object.entries(serviceStats)) {
      for (const rule of this.rules) {
        if (rule.service !== "*" && rule.service !== service) {
          continue;
        }

        const alertId = `${service}:${rule.name}`;
        const existingAlert = this.alerts.get(alertId);

        if (rule.condition(stats)) {
          // Condition met - should alert
          if (!existingAlert || existingAlert.state === AlertState.RESOLVED) {
            // New alert or resolved alert triggering again
            const alert: Alert = {
              id: alertId,
              service,
              severity: rule.severity,
              state: AlertState.ALERTING,
              message: `${rule.description} for ${service}`,
              startedAt: now,
              lastTriggered: now,
              triggerCount: 1,
            };
            this.alerts.set(alertId, alert);
            newAlerts.push(alert);
          } else if (existingAlert.state === AlertState.ALERTING) {
            // Existing alert - update trigger count if cooldown passed
            if (now - existingAlert.lastTriggered >= rule.cooldownMs) {
              existingAlert.lastTriggered = now;
              existingAlert.triggerCount++;
              newAlerts.push(existingAlert);
            }
          }
        } else {
          // Condition not met
          if (existingAlert && existingAlert.state === AlertState.ALERTING) {
            // Resolve existing alert
            existingAlert.state = AlertState.RESOLVED;
            existingAlert.resolvedAt = now;
          }
        }
      }
    }

    return newAlerts;
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(
      (alert) => alert.state === AlertState.ALERTING
    );
  }

  getAllAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.state = AlertState.RESOLVED;
      alert.resolvedAt = Date.now();
      return true;
    }
    return false;
  }
}

// Global alert manager
export const alertManager = new AlertManager();

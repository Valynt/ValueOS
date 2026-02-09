/**
 * Health check alert manager
 * Tracks persistent failures and manages alert states
 */
export declare enum AlertSeverity {
    WARNING = "warning",
    CRITICAL = "critical"
}
export declare enum AlertState {
    OK = "ok",
    ALERTING = "alerting",
    RESOLVED = "resolved"
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
    cooldownMs: number;
}
declare class AlertManager {
    private alerts;
    private rules;
    constructor();
    private initializeDefaultRules;
    addRule(rule: AlertRule): void;
    evaluateRules(serviceStats: Record<string, any>): Alert[];
    getActiveAlerts(): Alert[];
    getAllAlerts(): Alert[];
    acknowledgeAlert(alertId: string): boolean;
}
export declare const alertManager: AlertManager;
export {};
//# sourceMappingURL=alerts.d.ts.map
import { createServerSupabaseClient } from "../../lib/supabase.js";
import { logger } from "../../lib/logger.js";
import { getSecurityMonitor } from "./SecurityMonitor.js";

export type SecurityAnomalyType =
  | "bulk_export_volume"
  | "off_hours_privileged_access"
  | "repeated_failed_access"
  | "api_burst";

export interface SecurityAnomalyAlert {
  id: string;
  tenant_id: string;
  anomaly_type: SecurityAnomalyType;
  severity: "low" | "medium" | "high" | "critical";
  actor_id: string | null;
  window_start: string;
  window_end: string;
  observed_value: number;
  threshold_value: number;
  evidence_event_ids: string[];
  evidence: {
    actor_id: string | null;
    tenant_id: string;
    window_start: string;
    window_end: string;
    threshold: number;
    observed: number;
    event_ids: string[];
  };
  status: "open" | "acknowledged" | "suppressed";
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  acknowledge_reason: string | null;
  suppression_until: string | null;
  suppression_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditLogRow {
  id: string;
  tenant_id: string | null;
  organization_id: string | null;
  user_id: string | null;
  action: string;
  status: "success" | "failed";
  details: Record<string, unknown> | null;
  timestamp: string;
}

interface TenantBaseline {
  exportThreshold: number;
  failedThreshold: number;
  burstThreshold: number;
}

const DEFAULT_BASELINE: TenantBaseline = {
  exportThreshold: 50,
  failedThreshold: 8,
  burstThreshold: 200,
};

export class SecurityAnomalyService {
  private readonly supabase = createServerSupabaseClient();

  async runScheduledDetection(referenceTime = new Date()): Promise<SecurityAnomalyAlert[]> {
    const windowEnd = referenceTime;
    const windowStart = new Date(referenceTime.getTime() - 15 * 60 * 1000);

    const tenantIds = await this.fetchActiveTenantIds(windowStart, windowEnd);
    const createdAlerts: SecurityAnomalyAlert[] = [];

    for (const tenantId of tenantIds) {
      const baselines = await this.calculateTenantBaseline(tenantId, windowStart, windowEnd);
      const logs = await this.fetchTenantLogs(tenantId, windowStart, windowEnd);
      const alerts = await this.detectForTenant(tenantId, logs, baselines, windowStart, windowEnd);
      createdAlerts.push(...alerts);
    }

    return createdAlerts;
  }

  async getAlerts(options: {
    tenantId?: string;
    includeSuppressed?: boolean;
    status?: "open" | "acknowledged" | "suppressed";
    limit?: number;
  }): Promise<SecurityAnomalyAlert[]> {
    let query = (this.supabase as any)
      .from("security_anomaly_alerts")
      .select("*")
      .not("tenant_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 100);

    if (options.tenantId) {
      query = query.eq("tenant_id", options.tenantId);
    }
    if (options.status) {
      query = query.eq("status", options.status);
    } else if (!options.includeSuppressed) {
      query = query.neq("status", "suppressed");
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as SecurityAnomalyAlert[];
  }

  async acknowledgeAlert(params: {
    alertId: string;
    actorId: string;
    reason: string;
  }): Promise<SecurityAnomalyAlert | null> {
    const nowIso = new Date().toISOString();
    const { data, error } = await (this.supabase as any)
      .from("security_anomaly_alerts")
      .update({
        status: "acknowledged",
        acknowledged_at: nowIso,
        acknowledged_by: params.actorId,
        acknowledge_reason: params.reason,
        updated_at: nowIso,
      })
      .eq("id", params.alertId)
      .not("tenant_id", "is", null)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return (data as SecurityAnomalyAlert | null) ?? null;
  }

  async suppressAlert(params: {
    alertId: string;
    actorId: string;
    reason: string;
    suppressUntil: string;
  }): Promise<SecurityAnomalyAlert | null> {
    const nowIso = new Date().toISOString();
    const { data, error } = await (this.supabase as any)
      .from("security_anomaly_alerts")
      .update({
        status: "suppressed",
        suppression_until: params.suppressUntil,
        suppression_reason: params.reason,
        acknowledged_by: params.actorId,
        updated_at: nowIso,
      })
      .eq("id", params.alertId)
      .not("tenant_id", "is", null)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    const alert = (data as SecurityAnomalyAlert | null) ?? null;
    if (!alert) return null;

    const { error: suppressionError } = await (this.supabase as any)
      .from("security_anomaly_suppressions")
      .insert({
        tenant_id: alert.tenant_id,
        anomaly_type: alert.anomaly_type,
        actor_id: alert.actor_id,
        suppression_until: params.suppressUntil,
        reason: params.reason,
        created_by: params.actorId,
      });

    if (suppressionError) throw suppressionError;
    return alert;
  }

  private async fetchActiveTenantIds(windowStart: Date, windowEnd: Date): Promise<string[]> {
    const { data, error } = await (this.supabase as any)
      .from("audit_logs")
      .select("tenant_id")
      .not("tenant_id", "is", null)
      .gte("timestamp", windowStart.toISOString())
      .lte("timestamp", windowEnd.toISOString())
      .limit(5000);

    if (error) throw error;

    return Array.from(new Set((data ?? []).map((row: { tenant_id: string }) => row.tenant_id)));
  }

  private async fetchTenantLogs(
    tenantId: string,
    windowStart: Date,
    windowEnd: Date
  ): Promise<AuditLogRow[]> {
    const { data, error } = await (this.supabase as any)
      .from("audit_logs")
      .select("id, tenant_id, organization_id, user_id, action, status, details, timestamp")
      .eq("tenant_id", tenantId)
      .gte("timestamp", windowStart.toISOString())
      .lte("timestamp", windowEnd.toISOString())
      .order("timestamp", { ascending: true })
      .limit(5000);

    if (error) throw error;
    return (data ?? []) as AuditLogRow[];
  }

  private async calculateTenantBaseline(
    tenantId: string,
    windowStart: Date,
    windowEnd: Date
  ): Promise<TenantBaseline> {
    const baselineStart = new Date(windowStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const { data, error } = await (this.supabase as any)
      .from("audit_logs")
      .select("id, user_id, action, status, details, timestamp, resource_type")
      .eq("tenant_id", tenantId)
      .gte("timestamp", baselineStart.toISOString())
      .lt("timestamp", windowStart.toISOString())
      .order("timestamp", { ascending: false })
      .limit(25000);

    if (error) {
      logger.warn("Failed to calculate tenant baseline; falling back to defaults", {
        tenantId,
        error: error.message,
      });
      return DEFAULT_BASELINE;
    }

    const logs = (data ?? []) as AuditLogRow[];
    if (logs.length === 0) return DEFAULT_BASELINE;

    const exportEvents = logs.filter((log) => this.isBulkExport(log)).length;
    const failedEvents = logs.filter((log) => this.isFailedAccess(log)).length;
    const apiEvents = logs.filter((log) => this.isApiAction(log)).length;

    const windowsPerWeek = (7 * 24 * 60) / 15;

    return {
      exportThreshold: Math.max(DEFAULT_BASELINE.exportThreshold, Math.ceil((exportEvents / windowsPerWeek) * 6)),
      failedThreshold: Math.max(DEFAULT_BASELINE.failedThreshold, Math.ceil((failedEvents / windowsPerWeek) * 8)),
      burstThreshold: Math.max(DEFAULT_BASELINE.burstThreshold, Math.ceil((apiEvents / windowsPerWeek) * 10)),
    };
  }

  private async detectForTenant(
    tenantId: string,
    logs: AuditLogRow[],
    baseline: TenantBaseline,
    windowStart: Date,
    windowEnd: Date
  ): Promise<SecurityAnomalyAlert[]> {
    const generated: SecurityAnomalyAlert[] = [];

    const exportLogs = logs.filter((log) => this.isBulkExport(log));
    if (exportLogs.length >= baseline.exportThreshold) {
      const alert = await this.createAlert({
        tenantId,
        type: "bulk_export_volume",
        severity: "critical",
        actorId: this.topActor(exportLogs),
        observedValue: exportLogs.length,
        thresholdValue: baseline.exportThreshold,
        evidenceEventIds: exportLogs.map((log) => log.id).slice(0, 100),
        windowStart,
        windowEnd,
      });
      if (alert) generated.push(alert);
    }

    const failedLogs = logs.filter((log) => this.isFailedAccess(log));
    const failedByActor = this.groupByActor(failedLogs);
    for (const [actorId, actorLogs] of failedByActor.entries()) {
      if (actorLogs.length >= baseline.failedThreshold) {
        const alert = await this.createAlert({
          tenantId,
          type: "repeated_failed_access",
          severity: "high",
          actorId,
          observedValue: actorLogs.length,
          thresholdValue: baseline.failedThreshold,
          evidenceEventIds: actorLogs.map((log) => log.id).slice(0, 100),
          windowStart,
          windowEnd,
        });
        if (alert) generated.push(alert);
      }
    }

    const offHoursPrivilegedLogs = logs.filter((log) => this.isOffHoursPrivilegedAccess(log));
    if (offHoursPrivilegedLogs.length > 0) {
      const alert = await this.createAlert({
        tenantId,
        type: "off_hours_privileged_access",
        severity: "high",
        actorId: this.topActor(offHoursPrivilegedLogs),
        observedValue: offHoursPrivilegedLogs.length,
        thresholdValue: 1,
        evidenceEventIds: offHoursPrivilegedLogs.map((log) => log.id).slice(0, 100),
        windowStart,
        windowEnd,
      });
      if (alert) generated.push(alert);
    }

    const apiLogs = logs.filter((log) => this.isApiAction(log));
    const actorApi = this.groupByActor(apiLogs);
    for (const [actorId, actorLogs] of actorApi.entries()) {
      if (actorLogs.length >= baseline.burstThreshold) {
        const alert = await this.createAlert({
          tenantId,
          type: "api_burst",
          severity: "medium",
          actorId,
          observedValue: actorLogs.length,
          thresholdValue: baseline.burstThreshold,
          evidenceEventIds: actorLogs.map((log) => log.id).slice(0, 100),
          windowStart,
          windowEnd,
        });
        if (alert) generated.push(alert);
      }
    }

    return generated;
  }

  private async createAlert(params: {
    tenantId: string;
    type: SecurityAnomalyType;
    severity: "low" | "medium" | "high" | "critical";
    actorId: string | null;
    observedValue: number;
    thresholdValue: number;
    evidenceEventIds: string[];
    windowStart: Date;
    windowEnd: Date;
  }): Promise<SecurityAnomalyAlert | null> {
    const duplicate = await this.findOpenDuplicate(
      params.tenantId,
      params.type,
      params.actorId,
      params.windowStart,
      params.windowEnd
    );
    if (duplicate) {
      return null;
    }

    const suppression = await this.findActiveSuppression(params.tenantId, params.type, params.actorId);
    if (suppression) {
      return null;
    }

    const payload = {
      tenant_id: params.tenantId,
      anomaly_type: params.type,
      severity: params.severity,
      actor_id: params.actorId,
      window_start: params.windowStart.toISOString(),
      window_end: params.windowEnd.toISOString(),
      observed_value: params.observedValue,
      threshold_value: params.thresholdValue,
      evidence_event_ids: params.evidenceEventIds,
      evidence: {
        actor_id: params.actorId,
        tenant_id: params.tenantId,
        window_start: params.windowStart.toISOString(),
        window_end: params.windowEnd.toISOString(),
        threshold: params.thresholdValue,
        observed: params.observedValue,
        event_ids: params.evidenceEventIds,
      },
      status: "open",
    };

    const { data, error } = await (this.supabase as any)
      .from("security_anomaly_alerts")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    const alert = data as SecurityAnomalyAlert;

    getSecurityMonitor().recordEvent(
      "audit_log_anomaly",
      params.severity,
      "security-anomaly-service",
      `${params.type} anomaly detected`,
      {
        alert_id: alert.id,
        tenant_id: params.tenantId,
        actor_id: params.actorId,
        window_start: payload.window_start,
        window_end: payload.window_end,
        threshold: params.thresholdValue,
        observed: params.observedValue,
        event_ids: params.evidenceEventIds,
      }
    );

    return alert;
  }

  private async findOpenDuplicate(
    tenantId: string,
    anomalyType: SecurityAnomalyType,
    actorId: string | null,
    windowStart: Date,
    windowEnd: Date
  ): Promise<SecurityAnomalyAlert | null> {
    let query = (this.supabase as any)
      .from("security_anomaly_alerts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("anomaly_type", anomalyType)
      .gte("window_start", windowStart.toISOString())
      .lte("window_end", windowEnd.toISOString())
      .neq("status", "suppressed")
      .limit(1);

    query = actorId ? query.eq("actor_id", actorId) : query.is("actor_id", null);

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return (data as SecurityAnomalyAlert | null) ?? null;
  }

  private async findActiveSuppression(
    tenantId: string,
    anomalyType: SecurityAnomalyType,
    actorId: string | null
  ): Promise<boolean> {
    const nowIso = new Date().toISOString();
    let query = (this.supabase as any)
      .from("security_anomaly_suppressions")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("anomaly_type", anomalyType)
      .gt("suppression_until", nowIso)
      .limit(1);

    query = actorId ? query.eq("actor_id", actorId) : query.is("actor_id", null);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).length > 0;
  }

  private isBulkExport(log: AuditLogRow): boolean {
    return /export/i.test(log.action);
  }

  private isFailedAccess(log: AuditLogRow): boolean {
    return log.status === "failed" || /denied|forbidden|unauthorized/i.test(log.action);
  }

  private isApiAction(log: AuditLogRow): boolean {
    return /api|endpoint|request/i.test(log.action) || log.resource_type === "api";
  }

  private isOffHoursPrivilegedAccess(log: AuditLogRow): boolean {
    if (!/admin|privilege|role|root|super/i.test(log.action)) {
      return false;
    }

    const hour = new Date(log.timestamp).getUTCHours();
    return hour < 6 || hour > 20;
  }

  private groupByActor(logs: AuditLogRow[]): Map<string, AuditLogRow[]> {
    const byActor = new Map<string, AuditLogRow[]>();
    for (const log of logs) {
      const actorId = log.user_id ?? "unknown";
      const entries = byActor.get(actorId) ?? [];
      entries.push(log);
      byActor.set(actorId, entries);
    }
    return byActor;
  }

  private topActor(logs: AuditLogRow[]): string | null {
    const byActor = this.groupByActor(logs);
    let top: string | null = null;
    let count = -1;
    for (const [actorId, actorLogs] of byActor.entries()) {
      if (actorLogs.length > count) {
        top = actorId;
        count = actorLogs.length;
      }
    }
    return top;
  }
}

let securityAnomalyServiceInstance: SecurityAnomalyService | null = null;

export function getSecurityAnomalyService(): SecurityAnomalyService {
  if (!securityAnomalyServiceInstance) {
    securityAnomalyServiceInstance = new SecurityAnomalyService();
  }
  return securityAnomalyServiceInstance;
}

export class SecurityAnomalyScheduler {
  private interval: NodeJS.Timeout | null = null;

  start(intervalMs = 5 * 60 * 1000): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      void getSecurityAnomalyService()
        .runScheduledDetection()
        .catch((error: unknown) => {
          logger.error("Security anomaly scheduled detection failed", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
    }, intervalMs);
  }

  stop(): void {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }
}

let scheduler: SecurityAnomalyScheduler | null = null;

export function getSecurityAnomalyScheduler(): SecurityAnomalyScheduler {
  if (!scheduler) {
    scheduler = new SecurityAnomalyScheduler();
  }
  return scheduler;
}

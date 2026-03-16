import { createServerSupabaseClient } from "../../lib/supabase.js";
import { logger } from "../../lib/logger.js";
import { auditLogService } from "./AuditLogService.js";
import {
  complianceControlMappingRegistry,
  type ComplianceFramework,
  type EvidenceType,
} from "./ComplianceControlMappingRegistry.js";

export type AutomatedControlCheckStatus = "pass" | "fail";

export interface AutomatedControlCheckResult {
  control_id: string;
  framework: ComplianceFramework;
  evidence_type: EvidenceType;
  status: AutomatedControlCheckStatus;
  message: string;
  last_evidence_at: string | null;
  max_age_minutes: number;
  freshness_minutes: number | null;
}

export interface AutomatedControlCheckSnapshot {
  run_id: string;
  tenant_id: string;
  checked_at: string;
  trigger: "scheduled" | "manual";
  overall_status: AutomatedControlCheckStatus;
  failing_checks: number;
  results: AutomatedControlCheckResult[];
}

const FRESHNESS_BUDGET_MINUTES: Record<EvidenceType, number> = {
  audit_logs: 60 * 24,
  security_audit_log: 60 * 12,
  audit_logs_archive: 60 * 24 * 30,
  security_audit_log_archive: 60 * 24 * 30,
  control_status: 60 * 24,
};

export class ComplianceControlCheckService {
  private readonly supabase = createServerSupabaseClient();
  private interval: NodeJS.Timeout | null = null;

  private async findLatestEvidenceTimestamp(tenantId: string, evidenceType: EvidenceType): Promise<string | null> {
    if (evidenceType === "control_status") {
      const { data, error } = await this.supabase
        .from("compliance_control_status")
        .select("evidence_ts")
        .eq("tenant_id", tenantId)
        .order("evidence_ts", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.warn("ComplianceControlCheckService: failed control_status lookup", { tenantId, error: error.message });
        return null;
      }

      return (data?.evidence_ts as string | undefined) ?? null;
    }

    const baseQuery = this.supabase
      .from("audit_logs")
      .select("timestamp")
      .eq("tenant_id", tenantId)
      .order("timestamp", { ascending: false })
      .limit(1);

    if (evidenceType === "audit_logs") {
      const { data, error } = await baseQuery.maybeSingle();
      if (error) return null;
      return (data?.timestamp as string | undefined) ?? null;
    }

    if (evidenceType === "security_audit_log") {
      const { data, error } = await this.supabase
        .from("audit_logs")
        .select("timestamp")
        .eq("tenant_id", tenantId)
        .in("resource_type", ["security_alert", "security_event", "security_incident", "security_audit_log"])
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return (data?.timestamp as string | undefined) ?? null;
    }

    const { data, error } = await this.supabase
      .from("audit_logs")
      .select("timestamp")
      .eq("tenant_id", tenantId)
      .eq("archived", true)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return (data?.timestamp as string | undefined) ?? null;
  }

  async runChecksForTenant(tenantId: string, trigger: "scheduled" | "manual" = "scheduled"): Promise<AutomatedControlCheckSnapshot> {
    const checkedAt = new Date().toISOString();
    const controls = complianceControlMappingRegistry
      .listFrameworkMappings(["SOC2", "GDPR", "HIPAA"])
      .flatMap((mapping) =>
        mapping.controls.flatMap((control) =>
          control.required_evidence_types.map((evidenceType) => ({
            framework: mapping.framework,
            controlId: control.control_id,
            evidenceType,
          })),
        ),
      );

    const results: AutomatedControlCheckResult[] = [];

    for (const check of controls) {
      const latest = await this.findLatestEvidenceTimestamp(tenantId, check.evidenceType);
      const maxAge = FRESHNESS_BUDGET_MINUTES[check.evidenceType];
      const freshness = latest
        ? Math.max(0, (Date.now() - new Date(latest).getTime()) / 60000)
        : null;
      const isFresh = freshness !== null && freshness <= maxAge;

      results.push({
        control_id: check.controlId,
        framework: check.framework,
        evidence_type: check.evidenceType,
        status: isFresh ? "pass" : "fail",
        message: isFresh
          ? "Evidence artifact exists and is fresh."
          : latest
            ? `Evidence artifact is stale (${freshness?.toFixed(1)} minutes old).`
            : "Required evidence artifact is missing.",
        last_evidence_at: latest,
        max_age_minutes: maxAge,
        freshness_minutes: freshness ? Number(freshness.toFixed(2)) : null,
      });
    }

    const failingChecks = results.filter((item) => item.status === "fail");
    const snapshot: AutomatedControlCheckSnapshot = {
      run_id: crypto.randomUUID(),
      tenant_id: tenantId,
      checked_at: checkedAt,
      trigger,
      overall_status: failingChecks.length > 0 ? "fail" : "pass",
      failing_checks: failingChecks.length,
      results,
    };

    await this.supabase.from("compliance_control_audit").insert({
      tenant_id: tenantId,
      control_id: "automated_control_checks",
      event_type: "automated_control_check_ran",
      event_payload: snapshot,
      evidence_ts: checkedAt,
    });

    await auditLogService.createEntry({
      userId: "system",
      userName: "Compliance Control Check Job",
      userEmail: "compliance-bot@valueos.local",
      action: "compliance:automated_control_checks_ran",
      resourceType: "compliance_control_check",
      resourceId: snapshot.run_id,
      details: {
        tenant_id: tenantId,
        trigger,
        overall_status: snapshot.overall_status,
        failing_checks: snapshot.failing_checks,
      },
      status: snapshot.overall_status === "pass" ? "success" : "failed",
    });

    if (failingChecks.length > 0) {
      await this.supabase.from("compliance_control_audit").insert({
        tenant_id: tenantId,
        control_id: "automated_control_checks",
        event_type: "automated_control_check_alert_raised",
        event_payload: {
          run_id: snapshot.run_id,
          failures: failingChecks,
          alert: "compliance_control_check_regression",
        },
        evidence_ts: checkedAt,
      });
    }

    return snapshot;
  }

  async getLatestStatus(tenantId: string): Promise<AutomatedControlCheckSnapshot | null> {
    const { data, error } = await this.supabase
      .from("compliance_control_audit")
      .select("event_payload")
      .eq("tenant_id", tenantId)
      .eq("event_type", "automated_control_check_ran")
      .order("evidence_ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn("ComplianceControlCheckService: failed to fetch latest status", { tenantId, error: error.message });
      return null;
    }

    return (data?.event_payload as AutomatedControlCheckSnapshot | undefined) ?? null;
  }

  async runScheduledSweep(): Promise<void> {
    const { data, error } = await this.supabase.from("tenants").select("id");
    if (error) {
      logger.warn("ComplianceControlCheckService: failed loading tenants for scheduled sweep", { error: error.message });
      return;
    }

    const tenants = (data as Array<{ id: string }> | null) ?? [];
    for (const tenant of tenants) {
      await this.runChecksForTenant(tenant.id, "scheduled");
    }
  }

  start(intervalMs = 15 * 60 * 1000): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      void this.runScheduledSweep();
    }, intervalMs);
  }

  stop(): void {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }
}

export const complianceControlCheckService = new ComplianceControlCheckService();

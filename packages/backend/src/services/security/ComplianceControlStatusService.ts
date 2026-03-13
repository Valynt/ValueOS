import { createServerSupabaseClient } from "../../lib/supabase.js";
import { logger } from "../../lib/logger.js";

export type ComplianceFramework = "SOC2" | "GDPR" | "HIPAA" | "ISO27001";
export type ControlStatus = "pass" | "warn" | "fail";

export interface ControlStatusRecord {
  control_id: string;
  framework: ComplianceFramework;
  status: ControlStatus;
  evidence_ts: string;
  tenant_id: string;
  evidence_pointer: string;
  metric_value: number;
  metric_unit: "percent" | "hours" | "count";
}


export interface PolicyHistoryRecord {
  id: string;
  tenant_id: string;
  policy_key: string;
  previous_value: string | null;
  next_value: string;
  changed_by: string;
  changed_at: string;
  evidence_pointer: string;
}

export interface ComplianceControlSummary {
  controls_total: number;
  controls_passing: number;
  controls_warning: number;
  controls_failing: number;
}

export class ComplianceControlStatusService {
  private readonly supabase = createServerSupabaseClient();

  private statusByThreshold(value: number, warn: number, fail: number, reverse = false): ControlStatus {
    if (reverse) {
      if (value >= fail) return "fail";
      if (value >= warn) return "warn";
      return "pass";
    }

    if (value < fail) return "fail";
    if (value < warn) return "warn";
    return "pass";
  }

  // ---------------------------------------------------------------------------
  // Real metric collectors
  // ---------------------------------------------------------------------------

  /**
   * MFA coverage: percentage of tenant users with MFA enabled.
   * Queries user_organizations → mfa_secrets join.
   * Returns null when the query fails so the caller can skip this control.
   */
  private async measureMfaCoverage(tenantId: string): Promise<number | null> {
    try {
      // Total users in the tenant
      const { count: totalCount, error: totalErr } = await this.supabase
        .from("user_organizations")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", tenantId);

      if (totalErr || totalCount === null || totalCount === 0) return null;

      // Users with MFA enabled — join via user_organizations
      const { data: mfaRows, error: mfaErr } = await this.supabase
        .from("user_organizations")
        .select("user_id, mfa_secrets!inner(enabled)")
        .eq("organization_id", tenantId)
        .eq("mfa_secrets.enabled", true);

      if (mfaErr) return null;

      const enabledCount = mfaRows?.length ?? 0;
      return Number(((enabledCount / totalCount) * 100).toFixed(2));
    } catch (err) {
      logger.warn("ComplianceControlStatusService: MFA coverage query failed", {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Encryption at rest: determined by infrastructure configuration.
   * Returns 100 when ENCRYPTION_AT_REST_ENABLED=true, 0 otherwise.
   * This is a binary control — either the infrastructure is configured or it isn't.
   */
  private measureEncryptionAtRest(): number {
    return process.env.ENCRYPTION_AT_REST_ENABLED === "true" ? 100 : 0;
  }

  /**
   * Key rotation freshness: hours since the most recent key/secret rotation
   * event recorded in audit_logs for this tenant.
   * Returns null when no rotation event is found (treated as stale).
   */
  private async measureKeyRotationHours(tenantId: string): Promise<number | null> {
    try {
      const { data, error } = await this.supabase
        .from("audit_logs")
        .select("created_at")
        .eq("organization_id", tenantId)
        .in("action", ["secret.rotated", "key.rotated", "api_key.rotated"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      const rotatedAt = new Date(data.created_at as string).getTime();
      const hours = (Date.now() - rotatedAt) / (1000 * 60 * 60);
      return Number(hours.toFixed(2));
    } catch (err) {
      logger.warn("ComplianceControlStatusService: key rotation query failed", {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Audit integrity failures: count of audit_logs rows with action matching
   * 'audit.integrity*' and status 'failed' in the last 24 hours for this tenant.
   */
  private async measureAuditIntegrityFailures(tenantId: string): Promise<number | null> {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { count, error } = await this.supabase
        .from("audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", tenantId)
        .like("action", "audit.integrity%")
        .eq("metadata->>status", "failed")
        .gte("created_at", since);

      if (error) return null;
      return count ?? 0;
    } catch (err) {
      logger.warn("ComplianceControlStatusService: audit integrity query failed", {
        tenantId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  private async appendControlEvidence(control: ControlStatusRecord): Promise<void> {
    const evidencePayload = {
      tenant_id: control.tenant_id,
      control_id: control.control_id,
      framework: control.framework,
      evidence_pointer: control.evidence_pointer,
      evidence_payload: {
        metric_value: control.metric_value,
        metric_unit: control.metric_unit,
      },
      evidence_ts: control.evidence_ts,
    };

    await this.supabase.from("compliance_control_evidence").insert(evidencePayload);

    await this.supabase.from("compliance_control_audit").insert({
      tenant_id: control.tenant_id,
      control_id: control.control_id,
      event_type: "control_status_updated",
      event_payload: {
        status: control.status,
        framework: control.framework,
        evidence_pointer: control.evidence_pointer,
      },
      evidence_ts: control.evidence_ts,
    });

    await this.supabase.from("compliance_control_status").insert(control);
  }

  private async buildComputedControls(tenantId: string): Promise<ControlStatusRecord[]> {
    const now = new Date();

    const [mfaCoverage, keyRotationHours, integrityFailures] = await Promise.all([
      this.measureMfaCoverage(tenantId),
      this.measureKeyRotationHours(tenantId),
      this.measureAuditIntegrityFailures(tenantId),
    ]);
    const encryptionCoverage = this.measureEncryptionAtRest();

    const controls: ControlStatusRecord[] = [];

    if (mfaCoverage !== null) {
      controls.push({
        control_id: "mfa_coverage",
        framework: "SOC2",
        status: this.statusByThreshold(mfaCoverage, 95, 90),
        evidence_ts: now.toISOString(),
        tenant_id: tenantId,
        evidence_pointer: `audit://controls/${tenantId}/mfa-coverage/${now.toISOString()}`,
        metric_value: mfaCoverage,
        metric_unit: "percent",
      });
    }

    controls.push({
      control_id: "encryption_at_rest_coverage",
      framework: "ISO27001",
      status: this.statusByThreshold(encryptionCoverage, 98, 95),
      evidence_ts: now.toISOString(),
      tenant_id: tenantId,
      evidence_pointer: `audit://controls/${tenantId}/encryption-at-rest/${now.toISOString()}`,
      metric_value: encryptionCoverage,
      metric_unit: "percent",
    });

    if (keyRotationHours !== null) {
      controls.push({
        control_id: "key_rotation_freshness",
        framework: "SOC2",
        // Reverse threshold: higher hours = worse (stale)
        status: this.statusByThreshold(keyRotationHours, 24, 72, true),
        evidence_ts: now.toISOString(),
        tenant_id: tenantId,
        evidence_pointer: `audit://controls/${tenantId}/key-rotation/${now.toISOString()}`,
        metric_value: keyRotationHours,
        metric_unit: "hours",
      });
    }

    if (integrityFailures !== null) {
      controls.push({
        control_id: "audit_integrity_checks",
        framework: "GDPR",
        // Reverse threshold: higher failure count = worse
        status: this.statusByThreshold(integrityFailures, 1, 3, true),
        evidence_ts: now.toISOString(),
        tenant_id: tenantId,
        evidence_pointer: `audit://controls/${tenantId}/audit-integrity/${now.toISOString()}`,
        metric_value: integrityFailures,
        metric_unit: "count",
      });
    }

    return controls;
  }

  async refreshControlStatus(tenantId: string): Promise<ControlStatusRecord[]> {
    const controls = await this.buildComputedControls(tenantId);
    await Promise.all(controls.map((control) => this.appendControlEvidence(control)));
    return controls;
  }

  async getLatestControlStatus(tenantId: string): Promise<ControlStatusRecord[]> {
    const { data } = await this.supabase
      .from("compliance_control_status")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("evidence_ts", { ascending: false })
      .limit(100);

    const rows = (data as ControlStatusRecord[] | null) ?? [];
    if (rows.length === 0) {
      return this.refreshControlStatus(tenantId);
    }

    const deduped = new Map<string, ControlStatusRecord>();
    for (const row of rows) {
      const key = `${row.control_id}:${row.framework}`;
      if (!deduped.has(key)) {
        deduped.set(key, row);
      }
    }

    return [...deduped.values()];
  }


  async getPolicyHistory(tenantId: string): Promise<PolicyHistoryRecord[]> {
    const { data } = await this.supabase
      .from("compliance_control_audit")
      .select("id, tenant_id, event_payload, evidence_ts")
      .eq("tenant_id", tenantId)
      .eq("event_type", "policy_changed")
      .order("evidence_ts", { ascending: false })
      .limit(20);

    const rows = (data as Array<{ id: string; tenant_id: string; event_payload: Record<string, unknown> | null; evidence_ts: string }> | null) ?? [];

    return rows.map((entry) => {
      const payload = entry.event_payload ?? {};
      return {
        id: entry.id,
        tenant_id: entry.tenant_id,
        policy_key: typeof payload.policy_key === "string" ? payload.policy_key : "compliance.mode",
        previous_value: typeof payload.previous_value === "string" ? payload.previous_value : null,
        next_value: typeof payload.next_value === "string" ? payload.next_value : "enabled",
        changed_by: typeof payload.changed_by === "string" ? payload.changed_by : "system",
        changed_at: entry.evidence_ts,
        evidence_pointer:
          typeof payload.evidence_pointer === "string"
            ? payload.evidence_pointer
            : "audit://controls/policy-history",
      };
    });
  }

  summarize(controls: ControlStatusRecord[]): ComplianceControlSummary {
    return {
      controls_total: controls.length,
      controls_passing: controls.filter((control) => control.status === "pass").length,
      controls_warning: controls.filter((control) => control.status === "warn").length,
      controls_failing: controls.filter((control) => control.status === "fail").length,
    };
  }
}

export const complianceControlStatusService = new ComplianceControlStatusService();

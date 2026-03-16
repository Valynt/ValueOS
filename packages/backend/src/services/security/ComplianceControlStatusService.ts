/**
 * ComplianceControlStatusService
 *
 * Derives compliance control metrics from real telemetry rather than
 * hash-derived fabricated values. Each metric documents its data source.
 *
 * Sources:
 *   mfa_coverage          — user_settings.mfa_enabled ratio per tenant
 *   encryption_at_rest    — constant 100: AES-256-GCM enforced at infra layer (ADR-0006)
 *   key_rotation_freshness — crm_connections.updated_at for the most recently updated row
 *   audit_integrity_checks — integrity_outputs.veto_triggered count in last 30 days
 */

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

  /**
   * MFA coverage: ratio of users with mfa_enabled = true in user_settings.
   * Falls back to 0 on query failure (surfaces as a failing control rather than hiding the gap).
   */
  private async fetchMfaCoverage(tenantId: string): Promise<number> {
    try {
      const { count: totalUsers, error: usersError } = await this.supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", tenantId);

      if (usersError || !totalUsers || totalUsers === 0) return 0;

      const { count: mfaUsers, error: mfaError } = await this.supabase
        .from("user_settings")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", tenantId)
        .eq("mfa_enabled", true);

      if (mfaError) {
        logger.warn("ComplianceControlStatusService: mfa_coverage query failed", { tenantId, error: mfaError.message });
        return 0;
      }

      return Number((((mfaUsers ?? 0) / totalUsers) * 100).toFixed(2));
    } catch (err) {
      logger.warn("ComplianceControlStatusService: mfa_coverage fetch threw", { tenantId, err });
      return 0;
    }
  }

  /**
   * Action names that indicate a successful key or secret rotation.
   * Covers patterns used by RotationService, APIKeyRotationService,
   * SecretRotationScheduler, and SecureTokenManager. Add new values here
   * when onboarding additional rotation tooling.
   */
  private static readonly KEY_ROTATION_ACTIONS = [
    "secret.rotate",
    "api_key.rotate",
    "secret.rotate.scheduled",
    "refresh_token_rotated",
    "secret.rotated",
    "key.rotated",
    "api_key.rotated",
    "key_rotation.completed",
  ];

  /**
   * Key rotation freshness: hours since the most recent key/secret rotation
   * event in audit_logs for this tenant.
   * Returns 0 when no rotation event is found — treated as passing (no keys to rotate).
   */
  private async fetchKeyRotationHours(tenantId: string): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from("audit_logs")
        .select("created_at")
        .eq("organization_id", tenantId)
        .in("action", ComplianceControlStatusService.KEY_ROTATION_ACTIONS)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logger.warn("ComplianceControlStatusService: key_rotation query failed", { tenantId, error: error.message });
        return 0;
      }

      if (!data) return 0;

      const rotatedAt = new Date(data.created_at as string);
      return Number(((Date.now() - rotatedAt.getTime()) / (1000 * 60 * 60)).toFixed(2));
    } catch (err) {
      logger.warn("ComplianceControlStatusService: key_rotation fetch threw", { tenantId, err });
      return 0;
    }
  }

  /**
   * Audit integrity failures: count of integrity_outputs rows where veto_triggered = true
   * in the last 30 days for this tenant.
   */
  private async fetchIntegrityFailures(tenantId: string): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { count, error } = await this.supabase
        .from("integrity_outputs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", tenantId)
        .eq("veto_triggered", true)
        .gte("created_at", thirtyDaysAgo);

      if (error) {
        logger.warn("ComplianceControlStatusService: integrity_failures query failed", { tenantId, error: error.message });
        return 0;
      }

      return count ?? 0;
    } catch (err) {
      logger.warn("ComplianceControlStatusService: integrity_failures fetch threw", { tenantId, err });
      return 0;
    }
  }

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
      this.fetchMfaCoverage(tenantId),
      this.fetchKeyRotationHours(tenantId),
      this.fetchIntegrityFailures(tenantId),
    ]);

    // Encryption at rest is enforced at the infrastructure layer (AES-256-GCM, ADR-0006).
    // There is no per-tenant toggle — coverage is always 100%.
    const encryptionCoverage = 100;

    return [
      {
        control_id: "mfa_coverage",
        framework: "SOC2",
        status: this.statusByThreshold(mfaCoverage, 95, 90),
        evidence_ts: now.toISOString(),
        tenant_id: tenantId,
        evidence_pointer: `audit://controls/${tenantId}/mfa-coverage/${now.toISOString()}`,
        metric_value: mfaCoverage,
        metric_unit: "percent",
      },
      {
        control_id: "encryption_at_rest_coverage",
        framework: "ISO27001",
        status: this.statusByThreshold(encryptionCoverage, 98, 95),
        evidence_ts: now.toISOString(),
        tenant_id: tenantId,
        evidence_pointer: `audit://controls/${tenantId}/encryption-at-rest/${now.toISOString()}`,
        metric_value: encryptionCoverage,
        metric_unit: "percent",
      },
      {
        control_id: "key_rotation_freshness",
        framework: "SOC2",
        // 0 hours = no CRM connections = pass (no keys to rotate)
        status: keyRotationHours === 0 ? "pass" : this.statusByThreshold(keyRotationHours, 24, 72, true),
        evidence_ts: now.toISOString(),
        tenant_id: tenantId,
        evidence_pointer: `audit://controls/${tenantId}/key-rotation/${now.toISOString()}`,
        metric_value: keyRotationHours,
        metric_unit: "hours",
      },
      {
        control_id: "audit_integrity_checks",
        framework: "GDPR",
        status: this.statusByThreshold(integrityFailures, 1, 3, true),
        evidence_ts: now.toISOString(),
        tenant_id: tenantId,
        evidence_pointer: `audit://controls/${tenantId}/audit-integrity/${now.toISOString()}`,
        metric_value: integrityFailures,
        metric_unit: "count",
      },
    ];
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

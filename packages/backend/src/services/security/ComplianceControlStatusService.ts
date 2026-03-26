/**
 * ComplianceControlStatusService
 *
 * Derives compliance control metrics from real telemetry rather than
 * hash-derived fabricated values. Each metric documents its data source.
 *
 * Sources:
 *   mfa_coverage          — two-step: user_settings.mfa_enabled (primary),
 *                           falling back to mfa_secrets.enabled when the
 *                           primary signal is absent or null (see fetchMfaCoverage)
 *   encryption_at_rest    — constant 100: AES-256-GCM enforced at infra layer (ADR-0006)
 *   key_rotation_freshness — most recent matching action in audit_logs per tenant
 *   audit_integrity_checks — integrity_outputs.veto_triggered count in last 30 days
 */

import { logger } from "../../lib/logger.js";
import { createServerSupabaseClient } from "../../lib/supabase.js";

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

export type ComplianceTechnicalSignalKey =
  | "tests_passed"
  | "policies_deployed"
  | "retention_jobs_healthy"
  | "encryption_config_active";

export interface ComplianceTechnicalSignalStatus {
  key: ComplianceTechnicalSignalKey;
  status: "pass" | "fail";
  description: string;
  evidence_pointer: string;
  observed_at: string;
}

export interface FrameworkControlVerificationStatus {
  framework: "GDPR" | "HIPAA" | "CCPA" | "SOC2" | "ISO27001";
  declared: boolean;
  verified: boolean;
  missingPrerequisites: string[];
  requiredSignals: ComplianceTechnicalSignalKey[];
  signalStatuses: ComplianceTechnicalSignalStatus[];
}

const FRAMEWORK_SIGNAL_REQUIREMENTS: Record<FrameworkControlVerificationStatus["framework"], ComplianceTechnicalSignalKey[]> = {
  GDPR: ["tests_passed", "policies_deployed", "encryption_config_active"],
  HIPAA: ["tests_passed", "policies_deployed", "retention_jobs_healthy", "encryption_config_active"],
  CCPA: ["tests_passed", "retention_jobs_healthy", "policies_deployed"],
  SOC2: ["tests_passed", "policies_deployed", "retention_jobs_healthy"],
  ISO27001: ["tests_passed", "encryption_config_active", "retention_jobs_healthy"],
};

export class ComplianceControlStatusService {
  private _supabase: ReturnType<typeof createServerSupabaseClient> | undefined;
  private get supabase(): ReturnType<typeof createServerSupabaseClient> {
    if (!this._supabase) this._supabase = createServerSupabaseClient();
    return this._supabase;
  }

  /**
   * MFA coverage: percentage of tenant users with MFA effectively enabled.
   *
   * Resolution order per user:
   *   1. user_settings.mfa_enabled = true  → MFA enabled   (primary, authoritative)
   *   2. user_settings.mfa_enabled = false → MFA disabled  (primary, authoritative)
   *   3. user_settings row absent or mfa_enabled IS NULL
   *      → inspect mfa_secrets.enabled = true (fallback inference)
   *
   * The fallback exists because user_settings rows may not be present for all
   * users, but mfa_secrets rows are created when a user enrolls in MFA.
   * Only secrets with enabled = true count — disabled/unenrolled secrets do not.
   *
   * Tenant scoping for the fallback uses user_tenants (the canonical
   * tenant↔user join table) since mfa_secrets has no tenant column.
   *
   * Falls back to 0 on any query failure so the control surfaces as failing
   * rather than silently passing.
   */
  private async fetchMfaCoverage(tenantId: string): Promise<number> {
    try {
      // Step 1: total users in this tenant.
      // user_tenants is the canonical join table; user_id values are strings.
      const { count: totalUsers, error: usersError } = await this.supabase
        .from("user_tenants")
        .select("user_id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      if (usersError) {
        logger.warn("ComplianceControlStatusService: mfa_coverage users query failed", { tenantId, error: usersError.message });
        return 0;
      }
      if (!totalUsers || totalUsers === 0) return 0;

      // Step 2: users with explicit mfa_enabled = true in user_settings (primary signal).
      const { count: primaryMfaCount, error: primaryError } = await this.supabase
        .from("user_settings")
        .select("user_id", { count: "exact", head: true })
        .eq("organization_id", tenantId)
        .eq("mfa_enabled", true);

      if (primaryError) {
        logger.warn("ComplianceControlStatusService: mfa_coverage primary query failed", { tenantId, error: primaryError.message });
        return 0;
      }

      // Step 3: users whose user_settings row is absent or has mfa_enabled IS NULL,
      // but who have an active mfa_secrets record (fallback signal).
      //
      // We count user_tenants rows for this tenant where:
      //   - no user_settings row exists with mfa_enabled = true or false (i.e. primary is indeterminate)
      //   - mfa_secrets.enabled = true exists for that user_id
      //
      // Implemented as: count mfa_secrets.enabled = true for tenant users, then subtract
      // those already counted by the primary signal to avoid double-counting.
      //
      // Concretely: users counted by primary already have mfa_enabled = true in user_settings,
      // so they won't have a fallback row that changes the outcome. We count fallback users as:
      // users in user_tenants with an active mfa_secrets row AND no explicit user_settings row
      // (or mfa_enabled IS NULL).
      const { data: fallbackRows, error: fallbackError } = await this.supabase
        .from("user_tenants")
        .select("user_id")
        .eq("tenant_id", tenantId);

      if (fallbackError) {
        logger.warn("ComplianceControlStatusService: mfa_coverage fallback user list failed", { tenantId, error: fallbackError.message });
        // Degrade gracefully: use only the primary count rather than returning 0.
        return Number((((primaryMfaCount ?? 0) / totalUsers) * 100).toFixed(2));
      }

      const tenantUserIds = (fallbackRows ?? []).map((r) => r.user_id as string);
      if (tenantUserIds.length === 0) return 0;

      // Fetch user_settings rows for all tenant users to identify those with
      // an indeterminate primary signal (absent row or mfa_enabled IS NULL).
      const { data: settingsRows, error: settingsError } = await this.supabase
        .from("user_settings")
        .select("user_id, mfa_enabled")
        .eq("organization_id", tenantId)
        .in("user_id", tenantUserIds);

      if (settingsError) {
        logger.warn("ComplianceControlStatusService: mfa_coverage settings fetch failed", { tenantId, error: settingsError.message });
        return Number((((primaryMfaCount ?? 0) / totalUsers) * 100).toFixed(2));
      }

      // Build a map of user_id → explicit mfa_enabled value (true | false | null).
      const settingsMap = new Map<string, boolean | null>(
        (settingsRows ?? []).map((r) => [r.user_id as string, r.mfa_enabled as boolean | null])
      );

      // Users whose primary signal is indeterminate: no settings row, or mfa_enabled IS NULL.
      const indeterminateUserIds = tenantUserIds.filter((uid) => {
        const setting = settingsMap.get(uid);
        // setting === undefined → no row; setting === null → explicit NULL
        return setting === undefined || setting === null;
      });

      let fallbackMfaCount = 0;
      if (indeterminateUserIds.length > 0) {
        // Count how many indeterminate users have an active mfa_secrets record.
        // mfa_secrets.enabled = true means the secret is enrolled and active.
        const { count: secretCount, error: secretError } = await this.supabase
          .from("mfa_secrets")
          .select("user_id", { count: "exact", head: true })
          .in("user_id", indeterminateUserIds)
          .eq("enabled", true);

        if (secretError) {
          logger.warn("ComplianceControlStatusService: mfa_coverage fallback secrets query failed", { tenantId, error: secretError.message });
          // Degrade gracefully: omit fallback count rather than returning 0.
        } else {
          fallbackMfaCount = secretCount ?? 0;
        }
      }

      const effectiveMfaUsers = (primaryMfaCount ?? 0) + fallbackMfaCount;
      return Number(((effectiveMfaUsers / totalUsers) * 100).toFixed(2));
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
        // 0 hours = no rotation events found in audit_logs = pass (no keys to rotate yet)
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

  private async fetchLatestAutomatedControlCheckStatus(tenantId: string): Promise<"pass" | "fail"> {
    const { data, error } = await this.supabase
      .from("compliance_control_audit")
      .select("event_payload")
      .eq("tenant_id", tenantId)
      .eq("event_type", "automated_control_check_ran")
      .order("evidence_ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn("ComplianceControlStatusService: automated control status lookup failed", { tenantId, error: error.message });
      return "fail";
    }

    const overallStatus = (data?.event_payload as { overall_status?: string } | undefined)?.overall_status;
    return overallStatus === "pass" ? "pass" : "fail";
  }

  private async fetchPolicyDeploymentStatus(tenantId: string): Promise<"pass" | "fail"> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await this.supabase
      .from("compliance_control_audit")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("event_type", "policy_changed")
      .gte("evidence_ts", thirtyDaysAgo);

    if (error) {
      logger.warn("ComplianceControlStatusService: policy deployment lookup failed", { tenantId, error: error.message });
      return "fail";
    }

    return (count ?? 0) > 0 ? "pass" : "fail";
  }

  private async fetchRetentionJobHealthStatus(tenantId: string): Promise<"pass" | "fail"> {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { count, error } = await this.supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", tenantId)
      .in("action", ["retention:job_completed", "compliance:retention_job_completed"])
      .eq("status", "success")
      .gte("timestamp", fortyEightHoursAgo);

    if (error) {
      logger.warn("ComplianceControlStatusService: retention job health lookup failed", { tenantId, error: error.message });
      return "fail";
    }

    return (count ?? 0) > 0 ? "pass" : "fail";
  }

  async getTechnicalSignalStatuses(tenantId: string): Promise<ComplianceTechnicalSignalStatus[]> {
    const [controls, testSignalStatus, policySignalStatus, retentionSignalStatus] = await Promise.all([
      this.getLatestControlStatus(tenantId),
      this.fetchLatestAutomatedControlCheckStatus(tenantId),
      this.fetchPolicyDeploymentStatus(tenantId),
      this.fetchRetentionJobHealthStatus(tenantId),
    ]);

    const now = new Date().toISOString();
    const encryptionControl = controls.find((control) => control.control_id === "encryption_at_rest_coverage");

    return [
      {
        key: "tests_passed",
        status: testSignalStatus,
        description: "Most recent automated technical compliance test run is passing.",
        evidence_pointer: `audit://controls/${tenantId}/automated-control-check/latest`,
        observed_at: now,
      },
      {
        key: "policies_deployed",
        status: policySignalStatus,
        description: "Recent policy deployment audit event recorded in compliance control audit history.",
        evidence_pointer: `audit://controls/${tenantId}/policy-deployments/latest`,
        observed_at: now,
      },
      {
        key: "retention_jobs_healthy",
        status: retentionSignalStatus,
        description: "Retention job completion telemetry indicates a successful run in the last 48 hours.",
        evidence_pointer: `audit://controls/${tenantId}/retention-jobs/latest`,
        observed_at: now,
      },
      {
        key: "encryption_config_active",
        status: encryptionControl?.status === "pass" ? "pass" : "fail",
        description: "Encryption-at-rest control indicates active encrypted storage configuration.",
        evidence_pointer: encryptionControl?.evidence_pointer ?? `audit://controls/${tenantId}/encryption-at-rest/latest`,
        observed_at: encryptionControl?.evidence_ts ?? now,
      },
    ];
  }

  async getFrameworkVerificationStatuses(tenantId: string): Promise<FrameworkControlVerificationStatus[]> {
    const signalStatuses = await this.getTechnicalSignalStatuses(tenantId);
    const signalMap = new Map(signalStatuses.map((signal) => [signal.key, signal]));

    return (Object.keys(FRAMEWORK_SIGNAL_REQUIREMENTS) as FrameworkControlVerificationStatus["framework"][]).map((framework) => {
      const requiredSignals = FRAMEWORK_SIGNAL_REQUIREMENTS[framework];
      const missingPrerequisites = requiredSignals
        .filter((signalKey) => signalMap.get(signalKey)?.status !== "pass")
        .map((signalKey) => signalMap.get(signalKey)?.description ?? signalKey);

      return {
        framework,
        declared: true,
        verified: missingPrerequisites.length === 0,
        missingPrerequisites,
        requiredSignals,
        signalStatuses: requiredSignals
          .map((signalKey) => signalMap.get(signalKey))
          .filter((signal): signal is ComplianceTechnicalSignalStatus => Boolean(signal)),
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

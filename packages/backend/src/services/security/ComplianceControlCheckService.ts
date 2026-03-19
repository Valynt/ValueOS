import { randomUUID } from "crypto";

import { validateServiceIdentityConfig } from "../../middleware/serviceIdentityMiddleware.js";
import { logger } from "../../lib/logger.js";
import { createServerSupabaseClient } from "../../lib/supabase.js";

import { auditLogService } from "./AuditLogService.js";
import {
  complianceControlMappingRegistry,
  type ComplianceFramework,
  type EvidenceType,
} from "./ComplianceControlMappingRegistry.js";
import { complianceFrameworkCapabilityGate } from "./ComplianceFrameworkCapabilityGate.js";

export type AutomatedControlCheckStatus = "pass" | "fail";
export type AutomatedControlCheckKind = "evidence_freshness" | "technical_validation";

export interface AutomatedControlCheckResult {
  control_id: string;
  framework: ComplianceFramework;
  check_kind: AutomatedControlCheckKind;
  assertion_id: string;
  evidence_type: EvidenceType | null;
  status: AutomatedControlCheckStatus;
  message: string;
  last_evidence_at: string | null;
  max_age_minutes: number | null;
  freshness_minutes: number | null;
  details?: Record<string, unknown>;
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

interface RpcCapableSupabaseClient {
  from(table: string): {
    select(query: string): {
      eq(field: string, value: unknown): unknown;
      in(field: string, values: unknown[]): unknown;
      order(field: string, options: { ascending: boolean }): unknown;
      limit(count: number): unknown;
      maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
    };
    insert(payload: Record<string, unknown>): Promise<{ error: unknown | null }>;
  };
  rpc?: (fn: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
}

interface RlsVerificationRow {
  table_name: string;
  rls_enabled: boolean;
  policy_count: number;
  has_not_null_constraint: boolean;
}

interface TechnicalAssertionDefinition {
  framework: ComplianceFramework;
  control_id: string;
  assertion_id: string;
  execute: (tenantId: string) => Promise<AutomatedControlCheckResult>;
}

const FRESHNESS_BUDGET_MINUTES: Record<EvidenceType, number> = {
  audit_logs: 60 * 24,
  security_audit_log: 60 * 12,
  audit_logs_archive: 60 * 24 * 30,
  security_audit_log_archive: 60 * 24 * 30,
  control_status: 60 * 24,
};

const CONCURRENT_TENANT_CHECKS = 5;
const ENCRYPTION_KEY_PATTERN = /^(pbkdf2:|hex:|base64:)|.{44,}$/;

const FRAMEWORK_RLS_REQUIREMENTS: Record<ComplianceFramework, string[]> = {
  GDPR: [
    "audit_logs",
    "audit_logs_archive",
    "compliance_control_status",
    "compliance_control_audit",
    "compliance_control_evidence",
  ],
  HIPAA: [
    "audit_logs",
    "security_audit_log",
    "compliance_control_status",
    "compliance_control_audit",
    "mfa_secrets",
  ],
  CCPA: ["audit_logs", "audit_logs_archive", "compliance_control_status"],
  SOC2: [
    "audit_logs",
    "security_audit_log",
    "compliance_control_status",
    "compliance_control_audit",
    "user_settings",
    "user_tenants",
  ],
  ISO27001: ["audit_logs", "security_audit_log", "compliance_control_status"],
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function normalizeRows(data: unknown): RlsVerificationRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap((row) => {
    if (typeof row !== "object" || row === null) {
      return [];
    }

    const candidate = row as Record<string, unknown>;
    if (!isNonEmptyString(candidate.table_name)) {
      return [];
    }

    return [{
      table_name: candidate.table_name,
      rls_enabled: candidate.rls_enabled === true,
      policy_count: typeof candidate.policy_count === "number" ? candidate.policy_count : 0,
      has_not_null_constraint: candidate.has_not_null_constraint === true,
    } satisfies RlsVerificationRow];
  });
}

export class ComplianceControlCheckService {
  private readonly supabase = createServerSupabaseClient() as unknown as RpcCapableSupabaseClient;
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

      return isNonEmptyString(data?.evidence_ts) ? data.evidence_ts : null;
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
      return isNonEmptyString(data?.timestamp) ? data.timestamp : null;
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
      return isNonEmptyString(data?.timestamp) ? data.timestamp : null;
    }

    if (evidenceType === "audit_logs_archive") {
      const { data, error } = await this.supabase
        .from("audit_logs_archive")
        .select("timestamp")
        .eq("tenant_id", tenantId)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return isNonEmptyString(data?.timestamp) ? data.timestamp : null;
    }

    if (evidenceType === "security_audit_log_archive") {
      const { data, error } = await this.supabase
        .from("security_audit_log_archive")
        .select("timestamp")
        .eq("tenant_id", tenantId)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return isNonEmptyString(data?.timestamp) ? data.timestamp : null;
    }

    return null;
  }

  private async validateRequiredTableRls(framework: ComplianceFramework, controlId: string, assertionId: string): Promise<AutomatedControlCheckResult> {
    const requiredTables = FRAMEWORK_RLS_REQUIREMENTS[framework] ?? [];

    if (!this.supabase.rpc) {
      return {
        control_id: controlId,
        framework,
        check_kind: "technical_validation",
        assertion_id: assertionId,
        evidence_type: null,
        status: "fail",
        message: "Database metadata RPC is unavailable; unable to verify required-table RLS posture.",
        last_evidence_at: null,
        max_age_minutes: null,
        freshness_minutes: null,
        details: { required_tables: requiredTables },
      };
    }

    const { data, error } = await this.supabase.rpc("verify_rls_tenant_isolation");
    if (error) {
      logger.warn("ComplianceControlCheckService: failed RLS verification RPC", { framework, error: error.message });
      return {
        control_id: controlId,
        framework,
        check_kind: "technical_validation",
        assertion_id: assertionId,
        evidence_type: null,
        status: "fail",
        message: `Unable to verify RLS posture for required tables: ${error.message}`,
        last_evidence_at: null,
        max_age_minutes: null,
        freshness_minutes: null,
        details: { required_tables: requiredTables },
      };
    }

    const rowMap = new Map(normalizeRows(data).map((row) => [row.table_name, row]));
    const missingTables: string[] = [];
    const failingTables: string[] = [];

    for (const tableName of requiredTables) {
      const row = rowMap.get(tableName);
      if (!row) {
        missingTables.push(tableName);
        continue;
      }

      if (!row.rls_enabled || row.policy_count < 1 || !row.has_not_null_constraint) {
        failingTables.push(tableName);
      }
    }

    if (missingTables.length === 0 && failingTables.length === 0) {
      return {
        control_id: controlId,
        framework,
        check_kind: "technical_validation",
        assertion_id: assertionId,
        evidence_type: null,
        status: "pass",
        message: "RLS is enabled on all required tenant-scoped tables with tenant constraints in place.",
        last_evidence_at: null,
        max_age_minutes: null,
        freshness_minutes: null,
        details: { required_tables: requiredTables },
      };
    }

    const problems = [
      missingTables.length > 0 ? `missing metadata for ${missingTables.join(", ")}` : null,
      failingTables.length > 0 ? `failing posture on ${failingTables.join(", ")}` : null,
    ].filter(isNonEmptyString);

    return {
      control_id: controlId,
      framework,
      check_kind: "technical_validation",
      assertion_id: assertionId,
      evidence_type: null,
      status: "fail",
      message: `Required-table RLS validation failed: ${problems.join("; ")}.`,
      last_evidence_at: null,
      max_age_minutes: null,
      freshness_minutes: null,
      details: {
        required_tables: requiredTables,
        missing_tables: missingTables,
        failing_tables: failingTables,
      },
    };
  }

  private async validateImmutableAuditProtections(framework: ComplianceFramework, controlId: string, assertionId: string, tenantId: string): Promise<AutomatedControlCheckResult> {
    const { data, error } = await this.supabase
      .from("audit_logs")
      .select("timestamp, integrity_hash, previous_hash")
      .eq("tenant_id", tenantId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn("ComplianceControlCheckService: failed audit immutability lookup", { tenantId, framework, error: error.message });
      return {
        control_id: controlId,
        framework,
        check_kind: "technical_validation",
        assertion_id: assertionId,
        evidence_type: null,
        status: "fail",
        message: `Unable to inspect immutable audit protections: ${error.message}`,
        last_evidence_at: null,
        max_age_minutes: null,
        freshness_minutes: null,
      };
    }

    const integrityHash = data?.integrity_hash;
    const previousHash = data?.previous_hash;
    const timestamp = isNonEmptyString(data?.timestamp) ? data.timestamp : null;
    const hasIntegrity = isNonEmptyString(integrityHash);
    const hasChainContext = previousHash === null || isNonEmptyString(previousHash);

    if (hasIntegrity && hasChainContext) {
      return {
        control_id: controlId,
        framework,
        check_kind: "technical_validation",
        assertion_id: assertionId,
        evidence_type: null,
        status: "pass",
        message: "Immutable audit protections are present: the audit log exposes an integrity hash chain.",
        last_evidence_at: timestamp,
        max_age_minutes: null,
        freshness_minutes: null,
      };
    }

    return {
      control_id: controlId,
      framework,
      check_kind: "technical_validation",
      assertion_id: assertionId,
      evidence_type: null,
      status: "fail",
      message: "Immutable audit protections could not be confirmed from the latest audit record.",
      last_evidence_at: timestamp,
      max_age_minutes: null,
      freshness_minutes: null,
      details: {
        has_integrity_hash: hasIntegrity,
        has_previous_hash_context: hasChainContext,
      },
    };
  }

  private buildEncryptionConfigResult(framework: ComplianceFramework, controlId: string, assertionId: string): AutomatedControlCheckResult {
    const nodeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
    const encryptionKey = process.env.APP_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY;

    if (nodeEnv !== "production") {
      return {
        control_id: controlId,
        framework,
        check_kind: "technical_validation",
        assertion_id: assertionId,
        evidence_type: null,
        status: "pass",
        message: "Encryption-required production configuration is not applicable outside production.",
        last_evidence_at: null,
        max_age_minutes: null,
        freshness_minutes: null,
        details: { node_env: nodeEnv },
      };
    }

    const isValid = isNonEmptyString(encryptionKey) && ENCRYPTION_KEY_PATTERN.test(encryptionKey);
    return {
      control_id: controlId,
      framework,
      check_kind: "technical_validation",
      assertion_id: assertionId,
      evidence_type: null,
      status: isValid ? "pass" : "fail",
      message: isValid
        ? "Production encryption-required configuration is enforced."
        : "Production encryption-required configuration is missing or too weak.",
      last_evidence_at: null,
      max_age_minutes: null,
      freshness_minutes: null,
      details: { node_env: nodeEnv, encryption_key_configured: isValid },
    };
  }

  private buildMfaEnforcementResult(framework: ComplianceFramework, controlId: string, assertionId: string): AutomatedControlCheckResult {
    const nodeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
    const mfaEnabled = process.env.MFA_ENABLED === "true";

    if (nodeEnv !== "production") {
      return {
        control_id: controlId,
        framework,
        check_kind: "technical_validation",
        assertion_id: assertionId,
        evidence_type: null,
        status: "pass",
        message: "Production MFA enforcement is not applicable outside production.",
        last_evidence_at: null,
        max_age_minutes: null,
        freshness_minutes: null,
        details: { node_env: nodeEnv },
      };
    }

    return {
      control_id: controlId,
      framework,
      check_kind: "technical_validation",
      assertion_id: assertionId,
      evidence_type: null,
      status: mfaEnabled ? "pass" : "fail",
      message: mfaEnabled
        ? "MFA is enforced for production access."
        : "MFA is not enforced in production.",
      last_evidence_at: null,
      max_age_minutes: null,
      freshness_minutes: null,
      details: { node_env: nodeEnv, mfa_enabled: mfaEnabled },
    };
  }

  private buildServiceIdentityResult(framework: ComplianceFramework, controlId: string, assertionId: string): AutomatedControlCheckResult {
    try {
      validateServiceIdentityConfig();
      return {
        control_id: controlId,
        framework,
        check_kind: "technical_validation",
        assertion_id: assertionId,
        evidence_type: null,
        status: "pass",
        message: "Service identity is configured for protected internal routes.",
        last_evidence_at: null,
        max_age_minutes: null,
        freshness_minutes: null,
      };
    } catch (error) {
      return {
        control_id: controlId,
        framework,
        check_kind: "technical_validation",
        assertion_id: assertionId,
        evidence_type: null,
        status: "fail",
        message: error instanceof Error
          ? error.message
          : "Service identity is not configured for protected internal routes.",
        last_evidence_at: null,
        max_age_minutes: null,
        freshness_minutes: null,
      };
    }
  }

  private buildTechnicalAssertions(): TechnicalAssertionDefinition[] {
    return [
      {
        framework: "GDPR",
        control_id: "gdpr_art_32_security_processing",
        assertion_id: "gdpr_art_32_required_table_rls",
        execute: async () => this.validateRequiredTableRls("GDPR", "gdpr_art_32_security_processing", "gdpr_art_32_required_table_rls"),
      },
      {
        framework: "GDPR",
        control_id: "gdpr_art_32_security_processing",
        assertion_id: "gdpr_art_32_encryption_required_config",
        execute: async () => this.buildEncryptionConfigResult("GDPR", "gdpr_art_32_security_processing", "gdpr_art_32_encryption_required_config"),
      },
      {
        framework: "SOC2",
        control_id: "soc2_cc6_change_mgmt",
        assertion_id: "soc2_cc6_required_table_rls",
        execute: async () => this.validateRequiredTableRls("SOC2", "soc2_cc6_change_mgmt", "soc2_cc6_required_table_rls"),
      },
      {
        framework: "SOC2",
        control_id: "soc2_cc6_change_mgmt",
        assertion_id: "soc2_cc6_mfa_enforced_in_production",
        execute: async () => this.buildMfaEnforcementResult("SOC2", "soc2_cc6_change_mgmt", "soc2_cc6_mfa_enforced_in_production"),
      },
      {
        framework: "SOC2",
        control_id: "soc2_cc7_monitoring",
        assertion_id: "soc2_cc7_service_identity_internal_routes",
        execute: async () => this.buildServiceIdentityResult("SOC2", "soc2_cc7_monitoring", "soc2_cc7_service_identity_internal_routes"),
      },
      {
        framework: "HIPAA",
        control_id: "hipaa_164_312_b_audit_controls",
        assertion_id: "hipaa_164_312_b_immutable_audit_protections",
        execute: async (tenantId) => this.validateImmutableAuditProtections("HIPAA", "hipaa_164_312_b_audit_controls", "hipaa_164_312_b_immutable_audit_protections", tenantId),
      },
      {
        framework: "HIPAA",
        control_id: "hipaa_164_312_c_integrity",
        assertion_id: "hipaa_164_312_c_required_table_rls",
        execute: async () => this.validateRequiredTableRls("HIPAA", "hipaa_164_312_c_integrity", "hipaa_164_312_c_required_table_rls"),
      },
      {
        framework: "HIPAA",
        control_id: "hipaa_164_312_c_integrity",
        assertion_id: "hipaa_164_312_e_encryption_required_config",
        execute: async () => this.buildEncryptionConfigResult("HIPAA", "hipaa_164_312_c_integrity", "hipaa_164_312_e_encryption_required_config"),
      },
      {
        framework: "HIPAA",
        control_id: "hipaa_164_312_c_integrity",
        assertion_id: "hipaa_164_312_d_mfa_enforced_in_production",
        execute: async () => this.buildMfaEnforcementResult("HIPAA", "hipaa_164_312_c_integrity", "hipaa_164_312_d_mfa_enforced_in_production"),
      },
    ];
  }

  private async runEvidenceFreshnessChecks(tenantId: string): Promise<AutomatedControlCheckResult[]> {
    const supportedFrameworks = complianceFrameworkCapabilityGate.getSupportedFrameworks().filter(
      (framework): framework is ComplianceFramework => ["SOC2", "GDPR", "HIPAA"].includes(framework),
    );

    const controls = complianceControlMappingRegistry
      .listFrameworkMappings(supportedFrameworks)
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
        check_kind: "evidence_freshness",
        assertion_id: `${check.controlId}:${check.evidenceType}:freshness`,
        evidence_type: check.evidenceType,
        status: isFresh ? "pass" : "fail",
        message: isFresh
          ? "Evidence artifact exists and is fresh."
          : latest
            ? `Evidence artifact is stale (${freshness?.toFixed(1)} minutes old).`
            : "Required evidence artifact is missing.",
        last_evidence_at: latest,
        max_age_minutes: maxAge,
        freshness_minutes: freshness !== null ? Number(freshness.toFixed(2)) : null,
      });
    }

    return results;
  }

  private async runTechnicalValidationChecks(tenantId: string): Promise<AutomatedControlCheckResult[]> {
    const supportedFrameworks = new Set(complianceFrameworkCapabilityGate.getSupportedFrameworks());
    const assertions = this.buildTechnicalAssertions().filter((assertion) => supportedFrameworks.has(assertion.framework));

    const results: AutomatedControlCheckResult[] = [];
    for (const assertion of assertions) {
      results.push(await assertion.execute(tenantId));
    }

    return results;
  }

  async runChecksForTenant(tenantId: string, trigger: "scheduled" | "manual" = "scheduled"): Promise<AutomatedControlCheckSnapshot> {
    const checkedAt = new Date().toISOString();
    const evidenceResults = await this.runEvidenceFreshnessChecks(tenantId);
    const technicalResults = await this.runTechnicalValidationChecks(tenantId);
    const results = [...evidenceResults, ...technicalResults];

    const failingChecks = results.filter((item) => item.status === "fail");
    const snapshot: AutomatedControlCheckSnapshot = {
      run_id: randomUUID(),
      tenant_id: tenantId,
      checked_at: checkedAt,
      trigger,
      overall_status: failingChecks.length > 0 ? "fail" : "pass",
      failing_checks: failingChecks.length,
      results,
    };

    const { error: runAuditInsertError } = await this.supabase.from("compliance_control_audit").insert({
      tenant_id: tenantId,
      control_id: "automated_control_checks",
      event_type: "automated_control_check_ran",
      event_payload: snapshot,
      evidence_ts: checkedAt,
    });

    if (runAuditInsertError) {
      logger.error("Failed to insert automated_control_check_ran audit record", {
        tenant_id: tenantId,
        run_id: snapshot.run_id,
        error: runAuditInsertError,
      });
    }

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
        evidence_failures: evidenceResults.filter((result) => result.status === "fail").length,
        technical_failures: technicalResults.filter((result) => result.status === "fail").length,
      },
      status: snapshot.overall_status === "pass" ? "success" : "failed",
    });

    if (failingChecks.length > 0) {
      const { error: alertInsertError } = await this.supabase.from("compliance_control_audit").insert({
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

      if (alertInsertError) {
        logger.error("Failed to insert automated_control_check_alert_raised record", {
          tenant_id: tenantId,
          run_id: snapshot.run_id,
          failing_checks_count: failingChecks.length,
          error: alertInsertError,
        });
      }
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
    const { data, error } = await this.supabase.from("tenants").select("id") as { data: Array<{ id: string }> | null; error: { message: string } | null };
    if (error) {
      logger.warn("ComplianceControlCheckService: failed loading tenants for scheduled sweep", { error: error.message });
      return;
    }

    const tenants = data ?? [];
    for (let i = 0; i < tenants.length; i += CONCURRENT_TENANT_CHECKS) {
      const batch = tenants.slice(i, i + CONCURRENT_TENANT_CHECKS);
      await Promise.all(
        batch.map(async (tenant) => {
          try {
            await this.runChecksForTenant(tenant.id, "scheduled");
          } catch (err) {
            logger.warn("ComplianceControlCheckService: scheduled sweep failed for tenant", {
              tenantId: tenant.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }),
      );
    }
  }

  start(intervalMs = 15 * 60 * 1000): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      void this.runScheduledSweep().catch((error) => {
        logger.error("ComplianceControlCheckService: scheduled sweep failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, intervalMs);
    this.interval.unref?.();
  }

  stop(): void {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }
}

let _complianceControlCheckService: ComplianceControlCheckService | null = null;

function getComplianceControlCheckServiceInstance(): ComplianceControlCheckService {
  if (_complianceControlCheckService === null) {
    _complianceControlCheckService = new ComplianceControlCheckService();
  }
  return _complianceControlCheckService;
}

const complianceControlCheckServiceProxyHandler: ProxyHandler<ComplianceControlCheckService> = {
  get(_target, prop, _receiver) {
    const instance = getComplianceControlCheckServiceInstance();
    const value = (instance as Record<PropertyKey, unknown>)[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(instance);
    }
    return value;
  },
  set(_target, prop, value) {
    const instance = getComplianceControlCheckServiceInstance();
    (instance as Record<PropertyKey, unknown>)[prop] = value;
    return true;
  },
  has(_target, prop) {
    const instance = getComplianceControlCheckServiceInstance();
    return prop in instance;
  },
  ownKeys(_target) {
    const instance = getComplianceControlCheckServiceInstance();
    return Reflect.ownKeys(instance);
  },
  getOwnPropertyDescriptor(_target, prop) {
    const instance = getComplianceControlCheckServiceInstance();
    const descriptor = Object.getOwnPropertyDescriptor(instance, prop);
    if (!descriptor) return undefined;
    return { ...descriptor, configurable: true };
  },
};

export const complianceControlCheckService: ComplianceControlCheckService = new Proxy(
  {} as ComplianceControlCheckService,
  complianceControlCheckServiceProxyHandler,
);

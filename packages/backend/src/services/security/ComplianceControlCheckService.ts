import { logger } from "../../lib/logger.js";
// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from "../../lib/supabase.js";
import crypto from "node:crypto";

import { auditLogService } from "./AuditLogService.js";
import { complianceEvidenceService } from "./ComplianceEvidenceService.js";
import {
  complianceControlMappingRegistry,
  type ComplianceFramework,
  type EvidenceType,
} from "./ComplianceControlMappingRegistry.js";
import { complianceFrameworkCapabilityGate } from "./ComplianceFrameworkCapabilityGate.js";

/* eslint-disable security/detect-object-injection -- Proxy reflection and typed environment lookups are intentional here. */

export type AutomatedControlCheckStatus = "pass" | "fail";
export type AutomatedControlCheckKind = "evidence_freshness" | "technical_validation";
export type ConfiguredControlStatus = "configured" | "missing";

export interface DeclaredFrameworkCapability {
  framework: ComplianceFramework;
  supported: boolean;
  missing_prerequisites: string[];
  gating_label: "prerequisite_gate";
}

export interface ConfiguredControlState {
  framework: ComplianceFramework;
  control_id: string;
  source: "environment" | "tenant_config";
  status: ConfiguredControlStatus;
  message: string;
}

export interface AutomatedControlCheckResult {
  control_id: string;
  framework: ComplianceFramework;
  evidence_type: EvidenceType;
  status: AutomatedControlCheckStatus;
  message: string;
  last_evidence_at: string | null;
  max_age_minutes: number;
  freshness_minutes: number | null;
  check_kind: AutomatedControlCheckKind;
  assertion_id?: string;
}

export interface AutomatedControlCheckSnapshot {
  run_id: string;
  tenant_id: string;
  checked_at: string;
  trigger: "scheduled" | "manual";
  overall_status: AutomatedControlCheckStatus;
  failing_checks: number;
  declared_capability: DeclaredFrameworkCapability[];
  configured_controls: ConfiguredControlState[];
  results: AutomatedControlCheckResult[];
}

const FRESHNESS_BUDGET_MINUTES: Record<EvidenceType, number> = {
  audit_logs: 60 * 24,
  security_audit_log: 60 * 12,
  audit_logs_archive: 60 * 24 * 30,
  security_audit_log_archive: 60 * 24 * 30,
  control_status: 60 * 24,
};

const CONCURRENT_TENANT_CHECKS = 5;
const SUPPORTED_TECHNICAL_FRAMEWORKS: ComplianceFramework[] = ["SOC2", "GDPR", "ISO27001"];
const TECHNICAL_REQUIRED_TABLES = ["audit_logs", "audit_logs_archive", "compliance_reports", "organization_configurations"];
const IMMUTABLE_AUDIT_TABLES = ["audit_logs", "audit_logs_archive"];
const IMMUTABLE_AUDIT_POLICY_NAMES = [
  "deny_audit_logs_update",
  "deny_audit_logs_delete",
  "deny_audit_logs_archive_update",
  "deny_audit_logs_archive_delete",
];
const IMMUTABLE_AUDIT_TRIGGER_NAMES = [
  "prevent_audit_delete",
  "prevent_audit_update",
  "prevent_audit_archive_delete",
  "prevent_audit_archive_update",
];
const DATABASE_TLS_MARKERS = ["sslmode=require", "sslmode=verify-ca", "sslmode=verify-full"];

interface OrganizationConfigurationRow {
  auth_policy?: { enforceMFA?: boolean } | null;
}

interface TableSecurityRow {
  tablename?: string;
  rowsecurity?: boolean;
}

interface PolicyRow {
  tablename?: string;
  policyname?: string;
}

interface TriggerRow {
  event_object_table?: string;
  trigger_name?: string;
}

interface TenantTechnicalState {
  organizationAuthPolicy: { enforceMFA: boolean; found: boolean };
  rlsTables: Map<string, boolean>;
  immutableAuditPolicies: Set<string>;
  immutableAuditTriggers: Set<string>;
  encryptionRequired: boolean;
  serviceIdentityConfigured: boolean;
  productionMfaEnforced: boolean;
}

interface TechnicalAssertionDefinition {
  framework: ComplianceFramework;
  controlId: string;
  assertionId: string;
  evidenceType: EvidenceType;
  evaluate(state: TenantTechnicalState): { status: AutomatedControlCheckStatus; message: string };
}

const TECHNICAL_ASSERTIONS: TechnicalAssertionDefinition[] = [
  {
    framework: "GDPR",
    controlId: "gdpr_art_32_security_processing",
    assertionId: "gdpr_required_tables_rls_enabled",
    evidenceType: "control_status",
    evaluate: (state) => {
      const requiredTables = ["audit_logs", "compliance_reports", "organization_configurations"];
      const missingTables = requiredTables.filter((table) => !state.rlsTables.get(table));
      return missingTables.length === 0
        ? {
            status: "pass",
            message: "Row-level security is enabled on GDPR-reporting tables.",
          }
        : {
            status: "fail",
            message: `Row-level security is missing on required tables: ${missingTables.join(", ")}.`,
          };
    },
  },
  {
    framework: "GDPR",
    controlId: "gdpr_art_32_security_processing",
    assertionId: "gdpr_encryption_required_config_enforced",
    evidenceType: "control_status",
    evaluate: (state) => ({
      status: state.encryptionRequired ? "pass" : "fail",
      message: state.encryptionRequired
        ? "Encryption-required production configuration is enforced."
        : "Encryption-required production configuration is not enforced.",
    }),
  },
  {
    framework: "SOC2",
    controlId: "soc2_cc6_change_mgmt",
    assertionId: "soc2_mfa_enforced_in_production",
    evidenceType: "control_status",
    evaluate: (state) => ({
      status: state.productionMfaEnforced ? "pass" : "fail",
      message: state.productionMfaEnforced
        ? "MFA is enforced for production access."
        : "MFA is not enforced for production access.",
    }),
  },
  {
    framework: "SOC2",
    controlId: "soc2_cc7_monitoring",
    assertionId: "soc2_immutable_audit_protections_present",
    evidenceType: "audit_logs",
    evaluate: (state) => {
      const missingPolicies = IMMUTABLE_AUDIT_POLICY_NAMES.filter((policy) => !state.immutableAuditPolicies.has(policy));
      const missingTriggers = IMMUTABLE_AUDIT_TRIGGER_NAMES.filter((trigger) => !state.immutableAuditTriggers.has(trigger));
      return missingPolicies.length === 0 && missingTriggers.length === 0
        ? {
            status: "pass",
            message: "Immutable audit protections are present for live and archived audit logs.",
          }
        : {
            status: "fail",
            message: `Immutable audit protections are incomplete. Missing policies: ${missingPolicies.join(", ") || "none"}; missing triggers: ${missingTriggers.join(", ") || "none"}.`,
          };
    },
  },
  {
    framework: "SOC2",
    controlId: "soc2_cc7_monitoring",
    assertionId: "soc2_service_identity_configured",
    evidenceType: "security_audit_log",
    evaluate: (state) => ({
      status: state.serviceIdentityConfigured ? "pass" : "fail",
      message: state.serviceIdentityConfigured
        ? "Cryptographic service identity assertions are configured for protected internal routes."
        : "Protected internal routes do not have required cryptographic service identity configuration.",
    }),
  },
  {
    framework: "ISO27001",
    controlId: "iso27001_164_312_b_audit_controls",
    assertionId: "iso27001_service_identity_configured",
    evidenceType: "security_audit_log",
    evaluate: (state) => ({
      status: state.serviceIdentityConfigured ? "pass" : "fail",
      message: state.serviceIdentityConfigured
        ? "Service identity is configured for protected internal routes handling regulated workflows."
        : "Service identity is not configured for protected internal routes handling regulated workflows.",
    }),
  },
  {
    framework: "ISO27001",
    controlId: "iso27001_164_312_b_audit_controls",
    assertionId: "iso27001_mfa_enforced_in_production",
    evidenceType: "control_status",
    evaluate: (state) => ({
      status: state.productionMfaEnforced ? "pass" : "fail",
      message: state.productionMfaEnforced
        ? "MFA is enforced for production access in ISO27001-relevant environments."
        : "MFA is not enforced for production access in ISO27001-relevant environments.",
    }),
  },
  {
    framework: "ISO27001",
    controlId: "iso27001_164_312_c_integrity",
    assertionId: "iso27001_required_tables_rls_enabled",
    evidenceType: "control_status",
    evaluate: (state) => {
      const requiredTables = ["audit_logs", "audit_logs_archive", "compliance_reports", "organization_configurations"];
      const missingTables = requiredTables.filter((table) => !state.rlsTables.get(table));
      return missingTables.length === 0
        ? {
            status: "pass",
            message: "Row-level security is enabled on ISO27001-relevant reporting tables.",
          }
        : {
            status: "fail",
            message: `Row-level security is missing on ISO27001-relevant tables: ${missingTables.join(", ")}.`,
          };
    },
  },
  {
    framework: "ISO27001",
    controlId: "iso27001_164_312_c_integrity",
    assertionId: "iso27001_immutable_audit_protections_present",
    evidenceType: "audit_logs",
    evaluate: (state) => {
      const missingPolicies = IMMUTABLE_AUDIT_POLICY_NAMES.filter((policy) => !state.immutableAuditPolicies.has(policy));
      const missingTriggers = IMMUTABLE_AUDIT_TRIGGER_NAMES.filter((trigger) => !state.immutableAuditTriggers.has(trigger));
      return missingPolicies.length === 0 && missingTriggers.length === 0
        ? {
            status: "pass",
            message: "Immutable audit protections are present for ISO27001 audit evidence stores.",
          }
        : {
            status: "fail",
            message: `ISO27001 audit integrity protections are incomplete. Missing policies: ${missingPolicies.join(", ") || "none"}; missing triggers: ${missingTriggers.join(", ") || "none"}.`,
          };
    },
  },
  {
    framework: "ISO27001",
    controlId: "iso27001_164_312_c_integrity",
    assertionId: "iso27001_encryption_required_config_enforced",
    evidenceType: "control_status",
    evaluate: (state) => ({
      status: state.encryptionRequired ? "pass" : "fail",
      message: state.encryptionRequired
        ? "Encryption-required configuration is enforced for regulated data paths."
        : "Encryption-required configuration is not enforced for regulated data paths.",
    }),
  },
];

export class ComplianceControlCheckService {
  private readonly supabase = createServerSupabaseClient();
  private interval: NodeJS.Timeout | null = null;

  private isEnabled(value: string | undefined): boolean {
    if (!value) return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }

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

    if (evidenceType === "audit_logs_archive") {
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

    if (evidenceType === "security_audit_log_archive") {
      const { data, error } = await this.supabase
        .from("audit_logs")
        .select("timestamp")
        .eq("tenant_id", tenantId)
        .eq("archived", true)
        .in("resource_type", ["security_alert", "security_event", "security_incident", "security_audit_log"])
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return (data?.timestamp as string | undefined) ?? null;
    }

    return null;
  }

  private async getOrganizationConfiguration(tenantId: string): Promise<OrganizationConfigurationRow | null> {
    const { data, error } = await this.supabase
      .from("organization_configurations")
      .select("auth_policy")
      .eq("organization_id", tenantId)
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn("ComplianceControlCheckService: failed organization_configurations lookup", {
        tenantId,
        error: error.message,
      });
      return null;
    }

    return (data as OrganizationConfigurationRow | null) ?? null;
  }

  private async fetchTableSecurityState(): Promise<Map<string, boolean>> {
    const { data, error } = await this.supabase
      .from("pg_tables")
      .select("tablename, rowsecurity")
      .eq("schemaname", "public")
      .in("tablename", TECHNICAL_REQUIRED_TABLES);

    if (error) {
      logger.warn("ComplianceControlCheckService: failed pg_tables lookup", { error: error.message });
      return new Map<string, boolean>();
    }

    return new Map(
      ((data as TableSecurityRow[] | null) ?? []).map((row) => [row.tablename ?? "", Boolean(row.rowsecurity)]),
    );
  }

  private async fetchImmutableAuditPolicies(): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from("pg_policies")
      .select("tablename, policyname")
      .eq("schemaname", "public")
      .in("tablename", IMMUTABLE_AUDIT_TABLES);

    if (error) {
      logger.warn("ComplianceControlCheckService: failed pg_policies lookup", { error: error.message });
      return new Set<string>();
    }

    return new Set(
      (((data as PolicyRow[] | null) ?? [])
        .map((row) => row.policyname)
        .filter((value): value is string => typeof value === "string")),
    );
  }

  private async fetchImmutableAuditTriggers(): Promise<Set<string>> {
    const { data, error } = await this.supabase
      .from("information_schema.triggers")
      .select("event_object_table, trigger_name")
      .eq("trigger_schema", "public")
      .in("event_object_table", IMMUTABLE_AUDIT_TABLES);

    if (error) {
      logger.warn("ComplianceControlCheckService: failed information_schema.triggers lookup", { error: error.message });
      return new Set<string>();
    }

    return new Set(
      (((data as TriggerRow[] | null) ?? [])
        .map((row) => row.trigger_name)
        .filter((value): value is string => typeof value === "string")),
    );
  }

  private getEncryptionRequiredConfigState(): boolean {
    const databaseUrl = process.env.DATABASE_URL ?? "";
    const redisUrl = process.env.REDIS_URL ?? "";
    const cacheEncryptionEnabled = process.env.CACHE_ENCRYPTION_ENABLED !== "false";
    const cacheEncryptionKeyPresent = Boolean(process.env.CACHE_ENCRYPTION_KEY);
    const applicationEncryptionKeyPresent = Boolean(process.env.APP_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY);
    const databaseTlsEnabled = DATABASE_TLS_MARKERS.some((marker) => databaseUrl.includes(marker));
    const redisTlsEnabled = redisUrl.startsWith("rediss://") && (process.env.REDIS_TLS_REJECT_UNAUTHORIZED ?? "true") === "true";

    return cacheEncryptionEnabled
      && cacheEncryptionKeyPresent
      && applicationEncryptionKeyPresent
      && databaseTlsEnabled
      && redisTlsEnabled;
  }

  private getServiceIdentityConfiguredState(): boolean {
    const strictMode = process.env.NODE_ENV === "production" || process.env.SERVICE_IDENTITY_REQUIRED === "true";
    if (!strictMode) {
      return true;
    }

    const rawConfig = process.env.SERVICE_IDENTITY_CONFIG_JSON;
    if (!rawConfig) {
      return false;
    }

    try {
      const parsed = JSON.parse(rawConfig) as {
        jwtIssuers?: unknown[];
        hmacKeys?: unknown[];
        allowedSpiffeIds?: unknown[];
        ingressAttestors?: unknown[];
      };

      const hasCryptographicAssertions = (parsed.jwtIssuers?.length ?? 0) > 0 || (parsed.hmacKeys?.length ?? 0) > 0;
      const hasSpiffe = (parsed.allowedSpiffeIds?.length ?? 0) > 0;
      const hasIngressAttestors = (parsed.ingressAttestors?.length ?? 0) > 0;

      if (!hasCryptographicAssertions) {
        return false;
      }

      if (hasSpiffe && !hasIngressAttestors) {
        return false;
      }

      return hasCryptographicAssertions || (hasSpiffe && hasIngressAttestors);
    } catch (error) {
      logger.warn("ComplianceControlCheckService: invalid SERVICE_IDENTITY_CONFIG_JSON", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async collectTenantTechnicalState(tenantId: string): Promise<TenantTechnicalState> {
    const [orgConfig, rlsTables, immutableAuditPolicies, immutableAuditTriggers] = await Promise.all([
      this.getOrganizationConfiguration(tenantId),
      this.fetchTableSecurityState(),
      this.fetchImmutableAuditPolicies(),
      this.fetchImmutableAuditTriggers(),
    ]);

    const environmentRequiresMfa = process.env.NODE_ENV !== "production" || this.isEnabled(process.env.MFA_ENABLED);
    const tenantConfigRequiresMfa = Boolean(orgConfig?.auth_policy?.enforceMFA);

    return {
      organizationAuthPolicy: {
        enforceMFA: tenantConfigRequiresMfa,
        found: Boolean(orgConfig),
      },
      rlsTables,
      immutableAuditPolicies,
      immutableAuditTriggers,
      encryptionRequired: this.getEncryptionRequiredConfigState(),
      serviceIdentityConfigured: this.getServiceIdentityConfiguredState(),
      productionMfaEnforced: environmentRequiresMfa && tenantConfigRequiresMfa,
    };
  }

  private async getDeclaredCapabilities(tenantId: string): Promise<DeclaredFrameworkCapability[]> {
    return Promise.all(SUPPORTED_TECHNICAL_FRAMEWORKS.map(async (framework) => {
      const status = await complianceFrameworkCapabilityGate.getCapabilityStatus(tenantId, framework);
      return {
        framework,
        supported: status.supported,
        missing_prerequisites: status.missingPrerequisites,
        gating_label: "prerequisite_gate",
      };
    }));
  }

  private getConfiguredControls(state: TenantTechnicalState): ConfiguredControlState[] {
    return [
      {
        framework: "GDPR",
        control_id: "gdpr_encryption_required_config",
        source: "environment",
        status: state.encryptionRequired ? "configured" : "missing",
        message: state.encryptionRequired
          ? "TLS and encryption-required settings are configured."
          : "TLS and encryption-required settings are incomplete.",
      },
      {
        framework: "SOC2",
        control_id: "soc2_mfa_enforced_in_production",
        source: state.organizationAuthPolicy.found ? "tenant_config" : "environment",
        status: state.productionMfaEnforced ? "configured" : "missing",
        message: state.productionMfaEnforced
          ? "Production MFA is configured in environment and tenant auth policy."
          : "Production MFA is missing in environment or tenant auth policy.",
      },
      {
        framework: "SOC2",
        control_id: "soc2_service_identity_configured",
        source: "environment",
        status: state.serviceIdentityConfigured ? "configured" : "missing",
        message: state.serviceIdentityConfigured
          ? "Cryptographic service identity assertions are configured."
          : "Cryptographic service identity assertions are missing.",
      },
      {
        framework: "ISO27001",
        control_id: "iso27001_mfa_enforced_in_production",
        source: state.organizationAuthPolicy.found ? "tenant_config" : "environment",
        status: state.productionMfaEnforced ? "configured" : "missing",
        message: state.productionMfaEnforced
          ? "Production MFA is configured for regulated access."
          : "Production MFA is not fully configured for regulated access.",
      },
      {
        framework: "ISO27001",
        control_id: "iso27001_service_identity_configured",
        source: "environment",
        status: state.serviceIdentityConfigured ? "configured" : "missing",
        message: state.serviceIdentityConfigured
          ? "Protected internal routes have service identity configuration."
          : "Protected internal routes lack service identity configuration.",
      },
      {
        framework: "ISO27001",
        control_id: "iso27001_encryption_required_config",
        source: "environment",
        status: state.encryptionRequired ? "configured" : "missing",
        message: state.encryptionRequired
          ? "Encryption-required settings are configured for ISO27001-relevant paths."
          : "Encryption-required settings are incomplete for ISO27001-relevant paths.",
      },
    ];
  }

  private async buildEvidenceFreshnessResults(tenantId: string): Promise<AutomatedControlCheckResult[]> {
    const supportedFrameworks = await complianceFrameworkCapabilityGate.getSupportedFrameworks(tenantId);
    const controls = complianceControlMappingRegistry
      .listFrameworkMappings(
        supportedFrameworks.filter(
          (framework): framework is ComplianceFramework => SUPPORTED_TECHNICAL_FRAMEWORKS.includes(framework),
        ),
      )
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
        freshness_minutes: freshness !== null ? Number(freshness.toFixed(2)) : null,
        check_kind: "evidence_freshness",
      });
    }

    return results;
  }

  private buildTechnicalValidationResults(state: TenantTechnicalState): AutomatedControlCheckResult[] {
    return TECHNICAL_ASSERTIONS.map((assertion) => {
      const evaluation = assertion.evaluate(state);
      return {
        control_id: assertion.controlId,
        framework: assertion.framework,
        evidence_type: assertion.evidenceType,
        status: evaluation.status,
        message: evaluation.message,
        last_evidence_at: null,
        max_age_minutes: 0,
        freshness_minutes: null,
        check_kind: "technical_validation",
        assertion_id: assertion.assertionId,
      };
    });
  }

  async runChecksForTenant(tenantId: string, trigger: "scheduled" | "manual" = "scheduled"): Promise<AutomatedControlCheckSnapshot> {
    const checkedAt = new Date().toISOString();
    const [technicalState, evidenceResults] = await Promise.all([
      this.collectTenantTechnicalState(tenantId),
      this.buildEvidenceFreshnessResults(tenantId),
    ]);
    const declaredCapability = await this.getDeclaredCapabilities(tenantId);
    const configuredControls = this.getConfiguredControls(technicalState);
    const technicalResults = this.buildTechnicalValidationResults(technicalState);
    const results = [...evidenceResults, ...technicalResults];

    const failingChecks = results.filter((item) => item.status === "fail");
    const snapshot: AutomatedControlCheckSnapshot = {
      run_id: crypto.randomUUID(),
      tenant_id: tenantId,
      checked_at: checkedAt,
      trigger,
      overall_status: failingChecks.length > 0 ? "fail" : "pass",
      failing_checks: failingChecks.length,
      declared_capability: declaredCapability,
      configured_controls: configuredControls,
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

    await complianceEvidenceService.appendEvidence({
      tenantId,
      actorPrincipal: "compliance-control-attestor",
      actorType: "system",
      triggerType: trigger === "scheduled" ? "scheduled" : "event",
      triggerSource: "compliance_control_attestation_job",
      collectedAt: checkedAt,
      evidence: {
        evidence_type: "control_attestation_snapshot",
        immutable_snapshot: true,
        run_id: snapshot.run_id,
        trigger,
        overall_status: snapshot.overall_status,
        failing_checks: snapshot.failing_checks,
        declared_capability: snapshot.declared_capability,
        configured_controls: snapshot.configured_controls,
        technically_validated_results: snapshot.results.filter((result) => result.check_kind === "technical_validation"),
      },
    });

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

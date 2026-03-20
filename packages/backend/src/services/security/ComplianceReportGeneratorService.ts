import { createHmac, randomUUID } from "crypto";

import { createUserSupabaseClient } from "../../lib/supabase.js";

import {
  complianceControlMappingRegistry,
  type ComplianceFramework,
  type EvidenceType,
} from "./ComplianceControlMappingRegistry.js";
import {
  complianceFrameworkCapabilityGate,
  type FrameworkCapabilityStatus,
} from "./ComplianceFrameworkCapabilityGate.js";
import {
  complianceControlStatusService,
  type ControlStatusRecord,
} from "./ComplianceControlStatusService.js";
import {
  complianceControlCheckService,
  type AutomatedControlCheckSnapshot,
  type AutomatedControlCheckStatus,
} from "./ComplianceControlCheckService.js";

interface QueryableClient {
  from(table: string): {
    select(query: string): QueryChain;
    insert(payload: Record<string, unknown>): QueryInsertChain;
  };
}

interface QueryChain {
  eq(field: string, value: unknown): QueryChain;
  gte(field: string, value: string): QueryChain;
  lte(field: string, value: string): QueryChain;
  order(field: string, options: { ascending: boolean }): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
}

interface QueryInsertChain {
  select(query: string): {
    single(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  };
}

export interface GenerateComplianceReportInput {
  tenantId: string;
  frameworks: ComplianceFramework[];
  startAt: string;
  endAt: string;
  generatedBy: string;
  mode: "on_demand" | "scheduled";
  strict?: boolean;
}

export interface ConfiguredControlView {
  framework: ComplianceFramework;
  control_id: string;
  source: "prerequisite_gate" | "environment" | "runtime";
  status: "configured" | "missing" | "not_applicable";
  description: string;
}

export interface TechnicalValidationView {
  framework: ComplianceFramework;
  control_id: string;
  assertion_id: string;
  status: AutomatedControlCheckStatus;
  message: string;
  checked_at: string;
}

export interface ComplianceReportOutput {
  report_id: string;
  tenant_id: string;
  frameworks: ComplianceFramework[];
  generated_at: string;
  start_at: string;
  end_at: string;
  signature: string;
  evidence_manifest_id: string;
  status: "pass" | "warn" | "fail";
  declared_capability: FrameworkCapabilityStatus[];
  configured_controls: ConfiguredControlView[];
  technically_validated_controls: TechnicalValidationView[];
  missing_evidence: Array<{ framework: ComplianceFramework; control_id: string; missing_types: EvidenceType[] }>;
  retention_summary: ReturnType<typeof complianceControlMappingRegistry.getRetentionSummary>;
}

export class MissingEvidenceError extends Error {
  constructor(public readonly missingEvidence: ComplianceReportOutput["missing_evidence"]) {
    super("Missing required compliance evidence for one or more controls");
  }
}

function isEnabled(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export class ComplianceReportGeneratorService {
  constructor(
    private readonly client: QueryableClient = createUserSupabaseClient() as unknown as QueryableClient,
    private readonly controlStatusSource: {
      getLatestControlStatus(tenantId: string): Promise<ControlStatusRecord[]>;
    } = complianceControlStatusService,
    private readonly controlCheckSource: {
      runChecksForTenant(tenantId: string, trigger?: "scheduled" | "manual"): Promise<AutomatedControlCheckSnapshot>;
    } = complianceControlCheckService,
  ) {}

  async generateReport(input: GenerateComplianceReportInput): Promise<ComplianceReportOutput> {
    this.assertTenant(input.tenantId);
    complianceFrameworkCapabilityGate.assertFrameworksSupported(input.frameworks);

    const evidenceBuckets = await this.collectEvidence(input.tenantId, input.startAt, input.endAt);
    const [controlStatuses, technicalSnapshot] = await Promise.all([
      this.controlStatusSource.getLatestControlStatus(input.tenantId),
      this.controlCheckSource.runChecksForTenant(input.tenantId, "manual"),
    ]);

    const missingEvidence = this.computeMissingEvidence(input.frameworks, evidenceBuckets, controlStatuses);
    if ((input.strict ?? true) && missingEvidence.length > 0) {
      throw new MissingEvidenceError(missingEvidence);
    }

    const generatedAt = new Date().toISOString();
    const declaredCapability = input.frameworks.map((framework) => complianceFrameworkCapabilityGate.getCapabilityStatus(framework));
    const configuredControls = this.buildConfiguredControls(input.frameworks, declaredCapability, controlStatuses);
    const technicallyValidatedControls = technicalSnapshot.results
      .filter((result) => result.check_kind === "technical_validation" && input.frameworks.includes(result.framework))
      .map((result) => ({
        framework: result.framework,
        control_id: result.control_id,
        assertion_id: result.assertion_id,
        status: result.status,
        message: result.message,
        checked_at: technicalSnapshot.checked_at,
      }));

    const reportStatus = this.deriveReportStatus(missingEvidence, technicallyValidatedControls, controlStatuses, declaredCapability);

    const manifestId = await this.storeManifest({
      tenant_id: input.tenantId,
      generated_at: generatedAt,
      start_at: input.startAt,
      end_at: input.endAt,
      frameworks: input.frameworks,
      evidence_counts: Object.fromEntries(
        Object.entries(evidenceBuckets).map(([bucket, rows]) => [bucket, rows.length]),
      ),
      declared_capability: declaredCapability,
      configured_controls: configuredControls,
      technically_validated_controls: technicallyValidatedControls,
      missing_evidence: missingEvidence,
      report_status: reportStatus,
    });

    const signature = this.signPayload({
      tenant_id: input.tenantId,
      generated_at: generatedAt,
      frameworks: input.frameworks,
      evidence_manifest_id: manifestId,
      status: reportStatus,
      missing_evidence: missingEvidence,
    });

    const reportId = await this.storeReport({
      tenant_id: input.tenantId,
      generated_at: generatedAt,
      start_at: input.startAt,
      end_at: input.endAt,
      frameworks: input.frameworks,
      generated_by: input.generatedBy,
      mode: input.mode,
      signature,
      evidence_manifest_id: manifestId,
      status: reportStatus,
      declared_capability: declaredCapability,
      configured_controls: configuredControls,
      technically_validated_controls: technicallyValidatedControls,
      missing_evidence: missingEvidence,
      retention_summary: complianceControlMappingRegistry.getRetentionSummary(input.frameworks),
    });

    return {
      report_id: reportId,
      tenant_id: input.tenantId,
      frameworks: input.frameworks,
      generated_at: generatedAt,
      start_at: input.startAt,
      end_at: input.endAt,
      signature,
      evidence_manifest_id: manifestId,
      status: reportStatus,
      declared_capability: declaredCapability,
      configured_controls: configuredControls,
      technically_validated_controls: technicallyValidatedControls,
      missing_evidence: missingEvidence,
      retention_summary: complianceControlMappingRegistry.getRetentionSummary(input.frameworks),
    };
  }

  async auditDownloadAccess(tenantId: string, reportId: string, actorId: string): Promise<void> {
    this.assertTenant(tenantId);
    await this.client
      .from("audit_logs")
      .insert({
        tenant_id: tenantId,
        action: "compliance:report_downloaded",
        resource_type: "compliance_report",
        resource_id: reportId,
        status: "success",
        timestamp: new Date().toISOString(),
        details: {
          actor_id: actorId,
          immutable: true,
        },
      });
  }

  private async collectEvidence(tenantId: string, startAt: string, endAt: string): Promise<Record<EvidenceType, unknown[]>> {
    const [auditLogs, securityAudit, archivedAuditLogs, archivedSecurityAudit] = await Promise.all([
      this.queryTable("audit_logs", tenantId, startAt, endAt),
      this.queryTable("security_audit_log", tenantId, startAt, endAt),
      this.queryTable("audit_logs_archive", tenantId, startAt, endAt),
      this.queryTable("security_audit_log_archive", tenantId, startAt, endAt),
    ]);

    return {
      audit_logs: auditLogs,
      security_audit_log: securityAudit,
      audit_logs_archive: archivedAuditLogs,
      security_audit_log_archive: archivedSecurityAudit,
      control_status: [],
    };
  }

  private computeMissingEvidence(
    frameworks: ComplianceFramework[],
    buckets: Record<EvidenceType, unknown[]>,
    controlStatuses: ControlStatusRecord[],
  ): ComplianceReportOutput["missing_evidence"] {
    const missing: ComplianceReportOutput["missing_evidence"] = [];

    for (const mapping of complianceControlMappingRegistry.listFrameworkMappings(frameworks)) {
      for (const control of mapping.controls) {
        const missingTypes = control.required_evidence_types.filter((requiredType) => {
          if (requiredType === "control_status") {
            return !controlStatuses.some((status) => status.framework === mapping.framework);
          }
          return (buckets[requiredType] ?? []).length === 0;
        });

        if (missingTypes.length > 0) {
          missing.push({
            framework: mapping.framework,
            control_id: control.control_id,
            missing_types: missingTypes,
          });
        }
      }
    }

    return missing;
  }

  private buildConfiguredControls(
    frameworks: ComplianceFramework[],
    declaredCapability: FrameworkCapabilityStatus[],
    controlStatuses: ControlStatusRecord[],
  ): ConfiguredControlView[] {
    const controls: ConfiguredControlView[] = [];
    const nodeEnv = (process.env.NODE_ENV ?? "development").toLowerCase();
    const encryptionConfigured = Boolean(process.env.APP_ENCRYPTION_KEY ?? process.env.ENCRYPTION_KEY);
    const mfaConfigured = process.env.MFA_ENABLED === "true";
    const serviceIdentityConfigured = Boolean(
      process.env.SERVICE_IDENTITY_CONFIG_JSON ||
      process.env.SERVICE_IDENTITY_ALLOWED_SPIFFE_IDS ||
      process.env.SERVICE_IDENTITY_AUDIENCE ||
      process.env.SERVICE_IDENTITY_REQUIRED === "true"
    );

    for (const framework of frameworks) {
      const capability = declaredCapability.find((item) => item.framework === framework);
      controls.push({
        framework,
        control_id: `${framework.toLowerCase()}_declared_capability_gate`,
        source: "prerequisite_gate",
        status: capability?.supported ? "configured" : "missing",
        description: capability?.supported
          ? "Framework prerequisite gate is satisfied."
          : `Missing prerequisite controls: ${(capability?.missingPrerequisites ?? []).join(", ") || "unknown"}`,
      });

      if (framework === "GDPR" || framework === "HIPAA") {
        controls.push({
          framework,
          control_id: `${framework.toLowerCase()}_encryption_required_config`,
          source: "environment",
          status: nodeEnv === "production"
            ? (encryptionConfigured ? "configured" : "missing")
            : "not_applicable",
          description: nodeEnv === "production"
            ? "Production encryption-required configuration."
            : "Encryption-required production configuration is only enforced in production.",
        });
      }

      if (framework === "SOC2" || framework === "HIPAA") {
        controls.push({
          framework,
          control_id: `${framework.toLowerCase()}_mfa_production_enforcement`,
          source: "environment",
          status: nodeEnv === "production"
            ? (mfaConfigured ? "configured" : "missing")
            : "not_applicable",
          description: nodeEnv === "production"
            ? "Production MFA enforcement configuration."
            : "Production MFA enforcement is only applicable in production.",
        });
      }

      if (framework === "SOC2" || framework === "GDPR") {
        controls.push({
          framework,
          control_id: `${framework.toLowerCase()}_service_identity_internal_routes`,
          source: "runtime",
          status: serviceIdentityConfigured ? "configured" : "missing",
          description: "Protected internal routes must have service identity configuration.",
        });
      }

      const frameworkStatuses = controlStatuses.filter((status) => status.framework === framework);
      for (const status of frameworkStatuses) {
        controls.push({
          framework,
          control_id: status.control_id,
          source: "runtime",
          status: status.status === "fail" ? "missing" : "configured",
          description: `Configured runtime control status: ${status.status}.`,
        });
      }
    }

    return controls;
  }

  private deriveReportStatus(
    missingEvidence: ComplianceReportOutput["missing_evidence"],
    technicallyValidatedControls: TechnicalValidationView[],
    controlStatuses: ControlStatusRecord[],
    declaredCapability: FrameworkCapabilityStatus[],
  ): ComplianceReportOutput["status"] {
    if (declaredCapability.some((item) => !item.supported)) {
      return "fail";
    }

    if (technicallyValidatedControls.some((control) => control.status === "fail")) {
      return "fail";
    }

    if (controlStatuses.some((control) => control.status === "fail")) {
      return "fail";
    }

    if (missingEvidence.length > 0 || controlStatuses.some((control) => control.status === "warn")) {
      return "warn";
    }

    return "pass";
  }

  private async queryTable(table: string, tenantId: string, startAt: string, endAt: string): Promise<unknown[]> {
    const query = this.client
      .from(table)
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("timestamp", startAt)
      .lte("timestamp", endAt);

    const { data, error } = await query.order("timestamp", { ascending: true });
    if (error) {
      throw new Error(
        `Failed to query evidence from table "${table}" for tenant "${tenantId}": ${error.message ?? "unknown error"}`,
      );
    }

    return data ?? [];
  }

  private async storeManifest(payload: Record<string, unknown>): Promise<string> {
    const { data, error } = await this.client
      .from("audit_logs")
      .insert({
        tenant_id: payload.tenant_id,
        action: "compliance:manifest_generated",
        resource_type: "compliance_manifest",
        resource_id: randomUUID(),
        status: "success",
        timestamp: payload.generated_at,
        details: {
          immutable: true,
          access_control: "tenant_scoped",
          ...payload,
        },
      })
      .select("resource_id")
      .single();

    if (error || !data?.resource_id) {
      throw new Error(`Failed to persist evidence manifest: ${error?.message ?? "unknown"}`);
    }

    return String(data.resource_id);
  }

  private async storeReport(payload: Record<string, unknown>): Promise<string> {
    const { data, error } = await this.client
      .from("audit_logs")
      .insert({
        tenant_id: payload.tenant_id,
        action: "compliance:report_generated",
        resource_type: "compliance_report",
        resource_id: randomUUID(),
        status: payload.status === "fail" ? "failed" : "success",
        timestamp: payload.generated_at,
        details: {
          immutable: true,
          access_control: "tenant_scoped",
          ...payload,
        },
      })
      .select("resource_id")
      .single();

    if (error || !data?.resource_id) {
      throw new Error(`Failed to persist compliance report: ${error?.message ?? "unknown"}`);
    }

    return String(data.resource_id);
  }

  private signPayload(payload: Record<string, unknown>): string {
    const secret = process.env.COMPLIANCE_MANIFEST_HMAC_KEY;
    if (!secret) {
      throw new Error("COMPLIANCE_MANIFEST_HMAC_KEY is not configured for manifest signing");
    }

    return createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
  }

  private assertTenant(tenantId: string): void {
    if (!tenantId) {
      throw new Error("tenant_id is required");
    }
  }
}

let _complianceReportGeneratorService: ComplianceReportGeneratorService | undefined;
export const complianceReportGeneratorService = new Proxy({} as ComplianceReportGeneratorService, {
  get(_target, prop, _receiver) {
    if (!_complianceReportGeneratorService) {
      _complianceReportGeneratorService = new ComplianceReportGeneratorService();
    }
    const value = Reflect.get(
      _complianceReportGeneratorService as ComplianceReportGeneratorService,
      prop,
      _complianceReportGeneratorService as ComplianceReportGeneratorService
    );
    if (typeof value === "function") {
      return value.bind(_complianceReportGeneratorService);
    }
    return value;
  },
});

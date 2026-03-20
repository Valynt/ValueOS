import { createHmac, randomUUID } from "crypto";

import { createUserSupabaseClient } from "../../lib/supabase.js";

import {
  complianceControlMappingRegistry,
  type ComplianceFramework,
  type EvidenceType,
} from "./ComplianceControlMappingRegistry.js";
import { complianceFrameworkCapabilityGate } from "./ComplianceFrameworkCapabilityGate.js";
import {
  complianceControlCheckService,
  type AutomatedControlCheckResult,
  type AutomatedControlCheckSnapshot,
  type ConfiguredControlState,
  type DeclaredFrameworkCapability,
} from "./ComplianceControlCheckService.js";
import {
  complianceControlStatusService,
  type ControlStatusRecord,
} from "./ComplianceControlStatusService.js";

/* eslint-disable security/detect-object-injection -- Framework/evidence keys are constrained by typed registries. */

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

export interface FrameworkReportBreakdown {
  framework: ComplianceFramework;
  status: "pass" | "fail";
  declared_capability: DeclaredFrameworkCapability;
  configured_controls: ConfiguredControlState[];
  technically_validated_controls: AutomatedControlCheckResult[];
  missing_evidence: Array<{ framework: ComplianceFramework; control_id: string; missing_types: EvidenceType[] }>;
}

export interface ComplianceReportOutput {
  report_id: string;
  tenant_id: string;
  frameworks: ComplianceFramework[];
  generated_at: string;
  start_at: string;
  end_at: string;
  status: "pass" | "fail";
  signature: string;
  evidence_manifest_id: string;
  declared_capability: DeclaredFrameworkCapability[];
  configured_controls: ConfiguredControlState[];
  technically_validated_controls: AutomatedControlCheckResult[];
  framework_breakdown: FrameworkReportBreakdown[];
  missing_evidence: Array<{ framework: ComplianceFramework; control_id: string; missing_types: EvidenceType[] }>;
  retention_summary: ReturnType<typeof complianceControlMappingRegistry.getRetentionSummary>;
}

export class MissingEvidenceError extends Error {
  constructor(public readonly missingEvidence: ComplianceReportOutput["missing_evidence"]) {
    super("Missing required compliance evidence for one or more controls");
  }
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
    const [controlStatuses, controlCheckSnapshot] = await Promise.all([
      this.controlStatusSource.getLatestControlStatus(input.tenantId),
      this.controlCheckSource.runChecksForTenant(input.tenantId, "manual"),
    ]);

    const missingEvidence = this.computeMissingEvidence(input.frameworks, evidenceBuckets, controlStatuses);
    if ((input.strict ?? true) && missingEvidence.length > 0) {
      throw new MissingEvidenceError(missingEvidence);
    }

    const declaredCapability = controlCheckSnapshot.declared_capability.filter((status) => input.frameworks.includes(status.framework));
    const configuredControls = controlCheckSnapshot.configured_controls.filter((control) => input.frameworks.includes(control.framework));
    const technicallyValidatedControls = controlCheckSnapshot.results.filter(
      (result) => result.check_kind === "technical_validation" && input.frameworks.includes(result.framework),
    );
    const frameworkBreakdown = this.buildFrameworkBreakdown({
      frameworks: input.frameworks,
      declaredCapability,
      configuredControls,
      technicallyValidatedControls,
      missingEvidence,
    });

    const overallStatus = this.computeOverallStatus({
      missingEvidence,
      technicallyValidatedControls,
      controlCheckSnapshot,
    });

    const generatedAt = new Date().toISOString();
    const manifestId = await this.storeManifest({
      tenant_id: input.tenantId,
      generated_at: generatedAt,
      start_at: input.startAt,
      end_at: input.endAt,
      frameworks: input.frameworks,
      status: overallStatus,
      declared_capability: declaredCapability,
      configured_controls: configuredControls,
      technically_validated_controls: technicallyValidatedControls,
      framework_breakdown: frameworkBreakdown,
      evidence_counts: Object.fromEntries(
        Object.entries(evidenceBuckets).map(([bucket, rows]) => [bucket, rows.length]),
      ),
      missing_evidence: missingEvidence,
    });

    const signature = this.signPayload({
      tenant_id: input.tenantId,
      generated_at: generatedAt,
      frameworks: input.frameworks,
      status: overallStatus,
      evidence_manifest_id: manifestId,
      missing_evidence: missingEvidence,
    });

    const reportPayload = {
      tenant_id: input.tenantId,
      generated_at: generatedAt,
      start_at: input.startAt,
      end_at: input.endAt,
      frameworks: input.frameworks,
      generated_by: input.generatedBy,
      mode: input.mode,
      status: overallStatus,
      signature,
      evidence_manifest_id: manifestId,
      declared_capability: declaredCapability,
      configured_controls: configuredControls,
      technically_validated_controls: technicallyValidatedControls,
      framework_breakdown: frameworkBreakdown,
      missing_evidence: missingEvidence,
      retention_summary: complianceControlMappingRegistry.getRetentionSummary(input.frameworks),
    };

    const reportId = await this.storeReport(reportPayload);

    return {
      report_id: reportId,
      tenant_id: input.tenantId,
      frameworks: input.frameworks,
      generated_at: generatedAt,
      start_at: input.startAt,
      end_at: input.endAt,
      status: overallStatus,
      signature,
      evidence_manifest_id: manifestId,
      declared_capability: declaredCapability,
      configured_controls: configuredControls,
      technically_validated_controls: technicallyValidatedControls,
      framework_breakdown: frameworkBreakdown,
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

  private buildFrameworkBreakdown(input: {
    frameworks: ComplianceFramework[];
    declaredCapability: DeclaredFrameworkCapability[];
    configuredControls: ConfiguredControlState[];
    technicallyValidatedControls: AutomatedControlCheckResult[];
    missingEvidence: ComplianceReportOutput["missing_evidence"];
  }): FrameworkReportBreakdown[] {
    return input.frameworks.map((framework) => {
      const declaredCapability = input.declaredCapability.find((entry) => entry.framework === framework) ?? {
        framework,
        supported: complianceFrameworkCapabilityGate.getCapabilityStatus(framework).supported,
        missing_prerequisites: complianceFrameworkCapabilityGate.getCapabilityStatus(framework).missingPrerequisites,
        gating_label: "prerequisite_gate" as const,
      };
      const configuredControls = input.configuredControls.filter((entry) => entry.framework === framework);
      const technicallyValidatedControls = input.technicallyValidatedControls.filter((entry) => entry.framework === framework);
      const missingEvidence = input.missingEvidence.filter((entry) => entry.framework === framework);
      const hasTechnicalFailures = technicallyValidatedControls.some((entry) => entry.status === "fail");
      const hasMissingEvidence = missingEvidence.length > 0;

      return {
        framework,
        status: hasTechnicalFailures || hasMissingEvidence ? "fail" : "pass",
        declared_capability: declaredCapability,
        configured_controls: configuredControls,
        technically_validated_controls: technicallyValidatedControls,
        missing_evidence: missingEvidence,
      };
    });
  }

  private computeOverallStatus(input: {
    missingEvidence: ComplianceReportOutput["missing_evidence"];
    technicallyValidatedControls: AutomatedControlCheckResult[];
    controlCheckSnapshot: AutomatedControlCheckSnapshot;
  }): ComplianceReportOutput["status"] {
    if (input.missingEvidence.length > 0) {
      return "fail";
    }

    if (input.technicallyValidatedControls.some((control) => control.status === "fail")) {
      return "fail";
    }

    if (input.controlCheckSnapshot.results.some((result) => result.check_kind === "evidence_freshness" && result.status === "fail")) {
      return "fail";
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

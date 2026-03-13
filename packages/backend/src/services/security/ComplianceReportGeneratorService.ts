import { createHash, randomUUID } from "crypto";

import { createServerSupabaseClient } from "../../lib/supabase.js";

import {
  complianceControlMappingRegistry,
  type ComplianceFramework,
  type EvidenceType,
} from "./ComplianceControlMappingRegistry.js";
import {
  complianceControlStatusService,
  type ControlStatusRecord,
} from "./ComplianceControlStatusService.js";

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

export interface ComplianceReportOutput {
  report_id: string;
  tenant_id: string;
  frameworks: ComplianceFramework[];
  generated_at: string;
  start_at: string;
  end_at: string;
  signature: string;
  evidence_manifest_id: string;
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
    private readonly client: QueryableClient = createServerSupabaseClient() as unknown as QueryableClient,
    private readonly controlStatusSource: {
      getLatestControlStatus(tenantId: string): Promise<ControlStatusRecord[]>;
    } = complianceControlStatusService,
  ) {}

  async generateReport(input: GenerateComplianceReportInput): Promise<ComplianceReportOutput> {
    this.assertTenant(input.tenantId);

    const evidenceBuckets = await this.collectEvidence(input.tenantId, input.startAt, input.endAt);
    const controlStatuses = await this.controlStatusSource.getLatestControlStatus(input.tenantId);

    const missingEvidence = this.computeMissingEvidence(input.frameworks, evidenceBuckets, controlStatuses);
    if ((input.strict ?? true) && missingEvidence.length > 0) {
      throw new MissingEvidenceError(missingEvidence);
    }

    const generatedAt = new Date().toISOString();
    const manifestId = await this.storeManifest({
      tenant_id: input.tenantId,
      generated_at: generatedAt,
      start_at: input.startAt,
      end_at: input.endAt,
      frameworks: input.frameworks,
      evidence_counts: Object.fromEntries(
        Object.entries(evidenceBuckets).map(([bucket, rows]) => [bucket, rows.length]),
      ),
      missing_evidence: missingEvidence,
    });

    const signature = this.signPayload({
      tenant_id: input.tenantId,
      generated_at: generatedAt,
      frameworks: input.frameworks,
      evidence_manifest_id: manifestId,
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

  private async queryTable(table: string, tenantId: string, startAt: string, endAt: string): Promise<unknown[]> {
    const query = this.client
      .from(table)
      .select("*")
      .eq("tenant_id", tenantId)
      .gte("timestamp", startAt)
      .lte("timestamp", endAt);

    const { data, error } = await query.order("timestamp", { ascending: true });
    if (error) {
      return [];
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
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  private assertTenant(tenantId: string): void {
    if (!tenantId) {
      throw new Error("tenant_id is required");
    }
  }
}

export const complianceReportGeneratorService = new ComplianceReportGeneratorService();

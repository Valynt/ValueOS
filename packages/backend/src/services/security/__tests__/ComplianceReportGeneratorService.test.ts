import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/supabase.js", () => ({
  createUserSupabaseClient: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}));

import type { AutomatedControlCheckSnapshot } from "../ComplianceControlCheckService.js";
import type { ControlStatusRecord } from "../ComplianceControlStatusService.js";
import {
  ComplianceReportGeneratorService,
  MissingEvidenceError,
} from "../ComplianceReportGeneratorService.js";

interface MockInsertResult {
  data: Record<string, unknown>;
}

const HIPAA_ENV_VARS = [
  "COMPLIANCE_MANIFEST_HMAC_KEY",
  "HIPAA_PHI_DATA_CLASSIFICATION_ENABLED",
  "HIPAA_DISCLOSURE_ACCOUNTING_AND_AUDIT_RETENTION_ENABLED",
  "HIPAA_PHI_STORE_AND_BACKUP_ENCRYPTION_ENABLED",
  "HIPAA_BREAK_GLASS_ACCESS_LOGGING_ENABLED",
  "HIPAA_RETENTION_AND_DELETION_POLICIES_DOCUMENTED",
] as const;

function setHipaaSupport(enabled: boolean): void {
  for (const envVar of HIPAA_ENV_VARS) {
    if (enabled && envVar === "COMPLIANCE_MANIFEST_HMAC_KEY") {
      process.env[envVar] = "test-manifest-key";
    } else if (enabled) {
      process.env[envVar] = "true";
    } else {
      delete process.env[envVar];
    }
  }
}

class MockClient {
  constructor(
    private readonly tableData: Record<string, unknown[]>,
    private readonly insertResults: MockInsertResult[] = [],
  ) {}

  from(table: string) {
    return {
      select: (_query: string) => {
        const filters: Record<string, unknown> = {};
        return {
          eq: (field: string, value: unknown) => {
            filters[field] = value;
            return this.from(table).select("*").withFilters(filters);
          },
          withFilters: (appliedFilters: Record<string, unknown>) => ({
            gte: (_field: string, _value: string) => ({
              lte: (_lteField: string, _lteValue: string) => ({
                order: async () => ({
                  data: (this.tableData[table] ?? []).filter((row) =>
                    Object.entries(appliedFilters).every(([k, v]) => (row as Record<string, unknown>)[k] === v),
                  ),
                  error: null,
                }),
              }),
            }),
          }),
        };
      },
      insert: (_payload: Record<string, unknown>) => ({
        select: (_query: string) => ({
          single: async () => ({
            data: this.insertResults.shift()?.data ?? { resource_id: `${table}-resource` },
            error: null,
          }),
        }),
      }),
    };
  }
}

function buildControlStatuses(): ControlStatusRecord[] {
  return [
    {
      control_id: "soc2_cc7_monitoring",
      framework: "SOC2",
      status: "pass",
      evidence_ts: "2026-01-01T00:00:00.000Z",
      tenant_id: "tenant-a",
      evidence_pointer: "audit://soc2",
      metric_value: 99,
      metric_unit: "percent",
    },
    {
      control_id: "iso27001_a12_logging_monitoring",
      framework: "ISO27001",
      status: "pass",
      evidence_ts: "2026-01-01T00:00:00.000Z",
      tenant_id: "tenant-a",
      evidence_pointer: "audit://iso",
      metric_value: 99,
      metric_unit: "percent",
    },
    {
      control_id: "gdpr_art_32_security_processing",
      framework: "GDPR",
      status: "pass",
      evidence_ts: "2026-01-01T00:00:00.000Z",
      tenant_id: "tenant-a",
      evidence_pointer: "audit://gdpr",
      metric_value: 99,
      metric_unit: "percent",
    },
    {
      control_id: "hipaa_164_312_b_audit_controls",
      framework: "HIPAA",
      status: "pass",
      evidence_ts: "2026-01-01T00:00:00.000Z",
      tenant_id: "tenant-a",
      evidence_pointer: "audit://hipaa",
      metric_value: 99,
      metric_unit: "percent",
    },
    {
      control_id: "ccpa_1798_110_disclosure",
      framework: "CCPA",
      status: "pass",
      evidence_ts: "2026-01-01T00:00:00.000Z",
      tenant_id: "tenant-a",
      evidence_pointer: "audit://ccpa",
      metric_value: 99,
      metric_unit: "percent",
    },
  ];
}

function buildCheckSnapshot(status: "pass" | "fail" = "pass"): AutomatedControlCheckSnapshot {
  return {
    run_id: "run-1",
    tenant_id: "tenant-a",
    checked_at: "2026-01-01T00:00:00.000Z",
    trigger: "manual",
    overall_status: status,
    failing_checks: status === "fail" ? 1 : 0,
    declared_capability: [
      { framework: "GDPR", supported: true, missing_prerequisites: [], gating_label: "prerequisite_gate" },
      { framework: "HIPAA", supported: true, missing_prerequisites: [], gating_label: "prerequisite_gate" },
      { framework: "SOC2", supported: true, missing_prerequisites: [], gating_label: "prerequisite_gate" },
    ],
    configured_controls: [
      {
        framework: "GDPR",
        control_id: "gdpr_encryption_required_config",
        source: "environment",
        status: "configured",
        message: "TLS and encryption-required settings are configured.",
      },
      {
        framework: "HIPAA",
        control_id: "hipaa_mfa_enforced_in_production",
        source: "tenant_config",
        status: status === "fail" ? "missing" : "configured",
        message: status === "fail" ? "Production MFA is not configured." : "Production MFA is configured.",
      },
    ],
    results: [
      {
        framework: "GDPR",
        control_id: "gdpr_art_32_security_processing",
        evidence_type: "control_status",
        status: "pass",
        message: "RLS enabled.",
        last_evidence_at: null,
        max_age_minutes: 0,
        freshness_minutes: null,
        check_kind: "technical_validation",
        assertion_id: "gdpr_required_tables_rls_enabled",
      },
      {
        framework: "HIPAA",
        control_id: "hipaa_164_312_c_integrity",
        evidence_type: "control_status",
        status,
        message: status === "fail" ? "MFA not enforced." : "MFA enforced.",
        last_evidence_at: null,
        max_age_minutes: 0,
        freshness_minutes: null,
        check_kind: "technical_validation",
        assertion_id: "hipaa_mfa_enforced_in_production",
      },
      {
        framework: "SOC2",
        control_id: "soc2_cc7_monitoring",
        evidence_type: "security_audit_log",
        status: "pass",
        message: "Evidence artifact exists and is fresh.",
        last_evidence_at: "2026-01-01T00:00:00.000Z",
        max_age_minutes: 720,
        freshness_minutes: 15,
        check_kind: "evidence_freshness",
      },
    ],
  };
}

describe("ComplianceReportGeneratorService", () => {
  afterEach(() => {
    setHipaaSupport(false);
  });

  it("generates report breakdowns that distinguish declared, configured, validated, and evidence states", async () => {
    setHipaaSupport(true);

    const service = new ComplianceReportGeneratorService(
      new MockClient(
        {
          audit_logs: [{ tenant_id: "tenant-a", timestamp: "2026-01-01T00:00:00.000Z" }],
          security_audit_log: [{ tenant_id: "tenant-a", timestamp: "2026-01-01T00:00:00.000Z" }],
          audit_logs_archive: [{ tenant_id: "tenant-a", timestamp: "2026-01-01T00:00:00.000Z" }],
          security_audit_log_archive: [{ tenant_id: "tenant-a", timestamp: "2026-01-01T00:00:00.000Z" }],
        },
        [{ data: { resource_id: "manifest-1" } }, { data: { resource_id: "report-1" } }],
      ) as never,
      {
        getLatestControlStatus: async () => buildControlStatuses(),
      },
      {
        runChecksForTenant: async () => buildCheckSnapshot("pass"),
      },
    );

    const report = await service.generateReport({
      tenantId: "tenant-a",
      frameworks: ["GDPR", "HIPAA", "CCPA", "SOC2", "ISO27001"],
      startAt: "2026-01-01T00:00:00.000Z",
      endAt: "2026-01-02T00:00:00.000Z",
      generatedBy: "user-1",
      mode: "on_demand",
      strict: true,
    });

    expect(report.evidence_manifest_id).toBe("manifest-1");
    expect(report.report_id).toBe("report-1");
    expect(report.status).toBe("pass");
    expect(report.declared_capability.length).toBeGreaterThan(0);
    expect(report.configured_controls.length).toBeGreaterThan(0);
    expect(report.technically_validated_controls.length).toBeGreaterThan(0);
    expect(report.framework_breakdown.some((framework) => framework.framework === "HIPAA")).toBe(true);
    expect(report.missing_evidence).toHaveLength(0);
  });

  it("fails strict report generation when required evidence is missing", async () => {
    setHipaaSupport(true);

    const service = new ComplianceReportGeneratorService(
      new MockClient({
        audit_logs: [{ tenant_id: "tenant-a", timestamp: "2026-01-01T00:00:00.000Z" }],
      }) as never,
      {
        getLatestControlStatus: async () => buildControlStatuses().filter((control) => control.framework !== "HIPAA"),
      },
      {
        runChecksForTenant: async () => buildCheckSnapshot("pass"),
      },
    );

    await expect(() =>
      service.generateReport({
        tenantId: "tenant-a",
        frameworks: ["HIPAA"],
        startAt: "2026-01-01T00:00:00.000Z",
        endAt: "2026-01-02T00:00:00.000Z",
        generatedBy: "user-1",
        mode: "scheduled",
        strict: true,
      }),
    ).rejects.toBeInstanceOf(MissingEvidenceError);
  });

  it("downgrades report status when technical validation fails even if evidence exists", async () => {
    setHipaaSupport(true);

    const service = new ComplianceReportGeneratorService(
      new MockClient(
        {
          audit_logs: [{ tenant_id: "tenant-a", timestamp: "2026-01-01T00:00:00.000Z" }],
          security_audit_log: [{ tenant_id: "tenant-a", timestamp: "2026-01-01T00:00:00.000Z" }],
          audit_logs_archive: [{ tenant_id: "tenant-a", timestamp: "2026-01-01T00:00:00.000Z" }],
          security_audit_log_archive: [{ tenant_id: "tenant-a", timestamp: "2026-01-01T00:00:00.000Z" }],
        },
        [{ data: { resource_id: "manifest-1" } }, { data: { resource_id: "report-1" } }],
      ) as never,
      {
        getLatestControlStatus: async () => buildControlStatuses(),
      },
      {
        runChecksForTenant: async () => buildCheckSnapshot("fail"),
      },
    );

    const report = await service.generateReport({
      tenantId: "tenant-a",
      frameworks: ["HIPAA"],
      startAt: "2026-01-01T00:00:00.000Z",
      endAt: "2026-01-02T00:00:00.000Z",
      generatedBy: "user-1",
      mode: "scheduled",
      strict: false,
    });

    expect(report.status).toBe("fail");
    expect(report.technically_validated_controls.some((control) => control.status === "fail")).toBe(true);
  });

  it("rejects HIPAA report generation when PHI-specific prerequisites are not configured", async () => {
    const service = new ComplianceReportGeneratorService(
      new MockClient({
        audit_logs: [{ tenant_id: "tenant-a", timestamp: "2026-01-01T00:00:00.000Z" }],
      }) as never,
      {
        getLatestControlStatus: async () => buildControlStatuses(),
      },
      {
        runChecksForTenant: async () => buildCheckSnapshot("pass"),
      },
    );

    await expect(() =>
      service.generateReport({
        tenantId: "tenant-a",
        frameworks: ["HIPAA"],
        startAt: "2026-01-01T00:00:00.000Z",
        endAt: "2026-01-02T00:00:00.000Z",
        generatedBy: "user-1",
        mode: "scheduled",
        strict: true,
      }),
    ).rejects.toThrow(/unsupported compliance frameworks requested: HIPAA/i);
  });
});

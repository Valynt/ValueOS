import { afterEach, describe, expect, it } from "vitest";

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

describe("ComplianceReportGeneratorService", () => {
  afterEach(() => {
    setHipaaSupport(false);
  });

  it("generates framework-specific summaries for GDPR, HIPAA, CCPA, SOC2, and ISO27001", async () => {
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
    expect(report.missing_evidence).toHaveLength(0);
    expect(report.retention_summary.map((summary) => summary.framework)).toEqual([
      "GDPR",
      "HIPAA",
      "CCPA",
      "SOC2",
      "ISO27001",
    ]);
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

  it("rejects HIPAA report generation when PHI-specific prerequisites are not configured", async () => {
    const service = new ComplianceReportGeneratorService(
      new MockClient({
        audit_logs: [{ tenant_id: "tenant-a", timestamp: "2026-01-01T00:00:00.000Z" }],
      }) as never,
      {
        getLatestControlStatus: async () => buildControlStatuses(),
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

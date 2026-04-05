import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  delete process.env.COMPLIANCE_RETENTION_FRAMEWORK;
  vi.resetModules();
});

describe("complianceRetentionAdapter", () => {
  it("maps framework-specific operational windows to runtime values", async () => {
    const { resolveOperationalRetentionDays } = await import("../complianceRetentionAdapter.js");

    const retentionDays = resolveOperationalRetentionDays({
      classId: "audit-events",
      framework: "GDPR",
    });

    expect(retentionDays).toBe(180);
  });

  it("falls back to the policy default window when framework is not mapped", async () => {
    const { resolveOperationalRetentionDays } = await import("../complianceRetentionAdapter.js");

    const retentionDays = resolveOperationalRetentionDays({
      classId: "audit-events",
      framework: "UNMAPPED_FRAMEWORK",
    });

    expect(retentionDays).toBe(365);
  });

  it("keeps dataProtection audit retention aligned with infra policy defaults", async () => {
    const [{ dataProtectionConfig }, { readComplianceRetentionPolicy }] = await Promise.all([
      import("../dataProtection.js"),
      import("../complianceRetentionPolicy.js"),
    ]);

    const policy = readComplianceRetentionPolicy();
    const auditClass = policy.classes.find((entry) => entry.id === "audit-events");

    expect(auditClass).toBeDefined();
    expect(dataProtectionConfig.retentionDays.auditLogs).toBe(auditClass?.default_window.operational_days);
  });
});

import { afterEach, describe, expect, it } from "vitest";

import { complianceFrameworkCapabilityGate } from "../ComplianceFrameworkCapabilityGate.js";

const HIPAA_ENV_VARS = [
  "HIPAA_PHI_DATA_CLASSIFICATION_ENABLED",
  "HIPAA_DISCLOSURE_ACCOUNTING_AND_AUDIT_RETENTION_ENABLED",
  "HIPAA_PHI_STORE_AND_BACKUP_ENCRYPTION_ENABLED",
  "HIPAA_BREAK_GLASS_ACCESS_LOGGING_ENABLED",
  "HIPAA_RETENTION_AND_DELETION_POLICIES_DOCUMENTED",
] as const;

function setHipaaSupport(enabled: boolean): void {
  for (const envVar of HIPAA_ENV_VARS) {
    if (enabled) {
      process.env[envVar] = "true";
    } else {
      delete process.env[envVar];
    }
  }
}

describe("ComplianceFrameworkCapabilityGate", () => {
  afterEach(() => {
    setHipaaSupport(false);
  });

  it("hides HIPAA from supported frameworks until PHI prerequisites are configured", () => {
    expect(complianceFrameworkCapabilityGate.getSupportedFrameworks()).not.toContain("HIPAA");
  });

  it("exposes HIPAA only when every PHI prerequisite flag is enabled", () => {
    setHipaaSupport(true);

    expect(complianceFrameworkCapabilityGate.getSupportedFrameworks()).toContain("HIPAA");
  });
});

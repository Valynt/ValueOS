import { describe, expect, it } from "vitest";

import { ComplianceFrameworkCapabilityGate } from "../ComplianceFrameworkCapabilityGate.js";

describe("ComplianceFrameworkCapabilityGate", () => {
  it("marks framework as gated when required verification signals are failing", async () => {
    const gate = new ComplianceFrameworkCapabilityGate({
      getFrameworkVerificationStatuses: async () => [
        {
          framework: "GDPR",
          declared: true,
          verified: true,
          missingPrerequisites: [],
          requiredSignals: ["tests_passed", "policies_deployed", "encryption_config_active"],
          signalStatuses: [],
        },
        {
          framework: "ISO27001",
          declared: true,
          verified: false,
          missingPrerequisites: ["Most recent automated technical compliance test run is passing."],
          requiredSignals: ["tests_passed", "policies_deployed", "retention_jobs_healthy", "encryption_config_active"],
          signalStatuses: [],
        },
        {
          framework: "CCPA",
          declared: true,
          verified: true,
          missingPrerequisites: [],
          requiredSignals: ["tests_passed", "retention_jobs_healthy", "policies_deployed"],
          signalStatuses: [],
        },
        {
          framework: "SOC2",
          declared: true,
          verified: true,
          missingPrerequisites: [],
          requiredSignals: ["tests_passed", "policies_deployed", "retention_jobs_healthy"],
          signalStatuses: [],
        },
        {
          framework: "ISO27001",
          declared: true,
          verified: true,
          missingPrerequisites: [],
          requiredSignals: ["tests_passed", "encryption_config_active", "retention_jobs_healthy"],
          signalStatuses: [],
        },
      ],
    });

    const iso27001 = await gate.getCapabilityStatus("tenant-1", "ISO27001");
    expect(iso27001.supported).toBe(false);
    expect(iso27001.verified).toBe(false);
    expect(iso27001.availability).toBe("gated");
  });

  it("exposes verified frameworks as supported", async () => {
    const gate = new ComplianceFrameworkCapabilityGate({
      getFrameworkVerificationStatuses: async () => [
        { framework: "GDPR", declared: true, verified: true, missingPrerequisites: [], requiredSignals: [], signalStatuses: [] },
        { framework: "ISO27001", declared: true, verified: true, missingPrerequisites: [], requiredSignals: [], signalStatuses: [] },
        { framework: "CCPA", declared: true, verified: true, missingPrerequisites: [], requiredSignals: [], signalStatuses: [] },
        { framework: "SOC2", declared: true, verified: true, missingPrerequisites: [], requiredSignals: [], signalStatuses: [] },
        { framework: "ISO27001", declared: true, verified: true, missingPrerequisites: [], requiredSignals: [], signalStatuses: [] },
      ],
    });

    const supported = await gate.getSupportedFrameworks("tenant-1");
    expect(supported).toContain("ISO27001");
  });
});

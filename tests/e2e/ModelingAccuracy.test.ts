import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";

import { IntegrityService } from "../../apps/ValyntApp/src/features/workflow/services/IntegrityService";

describe("Modeling Accuracy & Integrity Veto", () => {
  it("should accurately calculate sensitivity analysis with decimal.js", () => {
    const base = new Decimal("100000");
    const sensitivity = new Decimal("10").div(100);

    const upside = base.mul(new Decimal(1).plus(sensitivity));
    const downside = base.mul(new Decimal(1).minus(sensitivity));

    expect(upside.toString()).toBe("110000");
    expect(downside.toString()).toBe("90000");
  });

  it("should veto assumptions that exceed the conservative threshold", async () => {
    const service = IntegrityService.getInstance();
    const metricId = "efficiency_gain";
    const proposedValue = new Decimal("30"); // 30%
    const median = new Decimal("15"); // 15%

    const result = await service.validateAssumption(metricId, proposedValue, {
      industry: "Software",
      benchmarkMedian: median,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain("exceeds conservative threshold");
    expect(result.suggestedValue?.toString()).toBe("18"); // 120% of 15
  });

  it("should approve assumptions within the conservative threshold", async () => {
    const service = IntegrityService.getInstance();
    const proposedValue = new Decimal("17"); // 17%
    const median = new Decimal("15"); // 15%

    const result = await service.validateAssumption("efficiency_gain", proposedValue, {
      industry: "Software",
      benchmarkMedian: median,
    });

    expect(result.isValid).toBe(true);
  });

  it("should log validated assumptions to VMRT with a hash", () => {
    const service = IntegrityService.getInstance();
    const log = service.logToVMRT({
      metricId: "efficiency_gain",
      originalValue: new Decimal("17"),
      validatedValue: new Decimal("17"),
      reasoning: "Within bounds",
      agentId: "IntegrityAgent",
    });

    expect(log.hash).toBeDefined();
    expect(log.timestamp).toBeDefined();
    expect(service.getVMRTLogs().length).toBeGreaterThan(0);
  });
});

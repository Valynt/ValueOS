import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HallucinationChecker } from "../../integrity/HallucinationChecker.js";
import { XSS_PAYLOADS, SQL_INJECTION_PAYLOADS } from "../fixtures/securityFixtures.js";

describe("HallucinationChecker", () => {
  let checker: HallucinationChecker;

  beforeEach(() => {
    checker = new HallucinationChecker();
    vi.clearAllMocks();
  });

  describe("Security & Input Validation", () => {
    it("should sanitize XSS in narrative text", async () => {
      const xssPayload = XSS_PAYLOADS[0];

      const result = await checker.check({
        narrativeText: `The ROI is 150%. ${xssPayload}`,
        caseId: "case-1",
        scenarioId: "scenario-1",
        tenantId: "tenant-1",
        expectedFigures: [{ metricName: "ROI", value: 150, unit: "%", location: "scenario.roi" }],
      });

      // Should not crash and should process without executing XSS
      expect(result.flags).toBeDefined();
    });

    it("should handle SQL injection in narrative text", async () => {
      const sqlPayload = SQL_INJECTION_PAYLOADS[0];

      const result = await checker.check({
        narrativeText: `Revenue increased by 20%. ${sqlPayload}`,
        caseId: "case-1",
        scenarioId: "scenario-1",
        tenantId: "tenant-1",
        expectedFigures: [{ metricName: "Revenue", value: 20, unit: "%", location: "scenario.revenue" }],
      });

      expect(result.flags).toBeDefined();
    });
  });

  describe("Figure Validation", () => {
    it("should flag critical hallucination when discrepancy > 10%", async () => {
      const result = await checker.check({
        narrativeText: "The ROI achieved was 200%.",
        caseId: "case-1",
        scenarioId: "scenario-1",
        tenantId: "tenant-1",
        expectedFigures: [{ metricName: "ROI", value: 150, unit: "%", location: "scenario.roi" }],
      });

      expect(result.hasCritical).toBe(true);
      expect(result.canPersist).toBe(false);
    });

    it("should flag warning when discrepancy between 5-10%", async () => {
      const result = await checker.check({
        narrativeText: "The NPV is $550,000.",
        caseId: "case-1",
        scenarioId: "scenario-1",
        tenantId: "tenant-1",
        expectedFigures: [{ metricName: "NPV", value: 500000, unit: "USD", location: "scenario.npv" }],
      });

      const warningFlag = result.flags.find((f) => f.severity === "warning");
      expect(warningFlag).toBeDefined();
    });

    it("should allow figures within 5% tolerance", async () => {
      const result = await checker.check({
        narrativeText: "The payback period is 12.5 months.",
        caseId: "case-1",
        scenarioId: "scenario-1",
        tenantId: "tenant-1",
        expectedFigures: [{ metricName: "Payback", value: 12, unit: "months", location: "scenario.payback" }],
      });

      expect(result.flags.filter((f) => f.severity === "critical" || f.severity === "warning")).toHaveLength(0);
    });
  });

  describe("Missing Figure Detection", () => {
    it("should flag expected figures not mentioned in narrative", async () => {
      const result = await checker.check({
        narrativeText: "The project achieved good results.",
        caseId: "case-1",
        scenarioId: "scenario-1",
        tenantId: "tenant-1",
        expectedFigures: [
          { metricName: "ROI", value: 150, unit: "%", location: "scenario.roi" },
          { metricName: "NPV", value: 500000, unit: "USD", location: "scenario.npv" },
        ],
      });

      const missingFlags = result.flags.filter((f) => f.severity === "info");
      expect(missingFlags.length).toBeGreaterThan(0);
    });
  });

  describe("Currency Parsing", () => {
    it("should parse $M format correctly", async () => {
      const result = await checker.check({
        narrativeText: "Revenue uplift of $1.5M annually.",
        caseId: "case-1",
        scenarioId: "scenario-1",
        tenantId: "tenant-1",
        expectedFigures: [{ metricName: "Revenue", value: 1500000, unit: "USD", location: "evf.revenue" }],
      });

      expect(result.flags.filter((f) => f.severity === "critical")).toHaveLength(0);
    });

    it("should parse $K format correctly", async () => {
      const result = await checker.check({
        narrativeText: "Cost savings of $500K per year.",
        caseId: "case-1",
        scenarioId: "scenario-1",
        tenantId: "tenant-1",
        expectedFigures: [{ metricName: "Savings", value: 500000, unit: "USD", location: "evf.savings" }],
      });

      expect(result.flags.filter((f) => f.severity === "critical")).toHaveLength(0);
    });
  });

  describe("Percentage Parsing", () => {
    it("should parse percentage figures correctly", async () => {
      const result = await checker.check({
        narrativeText: "Efficiency improved by 15%.",
        caseId: "case-1",
        scenarioId: "scenario-1",
        tenantId: "tenant-1",
        expectedFigures: [{ metricName: "Efficiency", value: 15, unit: "%", location: "metrics.efficiency" }],
      });

      expect(result.flags.filter((f) => f.severity === "critical")).toHaveLength(0);
    });
  });

  describe("Payback Period Parsing", () => {
    it("should parse months format correctly", async () => {
      const result = await checker.check({
        narrativeText: "Payback period of 8 months.",
        caseId: "case-1",
        scenarioId: "scenario-1",
        tenantId: "tenant-1",
        expectedFigures: [{ metricName: "Payback", value: 8, unit: "months", location: "scenario.payback" }],
      });

      expect(result.flags.filter((f) => f.severity === "critical")).toHaveLength(0);
    });
  });

  describe("Idempotency", () => {
    it("should return consistent results for identical inputs", async () => {
      const input = {
        narrativeText: "The ROI is 150%.",
        caseId: "case-1",
        scenarioId: "scenario-1",
        tenantId: "tenant-1",
        expectedFigures: [{ metricName: "ROI", value: 150, unit: "%", location: "scenario.roi" }],
      };

      const result1 = await checker.check(input);
      const result2 = await checker.check(input);

      expect(result1.flags.length).toBe(result2.flags.length);
      expect(result1.hasCritical).toBe(result2.hasCritical);
    });
  });
});

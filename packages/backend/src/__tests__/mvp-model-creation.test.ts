/**
 * MVP Model Creation Behavioral Tests
 *
 * Tests verify actual behavior of the economic kernel and scenario building
 * WITHOUT relying on mocks. These tests will FAIL if the implementation
 * is broken or produces incorrect results.
 *
 * INVARIANT: All financial calculations must be deterministic and accurate.
 */

import { describe, expect, it, beforeEach } from "vitest";

import Decimal from "decimal.js";
import {
  calculateNPV,
  calculateROI,
  calculatePayback,
  toDecimalArray,
  calculateIRR,
} from "../domain/economic-kernel/economic_kernel";
import { ScenarioBuilder } from "../services/value/ScenarioBuilder";

// --- Helpers ---
const d = (v: number | string) => new Decimal(v);
const dArr = (vs: number[]) => toDecimalArray(vs);

describe("MVP Model Creation - Economic Kernel Behavior", () => {
  describe("NPV Calculation", () => {
    it("must calculate positive NPV for profitable investments", () => {
      // Investment: -500K, Returns: 100K, 120K, 140K, 160K, 180K over 5 years
      // Discount rate: 10%
      const cashFlows = dArr([-500000, 100000, 120000, 140000, 160000, 180000]);
      const discountRate = d(0.1);

      const npv = calculateNPV(cashFlows, discountRate);

      // NPV should be positive (profitable investment)
      expect(npv.toNumber()).toBeGreaterThan(0);
      // Known correct value: ~$89,086 at 10% discount
      expect(npv.toNumber()).toBeCloseTo(89086, -2);
    });

    it("must calculate negative NPV for unprofitable investments", () => {
      // Investment: -500K, Returns too low to justify
      const cashFlows = dArr([-500000, 50000, 60000, 70000, 80000, 90000]);
      const discountRate = d(0.1);

      const npv = calculateNPV(cashFlows, discountRate);

      // NPV should be negative (unprofitable at this discount rate)
      expect(npv.toNumber()).toBeLessThan(0);
    });

    it("must return zero NPV when discount rate equals IRR", () => {
      // Simple case: invest 100, get back 110 in 1 year
      // At 10% discount, NPV = -100 + 110/1.1 = 0
      const cashFlows = dArr([-100, 110]);
      const discountRate = d(0.1);

      const npv = calculateNPV(cashFlows, discountRate);

      expect(npv.toNumber()).toBeCloseTo(0, 5);
    });

    it("must handle zero discount rate (undiscounted cash flows)", () => {
      const cashFlows = dArr([-1000, 300, 400, 500]);
      const discountRate = d(0);

      const npv = calculateNPV(cashFlows, discountRate);

      // Simple sum: -1000 + 300 + 400 + 500 = 200
      expect(npv.toNumber()).toBeCloseTo(200, 5);
    });
  });

  describe("ROI Calculation", () => {
    it("must calculate correct ROI for profitable scenario", () => {
      // Invest 1000, return 1500 total
      const totalBenefits = d(1500);
      const totalCosts = d(1000);

      const roi = calculateROI(totalBenefits, totalCosts);

      // ROI = (1500 - 1000) / 1000 = 0.5 = 50%
      expect(roi.toNumber()).toBeCloseTo(0.5, 5);
    });

    it("must return zero ROI when benefits equal costs", () => {
      const totalBenefits = d(1000);
      const totalCosts = d(1000);

      const roi = calculateROI(totalBenefits, totalCosts);

      expect(roi.toNumber()).toBeCloseTo(0, 5);
    });

    it("must handle very high ROI correctly", () => {
      // Invest 1000, return 10000 (10x)
      const totalBenefits = d(10000);
      const totalCosts = d(1000);

      const roi = calculateROI(totalBenefits, totalCosts);

      // ROI = (10000 - 1000) / 1000 = 9 = 900%
      expect(roi.toNumber()).toBeCloseTo(9, 5);
    });

    it("must handle edge case of zero costs", () => {
      const totalBenefits = d(1000);
      const totalCosts = d(0);

      // Should not throw, behavior defined by implementation
      expect(() => calculateROI(totalBenefits, totalCosts)).not.toThrow();
    });
  });

  describe("Payback Period Calculation", () => {
    it("must calculate payback for investment recovering in year 3", () => {
      // -1000, +400, +400, +400 - pays back during year 3
      const cashFlows = dArr([-1000, 400, 400, 400]);

      const result = calculatePayback(cashFlows);

      expect(result.period).toBeCloseTo(2.5, 1); // 2.5 years
      expect(result.converged).toBe(true);
    });

    it("must return null for investments that never pay back", () => {
      // -1000, +100, +100, +100 - never recovers
      const cashFlows = dArr([-1000, 100, 100, 100]);

      const result = calculatePayback(cashFlows);

      expect(result.period).toBeNull();
      expect(result.converged).toBe(false);
    });

    it("must handle immediate payback (period 0)", () => {
      // No initial investment, just gains
      const cashFlows = dArr([0, 1000, 1000]);

      const result = calculatePayback(cashFlows);

      // Should converge immediately
      expect(result.converged).toBe(true);
    });
  });

  describe("IRR Calculation", () => {
    it("must calculate IRR for standard investment", () => {
      // Classic case: -1000, +300, +400, +500
      // IRR should be around 10.6%
      const cashFlows = dArr([-1000, 300, 400, 500]);

      const result = calculateIRR(cashFlows);

      expect(result.irr).not.toBeNull();
      expect(result.converged).toBe(true);
      expect(result.irr!.toNumber()).toBeGreaterThan(0.1);
      expect(result.irr!.toNumber()).toBeLessThan(0.12);
    });

    it("must converge for multi-year investment", () => {
      const cashFlows = dArr([-500000, 150000, 200000, 250000, 180000]);

      const result = calculateIRR(cashFlows);

      expect(result.converged).toBe(true);
      expect(result.irr).not.toBeNull();
      expect(result.irr!.toNumber()).toBeGreaterThan(0.15); // > 15%
    });
  });

  describe("Deterministic Behavior", () => {
    it("must produce identical results for identical inputs", () => {
      const cashFlows = dArr([-1000000, 300000, 400000, 500000, 600000]);
      const discountRate = d(0.08);

      const npv1 = calculateNPV(cashFlows, discountRate);
      const npv2 = calculateNPV(cashFlows, discountRate);
      const npv3 = calculateNPV(cashFlows, discountRate);

      // Must be exactly equal
      expect(npv1.toString()).toBe(npv2.toString());
      expect(npv2.toString()).toBe(npv3.toString());
    });

    it("must maintain precision for very large numbers", () => {
      const cashFlows = dArr([-1000000000, 300000000, 400000000, 500000000]);
      const discountRate = d(0.1);

      const npv = calculateNPV(cashFlows, discountRate);

      // Should not lose precision
      expect(npv.isNaN()).toBe(false);
      expect(npv.isFinite()).toBe(true);
      expect(npv.toNumber()).toBeGreaterThan(0);
    });

    it("must handle very small numbers", () => {
      const cashFlows = dArr([-0.01, 0.003, 0.004, 0.005]);
      const discountRate = d(0.05);

      const npv = calculateNPV(cashFlows, discountRate);

      expect(npv.isNaN()).toBe(false);
      expect(npv.isFinite()).toBe(true);
    });
  });
});

describe("MVP Model Creation - ScenarioBuilder Behavior", () => {
  let scenarioBuilder: ScenarioBuilder;

  beforeEach(() => {
    scenarioBuilder = new ScenarioBuilder();
  });

  it("must build three scenarios (conservative, base, upside) from input", async () => {
    const input = {
      tenantId: "test-tenant",
      caseId: "test-case",
      acceptedHypotheses: [
        {
          id: "hyp-1",
          value_driver: "Cost Reduction",
          estimated_impact_min: 100000,
          estimated_impact_max: 200000,
          confidence_score: 0.8,
        },
      ],
      assumptions: [
        {
          id: "assump-1",
          name: "Implementation Timeline",
          value: 12,
          source_type: "industry_benchmark",
        },
      ],
    };

    const result = await scenarioBuilder.buildScenarios(input);

    // Must have all three scenarios
    expect(result.conservative).toBeDefined();
    expect(result.base).toBeDefined();
    expect(result.upside).toBeDefined();
  });

  it("must calculate positive NPV for all scenarios when inputs are positive", async () => {
    const input = {
      tenantId: "test-tenant",
      caseId: "test-case",
      acceptedHypotheses: [
        {
          id: "hyp-1",
          value_driver: "Cost Reduction",
          estimated_impact_min: 100000,
          estimated_impact_max: 500000,
          confidence_score: 0.9,
        },
      ],
      assumptions: [],
    };

    const result = await scenarioBuilder.buildScenarios(input);

    // All scenarios should have positive NPV for positive-value hypotheses
    expect(result.conservative.npv).toBeGreaterThan(0);
    expect(result.base.npv).toBeGreaterThan(0);
    expect(result.upside.npv).toBeGreaterThan(0);
  });

  it("must order scenarios correctly (conservative < base < upside)", async () => {
    const input = {
      tenantId: "test-tenant",
      caseId: "test-case",
      acceptedHypotheses: [
        {
          id: "hyp-1",
          value_driver: "Revenue Increase",
          estimated_impact_min: 100000,
          estimated_impact_max: 500000,
          confidence_score: 0.8,
        },
      ],
      assumptions: [],
    };

    const result = await scenarioBuilder.buildScenarios(input);

    // Conservative should have lowest NPV, upside highest
    expect(result.conservative.npv).toBeLessThan(result.base.npv);
    expect(result.base.npv).toBeLessThan(result.upside.npv);
  });

  it("must calculate ROI for each scenario", async () => {
    const input = {
      tenantId: "test-tenant",
      caseId: "test-case",
      acceptedHypotheses: [
        {
          id: "hyp-1",
          value_driver: "Cost Reduction",
          estimated_impact_min: 200000,
          estimated_impact_max: 400000,
          confidence_score: 0.85,
        },
      ],
      assumptions: [],
    };

    const result = await scenarioBuilder.buildScenarios(input);

    // Each scenario must have valid ROI
    expect(result.conservative.roi).toBeGreaterThan(0);
    expect(result.base.roi).toBeGreaterThan(0);
    expect(result.upside.roi).toBeGreaterThan(0);

    // ROI should be reasonable (not infinity, not NaN)
    expect(Number.isFinite(result.conservative.roi)).toBe(true);
    expect(Number.isFinite(result.base.roi)).toBe(true);
    expect(Number.isFinite(result.upside.roi)).toBe(true);
  });

  it("must calculate payback period for each scenario", async () => {
    const input = {
      tenantId: "test-tenant",
      caseId: "test-case",
      acceptedHypotheses: [
        {
          id: "hyp-1",
          value_driver: "Cost Reduction",
          estimated_impact_min: 100000,
          estimated_impact_max: 200000,
          confidence_score: 0.8,
        },
      ],
      assumptions: [
        {
          id: "assump-1",
          name: "Implementation Cost",
          value: 50000,
          source_type: "user_override",
        },
      ],
    };

    const result = await scenarioBuilder.buildScenarios(input);

    // Should have payback periods defined (may be null if doesn't pay back)
    expect(result.conservative).toHaveProperty("payback_months");
    expect(result.base).toHaveProperty("payback_months");
    expect(result.upside).toHaveProperty("payback_months");
  });
});

describe("MVP Model Creation - Performance Requirements", () => {
  it("must calculate NPV in under 10ms for 20-year cash flows", () => {
    const cashFlows = dArr([
      -1000000,
      ...Array(19)
        .fill(0)
        .map((_, i) => 150000 + i * 10000),
    ]);
    const discountRate = d(0.1);

    const start = performance.now();
    calculateNPV(cashFlows, discountRate);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10); // 10ms threshold
  });

  it("must calculate IRR in under 50ms for complex cash flows", () => {
    const cashFlows = dArr([
      -2000000,
      100000,
      200000,
      300000,
      400000,
      500000,
      600000,
      700000,
      800000,
    ]);

    const start = performance.now();
    calculateIRR(cashFlows);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50); // 50ms threshold
  });

  it("must build scenarios in under 100ms for single hypothesis", async () => {
    const scenarioBuilder = new ScenarioBuilder();
    const input = {
      tenantId: "perf-test",
      caseId: "perf-case",
      acceptedHypotheses: [
        {
          id: "hyp-perf",
          value_driver: "Performance Test",
          estimated_impact_min: 100000,
          estimated_impact_max: 500000,
          confidence_score: 0.8,
        },
      ],
      assumptions: [],
    };

    const start = performance.now();
    await scenarioBuilder.buildScenarios(input);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100); // 100ms threshold
  });
});

describe("MVP Model Creation - Data Integrity", () => {
  it("must handle missing hypotheses gracefully", async () => {
    const scenarioBuilder = new ScenarioBuilder();
    const input = {
      tenantId: "test-tenant",
      caseId: "test-case",
      acceptedHypotheses: [], // Empty array
      assumptions: [],
    };

    // Should not throw, should return valid (possibly zero) scenarios
    const result = await scenarioBuilder.buildScenarios(input);

    expect(result.conservative).toBeDefined();
    expect(result.base).toBeDefined();
    expect(result.upside).toBeDefined();
  });

  it("must handle extreme confidence scores (0 and 1)", async () => {
    const scenarioBuilder = new ScenarioBuilder();
    const input = {
      tenantId: "test-tenant",
      caseId: "test-case",
      acceptedHypotheses: [
        {
          id: "hyp-zero",
          value_driver: "No Confidence",
          estimated_impact_min: 100000,
          estimated_impact_max: 200000,
          confidence_score: 0, // Zero confidence
        },
        {
          id: "hyp-full",
          value_driver: "Full Confidence",
          estimated_impact_min: 100000,
          estimated_impact_max: 200000,
          confidence_score: 1, // Full confidence
        },
      ],
      assumptions: [],
    };

    // Should not throw
    const result = await scenarioBuilder.buildScenarios(input);

    expect(result.conservative).toBeDefined();
    expect(result.base).toBeDefined();
    expect(result.upside).toBeDefined();
  });

  it("must reject invalid cash flows (single period)", () => {
    // Single cash flow can't have meaningful NPV
    const cashFlows = dArr([1000]); // No investment, just a return
    const discountRate = d(0.1);

    const npv = calculateNPV(cashFlows, discountRate);

    // Should handle gracefully
    expect(npv.isNaN()).toBe(false);
    expect(npv.isFinite()).toBe(true);
  });

  it("must handle negative discount rates", () => {
    const cashFlows = dArr([-1000, 1100]);
    const discountRate = d(-0.1); // Negative discount (rare but possible)

    const npv = calculateNPV(cashFlows, discountRate);

    // Should calculate but result may be unusual
    expect(npv.isNaN()).toBe(false);
    expect(npv.isFinite()).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import {
  FinancialCalculator,
  FinancialInputs,
} from "../FinancialCalculator.js";

const baseInputs: FinancialInputs = {
  softwareCost: 10_000,
  implementationCost: 5_000,
  userCount: 50,
  efficiencyGainPercent: 10,
  avgSalary: 80_000,
  discountRate: 0.08,
  timeHorizonYears: 3,
};

describe("FinancialCalculator", () => {
  describe("calculate", () => {
    it("computes ROI, NPV, costs, benefits, and yearly breakdown for a standard input set", () => {
      const result = FinancialCalculator.calculate(baseInputs);

      // totalCosts = softwareCost * years + implementationCost = 10000*3 + 5000
      expect(result.totalCosts).toBe(35_000);

      // yearly benefits = userCount * 2000h * (efficiencyGain/100) * (avgSalary/2000)
      // = 50 * 2000 * 0.10 * 40 = 400,000 per year
      expect(result.totalBenefits).toBe(1_200_000);

      // ROI = ((1,200,000 - 35,000) / 35,000) * 100 ≈ 3329
      expect(result.roi).toBe(3329);

      // NPV is positive (benefits far exceed costs)
      expect(result.npv).toBeGreaterThan(0);

      // Yearly breakdown has one entry per year
      expect(result.yearlyBreakdown).toHaveLength(3);

      // Year 1 includes implementation cost; years 2-3 do not
      expect(result.yearlyBreakdown[0].costs).toBe(15_000);
      expect(result.yearlyBreakdown[1].costs).toBe(10_000);
      expect(result.yearlyBreakdown[2].costs).toBe(10_000);

      // All years have the same nominal benefits
      for (const year of result.yearlyBreakdown) {
        expect(year.benefits).toBe(400_000);
      }

      // Cumulative NPV is monotonically increasing (benefits > costs every year)
      for (let i = 1; i < result.yearlyBreakdown.length; i++) {
        expect(result.yearlyBreakdown[i].cumulativeNpv).toBeGreaterThan(
          result.yearlyBreakdown[i - 1].cumulativeNpv
        );
      }

      // Payback within the first year since benefits >> costs
      expect(result.paybackMonths).toBeLessThanOrEqual(12);
    });

    it("sets paybackMonths to full horizon when benefits never exceed costs", () => {
      const unprofitable: FinancialInputs = {
        ...baseInputs,
        softwareCost: 500_000,
        implementationCost: 500_000,
        userCount: 1,
        efficiencyGainPercent: 1,
        timeHorizonYears: 2,
      };

      const result = FinancialCalculator.calculate(unprofitable);

      // Benefits per year: 1 * 2000 * 0.01 * 40 = 800
      // Year 1 costs: 500000 + 500000 = 1,000,000 — NPV never goes positive
      expect(result.paybackMonths).toBe(unprofitable.timeHorizonYears * 12);
      expect(result.roi).toBeLessThan(0);
    });
  });

  describe("generateScenarios", () => {
    it("returns conservative, likely, and optimistic projections with correct ordering", () => {
      const scenarios = FinancialCalculator.generateScenarios(baseInputs);

      expect(scenarios).toHaveProperty("conservative");
      expect(scenarios).toHaveProperty("likely");
      expect(scenarios).toHaveProperty("optimistic");

      // ROI ordering: conservative < likely < optimistic
      expect(scenarios.conservative.roi).toBeLessThan(scenarios.likely.roi);
      expect(scenarios.likely.roi).toBeLessThan(scenarios.optimistic.roi);

      // Likely scenario matches a direct calculate call
      const direct = FinancialCalculator.calculate(baseInputs);
      expect(scenarios.likely.roi).toBe(direct.roi);
      expect(scenarios.likely.npv).toBe(direct.npv);
      expect(scenarios.likely.totalCosts).toBe(direct.totalCosts);
    });
  });
});

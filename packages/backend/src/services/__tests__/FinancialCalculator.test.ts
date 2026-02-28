import { describe, expect, it } from 'vitest';

import { FinancialCalculator, type FinancialInputs } from '../FinancialCalculator';

const baseInputs: FinancialInputs = {
  softwareCost: 50000,
  implementationCost: 20000,
  userCount: 100,
  efficiencyGainPercent: 10,
  avgSalary: 80000,
  discountRate: 0.1,
  timeHorizonYears: 3,
};

describe('FinancialCalculator', () => {
  describe('calculate', () => {
    it('returns correct totalCosts (software * years + implementation)', () => {
      const result = FinancialCalculator.calculate(baseInputs);
      // 50000 * 3 + 20000 = 170000
      expect(result.totalCosts).toBe(170000);
    });

    it('computes yearly benefits from efficiency gains and salary', () => {
      const result = FinancialCalculator.calculate(baseInputs);
      // annualBenefit = userCount * efficiencyGainPercent/100 * avgSalary = 100 * 0.10 * 80000 = 800000
      const expectedAnnualBenefit = 800000;
      expect(result.totalBenefits).toBe(expectedAnnualBenefit * baseInputs.timeHorizonYears);
    });

    it('includes implementation cost only in year 1', () => {
      const result = FinancialCalculator.calculate(baseInputs);
      expect(result.yearlyBreakdown[0].costs).toBe(50000 + 20000);
      expect(result.yearlyBreakdown[1].costs).toBe(50000);
      expect(result.yearlyBreakdown[2].costs).toBe(50000);
    });

    it('produces correct number of yearly breakdown entries', () => {
      const result = FinancialCalculator.calculate(baseInputs);
      expect(result.yearlyBreakdown).toHaveLength(baseInputs.timeHorizonYears);
    });

    it('calculates ROI as rounded percentage', () => {
      const result = FinancialCalculator.calculate(baseInputs);
      // ROI = ((2400000 - 170000) / 170000) * 100 ≈ 1312
      const expectedRoi = Math.round(((2400000 - 170000) / 170000) * 100);
      expect(result.roi).toBe(expectedRoi);
    });

    it('computes cumulative NPV that increases each year', () => {
      const result = FinancialCalculator.calculate(baseInputs);
      for (let i = 1; i < result.yearlyBreakdown.length; i++) {
        expect(result.yearlyBreakdown[i].cumulativeNpv).toBeGreaterThan(
          result.yearlyBreakdown[i - 1].cumulativeNpv
        );
      }
    });

    it('finds payback period when cumulative NPV turns positive', () => {
      const result = FinancialCalculator.calculate(baseInputs);
      // Benefits far exceed costs, so payback should be in year 1
      expect(result.paybackMonths).toBeGreaterThan(0);
      expect(result.paybackMonths).toBeLessThanOrEqual(12);
    });

    it('sets payback to full horizon when benefits never exceed costs', () => {
      const unprofitable: FinancialInputs = {
        ...baseInputs,
        efficiencyGainPercent: 0.01,
        softwareCost: 500000,
      };
      const result = FinancialCalculator.calculate(unprofitable);
      expect(result.paybackMonths).toBe(unprofitable.timeHorizonYears * 12);
    });
  });

  describe('generateScenarios', () => {
    it('returns conservative, likely, and optimistic scenarios', () => {
      const scenarios = FinancialCalculator.generateScenarios(baseInputs);
      expect(scenarios).toHaveProperty('conservative');
      expect(scenarios).toHaveProperty('likely');
      expect(scenarios).toHaveProperty('optimistic');
    });

    it('orders scenario ROI as conservative < likely < optimistic', () => {
      const { conservative, likely, optimistic } = FinancialCalculator.generateScenarios(baseInputs);
      expect(conservative.roi).toBeLessThan(likely.roi);
      expect(likely.roi).toBeLessThan(optimistic.roi);
    });

    it('applies 70% efficiency and 80% users for conservative scenario', () => {
      const { conservative } = FinancialCalculator.generateScenarios(baseInputs);
      const manualConservative = FinancialCalculator.calculate({
        ...baseInputs,
        efficiencyGainPercent: baseInputs.efficiencyGainPercent * 0.7,
        userCount: Math.floor(baseInputs.userCount * 0.8),
      });
      expect(conservative.roi).toBe(manualConservative.roi);
      expect(conservative.npv).toBe(manualConservative.npv);
    });
  });
});

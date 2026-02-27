import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import {
  calculateDiscountedPayback,
  calculateEVF,
  calculateIRR,
  calculateNPV,
  calculatePayback,
  calculateROI,
  discountCashFlows,
  multiSensitivityAnalysis,
  roundTo,
  sensitivityAnalysis,
  toDecimalArray,
} from '../economic_kernel';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const d = (v: number | string) => new Decimal(v);
const dArr = (vs: number[]) => toDecimalArray(vs);

function expectClose(actual: Decimal, expected: number, tolerance = 0.01) {
  expect(actual.minus(expected).abs().lte(tolerance)).toBe(true);
}

// ─── DCF Tests ───────────────────────────────────────────────────────────────

describe('discountCashFlows', () => {
  it('returns empty result for empty flows', () => {
    const result = discountCashFlows([], d(0.1));
    expect(result.presentValues).toEqual([]);
    expect(result.npv.toNumber()).toBe(0);
  });

  it('does not discount period 0', () => {
    const result = discountCashFlows([d(-1000)], d(0.1));
    expect(result.presentValues[0].toNumber()).toBe(-1000);
    expect(result.npv.toNumber()).toBe(-1000);
  });

  it('correctly discounts a simple 3-year series at 10%', () => {
    // -1000 + 500/(1.1) + 500/(1.1^2) + 500/(1.1^3)
    const flows = dArr([-1000, 500, 500, 500]);
    const result = discountCashFlows(flows, d(0.1));

    // PV1 = 500/1.1 ≈ 454.55
    expectClose(result.presentValues[1], 454.55);
    // PV2 = 500/1.21 ≈ 413.22
    expectClose(result.presentValues[2], 413.22);
    // PV3 = 500/1.331 ≈ 375.66
    expectClose(result.presentValues[3], 375.66);
    // NPV ≈ -1000 + 454.55 + 413.22 + 375.66 ≈ 243.43
    expectClose(result.npv, 243.43, 0.5);
  });

  it('at 0% discount rate, NPV equals sum of flows', () => {
    const flows = dArr([-1000, 400, 400, 400]);
    const result = discountCashFlows(flows, d(0));
    expectClose(result.npv, 200);
  });

  it('INVARIANT: sum of present values equals NPV', () => {
    const flows = dArr([-5000, 1500, 2000, 2500, 1000]);
    const result = discountCashFlows(flows, d(0.08));
    const sumPV = result.presentValues.reduce((s, pv) => s.plus(pv), d(0));
    expect(sumPV.minus(result.npv).abs().lte(1e-10)).toBe(true);
  });

  it('INVARIANT: higher discount rate produces lower NPV for positive future flows', () => {
    const flows = dArr([-1000, 500, 500, 500]);
    const npvLow = calculateNPV(flows, d(0.05));
    const npvHigh = calculateNPV(flows, d(0.15));
    expect(npvLow.gt(npvHigh)).toBe(true);
  });
});

describe('calculateNPV', () => {
  it('matches discountCashFlows NPV', () => {
    const flows = dArr([-2000, 800, 800, 800, 800]);
    const npv = calculateNPV(flows, d(0.12));
    const dcf = discountCashFlows(flows, d(0.12));
    expect(npv.eq(dcf.npv)).toBe(true);
  });

  it('handles single period (just initial investment)', () => {
    const npv = calculateNPV([d(-5000)], d(0.1));
    expect(npv.toNumber()).toBe(-5000);
  });
});

// ─── IRR Tests ───────────────────────────────────────────────────────────────

describe('calculateIRR', () => {
  it('returns non-converged for fewer than 2 flows', () => {
    const result = calculateIRR([d(-1000)]);
    expect(result.converged).toBe(false);
  });

  it('finds IRR for a simple investment', () => {
    // -1000 + 1100 → IRR = 10%
    const result = calculateIRR(dArr([-1000, 1100]));
    expect(result.converged).toBe(true);
    expectClose(result.rate, 0.1, 0.001);
  });

  it('finds IRR for a multi-year investment', () => {
    // -10000 + 3000 + 4000 + 5000 → IRR ≈ 8.9%
    const result = calculateIRR(dArr([-10000, 3000, 4000, 5000]));
    expect(result.converged).toBe(true);
    expectClose(result.rate, 0.089, 0.01);
  });

  it('INVARIANT: NPV at IRR rate is approximately zero', () => {
    const flows = dArr([-5000, 1500, 2000, 2500, 1000]);
    const irr = calculateIRR(flows);
    expect(irr.converged).toBe(true);

    const npvAtIRR = calculateNPV(flows, irr.rate);
    expect(npvAtIRR.abs().lte(0.01)).toBe(true);
  });

  it('INVARIANT: NPV at IRR is zero for various cash flow patterns', () => {
    const patterns = [
      [-1000, 200, 300, 400, 500],
      [-5000, 2000, 2000, 2000],
      [-100, 50, 50, 50],
      [-20000, 5000, 6000, 7000, 8000, 9000],
    ];

    for (const pattern of patterns) {
      const flows = dArr(pattern);
      const irr = calculateIRR(flows);
      if (irr.converged) {
        const npvAtIRR = calculateNPV(flows, irr.rate);
        expect(npvAtIRR.abs().lte(0.01)).toBe(true);
      }
    }
  });

  it('handles break-even investment (IRR = 0)', () => {
    // -1000 + 500 + 500 → IRR = 0
    const result = calculateIRR(dArr([-1000, 500, 500]));
    expect(result.converged).toBe(true);
    expectClose(result.rate, 0, 0.001);
  });
});

// ─── Payback Tests ───────────────────────────────────────────────────────────

describe('calculatePayback', () => {
  it('returns null for empty flows', () => {
    const result = calculatePayback([]);
    expect(result.period).toBeNull();
    expect(result.fractionalPeriod).toBeNull();
  });

  it('returns period 0 if initial flow is non-negative', () => {
    const result = calculatePayback(dArr([100, 200]));
    expect(result.period).toBe(0);
    expect(result.fractionalPeriod?.toNumber()).toBe(0);
  });

  it('calculates simple payback period', () => {
    // -1000 + 400 + 400 + 400 → payback at period 3
    const result = calculatePayback(dArr([-1000, 400, 400, 400]));
    expect(result.period).toBe(3);
  });

  it('calculates fractional payback via interpolation', () => {
    // -1000 + 600 + 600 → cumulative: -1000, -400, 200
    // Fractional: 1 + 400/600 = 1.667
    const result = calculatePayback(dArr([-1000, 600, 600]));
    expect(result.period).toBe(2);
    expectClose(result.fractionalPeriod!, 1.667, 0.01);
  });

  it('returns null if investment never pays back', () => {
    const result = calculatePayback(dArr([-1000, 100, 100, 100]));
    expect(result.period).toBeNull();
    expect(result.fractionalPeriod).toBeNull();
  });

  it('INVARIANT: cumulative flow at payback period is non-negative', () => {
    const flows = dArr([-5000, 1500, 2000, 2500, 1000]);
    const result = calculatePayback(flows);
    if (result.period !== null) {
      expect(result.cumulativeFlows[result.period].gte(0)).toBe(true);
    }
  });

  it('INVARIANT: cumulative flow before payback period is negative', () => {
    const flows = dArr([-5000, 1500, 2000, 2500, 1000]);
    const result = calculatePayback(flows);
    if (result.period !== null && result.period > 0) {
      expect(result.cumulativeFlows[result.period - 1].lt(0)).toBe(true);
    }
  });
});

describe('calculateDiscountedPayback', () => {
  it('discounted payback is >= undiscounted payback', () => {
    const flows = dArr([-1000, 400, 400, 400, 400]);
    const undiscounted = calculatePayback(flows);
    const discounted = calculateDiscountedPayback(flows, d(0.1));

    if (undiscounted.period !== null && discounted.period !== null) {
      expect(discounted.period).toBeGreaterThanOrEqual(undiscounted.period);
    }
  });

  it('at 0% rate, matches undiscounted payback', () => {
    const flows = dArr([-1000, 400, 400, 400]);
    const undiscounted = calculatePayback(flows);
    const discounted = calculateDiscountedPayback(flows, d(0));

    expect(discounted.period).toBe(undiscounted.period);
  });
});

// ─── Sensitivity Analysis Tests ──────────────────────────────────────────────

describe('sensitivityAnalysis', () => {
  it('evaluates output at each perturbation point', () => {
    const result = sensitivityAnalysis(
      'discount_rate',
      d(0.1),
      dArr([0.8, 0.9, 1.0, 1.1, 1.2]),
      (rate) => calculateNPV(dArr([-1000, 500, 500, 500]), rate)
    );

    expect(result.parameterName).toBe('discount_rate');
    expect(result.points).toHaveLength(5);
    expect(result.baseOutput.eq(calculateNPV(dArr([-1000, 500, 500, 500]), d(0.1)))).toBe(true);
  });

  it('INVARIANT: base case point (multiplier=1.0) matches baseOutput', () => {
    const result = sensitivityAnalysis(
      'cost',
      d(1000),
      dArr([0.5, 1.0, 1.5]),
      (cost) => d(5000).minus(cost)
    );

    const basePoint = result.points.find((p) => p.parameterValue.eq(1000));
    expect(basePoint).toBeDefined();
    expect(basePoint!.outputValue.eq(result.baseOutput)).toBe(true);
  });

  it('INVARIANT: monotonic output for monotonic function', () => {
    // NPV decreases as discount rate increases
    const result = sensitivityAnalysis(
      'discount_rate',
      d(0.1),
      dArr([0.5, 0.75, 1.0, 1.25, 1.5]),
      (rate) => calculateNPV(dArr([-1000, 500, 500, 500]), rate)
    );

    for (let i = 1; i < result.points.length; i++) {
      expect(result.points[i].outputValue.lte(result.points[i - 1].outputValue)).toBe(true);
    }
  });
});

describe('multiSensitivityAnalysis', () => {
  it('returns results for each parameter', () => {
    const results = multiSensitivityAnalysis([
      {
        name: 'discount_rate',
        baseValue: d(0.1),
        perturbations: dArr([0.8, 1.0, 1.2]),
        evaluate: (rate) => calculateNPV(dArr([-1000, 500, 500]), rate),
      },
      {
        name: 'initial_cost',
        baseValue: d(1000),
        perturbations: dArr([0.8, 1.0, 1.2]),
        evaluate: (cost) => d(1500).minus(cost),
      },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].parameterName).toBe('discount_rate');
    expect(results[1].parameterName).toBe('initial_cost');
  });
});

// ─── EVF Tests ───────────────────────────────────────────────────────────────

describe('calculateEVF', () => {
  it('calculates net value and risk-adjusted value', () => {
    const result = calculateEVF(d(10000), d(3000), d(0.2));
    expect(result.netValue.toNumber()).toBe(7000);
    // 7000 * (1 - 0.2) = 5600
    expect(result.riskAdjustedValue.toNumber()).toBe(5600);
  });

  it('with zero risk, risk-adjusted equals net value', () => {
    const result = calculateEVF(d(5000), d(2000), d(0));
    expect(result.riskAdjustedValue.eq(result.netValue)).toBe(true);
  });

  it('with 100% risk, risk-adjusted value is zero', () => {
    const result = calculateEVF(d(5000), d(2000), d(1));
    expect(result.riskAdjustedValue.toNumber()).toBe(0);
  });

  it('throws for risk factor out of range', () => {
    expect(() => calculateEVF(d(1000), d(500), d(-0.1))).toThrow(RangeError);
    expect(() => calculateEVF(d(1000), d(500), d(1.1))).toThrow(RangeError);
  });

  it('INVARIANT: riskAdjustedValue = netValue * (1 - risk)', () => {
    const revenue = d(8000);
    const cost = d(3000);
    const risk = d(0.35);
    const result = calculateEVF(revenue, cost, risk);

    const expected = result.netValue.times(d(1).minus(risk));
    expect(result.riskAdjustedValue.eq(expected)).toBe(true);
  });

  it('INVARIANT: components are preserved', () => {
    const result = calculateEVF(d(10000), d(4000), d(0.15));
    expect(result.components.revenue.toNumber()).toBe(10000);
    expect(result.components.cost.toNumber()).toBe(4000);
    expect(result.components.risk.toNumber()).toBe(0.15);
  });
});

// ─── ROI Tests ───────────────────────────────────────────────────────────────

describe('calculateROI', () => {
  it('calculates ROI as decimal', () => {
    // (15000 - 10000) / 10000 = 0.5
    const roi = calculateROI(d(15000), d(10000));
    expect(roi.toNumber()).toBe(0.5);
  });

  it('returns negative ROI for loss', () => {
    const roi = calculateROI(d(8000), d(10000));
    expect(roi.toNumber()).toBe(-0.2);
  });

  it('throws for zero costs', () => {
    expect(() => calculateROI(d(5000), d(0))).toThrow(RangeError);
  });

  it('INVARIANT: ROI = (benefits - costs) / costs', () => {
    const benefits = d(25000);
    const costs = d(10000);
    const roi = calculateROI(benefits, costs);
    const expected = benefits.minus(costs).div(costs);
    expect(roi.eq(expected)).toBe(true);
  });
});

// ─── Utility Tests ───────────────────────────────────────────────────────────

describe('toDecimalArray', () => {
  it('converts number array to Decimal array', () => {
    const result = toDecimalArray([1, 2.5, -3]);
    expect(result).toHaveLength(3);
    expect(result[0].toNumber()).toBe(1);
    expect(result[1].toNumber()).toBe(2.5);
    expect(result[2].toNumber()).toBe(-3);
  });
});

describe('roundTo', () => {
  it('rounds to specified decimal places', () => {
    expect(roundTo(d(3.14159), 2).toNumber()).toBe(3.14);
    expect(roundTo(d(3.145), 2).toNumber()).toBe(3.15);
    expect(roundTo(d(3.1), 4).toNumber()).toBe(3.1);
  });
});

// ─── Cross-Function Invariant Tests ──────────────────────────────────────────

describe('Cross-function invariants', () => {
  it('INVARIANT: positive NPV implies ROI > 0 for same cash flows', () => {
    const flows = dArr([-1000, 500, 500, 500]);
    const npv = calculateNPV(flows, d(0.1));
    const totalBenefits = flows.slice(1).reduce((s, f) => s.plus(f), d(0));
    const totalCosts = flows[0].abs();
    const roi = calculateROI(totalBenefits, totalCosts);

    if (npv.gt(0)) {
      expect(roi.gt(0)).toBe(true);
    }
  });

  it('INVARIANT: IRR > discount rate iff NPV > 0', () => {
    const flows = dArr([-5000, 1500, 2000, 2500, 1000]);
    const discountRate = d(0.08);
    const npv = calculateNPV(flows, discountRate);
    const irr = calculateIRR(flows);

    if (irr.converged) {
      if (npv.gt(0)) {
        expect(irr.rate.gt(discountRate)).toBe(true);
      } else if (npv.lt(0)) {
        expect(irr.rate.lt(discountRate)).toBe(true);
      }
    }
  });

  it('INVARIANT: payback exists when total undiscounted flows are positive', () => {
    const flows = dArr([-1000, 400, 400, 400]);
    const totalFlow = flows.reduce((s, f) => s.plus(f), d(0));
    const payback = calculatePayback(flows);

    if (totalFlow.gte(0)) {
      expect(payback.period).not.toBeNull();
    }
  });

  it('INVARIANT: sensitivity at base value matches direct calculation', () => {
    const flows = dArr([-1000, 500, 500, 500]);
    const baseRate = d(0.1);
    const directNPV = calculateNPV(flows, baseRate);

    const sens = sensitivityAnalysis(
      'rate',
      baseRate,
      [d(1)], // multiplier = 1.0 → same as base
      (rate) => calculateNPV(flows, rate)
    );

    expect(sens.points[0].outputValue.eq(directNPV)).toBe(true);
  });
});

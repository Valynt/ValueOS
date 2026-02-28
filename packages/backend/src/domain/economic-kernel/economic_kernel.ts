/**
 * Canonical Economic Kernel
 *
 * Pure financial math — no sector assumptions, no narrative strings, no side effects.
 * All functions are deterministic: same inputs always produce same outputs.
 *
 * Uses Decimal.js for precision in financial calculations.
 *
 * INVARIANTS (must hold for any overlay):
 * - DCF: sum of discounted cash flows equals NPV
 * - IRR: NPV at IRR discount rate equals zero (within tolerance)
 * - Payback: cumulative cash flow crosses zero at payback period
 * - Sensitivity: output varies monotonically with single-variable perturbation
 */

import Decimal from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CashFlowSeries {
  /** Period 0 = initial investment (typically negative), periods 1..n = future flows */
  flows: Decimal[];
}

export interface DCFResult {
  presentValues: Decimal[];
  npv: Decimal;
}

export interface IRRResult {
  rate: Decimal;
  converged: boolean;
  iterations: number;
}

export interface PaybackResult {
  /** Period at which cumulative cash flow first becomes non-negative. null if never. */
  period: number | null;
  /** Fractional period using linear interpolation between crossing periods */
  fractionalPeriod: Decimal | null;
  cumulativeFlows: Decimal[];
}

export interface SensitivityPoint {
  parameterValue: Decimal;
  outputValue: Decimal;
}

export interface SensitivityResult {
  parameterName: string;
  baseValue: Decimal;
  baseOutput: Decimal;
  points: SensitivityPoint[];
}

export interface EVFComponents {
  revenue: Decimal;
  cost: Decimal;
  risk: Decimal;
}

export interface EVFResult {
  netValue: Decimal;
  riskAdjustedValue: Decimal;
  components: EVFComponents;
}

// ─── DCF ─────────────────────────────────────────────────────────────────────

/**
 * Discount a series of cash flows at a given rate.
 *
 * PV_i = CF_i / (1 + r)^i
 *
 * @param flows - Cash flow series (period 0 is not discounted)
 * @param discountRate - Annual discount rate as a decimal (e.g., 0.10 for 10%)
 */
export function discountCashFlows(flows: Decimal[], discountRate: Decimal): DCFResult {
  if (flows.length === 0) {
    return { presentValues: [], npv: new Decimal(0) };
  }

  const one = new Decimal(1);
  const rate = one.plus(discountRate);

  const presentValues = flows.map((cf, i) => {
    if (i === 0) return cf;
    return cf.div(rate.pow(i));
  });

  const npv = presentValues.reduce((sum, pv) => sum.plus(pv), new Decimal(0));

  return { presentValues, npv };
}

/**
 * Calculate Net Present Value for a cash flow series.
 */
export function calculateNPV(flows: Decimal[], discountRate: Decimal): Decimal {
  return discountCashFlows(flows, discountRate).npv;
}

// ─── IRR ─────────────────────────────────────────────────────────────────────

/**
 * Calculate Internal Rate of Return using Newton-Raphson method.
 *
 * Finds rate r such that NPV(flows, r) ≈ 0.
 *
 * @param flows - Cash flow series (must have at least one sign change)
 * @param tolerance - Convergence tolerance (default 1e-10)
 * @param maxIterations - Maximum iterations (default 1000)
 * @param initialGuess - Starting rate estimate (default 0.10)
 */
export function calculateIRR(
  flows: Decimal[],
  tolerance: Decimal = new Decimal('1e-10'),
  maxIterations: number = 1000,
  initialGuess: Decimal = new Decimal('0.10')
): IRRResult {
  if (flows.length < 2) {
    return { rate: new Decimal(0), converged: false, iterations: 0 };
  }

  let rate = initialGuess;
  const one = new Decimal(1);

  for (let i = 0; i < maxIterations; i++) {
    let npv = new Decimal(0);
    let dnpv = new Decimal(0); // derivative of NPV w.r.t. rate

    for (let t = 0; t < flows.length; t++) {
      const discountFactor = one.plus(rate).pow(t);
      npv = npv.plus(flows[t].div(discountFactor));

      if (t > 0) {
        // d/dr [CF_t / (1+r)^t] = -t * CF_t / (1+r)^(t+1)
        dnpv = dnpv.minus(
          new Decimal(t).times(flows[t]).div(one.plus(rate).pow(t + 1))
        );
      }
    }

    if (dnpv.isZero()) {
      return { rate, converged: false, iterations: i + 1 };
    }

    const delta = npv.div(dnpv);
    rate = rate.minus(delta);

    if (delta.abs().lte(tolerance)) {
      return { rate, converged: true, iterations: i + 1 };
    }
  }

  return { rate, converged: false, iterations: maxIterations };
}

// ─── Payback Period ──────────────────────────────────────────────────────────

/**
 * Calculate payback period — the point at which cumulative cash flow becomes non-negative.
 *
 * Returns both the integer period and a fractional period using linear interpolation.
 *
 * @param flows - Cash flow series (period 0 = initial outlay)
 */
export function calculatePayback(flows: Decimal[]): PaybackResult {
  if (flows.length === 0) {
    return { period: null, fractionalPeriod: null, cumulativeFlows: [] };
  }

  const cumulativeFlows: Decimal[] = [];
  let cumulative = new Decimal(0);

  for (const cf of flows) {
    cumulative = cumulative.plus(cf);
    cumulativeFlows.push(cumulative);
  }

  // Find first period where cumulative >= 0
  for (let i = 0; i < cumulativeFlows.length; i++) {
    if (cumulativeFlows[i].gte(0)) {
      if (i === 0) {
        return { period: 0, fractionalPeriod: new Decimal(0), cumulativeFlows };
      }

      // Linear interpolation between period i-1 (negative) and period i (non-negative)
      const prevCumulative = cumulativeFlows[i - 1];
      const periodFlow = flows[i];

      let fractional: Decimal;
      if (periodFlow.isZero()) {
        fractional = new Decimal(i);
      } else {
        // fraction = |prevCumulative| / periodFlow
        fractional = new Decimal(i - 1).plus(prevCumulative.abs().div(periodFlow));
      }

      return { period: i, fractionalPeriod: fractional, cumulativeFlows };
    }
  }

  return { period: null, fractionalPeriod: null, cumulativeFlows };
}

/**
 * Calculate discounted payback period — payback using present values.
 */
export function calculateDiscountedPayback(
  flows: Decimal[],
  discountRate: Decimal
): PaybackResult {
  const { presentValues } = discountCashFlows(flows, discountRate);
  return calculatePayback(presentValues);
}

// ─── Sensitivity Analysis ────────────────────────────────────────────────────

/**
 * Run one-at-a-time sensitivity analysis on a calculation function.
 *
 * Varies a single parameter across a range while holding others constant,
 * then evaluates the output function at each point.
 *
 * @param parameterName - Name of the parameter being varied
 * @param baseValue - Base case value of the parameter
 * @param perturbations - Array of multipliers (e.g., [0.8, 0.9, 1.0, 1.1, 1.2])
 * @param evaluate - Function that takes the parameter value and returns the output
 */
export function sensitivityAnalysis(
  parameterName: string,
  baseValue: Decimal,
  perturbations: Decimal[],
  evaluate: (paramValue: Decimal) => Decimal
): SensitivityResult {
  const baseOutput = evaluate(baseValue);

  const points: SensitivityPoint[] = perturbations.map((multiplier) => {
    const parameterValue = baseValue.times(multiplier);
    const outputValue = evaluate(parameterValue);
    return { parameterValue, outputValue };
  });

  return {
    parameterName,
    baseValue,
    baseOutput,
    points,
  };
}

/**
 * Multi-parameter sensitivity: runs sensitivity for each parameter independently.
 */
export function multiSensitivityAnalysis(
  parameters: Array<{
    name: string;
    baseValue: Decimal;
    perturbations: Decimal[];
    evaluate: (paramValue: Decimal) => Decimal;
  }>
): SensitivityResult[] {
  return parameters.map((param) =>
    sensitivityAnalysis(param.name, param.baseValue, param.perturbations, param.evaluate)
  );
}

// ─── EVF (Economic Value Framework) ──────────────────────────────────────────

/**
 * Calculate net economic value from revenue, cost, and risk components.
 *
 * netValue = revenue - cost
 * riskAdjustedValue = netValue * (1 - risk)
 *
 * @param revenue - Total revenue/benefit value
 * @param cost - Total cost value
 * @param riskFactor - Risk factor as decimal (0 = no risk, 1 = total loss)
 */
export function calculateEVF(
  revenue: Decimal,
  cost: Decimal,
  riskFactor: Decimal
): EVFResult {
  if (riskFactor.lt(0) || riskFactor.gt(1)) {
    throw new RangeError('Risk factor must be between 0 and 1');
  }

  const netValue = revenue.minus(cost);
  const riskAdjustedValue = netValue.times(new Decimal(1).minus(riskFactor));

  return {
    netValue,
    riskAdjustedValue,
    components: { revenue, cost, risk: riskFactor },
  };
}

// ─── ROI ─────────────────────────────────────────────────────────────────────

/**
 * Calculate Return on Investment.
 *
 * ROI = (totalBenefits - totalCosts) / totalCosts
 *
 * Returns as a decimal (e.g., 1.5 = 150% ROI).
 */
export function calculateROI(totalBenefits: Decimal, totalCosts: Decimal): Decimal {
  if (totalCosts.isZero()) {
    throw new RangeError('Total costs cannot be zero');
  }
  return totalBenefits.minus(totalCosts).div(totalCosts);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Convert an array of numbers to Decimal array.
 */
export function toDecimalArray(values: number[]): Decimal[] {
  return values.map((v) => new Decimal(v));
}

/**
 * Round a Decimal to a specified number of decimal places.
 */
export function roundTo(value: Decimal, places: number): Decimal {
  return value.toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
}

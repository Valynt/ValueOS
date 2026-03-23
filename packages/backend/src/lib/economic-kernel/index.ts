import BaseDecimal from 'decimal.js';

// Isolated Decimal constructor — avoids mutating the global Decimal configuration
// which would affect all other consumers of decimal.js in the process.
const Decimal = BaseDecimal.clone({ precision: 28, rounding: BaseDecimal.ROUND_HALF_UP });
type Decimal = BaseDecimal;
export type { Decimal };
export { Decimal as FinancialDecimal };

export interface CashFlowProjection {
  period: number;
  inflow: Decimal;
  outflow: Decimal;
  net: Decimal;
}

export interface FinancialResults {
  npv: Decimal;
  irr: Decimal | null;
  roi: Decimal;
  paybackMonths: number;
  totalInvestment: Decimal;
  totalReturn: Decimal;
}

export interface ScenarioResult {
  name: 'conservative' | 'base' | 'upside';
  npv: Decimal;
  irr: Decimal | null;
  roi: Decimal;
  paybackMonths: number;
  assumptions: Record<string, Decimal>;
}

export interface SensitivityRange {
  low: Decimal;
  base: Decimal;
  high: Decimal;
}

export interface ScenarioAssumptions {
  initialInvestment: Decimal;
  annualSavings: Decimal;
  timeframeYears: Decimal;
}

export class EconomicKernel {
  readonly version = '1.0.0';

  calculateNPV(cashFlows: Decimal[], discountRate: Decimal): Decimal {
    if (cashFlows.length === 0) return new Decimal(0);
    let npv = new Decimal(0);
    const one = new Decimal(1);
    for (let t = 0; t < cashFlows.length; t++) {
      const denominator = one.plus(discountRate).pow(t);
      npv = npv.plus(cashFlows[t].dividedBy(denominator));
    }
    return npv;
  }

  calculateIRR(cashFlows: Decimal[], maxIterations = 100, precision = 1e-10): Decimal | null {
    if (cashFlows.length < 2) return null;
    const hasNegative = cashFlows.some(cf => cf.isNegative());
    const hasPositive = cashFlows.some(cf => cf.isPositive());
    if (!hasNegative || !hasPositive) return null;

    let rate = new Decimal(0.1);
    const one = new Decimal(1);
    const targetPrecision = new Decimal(precision);

    for (let i = 0; i < maxIterations; i++) {
      const npv = this.calculateNPV(cashFlows, rate);
      if (npv.abs().lessThan(targetPrecision)) return rate;

      const delta = new Decimal(0.0001);
      const npvDelta = this.calculateNPV(cashFlows, rate.plus(delta));
      const derivative = npvDelta.minus(npv).dividedBy(delta);

      if (derivative.abs().lessThan(targetPrecision)) {
        rate = rate.plus(0.05);
        continue;
      }

      const newRate = rate.minus(npv.dividedBy(derivative));
      if (newRate.lessThan(-1) || newRate.greaterThan(10)) return null;
      rate = newRate;
    }
    return null;
  }

  calculateROI(investment: Decimal, returns: Decimal): Decimal {
    if (investment.isZero()) return new Decimal(0);
    return returns.minus(investment).dividedBy(investment).times(100);
  }

  calculatePayback(cashFlows: Decimal[]): number {
    if (cashFlows.length === 0) return -1;
    let cumulative = new Decimal(0);
    let wentNegative = false;
    for (let i = 0; i < cashFlows.length; i++) {
      const prev = cumulative;
      cumulative = cumulative.plus(cashFlows[i]);
      if (prev.isNegative()) wentNegative = true;
      if (wentNegative && cumulative.isPositive()) {
        if (prev.isNegative() && !cashFlows[i].isZero()) {
          const fraction = prev.abs().dividedBy(cashFlows[i]);
          return (i - 1) + fraction.toNumber();
        }
        return i - 1;
      }
    }
    return -1;
  }

  calculateAllMetrics(projections: CashFlowProjection[], discountRate: Decimal): FinancialResults {
    const cashFlows = projections.map(p => p.net);
    const totalInvestment = projections.filter(p => p.net.isNegative()).reduce((sum, p) => sum.plus(p.net.abs()), new Decimal(0));
    const totalReturn = projections.filter(p => p.net.isPositive()).reduce((sum, p) => sum.plus(p.net), new Decimal(0));

    return {
      npv: this.calculateNPV(cashFlows, discountRate),
      irr: this.calculateIRR(cashFlows),
      roi: this.calculateROI(totalInvestment, totalReturn),
      paybackMonths: this.calculatePayback(cashFlows),
      totalInvestment,
      totalReturn
    };
  }

  generateScenarios(baseAssumptions: ScenarioAssumptions, sensitivityRanges: Map<string, SensitivityRange>, discountRate: Decimal): ScenarioResult[] {
    const scenarios: ScenarioResult[] = [];
    const asRecord = baseAssumptions as unknown as Record<string, Decimal>;
    const conservative: Record<string, Decimal> = {};
    const upside: Record<string, Decimal> = {};

    for (const [key, value] of Object.entries(asRecord)) {
      const range = sensitivityRanges.get(key);
      if (range) {
        conservative[key] = range.low;
        upside[key] = range.high;
      } else {
        conservative[key] = value;
        upside[key] = value;
      }
    }

    scenarios.push({ name: 'conservative', ...this.calculateSimpleMetrics(conservative as unknown as ScenarioAssumptions, discountRate), assumptions: conservative });
    scenarios.push({ name: 'base', ...this.calculateSimpleMetrics(baseAssumptions, discountRate), assumptions: { ...asRecord } });
    scenarios.push({ name: 'upside', ...this.calculateSimpleMetrics(upside as unknown as ScenarioAssumptions, discountRate), assumptions: upside });

    return scenarios;
  }

  private calculateSimpleMetrics(assumptions: ScenarioAssumptions, discountRate: Decimal): Omit<ScenarioResult, 'name' | 'assumptions'> {
    const investment = assumptions.initialInvestment ?? new Decimal(0);
    const annualSavings = assumptions.annualSavings ?? new Decimal(0);
    const timeframe = assumptions.timeframeYears ?? new Decimal(3);

    // Use Math.ceil so fractional years produce a full period rather than silently dropping it
    const periods = Math.ceil(timeframe.toNumber());
    const cashFlows: Decimal[] = [investment.negated()];
    for (let i = 0; i < periods; i++) cashFlows.push(annualSavings);

    const totalReturn = annualSavings.times(timeframe);
    return {
      npv: this.calculateNPV(cashFlows, discountRate),
      irr: this.calculateIRR(cashFlows),
      roi: this.calculateROI(investment, totalReturn),
      paybackMonths: this.calculatePayback(cashFlows)
    };
  }
}

export const economicKernel = new EconomicKernel();

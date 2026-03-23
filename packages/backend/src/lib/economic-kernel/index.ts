import Decimal from 'decimal.js';

// Configure Decimal for financial precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

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
    let cumulative = new Decimal(0);
    for (let i = 0; i < cashFlows.length; i++) {
      cumulative = cumulative.plus(cashFlows[i]);
      if (cumulative.isPositive()) {
        const prevCumulative = cumulative.minus(cashFlows[i]);
        if (prevCumulative.isNegative() && !cashFlows[i].isZero()) {
          const fraction = prevCumulative.abs().dividedBy(cashFlows[i]);
          return i + fraction.toNumber();
        }
        return i;
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

  generateScenarios(baseAssumptions: Record<string, Decimal>, sensitivityRanges: Map<string, SensitivityRange>, discountRate: Decimal): ScenarioResult[] {
    const scenarios: ScenarioResult[] = [];
    const conservative: Record<string, Decimal> = {};
    const upside: Record<string, Decimal> = {};

    for (const [key, value] of Object.entries(baseAssumptions)) {
      const range = sensitivityRanges.get(key);
      if (range) {
        conservative[key] = range.low;
        upside[key] = range.high;
      } else {
        conservative[key] = value;
        upside[key] = value;
      }
    }

    scenarios.push({ name: 'conservative', ...this.calculateSimpleMetrics(conservative, discountRate), assumptions: conservative });
    scenarios.push({ name: 'base', ...this.calculateSimpleMetrics(baseAssumptions, discountRate), assumptions: { ...baseAssumptions } });
    scenarios.push({ name: 'upside', ...this.calculateSimpleMetrics(upside, discountRate), assumptions: upside });

    return scenarios;
  }

  private calculateSimpleMetrics(assumptions: Record<string, Decimal>, discountRate: Decimal): Omit<ScenarioResult, 'name' | 'assumptions'> {
    const investment = assumptions['initialInvestment'] || new Decimal(0);
    const annualSavings = assumptions['annualSavings'] || new Decimal(0);
    const timeframe = assumptions['timeframeYears'] || new Decimal(3);

    const cashFlows: Decimal[] = [investment.negated()];
    for (let i = 0; i < timeframe.toNumber(); i++) cashFlows.push(annualSavings);

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

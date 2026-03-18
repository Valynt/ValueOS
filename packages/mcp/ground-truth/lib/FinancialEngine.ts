/**
 * Financial Engine
 *
 * Standard financial calculations for business case analysis:
 * - NPV (Net Present Value)
 * - IRR (Internal Rate of Return)
 * - ROI calculations
 * - Payback period
 */

/** Cash flow entry */
export interface CashFlow {
  period: number;
  inflow: number;
  outflow: number;
  net: number;
}

/** Financial analysis inputs */
export interface FinancialAnalysisInput {
  initialInvestment: number;
  cashFlows: number[];
  discountRate: number;
  terminalValue?: number;
}

/** Complete financial analysis result */
export interface FinancialAnalysis {
  npv: number;
  irr: number | null;
  roi: number;
  paybackPeriod: number | null;
  benefitCostRatio: number;
  totalInflows: number;
  totalOutflows: number;
  discountedCashFlows: number[];
  cumulativeCashFlows: number[];
}

/**
 * Calculate Net Present Value (NPV)
 *
 * NPV = Σ(CashFlow_t / (1 + r)^t) - InitialInvestment
 */
export function calculateNPV(
  initialInvestment: number,
  cashFlows: number[],
  discountRate: number
): number {
  let npv = -initialInvestment;

  for (let t = 0; t < cashFlows.length; t++) {
    npv += cashFlows[t] / Math.pow(1 + discountRate, t + 1);
  }

  return Math.round(npv * 100) / 100;
}

/**
 * Calculate Internal Rate of Return (IRR)
 *
 * IRR is the discount rate where NPV = 0
 * Uses Newton-Raphson method for approximation
 */
export function calculateIRR(
  initialInvestment: number,
  cashFlows: number[]
): number | null {
  const maxIterations = 100;
  const precision = 0.0001;

  // Initial guess
  let rate = 0.1;

  for (let i = 0; i < maxIterations; i++) {
    const npv = calculateNPV(initialInvestment, cashFlows, rate);

    if (Math.abs(npv) < precision) {
      return Math.round(rate * 10000) / 10000;
    }

    // Calculate derivative (dNPV/dr)
    let derivative = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      derivative -=
        ((t + 1) * cashFlows[t]) / Math.pow(1 + rate, t + 2);
    }

    if (Math.abs(derivative) < precision) {
      break;
    }

    // Newton-Raphson step
    const newRate = rate - npv / derivative;

    // Check for convergence issues
    if (newRate < -1 || newRate > 10) {
      return null; // IRR doesn't exist or is not meaningful
    }

    rate = newRate;
  }

  return Math.round(rate * 10000) / 10000;
}

/**
 * Calculate simple ROI (Return on Investment)
 *
 * ROI = (Total Return - Total Investment) / Total Investment
 */
export function calculateROI(
  initialInvestment: number,
  totalReturns: number
): number {
  if (initialInvestment === 0) return 0;
  return Math.round(((totalReturns - initialInvestment) / initialInvestment) * 10000) / 10000;
}

/**
 * Calculate payback period
 *
 * Time to recover initial investment from cash flows
 */
export function calculatePaybackPeriod(
  initialInvestment: number,
  cashFlows: number[]
): number | null {
  let cumulative = -initialInvestment;

  for (let t = 0; t < cashFlows.length; t++) {
    cumulative += cashFlows[t];

    if (cumulative >= 0) {
      // Interpolate within the period
      const previousCumulative = cumulative - cashFlows[t];
      const fraction = Math.abs(previousCumulative) / cashFlows[t];
      return Math.round((t + fraction) * 100) / 100;
    }
  }

  // Investment not recovered within period
  return null;
}

/**
 * Calculate discounted payback period
 *
 * Time to recover initial investment from discounted cash flows
 */
export function calculateDiscountedPaybackPeriod(
  initialInvestment: number,
  cashFlows: number[],
  discountRate: number
): number | null {
  let cumulative = -initialInvestment;

  for (let t = 0; t < cashFlows.length; t++) {
    const discountedCF = cashFlows[t] / Math.pow(1 + discountRate, t + 1);
    cumulative += discountedCF;

    if (cumulative >= 0) {
      const previousCumulative = cumulative - discountedCF;
      const fraction = Math.abs(previousCumulative) / discountedCF;
      return Math.round((t + fraction) * 100) / 100;
    }
  }

  return null;
}

/**
 * Calculate benefit-cost ratio
 *
 * BCR = Present Value of Benefits / Present Value of Costs
 */
export function calculateBenefitCostRatio(
  initialInvestment: number,
  benefits: number[],
  discountRate: number
): number {
  let presentValueBenefits = 0;

  for (let t = 0; t < benefits.length; t++) {
    presentValueBenefits += benefits[t] / Math.pow(1 + discountRate, t + 1);
  }

  if (initialInvestment === 0) return presentValueBenefits > 0 ? Infinity : 0;

  return Math.round((presentValueBenefits / initialInvestment) * 100) / 100;
}

/**
 * Complete financial analysis
 */
export function analyzeFinancials(
  input: FinancialAnalysisInput
): FinancialAnalysis {
  const { initialInvestment, cashFlows, discountRate, terminalValue } = input;

  // Add terminal value to final cash flow if provided
  const adjustedCashFlows = [...cashFlows];
  if (terminalValue && terminalValue !== 0) {
    adjustedCashFlows[adjustedCashFlows.length - 1] += terminalValue;
  }

  // Calculate discounted cash flows
  const discountedCashFlows = adjustedCashFlows.map(
    (cf, t) => Math.round((cf / Math.pow(1 + discountRate, t + 1)) * 100) / 100
  );

  // Calculate cumulative cash flows
  const cumulativeCashFlows: number[] = [];
  let cumulative = -initialInvestment;
  for (const cf of discountedCashFlows) {
    cumulative += cf;
    cumulativeCashFlows.push(Math.round(cumulative * 100) / 100);
  }

  const totalInflows = adjustedCashFlows.filter((cf) => cf > 0).reduce((a, b) => a + b, 0);
  const totalOutflows =
    initialInvestment + adjustedCashFlows.filter((cf) => cf < 0).reduce((a, b) => a + Math.abs(b), 0);

  const npv = calculateNPV(initialInvestment, adjustedCashFlows, discountRate);
  const irr = calculateIRR(initialInvestment, adjustedCashFlows);
  const roi = calculateROI(initialInvestment, totalInflows);
  const paybackPeriod = calculatePaybackPeriod(initialInvestment, adjustedCashFlows);
  const benefitCostRatio = calculateBenefitCostRatio(
    initialInvestment,
    adjustedCashFlows.filter((cf) => cf > 0),
    discountRate
  );

  return {
    npv,
    irr,
    roi,
    paybackPeriod,
    benefitCostRatio,
    totalInflows: Math.round(totalInflows * 100) / 100,
    totalOutflows: Math.round(totalOutflows * 100) / 100,
    discountedCashFlows,
    cumulativeCashFlows,
  };
}

/**
 * Generate cash flows from simulation results
 *
 * Converts KPI impacts into projected revenue and cost changes
 */
export interface CashFlowProjection {
  period: number; // months
  revenueChange: number;
  costChange: number;
  netCashFlow: number;
}

export function projectCashFlows(
  annualRevenue: number,
  arrImpact: number,
  costImpact: number,
  periods: number = 12
): CashFlowProjection[] {
  const monthlyRevenue = annualRevenue / 12;
  const projections: CashFlowProjection[] = [];

  for (let i = 0; i < periods; i++) {
    // Ramp up effect - full impact by month 6
    const rampFactor = Math.min(i / 6, 1);

    const revenueChange = monthlyRevenue * arrImpact * rampFactor;
    const costChange = costImpact / periods * rampFactor;
    const netCashFlow = revenueChange - costChange;

    projections.push({
      period: i + 1,
      revenueChange: Math.round(revenueChange * 100) / 100,
      costChange: Math.round(costChange * 100) / 100,
      netCashFlow: Math.round(netCashFlow * 100) / 100,
    });
  }

  return projections;
}

/**
 * Calculate magic number (SaaS metric)
 *
 * Magic Number = Net New ARR / Prior Quarter S&M Spend
 */
export function calculateMagicNumber(
  netNewARR: number,
  priorQuarterSalesMarketingSpend: number
): number {
  if (priorQuarterSalesMarketingSpend === 0) return 0;
  return Math.round((netNewARR / priorQuarterSalesMarketingSpend) * 100) / 100;
}

/**
 * Calculate LTV:CAC ratio
 */
export function calculateLTVCAC(
  customerLTV: number,
  customerAcquisitionCost: number
): number {
  if (customerAcquisitionCost === 0) return 0;
  return Math.round((customerLTV / customerAcquisitionCost) * 100) / 100;
}

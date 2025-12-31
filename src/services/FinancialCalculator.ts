export interface FinancialInputs {
  softwareCost: number;
  implementationCost: number;
  userCount: number;
  efficiencyGainPercent: number;
  avgSalary: number;
  discountRate: number;
  timeHorizonYears: number;
}

export interface FinancialOutputs {
  roi: number;
  npv: number;
  paybackMonths: number;
  totalBenefits: number;
  totalCosts: number;
  yearlyBreakdown: Array<{
    year: number;
    costs: number;
    benefits: number;
    cumulativeNpv: number;
  }>;
}

export class FinancialCalculator {
  static calculate(inputs: FinancialInputs): FinancialOutputs {
    const {
      softwareCost,
      implementationCost,
      userCount,
      efficiencyGainPercent,
      avgSalary,
      discountRate,
      timeHorizonYears
    } = inputs;

    const yearlyBreakdown = [];
    let cumulativeNpv = 0;
    let paybackMonths = 0;
    let paybackFound = false;

    // Calculate yearly breakdown
    for (let year = 1; year <= timeHorizonYears; year++) {
      // Costs: software cost annually, implementation in year 1 only
      const costs = softwareCost + (year === 1 ? implementationCost : 0);
      
      // Benefits: efficiency gains translated to salary savings
      const annualEfficiencyHours = userCount * 2000 * (efficiencyGainPercent / 100); // 2000 work hours/year
      const benefits = annualEfficiencyHours * (avgSalary / 2000); // Hourly rate approximation
      
      // Present value calculations
      const pvCosts = costs / Math.pow(1 + discountRate, year);
      const pvBenefits = benefits / Math.pow(1 + discountRate, year);
      const yearlyNpv = pvBenefits - pvCosts;
      
      cumulativeNpv += yearlyNpv;

      // Find payback period
      if (!paybackFound && cumulativeNpv > 0) {
        paybackMonths = (year - 1) * 12 + Math.ceil(12 * (pvCosts / pvBenefits));
        paybackFound = true;
      }

      yearlyBreakdown.push({
        year,
        costs,
        benefits,
        cumulativeNpv
      });
    }

    const totalCosts = softwareCost * timeHorizonYears + implementationCost;
    const totalBenefits = yearlyBreakdown.reduce((sum, year) => sum + year.benefits, 0);
    const roi = ((totalBenefits - totalCosts) / totalCosts) * 100;
    const npv = cumulativeNpv;

    return {
      roi: Math.round(roi),
      npv: Math.round(npv),
      paybackMonths: paybackFound ? paybackMonths : timeHorizonYears * 12,
      totalBenefits: Math.round(totalBenefits),
      totalCosts: Math.round(totalCosts),
      yearlyBreakdown
    };
  }

  static generateScenarios(baseInputs: FinancialInputs) {
    const conservative = this.calculate({
      ...baseInputs,
      efficiencyGainPercent: baseInputs.efficiencyGainPercent * 0.7,
      userCount: Math.floor(baseInputs.userCount * 0.8)
    });

    const likely = this.calculate(baseInputs);

    const optimistic = this.calculate({
      ...baseInputs,
      efficiencyGainPercent: baseInputs.efficiencyGainPercent * 1.3,
      userCount: Math.floor(baseInputs.userCount * 1.2)
    });

    return { conservative, likely, optimistic };
  }
}
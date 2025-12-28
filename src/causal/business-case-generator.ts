/**
 * Business Case Generator
 * 
 * Generates comprehensive business cases by combining:
 * - Layer 1: Metric Truth (baseline metrics)
 * - Layer 2: Structural Truth (formula dependencies)
 * - Layer 3: Causal Truth (action impacts & time curves)
 * 
 * Provides audit trail for all reasoning steps.
 */

import { 
  StructuralTruth, 
  FormulaRegistry, 
  FormulaEvaluationResult,
  FormulaInput,
  FormulaOutput
} from '../structural/structural-data';
import { 
  CausalTruth, 
  ActionImpact, 
  ImpactDistribution,
  TimeCurve,
  BusinessAction,
  Persona,
  Industry,
  CompanySize
} from './causal-truth';

export interface BusinessCaseRequest {
  persona: Persona;
  industry: Industry;
  companySize: CompanySize;
  annualRevenue: number;
  currentKPIs: Record<string, number>;
  selectedActions: BusinessAction[];
  timeframe: '30d' | '90d' | '180d' | '365d';
  confidenceThreshold?: number; // 0.0 to 1.0
}

export interface BusinessCaseResult {
  summary: BusinessCaseSummary;
  financialImpact: FinancialImpact;
  kpiImpacts: KPIImpact[];
  timeline: TimelineEvent[];
  riskAnalysis: RiskAnalysis;
  auditTrail: AuditStep[];
  recommendations: Recommendation[];
}

export interface BusinessCaseSummary {
  title: string;
  description: string;
  totalInvestment: number;
  totalReturn: number;
  roi: number;
  paybackPeriod: number; // days
  confidence: number; // 0.0 to 1.0
  riskLevel: 'low' | 'medium' | 'high';
}

export interface FinancialImpact {
  incrementalRevenue: number;
  costSavings: number;
  totalBenefits: number;
  totalCosts: number;
  netPresentValue: number;
  internalRateOfReturn: number;
}

export interface KPIImpact {
  kpiId: string;
  kpiName: string;
  baselineValue: number;
  projectedValue: number;
  absoluteChange: number;
  relativeChange: number; // percentage
  confidence: number;
  contributingActions: string[];
  formulaDependencies: string[];
}

export interface TimelineEvent {
  day: number;
  action: string;
  kpiImpacts: string[];
  cumulativeImpact: number;
  probability: number;
}

export interface RiskAnalysis {
  downsideScenario: Scenario;
  baseCase: Scenario;
  upsideScenario: Scenario;
  sensitivity: SensitivityFactor[];
  keyRisks: Risk[];
}

export interface Scenario {
  probability: number;
  npv: number;
  roi: number;
  description: string;
}

export interface SensitivityFactor {
  variable: string;
  impact: 'high' | 'medium' | 'low';
  range: [number, number];
}

export interface Risk {
  description: string;
  probability: number;
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
}

export interface AuditStep {
  timestamp: string;
  step: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  confidence: number;
  reasoning: string;
  sources: string[];
}

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  quickWin: boolean;
}

export class BusinessCaseGenerator {
  private structuralTruth: StructuralTruth;
  private causalTruth: CausalTruth;
  private formulaRegistry: FormulaRegistry;

  constructor(
    structuralTruth: StructuralTruth,
    causalTruth: CausalTruth
  ) {
    this.structuralTruth = structuralTruth;
    this.causalTruth = causalTruth;
    this.formulaRegistry = structuralTruth.getFormulaRegistry();
  }

  /**
   * Generate comprehensive business case
   */
  async generateBusinessCase(
    request: BusinessCaseRequest
  ): Promise<BusinessCaseResult> {
    const auditTrail: AuditStep[] = [];
    
    // Step 1: Validate baseline KPIs
    const baselineValidation = await this.validateBaselineKPIs(
      request.currentKPIs,
      request.persona,
      auditTrail
    );

    // Step 2: Calculate direct impacts for each action
    const directImpacts = await this.calculateDirectImpacts(
      request.selectedActions,
      request.currentKPIs,
      request.persona,
      request.industry,
      request.companySize,
      auditTrail
    );

    // Step 3: Calculate cascading impacts via formulas
    const cascadingImpacts = await this.calculateCascadingImpacts(
      directImpacts,
      request.currentKPIs,
      auditTrail
    );

    // Step 4: Apply time-to-realize curves
    const timeline = await this.buildTimeline(
      cascadingImpacts,
      request.timeframe,
      auditTrail
    );

    // Step 5: Calculate financial metrics
    const financialImpact = await this.calculateFinancialImpact(
      timeline,
      request.annualRevenue,
      auditTrail
    );

    // Step 6: Perform risk analysis
    const riskAnalysis = await this.analyzeRisks(
      timeline,
      financialImpact,
      request.confidenceThreshold || 0.7,
      auditTrail
    );

    // Step 7: Generate recommendations
    const recommendations = await this.generateRecommendations(
      request.selectedActions,
      riskAnalysis,
      auditTrail
    );

    // Step 8: Create summary
    const summary = await this.createSummary(
      request,
      financialImpact,
      riskAnalysis,
      recommendations,
      auditTrail
    );

    return {
      summary,
      financialImpact,
      kpiImpacts: cascadingImpacts,
      timeline,
      riskAnalysis,
      auditTrail,
      recommendations
    };
  }

  /**
   * Validate that baseline KPIs are within expected ranges
   */
  private async validateBaselineKPIs(
    kpis: Record<string, number>,
    persona: Persona,
    auditTrail: AuditStep[]
  ): Promise<boolean> {
    const step: AuditStep = {
      timestamp: new Date().toISOString(),
      step: 'Validate Baseline KPIs',
      inputs: { kpis, persona },
      outputs: {},
      confidence: 1.0,
      reasoning: 'Validating baseline KPIs against persona benchmarks',
      sources: ['structural-data.ts']
    };

    let allValid = true;
    for (const [kpiId, value] of Object.entries(kpis)) {
      const benchmark = this.structuralTruth.getKPIBenchmark(kpiId, persona);
      if (benchmark) {
        const isValid = value >= benchmark.p25 && value <= benchmark.p75;
        if (!isValid) {
          allValid = false;
          step.reasoning += `\n⚠️ ${kpiId}: ${value} outside typical range ${benchmark.p25}-${benchmark.p75}`;
        }
      }
    }

    step.outputs = { valid: allValid };
    auditTrail.push(step);
    return allValid;
  }

  /**
   * Calculate direct impacts from selected actions
   */
  private async calculateDirectImpacts(
    actions: BusinessAction[],
    baselineKPIs: Record<string, number>,
    persona: Persona,
    industry: Industry,
    companySize: CompanySize,
    auditTrail: AuditStep[]
  ): Promise<KPIImpact[]> {
    const impacts: KPIImpact[] = [];
    
    for (const action of actions) {
      const step: AuditStep = {
        timestamp: new Date().toISOString(),
        step: `Calculate Direct Impact: ${action}`,
        inputs: { action, baselineKPIs, persona, industry, companySize },
        outputs: {},
        confidence: 0.0,
        reasoning: '',
        sources: []
      };

      const impact = this.causalTruth.getImpactForAction(
        action,
        persona,
        industry,
        companySize
      );

      if (!impact) {
        step.reasoning = `No impact data available for ${action}`;
        step.confidence = 0.0;
        auditTrail.push(step);
        continue;
      }

      // Calculate impact for each affected KPI
      for (const [kpiId, distribution] of Object.entries(impact.kpiImpacts)) {
        const baseline = baselineKPIs[kpiId];
        if (baseline === undefined) continue;

        const medianImpact = distribution.p50;
        const absoluteChange = baseline * medianImpact;
        const projectedValue = baseline + absoluteChange;

        const kpiImpact: KPIImpact = {
          kpiId,
          kpiName: this.getKPIName(kpiId),
          baselineValue: baseline,
          projectedValue: projectedValue,
          absoluteChange: absoluteChange,
          relativeChange: medianImpact * 100,
          confidence: impact.confidence * impact.evidenceQuality,
          contributingActions: [action],
          formulaDependencies: this.formulaRegistry.getDependencies(kpiId)
        };

        impacts.push(kpiImpact);
        step.outputs[kpiId] = kpiImpact;
      }

      step.confidence = impact.confidence * impact.evidenceQuality;
      step.sources = impact.sources;
      step.reasoning = `Direct impact of ${action} on KPIs with ${step.confidence.toFixed(2)} confidence`;
      auditTrail.push(step);
    }

    return impacts;
  }

  /**
   * Calculate cascading impacts through formula dependencies
   */
  private async calculateCascadingImpacts(
    directImpacts: KPIImpact[],
    baselineKPIs: Record<string, number>,
    auditTrail: AuditStep[]
  ): Promise<KPIImpact[]> {
    const allImpacts = new Map<string, KPIImpact>();
    
    // Add direct impacts
    for (const impact of directImpacts) {
      allImpacts.set(impact.kpiId, impact);
    }

    // Calculate cascading impacts
    let changed = true;
    let iteration = 0;
    const maxIterations = 10;

    while (changed && iteration < maxIterations) {
      changed = false;
      iteration++;

      const step: AuditStep = {
        timestamp: new Date().toISOString(),
        step: `Cascading Impact Calculation - Iteration ${iteration}`,
        inputs: { currentImpacts: Array.from(allImpacts.keys()) },
        outputs: {},
        confidence: 0.8,
        reasoning: `Propagating impacts through formula dependencies (iteration ${iteration})`,
        sources: ['structural-data.ts']
      };

      for (const [kpiId, impact] of allImpacts) {
        const dependentKPIs = this.formulaRegistry.getDependents(kpiId);
        
        for (const dependentKPI of dependentKPIs) {
          if (allImpacts.has(dependentKPI)) continue; // Already calculated

          const formula = this.formulaRegistry.getFormula(dependentKPI);
          if (!formula) continue;

          // Check if all dependencies have been calculated
          const deps = formula.dependencies;
          const allDepsCalculated = deps.every(dep => allImpacts.has(dep) || baselineKPIs[dep] !== undefined);

          if (!allDepsCalculated) continue;

          // Calculate new value
          const inputs: FormulaInput[] = deps.map(dep => {
            const depImpact = allImpacts.get(dep);
            return {
              kpiId: dep,
              value: depImpact ? depImpact.projectedValue : baselineKPIs[dep],
              confidence: depImpact ? depImpact.confidence : 1.0
            };
          });

          const result: FormulaEvaluationResult = this.formulaRegistry.evaluate(
            dependentKPI,
            inputs
          );

          if (result.success && result.output) {
            const baseline = baselineKPIs[dependentKPI];
            if (baseline === undefined) continue;

            const absoluteChange = result.output.value - baseline;
            const relativeChange = baseline > 0 ? (absoluteChange / baseline) * 100 : 0;

            const cascadingImpact: KPIImpact = {
              kpiId: dependentKPI,
              kpiName: this.getKPIName(dependentKPI),
              baselineValue: baseline,
              projectedValue: result.output.value,
              absoluteChange: absoluteChange,
              relativeChange: relativeChange,
              confidence: result.output.confidence,
              contributingActions: Array.from(new Set(
                deps.flatMap(dep => {
                  const depImpact = allImpacts.get(dep);
                  return depImpact ? depImpact.contributingActions : [];
                })
              )),
              formulaDependencies: deps
            };

            allImpacts.set(dependentKPI, cascadingImpact);
            step.outputs[dependentKPI] = cascadingImpact;
            changed = true;
          }
        }
      }

      if (Object.keys(step.outputs).length > 0) {
        auditTrail.push(step);
      }
    }

    return Array.from(allImpacts.values());
  }

  /**
   * Build timeline with time-to-realize curves
   */
  private async buildTimeline(
    kpiImpacts: KPIImpact[],
    timeframe: string,
    auditTrail: AuditStep[]
  ): Promise<TimelineEvent[]> {
    const timeline: TimelineEvent[] = [];
    const days = this.parseTimeframe(timeframe);

    const step: AuditStep = {
      timestamp: new Date().toISOString(),
      step: 'Build Timeline with Time-to-Realize Curves',
      inputs: { kpiImpacts: kpiImpacts.length, timeframe },
      outputs: {},
      confidence: 0.75,
      reasoning: 'Applying time-to-realize curves to KPI impacts',
      sources: ['causal-truth.ts']
    };

    for (const impact of kpiImpacts) {
      // Get time curve for each contributing action
      for (const action of impact.contributingActions) {
        const timeCurve = this.causalTruth.getTimeCurve(action, impact.kpiId);
        
        if (!timeCurve) continue;

        // Generate daily impacts
        for (let day = 1; day <= days; day++) {
          const dayImpact = this.evaluateTimeCurve(timeCurve, day, impact.absoluteChange);
          if (Math.abs(dayImpact) < 0.01) continue; // Skip negligible impacts

          const cumulativeImpact = timeline
            .filter(t => t.day <= day && t.kpiImpacts.includes(impact.kpiId))
            .reduce((sum, t) => sum + t.cumulativeImpact, 0) + dayImpact;

          timeline.push({
            day,
            action,
            kpiImpacts: [impact.kpiId],
            cumulativeImpact: cumulativeImpact,
            probability: timeCurve.confidence
          });
        }
      }
    }

    // Aggregate by day
    const aggregated = new Map<number, TimelineEvent>();
    for (const event of timeline) {
      const existing = aggregated.get(event.day);
      if (existing) {
        existing.cumulativeImpact += event.cumulativeImpact;
        existing.kpiImpacts = [...new Set([...existing.kpiImpacts, ...event.kpiImpacts])];
        existing.probability = Math.min(existing.probability, event.probability);
      } else {
        aggregated.set(event.day, { ...event });
      }
    }

    const sortedTimeline = Array.from(aggregated.values()).sort((a, b) => a.day - b.day);
    
    step.outputs = { events: sortedTimeline.length };
    auditTrail.push(step);

    return sortedTimeline;
  }

  /**
   * Calculate financial impact metrics
   */
  private async calculateFinancialImpact(
    timeline: TimelineEvent[],
    annualRevenue: number,
    auditTrail: AuditStep[]
  ): Promise<FinancialImpact> {
    const step: AuditStep = {
      timestamp: new Date().toISOString(),
      step: 'Calculate Financial Impact',
      inputs: { timelineEvents: timeline.length, annualRevenue },
      outputs: {},
      confidence: 0.85,
      reasoning: 'Converting KPI impacts to financial metrics',
      sources: ['structural-data.ts', 'causal-truth.ts']
    };

    // Sum incremental revenue from timeline
    const totalRevenueImpact = timeline.reduce((sum, event) => {
      // Convert cumulative impact to revenue (simplified)
      // In reality, this would use formula mappings
      return sum + event.cumulativeImpact;
    }, 0);

    // Estimate cost savings (typically 20-40% of revenue impact for efficiency actions)
    const costSavings = totalRevenueImpact * 0.3;

    // Estimate costs (investment required)
    // This would come from action metadata
    const totalCosts = annualRevenue * 0.05; // 5% of revenue as proxy

    const totalBenefits = totalRevenueImpact + costSavings;
    const netBenefits = totalBenefits - totalCosts;

    // NPV calculation (simplified 10% discount rate)
    const npv = this.calculateNPV(timeline, totalBenefits, totalCosts);

    // IRR calculation (simplified)
    const irr = this.calculateIRR(timeline, totalBenefits, totalCosts);

    const result: FinancialImpact = {
      incrementalRevenue: totalRevenueImpact,
      costSavings: costSavings,
      totalBenefits: totalBenefits,
      totalCosts: totalCosts,
      netPresentValue: npv,
      internalRateOfReturn: irr
    };

    step.outputs = result;
    auditTrail.push(step);

    return result;
  }

  /**
   * Analyze risks and scenarios
   */
  private async analyzeRisks(
    timeline: TimelineEvent[],
    financialImpact: FinancialImpact,
    confidenceThreshold: number,
    auditTrail: AuditStep[]
  ): Promise<RiskAnalysis> {
    const step: AuditStep = {
      timestamp: new Date().toISOString(),
      step: 'Risk Analysis',
      inputs: { confidenceThreshold },
      outputs: {},
      confidence: 0.7,
      reasoning: 'Generating downside, base, and upside scenarios',
      sources: ['causal-truth.ts']
    };

    // Calculate confidence from timeline probabilities
    const avgConfidence = timeline.length > 0
      ? timeline.reduce((sum, e) => sum + e.probability, 0) / timeline.length
      : 0.5;

    // Downside scenario (p10)
    const downside = {
      probability: 0.1,
      npv: financialImpact.netPresentValue * 0.5,
      roi: (financialImpact.netPresentValue / financialImpact.totalCosts) * 0.5,
      description: 'Conservative estimates with slower adoption and lower impact'
    };

    // Base case (p50)
    const baseCase = {
      probability: 0.5,
      npv: financialImpact.netPresentValue,
      roi: financialImpact.netPresentValue / financialImpact.totalCosts,
      description: 'Expected outcomes based on median estimates'
    };

    // Upside scenario (p90)
    const upside = {
      probability: 0.9,
      npv: financialImpact.netPresentValue * 1.5,
      roi: (financialImpact.netPresentValue / financialImpact.totalCosts) * 1.5,
      description: 'Optimistic outcomes with faster adoption and higher impact'
    };

    // Sensitivity factors
    const sensitivity: SensitivityFactor[] = [
      { variable: 'Adoption Rate', impact: 'high', range: [0.6, 1.2] },
      { variable: 'Time to Realize', impact: 'medium', range: [0.8, 1.5] },
      { variable: 'Impact Magnitude', impact: 'high', range: [0.7, 1.3] }
    ];

    // Key risks
    const keyRisks: Risk[] = [
      {
        description: 'Implementation delays reduce time value',
        probability: 0.3,
        impact: 'medium',
        mitigation: 'Phased rollout with clear milestones'
      },
      {
        description: 'Lower than expected adoption rates',
        probability: 0.25,
        impact: 'high',
        mitigation: 'Change management program and training'
      },
      {
        description: 'Market conditions change',
        probability: 0.15,
        impact: 'high',
        mitigation: 'Regular review and adjustment of strategy'
      }
    ];

    const result: RiskAnalysis = {
      downsideScenario: downside,
      baseCase: baseCase,
      upsideScenario: upside,
      sensitivity: sensitivity,
      keyRisks: keyRisks
    };

    step.outputs = result;
    auditTrail.push(step);

    return result;
  }

  /**
   * Generate actionable recommendations
   */
  private async generateRecommendations(
    actions: BusinessAction[],
    riskAnalysis: RiskAnalysis,
    auditTrail: AuditStep[]
  ): Promise<Recommendation[]> {
    const step: AuditStep = {
      timestamp: new Date().toISOString(),
      step: 'Generate Recommendations',
      inputs: { actions },
      outputs: {},
      confidence: 0.8,
      reasoning: 'Prioritizing actions based on impact, effort, and risk',
      sources: ['causal-truth.ts']
    };

    const recommendations: Recommendation[] = [];

    // Map actions to recommendations
    const actionPriorities: Record<BusinessAction, Recommendation> = {
      'price_optimization': {
        priority: 'high',
        action: 'Implement price optimization strategy',
        expectedImpact: '5-15% revenue increase',
        effort: 'medium',
        quickWin: false
      },
      'sales_training': {
        priority: 'high',
        action: 'Invest in sales team training',
        expectedImpact: '10-20% conversion rate improvement',
        effort: 'medium',
        quickWin: true
      },
      'product_feature': {
        priority: 'medium',
        action: 'Develop key product features',
        expectedImpact: '15-25% TTV reduction',
        effort: 'high',
        quickWin: false
      },
      'customer_success': {
        priority: 'critical',
        action: 'Enhance customer success program',
        expectedImpact: '5-10% retention improvement',
        effort: 'low',
        quickWin: true
      },
      'operational_efficiency': {
        priority: 'medium',
        action: 'Optimize operational processes',
        expectedImpact: '2-5% margin improvement',
        effort: 'high',
        quickWin: false
      }
    };

    for (const action of actions) {
      if (actionPriorities[action]) {
        recommendations.push(actionPriorities[action]);
      }
    }

    // Add general recommendations based on risk
    if (riskAnalysis.downsideScenario.npv < 0) {
      recommendations.push({
        priority: 'critical',
        action: 'Reconsider investment - downside scenario shows negative NPV',
        expectedImpact: 'Risk mitigation required',
        effort: 'low',
        quickWin: false
      });
    }

    if (riskAnalysis.baseCase.roi > 2.0) {
      recommendations.push({
        priority: 'high',
        action: 'Proceed with investment - strong ROI potential',
        expectedImpact: `${riskAnalysis.baseCase.roi.toFixed(1)}x ROI expected`,
        effort: 'medium',
        quickWin: false
      });
    }

    step.outputs = { recommendations: recommendations.length };
    auditTrail.push(step);

    return recommendations;
  }

  /**
   * Create business case summary
   */
  private async createSummary(
    request: BusinessCaseRequest,
    financialImpact: FinancialImpact,
    riskAnalysis: RiskAnalysis,
    recommendations: Recommendation[],
    auditTrail: AuditStep[]
  ): Promise<BusinessCaseSummary> {
    const step: AuditStep = {
      timestamp: new Date().toISOString(),
      step: 'Create Business Case Summary',
      inputs: { request },
      outputs: {},
      confidence: 0.9,
      reasoning: 'Compiling all components into executive summary',
      sources: ['all-layers']
    };

    const roi = financialImpact.netPresentValue / financialImpact.totalCosts;
    const paybackPeriod = this.calculatePaybackPeriod(
      financialImpact.totalCosts,
      financialImpact.totalBenefits
    );

    // Calculate overall confidence from audit trail
    const avgConfidence = auditTrail.reduce((sum, s) => sum + s.confidence, 0) / auditTrail.length;

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high';
    if (riskAnalysis.keyRisks.filter(r => r.impact === 'high').length >= 2) {
      riskLevel = 'high';
    } else if (riskAnalysis.keyRisks.filter(r => r.impact === 'high').length === 1) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    const summary: BusinessCaseSummary = {
      title: `Business Case: ${request.selectedActions.join(', ')}`,
      description: `Comprehensive analysis for ${request.persona} in ${request.industry} industry`,
      totalInvestment: financialImpact.totalCosts,
      totalReturn: financialImpact.totalBenefits,
      roi: roi,
      paybackPeriod: paybackPeriod,
      confidence: avgConfidence,
      riskLevel: riskLevel
    };

    step.outputs = summary;
    auditTrail.push(step);

    return summary;
  }

  // Helper methods
  private getKPIName(kpiId: string): string {
    const kpiNames: Record<string, string> = {
      'arr': 'Annual Recurring Revenue',
      'churn_rate': 'Churn Rate',
      'cac': 'Customer Acquisition Cost',
      'ltv': 'Lifetime Value',
      'gross_margin': 'Gross Margin',
      'ttv': 'Time to Value',
      'conversion_rate': 'Conversion Rate',
      'retention_rate': 'Retention Rate',
      'nrr': 'Net Revenue Retention'
    };
    return kpiNames[kpiId] || kpiId;
  }

  private parseTimeframe(timeframe: string): number {
    const map: Record<string, number> = {
      '30d': 30,
      '90d': 90,
      '180d': 180,
      '365d': 365
    };
    return map[timeframe] || 90;
  }

  private evaluateTimeCurve(curve: TimeCurve, day: number, totalImpact: number): number {
    const t = day / curve.duration;
    
    switch (curve.type) {
      case 'sigmoid':
        // S-shaped adoption curve
        const sigmoid = 1 / (1 + Math.exp(-10 * (t - 0.5)));
        return totalImpact * sigmoid * (1 / curve.duration);
      
      case 'linear':
        return totalImpact * (1 / curve.duration);
      
      case 'exponential_decay':
        return totalImpact * Math.exp(-3 * t) * 0.1;
      
      case 'step':
        return day >= curve.delay ? totalImpact / (curve.duration - curve.delay) : 0;
      
      default:
        return 0;
    }
  }

  private calculateNPV(
    timeline: TimelineEvent[],
    totalBenefits: number,
    totalCosts: number
  ): number {
    // Simplified NPV with 10% discount rate
    const discountRate = 0.10;
    let npv = -totalCosts;

    for (const event of timeline) {
      const year = event.day / 365;
      const discountFactor = Math.pow(1 + discountRate, -year);
      npv += event.cumulativeImpact * discountFactor;
    }

    return npv;
  }

  private calculateIRR(
    timeline: TimelineEvent[],
    totalBenefits: number,
    totalCosts: number
  ): number {
    // Simplified IRR calculation (binary search approximation)
    const targetNPV = 0;
    let low = 0;
    let high = 1; // 100% IRR

    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      const npv = this.calculateNPV(timeline, totalBenefits, totalCosts) / (1 + mid);
      
      if (Math.abs(npv - targetNPV) < 0.01) {
        return mid * 100;
      }
      
      if (npv > targetNPV) {
        low = mid;
      } else {
        high = mid;
      }
    }

    return ((low + high) / 2) * 100;
  }

  private calculatePaybackPeriod(totalCosts: number, totalBenefits: number): number {
    if (totalBenefits <= 0) return Infinity;
    const dailyBenefit = totalBenefits / 365;
    return (totalCosts / dailyBenefit);
  }
}

/**
 * MCP Server Integration
 * Exposes business case generation as tools
 */
export const BusinessCaseTools = {
  /**
   * Generate business case for selected actions
   */
  generate_business_case: {
    description: 'Generate comprehensive business case combining metric, structural, and causal truth',
    inputSchema: {
      type: 'object',
      properties: {
        persona: { type: 'string', enum: ['founder', 'ceo', 'cto', 'cfo', 'coo', 'cmo', 'cso', 'vp_sales', 'vp_product'] },
        industry: { type: 'string', enum: ['saas', 'finance', 'manufacturing', 'healthcare', 'retail', 'technology', 'professional_services'] },
        companySize: { type: 'string', enum: ['startup', 'smb', 'mid_market', 'enterprise'] },
        annualRevenue: { type: 'number' },
        currentKPIs: { type: 'object' },
        selectedActions: { 
          type: 'array', 
          items: { 
            type: 'string', 
            enum: ['price_optimization', 'sales_training', 'product_feature', 'customer_success', 'operational_efficiency']
          }
        },
        timeframe: { type: 'string', enum: ['30d', '90d', '180d', '365d'] },
        confidenceThreshold: { type: 'number', minimum: 0, maximum: 1 }
      },
      required: ['persona', 'industry', 'companySize', 'annualRevenue', 'currentKPIs', 'selectedActions', 'timeframe']
    }
  },

  /**
   * Get risk analysis for business case
   */
  get_risk_analysis: {
    description: 'Get detailed risk analysis for a business case',
    inputSchema: {
      type: 'object',
      properties: {
        businessCaseId: { type: 'string' }
      },
      required: ['businessCaseId']
    }
  },

  /**
   * Compare multiple business cases
   */
  compare_scenarios: {
    description: 'Compare multiple business case scenarios side by side',
    inputSchema: {
      type: 'object',
      properties: {
        scenarios: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              actions: { type: 'array', items: { type: 'string' } },
              persona: { type: 'string' },
              industry: { type: 'string' },
              companySize: { type: 'string' },
              annualRevenue: { type: 'number' },
              currentKPIs: { type: 'object' },
              timeframe: { type: 'string' }
            },
            required: ['name', 'actions', 'persona', 'industry', 'companySize', 'annualRevenue', 'currentKPIs', 'timeframe']
          }
        }
      },
      required: ['scenarios']
    }
  },

  /**
   * Get audit trail for business case
   */
  get_audit_trail: {
    description: 'Get detailed audit trail showing all reasoning steps',
    inputSchema: {
      type: 'object',
      properties: {
        businessCaseId: { type: 'string' },
        detailLevel: { type: 'string', enum: ['summary', 'detailed', 'full'] }
      },
      required: ['businessCaseId']
    }
  }
};
/**
 * Enhanced Business Case Generator with Comprehensive Audit Trail
 * 
 * Generates business cases by integrating:
 * - Structural Truth (formulas, dependencies, benchmarks)
 * - Causal Truth (action impacts, time curves, evidence)
 * - Full audit trail for regulatory compliance
 * 
 * Part of Phase 3 - Integration & Business Case Generation
 */

import { StructuralTruth, FormulaInput } from '../structural/structural-truth';
import CausalTruth from './causal-truth-enhanced';
import { BusinessAction } from './causal-truth';
import { 
  StructuralPersona, 
  StructuralIndustry,
  StructuralKPINode
} from '../types/structural-truth';

// ============================================================================
// BUSINESS CASE TYPES
// ============================================================================

export interface BusinessCaseRequest {
  persona: StructuralPersona;
  industry: StructuralIndustry;
  companySize: 'startup' | 'scaleup' | 'enterprise';
  annualRevenue: number;
  currentKPIs: Record<string, number>;
  selectedActions: BusinessAction[];
  timeframe: '30d' | '90d' | '180d' | '365d';
  confidenceThreshold?: number;
  scenarioName?: string;
}

export interface BusinessCaseResult {
  metadata: BusinessCaseMetadata;
  summary: BusinessCaseSummary;
  financialImpact: FinancialImpact;
  kpiImpacts: KPIImpact[];
  timeline: TimelineEvent[];
  riskAnalysis: RiskAnalysis;
  auditTrail: AuditStep[];
  recommendations: Recommendation[];
  evidence: EvidenceSummary[];
}

export interface BusinessCaseMetadata {
  id: string;
  version: string;
  createdAt: string;
  persona: StructuralPersona;
  industry: StructuralIndustry;
  companySize: string;
  timeframe: string;
  confidenceScore: number;
  dataSources: string[];
}

export interface BusinessCaseSummary {
  title: string;
  description: string;
  totalInvestment: number;
  totalReturn: number;
  roi: number;
  netPresentValue: number;
  paybackPeriod: number;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
  keyInsights: string[];
}

export interface FinancialImpact {
  incrementalRevenue: number;
  costSavings: number;
  totalBenefits: number;
  totalCosts: number;
  netPresentValue: number;
  internalRateOfReturn: number;
  benefitCostRatio: number;
  sensitivity: FinancialSensitivity;
}

export interface FinancialSensitivity {
  downside: {
    npv: number;
    roi: number;
  };
  baseCase: {
    npv: number;
    roi: number;
  };
  upside: {
    npv: number;
    roi: number;
  };
}

export interface KPIImpact {
  kpiId: string;
  kpiName: string;
  baselineValue: number;
  projectedValue: number;
  absoluteChange: number;
  relativeChange: number;
  confidence: number;
  contributingActions: string[];
  formulaDependencies: string[];
  benchmarkAlignment: {
    aligned: boolean;
    percentile: string;
    warning?: string;
  };
  timeToImpact: number;
}

export interface TimelineEvent {
  day: number;
  action: string;
  kpiImpacts: Array<{ kpiId: string; impact: number }>;
  cumulativeImpact: number;
  probability: number;
  confidence: number;
}

export interface RiskAnalysis {
  downsideScenario: Scenario;
  baseCase: Scenario;
  upsideScenario: Scenario;
  sensitivity: SensitivityFactor[];
  keyRisks: Risk[];
  mitigationStrategies: string[];
}

export interface Scenario {
  probability: number;
  npv: number;
  roi: number;
  description: string;
  confidence: number;
}

export interface SensitivityFactor {
  variable: string;
  impact: 'high' | 'medium' | 'low';
  range: [number, number];
  currentEstimate: number;
}

export interface Risk {
  description: string;
  probability: number;
  impact: 'high' | 'medium' | 'low';
  mitigation: string;
  expectedImpact: number;
}

export interface Recommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  expectedImpact: string;
  effort: 'low' | 'medium' | 'high';
  quickWin: boolean;
  rationale: string;
  supportingEvidence: string[];
}

export interface AuditStep {
  id: string;
  timestamp: string;
  step: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  confidence: number;
  reasoning: string;
  sources: string[];
  validation?: ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  complianceFlags: string[];
}

export interface EvidenceSummary {
  source: string;
  quality: 'anecdotal' | 'case_study' | 'research_paper' | 'meta_analysis';
  relevance: number;
  recency: string;
  keyFindings: string[];
}

// ============================================================================
// ENHANCED BUSINESS CASE GENERATOR
// ============================================================================

export class EnhancedBusinessCaseGenerator {
  private structuralTruth: StructuralTruth;
  private causalTruth: CausalTruth;
  private auditTrail: AuditStep[] = [];
  private evidenceLog: EvidenceSummary[] = [];

  constructor(
    structuralTruth: StructuralTruth,
    causalTruth: CausalTruth
  ) {
    this.structuralTruth = structuralTruth;
    this.causalTruth = causalTruth;
  }

  /**
   * Generate comprehensive business case with full audit trail
   */
  async generateBusinessCase(
    request: BusinessCaseRequest
  ): Promise<BusinessCaseResult> {
    this.auditTrail = [];
    this.evidenceLog = [];
    
    const startTime = Date.now();
    const caseId = `BC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Step 1: Validate inputs and baseline
      const validationStep = await this.validateInputs(request);
      if (!validationStep.outputs.valid) {
        throw new Error(`Validation failed: ${validationStep.outputs.errors.join(', ')}`);
      }

      // Step 2: Calculate direct impacts
      const directImpacts = await this.calculateDirectImpacts(request);

      // Step 3: Calculate cascading impacts
      const cascadingImpacts = await this.calculateCascadingImpacts(directImpacts, request);

      // Step 4: Build timeline
      const timeline = await this.buildTimeline(cascadingImpacts, request);

      // Step 5: Calculate financial impact
      const financialImpact = await this.calculateFinancialImpact(timeline, request);

      // Step 6: Risk analysis
      const riskAnalysis = await this.analyzeRisks(timeline, financialImpact, request);

      // Step 7: Generate recommendations
      const recommendations = await this.generateRecommendations(request, riskAnalysis);

      // Step 8: Create summary
      const summary = await this.createSummary(request, financialImpact, riskAnalysis, recommendations);

      // Step 9: Compile evidence
      const evidence = await this.compileEvidence();

      // Step 10: Final validation
      const finalValidation = await this.finalValidation(request, summary);

      const executionTime = Date.now() - startTime;

      return {
        metadata: {
          id: caseId,
          version: "1.0.0",
          createdAt: new Date().toISOString(),
          persona: request.persona,
          industry: request.industry,
          companySize: request.companySize,
          timeframe: request.timeframe,
          confidenceScore: summary.confidence,
          dataSources: this.extractDataSources()
        },
        summary,
        financialImpact,
        kpiImpacts: cascadingImpacts,
        timeline,
        riskAnalysis,
        auditTrail: this.auditTrail,
        recommendations,
        evidence
      };

    } catch (error) {
      const errorStep: AuditStep = {
        id: `error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        step: 'Business Case Generation Failed',
        inputs: { request },
        outputs: { error: error instanceof Error ? error.message : 'Unknown error' },
        confidence: 0,
        reasoning: 'Generation failed due to validation or calculation error',
        sources: [],
        validation: {
          valid: false,
          warnings: [],
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          complianceFlags: ['GENERATION_FAILURE']
        }
      };
      
      this.auditTrail.push(errorStep);
      
      throw error;
    }
  }

  // ============================================================================
  // VALIDATION STEP
  // ============================================================================

  private async validateInputs(request: BusinessCaseRequest): Promise<AuditStep> {
    const step: AuditStep = {
      id: `validate-${Date.now()}`,
      timestamp: new Date().toISOString(),
      step: 'Input Validation',
      inputs: {
        persona: request.persona,
        industry: request.industry,
        companySize: request.companySize,
        annualRevenue: request.annualRevenue,
        currentKPIs: Object.keys(request.currentKPIs),
        selectedActions: request.selectedActions,
        timeframe: request.timeframe
      },
      outputs: {},
      confidence: 1.0,
      reasoning: 'Validating all inputs for business case generation',
      sources: ['request-input']
    };

    const errors: string[] = [];
    const warnings: string[] = [];
    const complianceFlags: string[] = [];

    // Validate persona
    const validPersonas = ['cfo', 'cio', 'cto', 'coo', 'vp_sales', 'vp_ops', 'vp_engineering', 'director_finance', 'data_analyst'];
    if (!validPersonas.includes(request.persona)) {
      errors.push(`Invalid persona: ${request.persona}`);
    }

    // Validate industry
    const validIndustries = ['saas', 'manufacturing', 'healthcare', 'finance', 'retail', 'technology', 'professional_services'];
    if (!validIndustries.includes(request.industry)) {
      errors.push(`Invalid industry: ${request.industry}`);
    }

    // Validate company size
    const validSizes = ['startup', 'scaleup', 'enterprise'];
    if (!validSizes.includes(request.companySize)) {
      errors.push(`Invalid company size: ${request.companySize}`);
    }

    // Validate annual revenue
    if (request.annualRevenue <= 0) {
      errors.push('Annual revenue must be positive');
    }

    // Validate KPIs
    if (Object.keys(request.currentKPIs).length === 0) {
      errors.push('At least one KPI must be provided');
    }

    // Validate actions
    if (request.selectedActions.length === 0) {
      errors.push('At least one action must be selected');
    }

    // Check for missing critical KPIs
    const criticalKPIs = this.getCriticalKPIsForIndustry(request.industry);
    const missingKPIs = criticalKPIs.filter(kpi => !request.currentKPIs[kpi]);
    if (missingKPIs.length > 0) {
      warnings.push(`Missing critical KPIs: ${missingKPIs.join(', ')}`);
      complianceFlags.push('MISSING_CRITICAL_KPIS');
    }

    // Check for unrealistic values
    for (const [kpi, value] of Object.entries(request.currentKPIs)) {
      const benchmark = this.structuralTruth.getKPIBenchmark(kpi, request.persona);
      if (benchmark) {
        if (value > benchmark.p75 * 2) {
          warnings.push(`${kpi} value (${value}) significantly exceeds 75th percentile (${benchmark.p75})`);
        }
        if (value < benchmark.p25 * 0.5) {
          warnings.push(`${kpi} value (${value}) significantly below 25th percentile (${benchmark.p25})`);
        }
      }
    }

    // Validate timeframe
    const validTimeframes = ['30d', '90d', '180d', '365d'];
    if (!validTimeframes.includes(request.timeframe)) {
      errors.push(`Invalid timeframe: ${request.timeframe}`);
    }

    // Check for regulatory compliance
    if (request.industry === 'healthcare' || request.industry === 'finance') {
      complianceFlags.push('REQUIRES_REGULATORY_REVIEW');
    }

    step.outputs = {
      valid: errors.length === 0,
      errors,
      warnings,
      complianceFlags,
      validationScore: 1.0 - (errors.length * 0.2) - (warnings.length * 0.05)
    };

    step.confidence = Math.max(0, step.outputs.validationScore);
    step.validation = {
      valid: errors.length === 0,
      warnings,
      errors,
      complianceFlags
    };

    this.auditTrail.push(step);
    return step;
  }

  // ============================================================================
  // DIRECT IMPACTS CALCULATION
  // ============================================================================

  private async calculateDirectImpacts(request: BusinessCaseRequest): Promise<KPIImpact[]> {
    const step: AuditStep = {
      id: `direct-impacts-${Date.now()}`,
      timestamp: new Date().toISOString(),
      step: 'Calculate Direct Impacts',
      inputs: {
        actions: request.selectedActions,
        baselineKPIs: request.currentKPIs
      },
      outputs: {},
      confidence: 0.0,
      reasoning: 'Calculating direct causal impacts of selected actions',
      sources: ['causal-truth']
    };

    const impacts: KPIImpact[] = [];

    for (const action of request.selectedActions) {
      const impact = this.causalTruth.getImpactForAction(
        action,
        request.persona,
        request.industry,
        request.companySize
      );

      if (!impact) {
        step.reasoning += `\nNo impact data for ${action}`;
        continue;
      }

      // Add evidence to log
      this.evidenceLog.push({
        source: impact.evidence,
        quality: this.getEvidenceQuality(impact.evidence),
        relevance: impact.confidence,
        recency: '2024',
        keyFindings: [`Action ${action} affects ${impact.targetKpi}`]
      });

      // Calculate impact for each affected KPI
      for (const [kpiId, distribution] of Object.entries(impact.impact)) {
        const baseline = request.currentKPIs[kpiId];
        if (baseline === undefined) continue;

        const medianImpact = distribution.p50;
        const absoluteChange = baseline * medianImpact;
        const projectedValue = baseline + absoluteChange;

        // Check benchmark alignment
        const benchmark = this.structuralTruth.getKPIBenchmark(kpiId, request.persona);
        const benchmarkAlignment = benchmark ? 
          this.checkBenchmarkAlignment(kpiId, projectedValue, benchmark) : 
          { aligned: true, percentile: 'unknown' };

        const kpiImpact: KPIImpact = {
          kpiId,
          kpiName: this.getKPIName(kpiId),
          baselineValue: baseline,
          projectedValue: projectedValue,
          absoluteChange: absoluteChange,
          relativeChange: medianImpact * 100,
          confidence: impact.confidence * impact.timeCurve.confidence,
          contributingActions: [action],
          formulaDependencies: this.structuralTruth.getDependencies(kpiId),
          benchmarkAlignment,
          timeToImpact: impact.timeCurve.timeToFirstImpact
        };

        impacts.push(kpiImpact);
        step.outputs[kpiId] = kpiImpact;
      }

      // Add to audit trail
      step.confidence = Math.max(step.confidence, impact.confidence);
    }

    step.confidence = Math.min(step.confidence, 1.0);
    this.auditTrail.push(step);

    return impacts;
  }

  // ============================================================================
  // CASCADING IMPACTS CALCULATION
  // ============================================================================

  private async calculateCascadingImpacts(
    directImpacts: KPIImpact[],
    request: BusinessCaseRequest
  ): Promise<KPIImpact[]> {
    const step: AuditStep = {
      id: `cascading-${Date.now()}`,
      timestamp: new Date().toISOString(),
      step: 'Calculate Cascading Impacts',
      inputs: { directImpacts: directImpacts.length },
      outputs: {},
      confidence: 0.8,
      reasoning: 'Propagating impacts through formula dependencies',
      sources: ['structural-truth', 'causal-truth']
    };

    const allImpacts = new Map<string, KPIImpact>();
    
    // Add direct impacts
    for (const impact of directImpacts) {
      allImpacts.set(impact.kpiId, impact);
    }

    // Iteratively calculate cascading impacts
    let changed = true;
    let iteration = 0;
    const maxIterations = 10;

    while (changed && iteration < maxIterations) {
      changed = false;
      iteration++;

      const iterationStep: AuditStep = {
        id: `cascading-iter-${iteration}-${Date.now()}`,
        timestamp: new Date().toISOString(),
        step: `Cascading Iteration ${iteration}`,
        inputs: { currentImpacts: Array.from(allImpacts.keys()) },
        outputs: {},
        confidence: 0.8,
        reasoning: `Iteration ${iteration} of cascading impact calculation`,
        sources: ['structural-truth']
      };

      for (const [kpiId, impact] of allImpacts) {
        // Find formulas that depend on this KPI
        const dependentFormulas = this.getDependentFormulas(kpiId);
        
        for (const formula of dependentFormulas) {
          if (allImpacts.has(formula.output_kpi)) continue;

          // Check if all dependencies are calculated
          const deps = formula.input_kpis;
          const allDepsCalculated = deps.every(dep => 
            allImpacts.has(dep) || request.currentKPIs[dep] !== undefined
          );

          if (!allDepsCalculated) continue;

          // Calculate formula output
          const inputs: FormulaInput[] = deps.map(dep => {
            const depImpact = allImpacts.get(dep);
            return {
              kpiId: dep,
              value: depImpact ? depImpact.projectedValue : request.currentKPIs[dep],
              confidence: depImpact ? depImpact.confidence : 1.0
            };
          });

          const result = this.structuralTruth.getFormulaRegistry().evaluate(
            formula.formula_id,
            inputs
          );

          if (result.success && result.output) {
            const baseline = request.currentKPIs[formula.output_kpi];
            if (baseline === undefined) continue;

            const absoluteChange = result.output.value - baseline;
            const relativeChange = baseline > 0 ? (absoluteChange / baseline) * 100 : 0;

            const cascadingImpact: KPIImpact = {
              kpiId: formula.output_kpi,
              kpiName: this.getKPIName(formula.output_kpi),
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
              formulaDependencies: deps,
              benchmarkAlignment: { aligned: true, percentile: 'calculated' },
              timeToImpact: Math.max(...deps.map(dep => {
                const depImpact = allImpacts.get(dep);
                return depImpact ? depImpact.timeToImpact : 0;
              }))
            };

            allImpacts.set(formula.output_kpi, cascadingImpact);
            iterationStep.outputs[formula.output_kpi] = cascadingImpact;
            changed = true;
          }
        }
      }

      if (Object.keys(iterationStep.outputs).length > 0) {
        this.auditTrail.push(iterationStep);
      }
    }

    step.outputs = { finalImpacts: allImpacts.size, iterations };
    this.auditTrail.push(step);

    return Array.from(allImpacts.values());
  }

  // ============================================================================
  // TIMELINE BUILDING
  // ============================================================================

  private async buildTimeline(
    kpiImpacts: KPIImpact[],
    request: BusinessCaseRequest
  ): Promise<TimelineEvent[]> {
    const step: AuditStep = {
      id: `timeline-${Date.now()}`,
      timestamp: new Date().toISOString(),
      step: 'Build Timeline',
      inputs: { kpiImpacts: kpiImpacts.length, timeframe: request.timeframe },
      outputs: {},
      confidence: 0.75,
      reasoning: 'Applying time-to-realize curves to build daily timeline',
      sources: ['causal-truth']
    };

    const timeline: TimelineEvent[] = [];
    const days = this.parseTimeframe(request.timeframe);

    for (const impact of kpiImpacts) {
      for (const action of impact.contributingActions) {
        const timeCurve = this.causalTruth.getTimeCurve(action, impact.kpiId);
        if (!timeCurve) continue;

        // Generate daily impacts
        for (let day = 1; day <= days; day++) {
          const dayImpact = this.evaluateTimeCurve(timeCurve, day, impact.absoluteChange);
          if (Math.abs(dayImpact) < 0.01) continue;

          const cumulativeImpact = timeline
            .filter(t => t.day <= day && t.kpiImpacts.some(k => k.kpiId === impact.kpiId))
            .reduce((sum, t) => sum + t.cumulativeImpact, 0) + dayImpact;

          timeline.push({
            day,
            action,
            kpiImpacts: [{ kpiId: impact.kpiId, impact: dayImpact }],
            cumulativeImpact: cumulativeImpact,
            probability: timeCurve.confidence || 0.8,
            confidence: impact.confidence
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
        existing.kpiImpacts = [...existing.kpiImpacts, ...event.kpiImpacts];
        existing.probability = Math.min(existing.probability, event.probability);
        existing.confidence = Math.min(existing.confidence, event.confidence);
      } else {
        aggregated.set(event.day, { ...event });
      }
    }

    const sortedTimeline = Array.from(aggregated.values()).sort((a, b) => a.day - b.day);
    
    step.outputs = { events: sortedTimeline.length, totalDays: days };
    this.auditTrail.push(step);

    return sortedTimeline;
  }

  // ============================================================================
  // FINANCIAL IMPACT CALCULATION
  // ============================================================================

  private async calculateFinancialImpact(
    timeline: TimelineEvent[],
    request: BusinessCaseRequest
  ): Promise<FinancialImpact> {
    const step: AuditStep = {
      id: `financial-${Date.now()}`,
      timestamp: new Date().toISOString(),
      step: 'Calculate Financial Impact',
      inputs: { timelineEvents: timeline.length, annualRevenue: request.annualRevenue },
      outputs: {},
      confidence: 0.85,
      reasoning: 'Converting KPI impacts to financial metrics',
      sources: ['structural-truth', 'causal-truth']
    };

    // Sum revenue impacts from timeline
    const totalRevenueImpact = timeline.reduce((sum, event) => {
      // Convert cumulative impact to revenue (simplified)
      // In production, this would use formula mappings
      return sum + event.cumulativeImpact;
    }, 0);

    // Estimate cost savings (typically 20-40% of revenue impact for efficiency actions)
    const costSavings = totalRevenueImpact * 0.3;

    // Estimate costs (investment required)
    // This would come from action metadata in production
    const totalCosts = request.annualRevenue * 0.05; // 5% of revenue as proxy

    const totalBenefits = totalRevenueImpact + costSavings;
    const netBenefits = totalBenefits - totalCosts;

    // NPV calculation
    const npv = this.calculateNPV(timeline, totalBenefits, totalCosts);

    // IRR calculation
    const irr = this.calculateIRR(timeline, totalBenefits, totalCosts);

    // Benefit-cost ratio
    const bcr = totalCosts > 0 ? totalBenefits / totalCosts : 0;

    // Sensitivity analysis
    const sensitivity = this.calculateFinancialSensitivity(timeline, totalBenefits, totalCosts);

    const result: FinancialImpact = {
      incrementalRevenue: totalRevenueImpact,
      costSavings: costSavings,
      totalBenefits: totalBenefits,
      totalCosts: totalCosts,
      netPresentValue: npv,
      internalRateOfReturn: irr,
      benefitCostRatio: bcr,
      sensitivity: sensitivity
    };

    step.outputs = result;
    this.auditTrail.push(step);

    return result;
  }

  // ============================================================================
  // RISK ANALYSIS
  // ============================================================================

  private async analyzeRisks(
    timeline: TimelineEvent[],
    financialImpact: FinancialImpact,
    request: BusinessCaseRequest
  ): Promise<RiskAnalysis> {
    const step: AuditStep = {
      id: `risk-${Date.now()}`,
      timestamp: new Date().toISOString(),
      step: 'Risk Analysis',
      inputs: { confidenceThreshold: request.confidenceThreshold || 0.7 },
      outputs: {},
      confidence: 0.7,
      reasoning: 'Generating downside, base, and upside scenarios',
      sources: ['causal-truth']
    };

    // Calculate confidence from timeline
    const avgConfidence = timeline.length > 0
      ? timeline.reduce((sum, e) => sum + e.confidence, 0) / timeline.length
      : 0.5;

    // Downside scenario (p10)
    const downside = {
      probability: 0.1,
      npv: financialImpact.netPresentValue * 0.5,
      roi: (financialImpact.netPresentValue / financialImpact.totalCosts) * 0.5,
      description: 'Conservative estimates with slower adoption and lower impact',
      confidence: avgConfidence * 0.7
    };

    // Base case (p50)
    const baseCase = {
      probability: 0.5,
      npv: financialImpact.netPresentValue,
      roi: financialImpact.netPresentValue / financialImpact.totalCosts,
      description: 'Expected outcomes based on median estimates',
      confidence: avgConfidence
    };

    // Upside scenario (p90)
    const upside = {
      probability: 0.9,
      npv: financialImpact.netPresentValue * 1.5,
      roi: (financialImpact.netPresentValue / financialImpact.totalCosts) * 1.5,
      description: 'Optimistic outcomes with faster adoption and higher impact',
      confidence: avgConfidence * 1.1
    };

    // Sensitivity factors
    const sensitivity: SensitivityFactor[] = [
      { 
        variable: 'Adoption Rate', 
        impact: 'high', 
        range: [0.6, 1.2],
        currentEstimate: 1.0
      },
      { 
        variable: 'Time to Realize', 
        impact: 'medium', 
        range: [0.8, 1.5],
        currentEstimate: 1.0
      },
      { 
        variable: 'Impact Magnitude', 
        impact: 'high', 
        range: [0.7, 1.3],
        currentEstimate: 1.0
      }
    ];

    // Key risks
    const keyRisks: Risk[] = [
      {
        description: 'Implementation delays reduce time value',
        probability: 0.3,
        impact: 'medium',
        mitigation: 'Phased rollout with clear milestones',
        expectedImpact: downside.npv * 0.3
      },
      {
        description: 'Lower than expected adoption rates',
        probability: 0.25,
        impact: 'high',
        mitigation: 'Change management program and training',
        expectedImpact: downside.npv * 0.25
      },
      {
        description: 'Market conditions change',
        probability: 0.15,
        impact: 'high',
        mitigation: 'Regular review and adjustment of strategy',
        expectedImpact: downside.npv * 0.15
      }
    ];

    // Mitigation strategies
    const mitigationStrategies = [
      'Implement change management program',
      'Establish clear success metrics',
      'Create phased rollout plan',
      'Set up regular review cadence',
      'Build contingency budget (10-15%)'
    ];

    const result: RiskAnalysis = {
      downsideScenario: downside,
      baseCase: baseCase,
      upsideScenario: upside,
      sensitivity: sensitivity,
      keyRisks: keyRisks,
      mitigationStrategies: mitigationStrategies
    };

    step.outputs = result;
    this.auditTrail.push(step);

    return result;
  }

  // ============================================================================
  // RECOMMENDATIONS GENERATION
  // ============================================================================

  private async generateRecommendations(
    request: BusinessCaseRequest,
    riskAnalysis: RiskAnalysis
  ): Promise<Recommendation[]> {
    const step: AuditStep = {
      id: `recommendations-${Date.now()}`,
      timestamp: new Date().toISOString(),
      step: 'Generate Recommendations',
      inputs: { actions: request.selectedActions },
      outputs: {},
      confidence: 0.8,
      reasoning: 'Prioritizing actions based on impact, effort, and risk',
      sources: ['causal-truth']
    };

    const recommendations: Recommendation[] = [];

    // Get recommendations for each action
    for (const action of request.selectedActions) {
      const actionRecs = await this.getActionRecommendations(action, request, riskAnalysis);
      recommendations.push(...actionRecs);
    }

    // Add strategic recommendations based on risk
    if (riskAnalysis.downsideScenario.npv < 0) {
      recommendations.push({
        priority: 'critical',
        action: 'Reconsider investment - downside scenario shows negative NPV',
        expectedImpact: 'Risk mitigation required',
        effort: 'low',
        quickWin: false,
        rationale: 'Downside scenario indicates potential value destruction',
        supportingEvidence: ['Risk analysis shows negative NPV in downside case']
      });
    }

    if (riskAnalysis.baseCase.roi > 2.0) {
      recommendations.push({
        priority: 'high',
        action: 'Proceed with investment - strong ROI potential',
        expectedImpact: `${riskAnalysis.baseCase.roi.toFixed(1)}x ROI expected`,
        effort: 'medium',
        quickWin: false,
        rationale: 'Base case shows strong return potential',
        supportingEvidence: ['Financial analysis confirms positive ROI']
      });
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    step.outputs = { recommendations: recommendations.length };
    this.auditTrail.push(step);

    return recommendations;
  }

  private async getActionRecommendations(
    action: BusinessAction,
    request: BusinessCaseRequest,
    riskAnalysis: RiskAnalysis
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Get impact data
    const impact = this.causalTruth.getImpactForAction(
      action,
      request.persona,
      request.industry,
      request.companySize
    );

    if (!impact) return recommendations;

    // Map action to recommendation
    const actionMap: Record<BusinessAction, Partial<Recommendation>> = {
      'price_increase_5pct': {
        action: 'Implement 5% price increase',
        expectedImpact: '4-6% ARR increase',
        effort: 'medium',
        quickWin: false
      },
      'increase_sales_team_20pct': {
        action: 'Increase sales team by 20%',
        expectedImpact: '8-15% ARR growth',
        effort: 'high',
        quickWin: false
      },
      'double_marketing_spend': {
        action: 'Double marketing spend',
        expectedImpact: '15-25% lead increase',
        effort: 'medium',
        quickWin: false
      },
      'add_self_service_onboarding': {
        action: 'Add self-service onboarding',
        expectedImpact: '30-50% TTV reduction',
        effort: 'low',
        quickWin: true
      },
      'improve_page_load_50pct': {
        action: 'Improve page load by 50%',
        expectedImpact: '8-12% conversion increase',
        effort: 'low',
        quickWin: true
      },
      'implement_health_scoring': {
        action: 'Implement customer health scoring',
        expectedImpact: '8-15% churn reduction',
        effort: 'medium',
        quickWin: true
      },
      'automate_manual_processes': {
        action: 'Automate manual processes',
        expectedImpact: '2-5% margin improvement',
        effort: 'high',
        quickWin: false
      },
      'implement_usage_based_pricing': {
        action: 'Implement usage-based pricing',
        expectedImpact: '12-22% LTV increase',
        effort: 'high',
        quickWin: false
      }
    };

    const rec = actionMap[action];
    if (rec) {
      // Determine priority based on risk and impact
      let priority: Recommendation['priority'] = 'medium';
      
      if (riskAnalysis.baseCase.roi > 2.5 && impact.confidence > 0.8) {
        priority = 'high';
      }
      if (riskAnalysis.downsideScenario.npv < 0) {
        priority = 'low';
      }
      if (rec.quickWin && impact.confidence > 0.7) {
        priority = 'high';
      }

      recommendations.push({
        priority,
        action: rec.action,
        expectedImpact: rec.expectedImpact,
        effort: rec.effort,
        quickWin: rec.quickWin,
        rationale: `Action ${action} shows ${rec.expectedImpact} with ${impact.confidence.toFixed(2)} confidence`,
        supportingEvidence: [impact.evidence]
      });
    }

    return recommendations;
  }

  // ============================================================================
  // SUMMARY CREATION
  // ============================================================================

  private async createSummary(
    request: BusinessCaseRequest,
    financialImpact: FinancialImpact,
    riskAnalysis: RiskAnalysis,
    recommendations: Recommendation[],
    auditTrail: AuditStep[]
  ): Promise<BusinessCaseSummary> {
    const step: AuditStep = {
      id: `summary-${Date.now()}`,
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
    const highRisks = riskAnalysis.keyRisks.filter(r => r.impact === 'high').length;
    
    if (highRisks >= 2) {
      riskLevel = 'high';
    } else if (highRisks === 1) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // Generate key insights
    const keyInsights: string[] = [];
    
    if (roi > 2.0) {
      keyInsights.push(`Strong ROI potential: ${roi.toFixed(1)}x return expected`);
    }
    
    if (financialImpact.netPresentValue > 0) {
      keyInsights.push(`Positive NPV: $${financialImpact.netPresentValue.toLocaleString()} value creation`);
    }
    
    if (paybackPeriod < 180) {
      keyInsights.push(`Fast payback: ${Math.round(paybackPeriod)} days to break even`);
    }
    
    if (riskLevel === 'high') {
      keyInsights.push('High risk profile - requires careful implementation');
    }
    
    if (recommendations.some(r => r.quickWin)) {
      keyInsights.push('Quick wins available - start with low-effort, high-impact actions');
    }

    const summary: BusinessCaseSummary = {
      title: request.scenarioName || `Business Case: ${request.selectedActions.join(', ')}`,
      description: `Comprehensive analysis for ${request.persona} in ${request.industry} industry, ${request.companySize} company size`,
      totalInvestment: financialImpact.totalCosts,
      totalReturn: financialImpact.totalBenefits,
      roi: roi,
      netPresentValue: financialImpact.netPresentValue,
      paybackPeriod: paybackPeriod,
      confidence: avgConfidence,
      riskLevel: riskLevel,
      keyInsights: keyInsights
    };

    step.outputs = summary;
    this.auditTrail.push(step);

    return summary;
  }

  // ============================================================================
  // EVIDENCE COMPILATION
  // ============================================================================

  private async compileEvidence(): Promise<EvidenceSummary[]> {
    const step: AuditStep = {
      id: `evidence-${Date.now()}`,
      timestamp: new Date().toISOString(),
      step: 'Compile Evidence',
      inputs: { evidenceCount: this.evidenceLog.length },
      outputs: {},
      confidence: 1.0,
      reasoning: 'Aggregating all evidence sources',
      sources: ['causal-truth', 'structural-truth']
    };

    // Group by source and quality
    const grouped: Map<string, EvidenceSummary> = new Map();

    for (const evidence of this.evidenceLog) {
      const key = `${evidence.source}-${evidence.quality}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          source: evidence.source,
          quality: evidence.quality,
          relevance: evidence.relevance,
          recency: evidence.recency,
          keyFindings: [...evidence.keyFindings]
        });
      } else {
        const existing = grouped.get(key)!;
        existing.relevance = Math.max(existing.relevance, evidence.relevance);
        existing.keyFindings.push(...evidence.keyFindings);
      }
    }

    const result = Array.from(grouped.values());
    step.outputs = { uniqueSources: result.length };
    this.auditTrail.push(step);

    return result;
  }

  // ============================================================================
  // FINAL VALIDATION
  // ============================================================================

  private async finalValidation(
    request: BusinessCaseRequest,
    summary: BusinessCaseSummary
  ): Promise<boolean> {
    const step: AuditStep = {
      id: `final-validation-${Date.now()}`,
      timestamp: new Date().toISOString(),
      step: 'Final Validation',
      inputs: { summary },
      outputs: {},
      confidence: 1.0,
      reasoning: 'Final compliance and quality check',
      sources: ['all-layers']
    };

    const issues: string[] = [];

    // Check confidence threshold
    const threshold = request.confidenceThreshold || 0.7;
    if (summary.confidence < threshold) {
      issues.push(`Confidence ${summary.confidence.toFixed(2)} below threshold ${threshold}`);
    }

    // Check for extreme values
    if (summary.roi > 10) {
      issues.push('ROI exceeds 10x - verify calculations');
    }

    if (summary.netPresentValue < 0 && summary.confidence > 0.8) {
      issues.push('Negative NPV with high confidence - recommend reconsideration');
    }

    // Check for missing data
    if (this.evidenceLog.length === 0) {
      issues.push('No evidence compiled - data quality concern');
    }

    step.outputs = {
      valid: issues.length === 0,
      issues,
      complianceScore: issues.length === 0 ? 1.0 : Math.max(0, 1.0 - (issues.length * 0.1))
    };

    this.auditTrail.push(step);

    return issues.length === 0;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private getCriticalKPIsForIndustry(industry: StructuralIndustry): string[] {
    const criticalMap: Record<StructuralIndustry, string[]> = {
      saas: ['saas_arr', 'saas_nrr', 'saas_cac', 'saas_ltv'],
      manufacturing: ['mfg_oee', 'mfg_throughput', 'mfg_cycle_time'],
      healthcare: ['hc_days_in_ar', 'hc_collection_rate', 'hc_operating_margin'],
      finance: ['fin_dso', 'fin_ccc', 'fin_cost_per_revenue'],
      retail: ['ret_sales_per_sqft', 'ret_conversion_rate', 'ret_gross_margin'],
      technology: ['tech_cycle_time', 'tech_uptime', 'tech_maintenance_ratio'],
      professional_services: ['fin_dso', 'fin_cost_per_revenue']
    };
    return criticalMap[industry] || [];
  }

  private getKPIName(kpiId: string): string {
    const kpi = this.structuralTruth.getGraph().nodes.find(n => n.id === kpiId);
    return kpi ? kpi.name : kpiId;
  }

  private getEvidenceQuality(evidence: string): 'anecdotal' | 'case_study' | 'research_paper' | 'meta_analysis' {
    if (evidence.includes('meta') || evidence.includes('study')) return 'meta_analysis';
    if (evidence.includes('research') || evidence.includes('paper')) return 'research_paper';
    if (evidence.includes('case')) return 'case_study';
    return 'anecdotal';
  }

  private checkBenchmarkAlignment(
    kpiId: string,
    projectedValue: number,
    benchmark: { p25: number; p50: number; p75: number }
  ): { aligned: boolean; percentile: string; warning?: string } {
    const isHigherBetter = this.getImprovementDirection(kpiId) === 'higher_is_better';

    // Simple percentile estimation
    let percentile = 'unknown';
    let aligned = true;
    let warning: string | undefined;

    if (isHigherBetter) {
      if (projectedValue >= benchmark.p75) {
        percentile = '75th+';
      } else if (projectedValue >= benchmark.p50) {
        percentile = '50th-75th';
      } else {
        percentile = '<50th';
      }

      if (projectedValue > benchmark.p75 * 1.5) {
        aligned = false;
        warning = 'Exceeds 75th percentile by 50% - verify assumptions';
      }
    } else {
      if (projectedValue <= benchmark.p75) {
        percentile = '75th+';
      } else if (projectedValue <= benchmark.p50) {
        percentile = '50th-75th';
      } else {
        percentile = '<50th';
      }

      if (projectedValue < benchmark.p25 * 0.5) {
        aligned = false;
        warning = 'Below 25th percentile by 50% - verify assumptions';
      }
    }

    return { aligned, percentile, warning };
  }

  private getImprovementDirection(kpiId: string): 'higher_is_better' | 'lower_is_better' {
    const kpi = this.structuralTruth.getGraph().nodes.find(n => n.id === kpiId);
    return kpi ? kpi.improvementDirection : 'higher_is_better';
  }

  private getDependentFormulas(kpiId: string) {
    const formulas = this.structuralTruth.getFormulaRegistry().getAllFormulas();
    return formulas.filter(f => f.input_kpis.includes(kpiId));
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

  private evaluateTimeCurve(curve: any, day: number, totalImpact: number): number {
    const t = day / (curve.timeToFullImpact || 180);
    
    switch (curve.type) {
      case 'sigmoid':
        const sigmoid = 1 / (1 + Math.exp(-10 * (t - 0.5)));
        return totalImpact * sigmoid * (1 / (curve.timeToFullImpact || 180));
      
      case 'linear':
        return totalImpact * (1 / (curve.timeToFullImpact || 180));
      
      case 'exponential_decay':
        return totalImpact * Math.exp(-3 * t) * 0.1;
      
      case 'step':
        const delay = curve.delay || 0;
        return day >= delay ? totalImpact / ((curve.timeToFullImpact || 180) - delay) : 0;
      
      default:
        return 0;
    }
  }

  private calculateNPV(timeline: TimelineEvent[], totalBenefits: number, totalCosts: number): number {
    const discountRate = 0.10;
    let npv = -totalCosts;

    for (const event of timeline) {
      const year = event.day / 365;
      const discountFactor = Math.pow(1 + discountRate, -year);
      npv += event.cumulativeImpact * discountFactor;
    }

    return npv;
  }

  private calculateIRR(timeline: TimelineEvent[], totalBenefits: number, totalCosts: number): number {
    const targetNPV = 0;
    let low = 0;
    let high = 1;

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

  private calculateFinancialSensitivity(
    timeline: TimelineEvent[],
    totalBenefits: number,
    totalCosts: number
  ): FinancialSensitivity {
    const baseNPV = this.calculateNPV(timeline, totalBenefits, totalCosts);
    const baseROI = baseNPV / totalCosts;

    // Downside (80% of base)
    const downsideNPV = baseNPV * 0.8;
    const downsideROI = downsideNPV / totalCosts;

    // Upside (120% of base)
    const upsideNPV = baseNPV * 1.2;
    const upsideROI = upsideNPV / totalCosts;

    return {
      downside: { npv: downsideNPV, roi: downsideROI },
      baseCase: { npv: baseNPV, roi: baseROI },
      upside: { npv: upsideNPV, roi: upsideROI }
    };
  }

  private extractDataSources(): string[] {
    const sources = new Set<string>();
    
    this.evidenceLog.forEach(evidence => {
      if (evidence.source.includes('EDGAR')) sources.add('SEC EDGAR');
      if (evidence.source.includes('OpenView')) sources.add('OpenView SaaS Benchmarks');
      if (evidence.source.includes('Bessemer')) sources.add('Bessemer Cloud Index');
      if (evidence.source.includes('Gainsight')) sources.add('Gainsight Research');
      if (evidence.source.includes('APQC')) sources.add('APQC Benchmarks');
      if (evidence.source.includes('DORA')) sources.add('DORA Research');
    });

    return Array.from(sources);
  }
}

// ============================================================================
// MCP TOOLS FOR BUSINESS CASE GENERATION
// ============================================================================

export const BusinessCaseTools = {
  /**
   * Generate comprehensive business case
   */
  generate_business_case: {
    description: 'Generate comprehensive business case combining metric, structural, and causal truth with full audit trail',
    inputSchema: {
      type: 'object',
      properties: {
        persona: { type: 'string', enum: ['cfo', 'cio', 'cto', 'coo', 'vp_sales', 'vp_ops', 'vp_engineering', 'director_finance', 'data_analyst'] },
        industry: { type: 'string', enum: ['saas', 'manufacturing', 'healthcare', 'finance', 'retail', 'technology', 'professional_services'] },
        companySize: { type: 'string', enum: ['startup', 'scaleup', 'enterprise'] },
        annualRevenue: { type: 'number' },
        currentKPIs: { type: 'object' },
        selectedActions: { 
          type: 'array', 
          items: { type: 'string' }
        },
        timeframe: { type: 'string', enum: ['30d', '90d', '180d', '365d'] },
        confidenceThreshold: { type: 'number', minimum: 0, maximum: 1 },
        scenarioName: { type: 'string' }
      },
      required: ['persona', 'industry', 'companySize', 'annualRevenue', 'currentKPIs', 'selectedActions', 'timeframe']
    }
  },

  /**
   * Get audit trail for business case
   */
  get_audit_trail: {
    description: 'Get detailed audit trail showing all reasoning steps and validation',
    inputSchema: {
      type: 'object',
      properties: {
        businessCaseId: { type: 'string' },
        detailLevel: { type: 'string', enum: ['summary', 'detailed', 'full'] }
      },
      required: ['businessCaseId']
    }
  },

  /**
   * Compare multiple scenarios
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
              persona: { type: 'string', enum: ['cfo', 'cio', 'cto', 'coo', 'vp_sales', 'vp_ops', 'vp_engineering', 'director_finance', 'data_analyst'] },
              industry: { type: 'string', enum: ['saas', 'manufacturing', 'healthcare', 'finance', 'retail', 'technology', 'professional_services'] },
              companySize: { type: 'string', enum: ['startup', 'scaleup', 'enterprise'] },
              annualRevenue: { type: 'number' },
              currentKPIs: { type: 'object' },
              selectedActions: { type: 'array', items: { type: 'string' } },
              timeframe: { type: 'string', enum: ['30d', '90d', '180d', '365d'] }
            },
            required: ['name', 'persona', 'industry', 'companySize', 'annualRevenue', 'currentKPIs', 'selectedActions', 'timeframe']
          }
        }
      },
      required: ['scenarios']
    }
  },

  /**
   * Get risk analysis
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
   * Get recommendations
   */
  get_recommendations: {
    description: 'Get prioritized recommendations for business case implementation',
    inputSchema: {
      type: 'object',
      properties: {
        businessCaseId: { type: 'string' },
        priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] }
      },
      required: ['businessCaseId']
    }
  }
};
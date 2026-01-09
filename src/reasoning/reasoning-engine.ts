/**
 * Reasoning Engine
 * 
 * Orchestrates the decision-making process for business case generation:
 * - Strategic reasoning based on persona and industry
 * - Multi-step logical inference
 * - Evidence-based recommendations
 * - Confidence scoring and uncertainty handling
 * 
 * Part of Phase 3 - Integration & Business Case Generation
 */

import { StructuralTruth } from '../structural/structural-truth';
import CausalTruth from '../causal/causal-truth-enhanced';
import { BusinessAction } from '../causal/causal-truth';
import { 
  StructuralIndustry,
  StructuralKPINode,
  StructuralPersona
} from '../types/structural-truth';

// ============================================================================
// REASONING TYPES
// ============================================================================

export interface ReasoningRequest {
  persona: StructuralPersona;
  industry: StructuralIndustry;
  companySize: 'startup' | 'scaleup' | 'enterprise';
  currentKPIs: Record<string, number>;
  goals: string[];
  constraints: ReasoningConstraints;
}

export interface ReasoningConstraints {
  maxInvestment?: number;
  maxTime?: number; // days
  minROI?: number;
  riskTolerance?: 'low' | 'medium' | 'high';
  preferredQuickWins?: boolean;
}

export interface ReasoningResult {
  strategy: Strategy;
  recommendedActions: RecommendedAction[];
  reasoningChain: ReasoningStep[];
  confidence: number;
  evidence: Evidence[];
  alternatives: Alternative[];
}

export interface Strategy {
  name: string;
  description: string;
  rationale: string;
  expectedOutcome: string;
  priority: 'immediate' | 'short-term' | 'medium-term' | 'long-term';
}

export interface RecommendedAction {
  action: BusinessAction;
  description: string;
  expectedImpact: string;
  confidence: number;
  effort: 'low' | 'medium' | 'high';
  quickWin: boolean;
  prerequisites: string[];
  risks: string[];
  mitigation: string[];
}

export interface ReasoningStep {
  id: string;
  type: 'analysis' | 'inference' | 'evaluation' | 'decision';
  description: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  confidence: number;
  evidence: string[];
  timestamp: string;
}

export interface Evidence {
  source: string;
  type: 'data' | 'research' | 'expert_opinion' | 'historical';
  relevance: number;
  strength: number;
  description: string;
}

export interface Alternative {
  name: string;
  actions: BusinessAction[];
  expectedROI: number;
  riskLevel: string;
  description: string;
}

// ============================================================================
// REASONING ENGINE
// ============================================================================

export class ReasoningEngine {
  private structuralTruth: StructuralTruth;
  private causalTruth: CausalTruth;
  private reasoningChain: ReasoningStep[] = [];

  constructor(
    structuralTruth: StructuralTruth,
    causalTruth: CausalTruth
  ) {
    this.structuralTruth = structuralTruth;
    this.causalTruth = causalTruth;
  }

  /**
   * Generate strategic reasoning and recommendations
   */
  async generateRecommendations(request: ReasoningRequest): Promise<ReasoningResult> {
    this.reasoningChain = [];
    
    const startTime = Date.now();

    try {
      // Step 1: Analyze current state
      const analysisStep = await this.analyzeCurrentState(request);
      
      // Step 2: Identify strategic priorities
      const priorityStep = await this.identifyPriorities(request, analysisStep);
      
      // Step 3: Generate candidate actions
      const candidateStep = await this.generateCandidates(request, priorityStep);
      
      // Step 4: Evaluate and filter candidates
      const evaluationStep = await this.evaluateCandidates(request, candidateStep);
      
      // Step 5: Build reasoning chain
      const strategy = await this.buildStrategy(request, evaluationStep);
      
      // Step 6: Generate alternatives
      const alternatives = await this.generateAlternatives(request, strategy);
      
      // Step 7: Compile final result
      const result = await this.compileResult(request, strategy, alternatives);

      return result;

    } catch (error) {
      const errorStep: ReasoningStep = {
        id: `error-${Date.now()}`,
        type: 'evaluation',
        description: 'Reasoning failed',
        inputs: { request },
        outputs: { error: error instanceof Error ? error.message : 'Unknown error' },
        confidence: 0,
        evidence: [],
        timestamp: new Date().toISOString()
      };
      
      this.reasoningChain.push(errorStep);
      
      throw error;
    }
  }

  // ============================================================================
  // STEP 1: ANALYZE CURRENT STATE
  // ============================================================================

  private async analyzeCurrentState(request: ReasoningRequest): Promise<ReasoningStep> {
    const step: ReasoningStep = {
      id: `analysis-${Date.now()}`,
      type: 'analysis',
      description: 'Analyze current state and identify gaps',
      inputs: {
        persona: request.persona,
        industry: request.industry,
        companySize: request.companySize,
        currentKPIs: request.currentKPIs,
        goals: request.goals
      },
      outputs: {},
      confidence: 0.9,
      evidence: [],
      timestamp: new Date().toISOString()
    };

    const insights: string[] = [];
    const gaps: string[] = [];
    const strengths: string[] = [];

    // Get persona-specific KPIs
    const personaKPIs = this.structuralTruth.getKPIsForPersona(request.persona);
    
    // Check for missing critical KPIs
    for (const kpi of personaKPIs) {
      if (request.currentKPIs[kpi.id] === undefined) {
        gaps.push(`Missing critical KPI: ${kpi.name}`);
      } else {
        // Check against benchmarks
        const benchmark = this.structuralTruth.getKPIBenchmark(kpi.id, request.persona);
        if (benchmark) {
          const value = request.currentKPIs[kpi.id];
          const isHigherBetter = kpi.improvementDirection === 'higher_is_better';
          
          if (isHigherBetter) {
            if (value < benchmark.p25) {
              gaps.push(`${kpi.name} (${value}) is below 25th percentile (${benchmark.p25})`);
            } else if (value >= benchmark.p75) {
              strengths.push(`${kpi.name} (${value}) is at or above 75th percentile (${benchmark.p75})`);
            }
          } else {
            if (value > benchmark.p75) {
              gaps.push(`${kpi.name} (${value}) is above 75th percentile (${benchmark.p75})`);
            } else if (value <= benchmark.p25) {
              strengths.push(`${kpi.name} (${value}) is at or below 25th percentile (${benchmark.p25})`);
            }
          }
        }
      }
    }

    // Analyze goals
    for (const goal of request.goals) {
      insights.push(`Goal identified: ${goal}`);
    }

    // Check constraints
    if (request.constraints.maxInvestment) {
      insights.push(`Investment constraint: $${request.constraints.maxInvestment.toLocaleString()}`);
    }
    
    if (request.constraints.maxTime) {
      insights.push(`Time constraint: ${request.constraints.maxTime} days`);
    }

    step.outputs = {
      gaps,
      strengths,
      insights,
      gapCount: gaps.length,
      strengthCount: strengths.length
    };

    step.evidence = [
      ...gaps.map(g => `Gap: ${g}`),
      ...strengths.map(s => `Strength: ${s}`),
      ...insights.map(i => `Insight: ${i}`)
    ];

    this.reasoningChain.push(step);
    return step;
  }

  // ============================================================================
  // STEP 2: IDENTIFY STRATEGIC PRIORITIES
  // ============================================================================

  private async identifyPriorities(
    request: ReasoningRequest,
    analysisStep: ReasoningStep
  ): Promise<ReasoningStep> {
    const step: ReasoningStep = {
      id: `priorities-${Date.now()}`,
      type: 'inference',
      description: 'Identify strategic priorities based on gaps and goals',
      inputs: {
        gaps: analysisStep.outputs.gaps,
        strengths: analysisStep.outputs.strengths,
        goals: request.goals
      },
      outputs: {},
      confidence: 0.85,
      evidence: [],
      timestamp: new Date().toISOString()
    };

    const priorities: string[] = [];
    const strategicThemes: string[] = [];

    // Analyze gaps for priority
    const gaps = analysisStep.outputs.gaps as string[];
    
    // Categorize gaps
    const revenueGaps = gaps.filter(g => 
      g.toLowerCase().includes('revenue') || 
      g.toLowerCase().includes('arr') || 
      g.toLowerCase().includes('nrr')
    );
    
    const efficiencyGaps = gaps.filter(g => 
      g.toLowerCase().includes('cost') || 
      g.toLowerCase().includes('margin') || 
      g.toLowerCase().includes('efficiency')
    );
    
    const retentionGaps = gaps.filter(g => 
      g.toLowerCase().includes('churn') || 
      g.toLowerCase().includes('retention')
    );

    // Prioritize based on persona
    switch (request.persona) {
      case 'cfo':
        if (efficiencyGaps.length > 0) {
          priorities.push('Cost optimization and efficiency improvement');
          strategicThemes.push('Operational Efficiency');
        }
        if (revenueGaps.length > 0) {
          priorities.push('Revenue growth with strong ROI');
          strategicThemes.push('Revenue Growth');
        }
        break;

      case 'vp_sales':
        if (revenueGaps.length > 0) {
          priorities.push('Pipeline and conversion optimization');
          strategicThemes.push('Sales Excellence');
        }
        if (retentionGaps.length > 0) {
          priorities.push('Customer retention and expansion');
          strategicThemes.push('Customer Success');
        }
        break;

      case 'cto':
        if (efficiencyGaps.length > 0) {
          priorities.push('Technical debt reduction and automation');
          strategicThemes.push('Technical Excellence');
        }
        if (revenueGaps.length > 0) {
          priorities.push('Product-led growth initiatives');
          strategicThemes.push('Product Innovation');
        }
        break;

      case 'coo':
        if (efficiencyGaps.length > 0) {
          priorities.push('Process optimization and throughput');
          strategicThemes.push('Operational Excellence');
        }
        if (retentionGaps.length > 0) {
          priorities.push('Quality and reliability improvement');
          strategicThemes.push('Quality Management');
        }
        break;

      default:
        // Generic prioritization
        if (revenueGaps.length >= efficiencyGaps.length && revenueGaps.length >= retentionGaps.length) {
          priorities.push('Revenue growth initiatives');
          strategicThemes.push('Growth Strategy');
        } else if (efficiencyGaps.length >= retentionGaps.length) {
          priorities.push('Efficiency and cost optimization');
          strategicThemes.push('Cost Leadership');
        } else {
          priorities.push('Customer retention and satisfaction');
          strategicThemes.push('Customer Focus');
        }
    }

    // Apply constraints
    if (request.constraints.preferredQuickWins) {
      priorities.push('Focus on quick wins with low effort, high impact');
      strategicThemes.push('Quick Wins');
    }

    if (request.constraints.riskTolerance === 'low') {
      priorities.push('Prioritize low-risk, proven strategies');
      strategicThemes.push('Risk Mitigation');
    }

    step.outputs = {
      priorities,
      strategicThemes,
      priorityCount: priorities.length
    };

    step.evidence = [
      ...priorities.map(p => `Priority: ${p}`),
      ...strategicThemes.map(t => `Theme: ${t}`)
    ];

    this.reasoningChain.push(step);
    return step;
  }

  // ============================================================================
  // STEP 3: GENERATE CANDIDATE ACTIONS
  // ============================================================================

  private async generateCandidates(
    request: ReasoningRequest,
    priorityStep: ReasoningStep
  ): Promise<ReasoningStep> {
    const step: ReasoningStep = {
      id: `candidates-${Date.now()}`,
      type: 'inference',
      description: 'Generate candidate business actions',
      inputs: {
        priorities: priorityStep.outputs.priorities,
        themes: priorityStep.outputs.strategicThemes
      },
      outputs: {},
      confidence: 0.8,
      evidence: [],
      timestamp: new Date().toISOString()
    };

    const candidates: BusinessAction[] = [];
    const reasoning: string[] = [];

    // Get all available actions
    const allActions = this.causalTruth.getAvailableActions();

    // Filter based on priorities and constraints
    for (const action of allActions) {
      // Check if action aligns with priorities
      const actionImpact = this.causalTruth.getImpactForAction(
        action,
        request.persona,
        request.industry,
        request.companySize
      );

      if (!actionImpact) continue;

      // Check constraints
      let passesConstraints = true;
      const reasons: string[] = [];

      if (request.constraints.maxTime) {
        const timeToImpact = actionImpact.timeCurve.timeToFirstImpact;
        if (timeToImpact > request.constraints.maxTime) {
          passesConstraints = false;
          reasons.push(`Time to impact (${timeToImpact}d) exceeds constraint (${request.constraints.maxTime}d)`);
        }
      }

      if (request.constraints.minROI) {
        // Estimate ROI from impact
        const estimatedROI = this.estimateROI(actionImpact, request);
        if (estimatedROI < request.constraints.minROI) {
          passesConstraints = false;
          reasons.push(`Estimated ROI (${estimatedROI.toFixed(1)}x) below minimum (${request.constraints.minROI}x)`);
        }
      }

      // Check risk tolerance
      if (request.constraints.riskTolerance === 'low' && actionImpact.confidence < 0.7) {
        passesConstraints = false;
        reasons.push(`Confidence (${actionImpact.confidence.toFixed(2)}) too low for low risk tolerance`);
      }

      // Check quick win preference
      const isQuickWin = actionImpact.timeCurve.timeToFirstImpact <= 30;
      if (request.constraints.preferredQuickWins && !isQuickWin) {
        reasons.push('Not a quick win (takes >30 days)');
        // Still include but deprioritize
      }

      if (passesConstraints || reasons.length > 0) {
        candidates.push(action);
        if (reasons.length > 0) {
          reasoning.push(`${action}: ${reasons.join(', ')}`);
        } else {
          reasoning.push(`${action}: Aligns with priorities and constraints`);
        }
      }
    }

    step.outputs = {
      candidates,
      candidateCount: candidates.length,
      reasoning
    };

    step.evidence = reasoning;

    this.reasoningChain.push(step);
    return step;
  }

  // ============================================================================
  // STEP 4: EVALUATE AND FILTER CANDIDATES
  // ============================================================================

  private async evaluateCandidates(
    request: ReasoningRequest,
    candidateStep: ReasoningStep
  ): Promise<ReasoningStep> {
    const step: ReasoningStep = {
      id: `evaluation-${Date.now()}`,
      type: 'evaluation',
      description: 'Evaluate and rank candidate actions',
      inputs: {
        candidates: candidateStep.outputs.candidates
      },
      outputs: {},
      confidence: 0.9,
      evidence: [],
      timestamp: new Date().toISOString()
    };

    const candidates = candidateStep.outputs.candidates as BusinessAction[];
    const scored: Array<{
      action: BusinessAction;
      score: number;
      breakdown: Record<string, number>;
      impact: any;
    }> = [];

    for (const action of candidates) {
      const impact = this.causalTruth.getImpactForAction(
        action,
        request.persona,
        request.industry,
        request.companySize
      );

      if (!impact) continue;

      // Calculate composite score
      const breakdown: Record<string, number> = {};
      
      // Confidence score (30%)
      breakdown.confidence = impact.confidence * 0.3;
      
      // Impact score (40%)
      const totalImpact = Object.values(impact.impact).reduce((sum, dist) => sum + dist.p50, 0);
      breakdown.impact = Math.min(totalImpact * 10, 1) * 0.4; // Normalize
      
      // Speed score (20%)
      const speed = 1 / (impact.timeCurve.timeToFirstImpact / 30); // 30 days = 1.0
      breakdown.speed = Math.min(speed, 1) * 0.2;
      
      // Alignment score (10%)
      breakdown.alignment = this.calculateAlignment(action, request) * 0.1;

      const totalScore = Object.values(breakdown).reduce((sum, s) => sum + s, 0);

      scored.push({
        action,
        score: totalScore,
        breakdown,
        impact
      });
    }

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Take top candidates
    const topCandidates = scored.slice(0, 5);

    step.outputs = {
      rankedCandidates: topCandidates.map(c => ({
        action: c.action,
        score: c.score,
        breakdown: c.breakdown
      })),
      topCandidate: topCandidates[0]?.action,
      averageScore: scored.reduce((sum, c) => sum + c.score, 0) / scored.length
    };

    step.evidence = topCandidates.map(c => 
      `${c.action}: Score ${c.score.toFixed(2)} (Conf: ${c.impact.confidence.toFixed(2)}, Impact: ${Object.values(c.impact.impact).reduce((s, d) => s + d.p50, 0).toFixed(2)})`
    );

    this.reasoningChain.push(step);
    return step;
  }

  // ============================================================================
  // STEP 5: BUILD STRATEGY
  // ============================================================================

  private async buildStrategy(
    request: ReasoningRequest,
    evaluationStep: ReasoningStep
  ): Promise<Strategy> {
    const step: ReasoningStep = {
      id: `strategy-${Date.now()}`,
      type: 'decision',
      description: 'Build comprehensive strategy',
      inputs: {
        topCandidate: evaluationStep.outputs.topCandidate,
        rankedCandidates: evaluationStep.outputs.rankedCandidates
      },
      outputs: {},
      confidence: 0.85,
      evidence: [],
      timestamp: new Date().toISOString()
    };

    const topCandidate = evaluationStep.outputs.topCandidate as BusinessAction;
    const rankedCandidates = evaluationStep.outputs.rankedCandidates as Array<{action: BusinessAction, score: number}>;

    // Build strategy based on top candidate and persona
    let strategy: Strategy;

    switch (request.persona) {
      case 'cfo':
        strategy = {
          name: 'Financial Optimization Strategy',
          description: `Focus on cost efficiency and ROI-driven investments starting with ${this.formatAction(topCandidate)}`,
          rationale: 'CFO priority is maximizing shareholder value through disciplined capital allocation',
          expectedOutcome: 'Improved margins and cash flow with measurable ROI within 6 months',
          priority: 'short-term'
        };
        break;

      case 'vp_sales':
        strategy = {
          name: 'Revenue Acceleration Strategy',
          description: `Drive growth through sales excellence and customer expansion starting with ${this.formatAction(topCandidate)}`,
          rationale: 'VP Sales focuses on pipeline velocity and conversion optimization',
          expectedOutcome: '20-30% increase in qualified pipeline and improved win rates',
          priority: 'immediate'
        };
        break;

      case 'cto':
        strategy = {
          name: 'Technical Excellence Strategy',
          description: `Enable growth through technical debt reduction and automation starting with ${this.formatAction(topCandidate)}`,
          rationale: 'CTO prioritizes scalable architecture and developer productivity',
          expectedOutcome: '50% reduction in technical debt and faster time-to-market',
          priority: 'medium-term'
        };
        break;

      case 'coo':
        strategy = {
          name: 'Operational Excellence Strategy',
          description: `Optimize processes and throughput starting with ${this.formatAction(topCandidate)}`,
          rationale: 'COO focuses on operational efficiency and quality improvement',
          expectedOutcome: '25% improvement in cycle time and 15% cost reduction',
          priority: 'short-term'
        };
        break;

      default:
        strategy = {
          name: 'Balanced Growth Strategy',
          description: `Comprehensive approach starting with ${this.formatAction(topCandidate)}`,
          rationale: 'Balanced approach considering multiple stakeholder needs',
          expectedOutcome: 'Sustainable growth with managed risk',
          priority: 'short-term'
        };
    }

    step.outputs = { strategy };
    step.evidence = [`Strategy: ${strategy.name}`, `Rationale: ${strategy.rationale}`];

    this.reasoningChain.push(step);
    return strategy;
  }

  // ============================================================================
  // STEP 6: GENERATE RECOMMENDED ACTIONS
  // ============================================================================

  private async compileResult(
    request: ReasoningRequest,
    strategy: Strategy,
    alternatives: Alternative[]
  ): Promise<ReasoningResult> {
    const evaluationStep = this.reasoningChain[this.reasoningChain.length - 2]; // Get evaluation step
    const rankedCandidates = evaluationStep.outputs.rankedCandidates as Array<{action: BusinessAction, score: number, breakdown: any, impact: any}>;

    // Convert to recommended actions
    const recommendedActions: RecommendedAction[] = rankedCandidates.slice(0, 3).map((candidate, index) => {
      const impact = candidate.impact;
      const isQuickWin = impact.timeCurve.timeToFirstImpact <= 30;
      
      return {
        action: candidate.action,
        description: this.getActionDescription(candidate.action),
        expectedImpact: this.formatImpact(impact),
        confidence: impact.confidence,
        effort: this.estimateEffort(candidate.action),
        quickWin: isQuickWin,
        prerequisites: this.getPrerequisites(candidate.action),
        risks: this.getRisks(candidate.action),
        mitigation: this.getMitigation(candidate.action)
      };
    });

    // Calculate overall confidence
    const avgConfidence = recommendedActions.reduce((sum, a) => sum + a.confidence, 0) / recommendedActions.length;

    // Compile evidence
    const evidence: Evidence[] = this.compileEvidence();

    const result: ReasoningResult = {
      strategy,
      recommendedActions,
      reasoningChain: this.reasoningChain,
      confidence: avgConfidence,
      evidence,
      alternatives
    };

    return result;
  }

  // ============================================================================
  // STEP 7: GENERATE ALTERNATIVES
  // ============================================================================

  private async generateAlternatives(
    request: ReasoningRequest,
    strategy: Strategy
  ): Promise<Alternative[]> {
    const alternatives: Alternative[] = [];

    // Get all candidates from evaluation step
    const evaluationStep = this.reasoningChain.find(s => s.type === 'evaluation');
    if (!evaluationStep) return [];

    const rankedCandidates = evaluationStep.outputs.rankedCandidates as Array<{action: BusinessAction, score: number}>;
    
    if (rankedCandidates.length < 2) return [];

    // Alternative 1: Quick wins focus
    const quickWins = rankedCandidates
      .filter(c => {
        const impact = this.causalTruth.getImpactForAction(
          c.action,
          request.persona,
          request.industry,
          request.companySize
        );
        return impact && impact.timeCurve.timeToFirstImpact <= 30;
      })
      .slice(0, 3);

    if (quickWins.length > 0) {
      const roi = quickWins.reduce((sum, c) => {
        const impact = this.causalTruth.getImpactForAction(
          c.action,
          request.persona,
          request.industry,
          request.companySize
        );
        return sum + (impact ? this.estimateROI(impact, request) : 0);
      }, 0) / quickWins.length;

      alternatives.push({
        name: 'Quick Wins Strategy',
        actions: quickWins.map(c => c.action),
        expectedROI: roi,
        riskLevel: 'low',
        description: 'Focus on low-effort, high-impact actions for immediate results'
      });
    }

    // Alternative 2: High impact focus
    const highImpact = rankedCandidates.slice(0, 3);
    if (highImpact.length > 0) {
      const roi = highImpact.reduce((sum, c) => {
        const impact = this.causalTruth.getImpactForAction(
          c.action,
          request.persona,
          request.industry,
          request.companySize
        );
        return sum + (impact ? this.estimateROI(impact, request) : 0);
      }, 0) / highImpact.length;

      alternatives.push({
        name: 'Maximum Impact Strategy',
        actions: highImpact.map(c => c.action),
        expectedROI: roi,
        riskLevel: 'medium',
        description: 'Focus on highest impact actions regardless of effort'
      });
    }

    // Alternative 3: Balanced approach
    if (rankedCandidates.length >= 4) {
      const balanced = [rankedCandidates[0], rankedCandidates[2]]; // Skip second for balance
      const roi = balanced.reduce((sum, c) => {
        const impact = this.causalTruth.getImpactForAction(
          c.action,
          request.persona,
          request.industry,
          request.companySize
        );
        return sum + (impact ? this.estimateROI(impact, request) : 0);
      }, 0) / balanced.length;

      alternatives.push({
        name: 'Balanced Portfolio',
        actions: balanced.map(c => c.action),
        expectedROI: roi,
        riskLevel: 'medium',
        description: 'Mix of quick wins and strategic investments'
      });
    }

    return alternatives;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private estimateROI(impact: any, request: ReasoningRequest): number {
    // Simplified ROI estimation
    const totalImpact = Object.values(impact.impact).reduce((sum: number, dist: any) => sum + dist.p50, 0);
    const annualRevenue = request.currentKPIs['saas_arr'] || request.currentKPIs['arr'] || request.currentKPIs['revenue'] || 1000000;
    
    // Assume costs are 20% of impact for estimation
    const estimatedCost = totalImpact * annualRevenue * 0.2;
    const estimatedReturn = totalImpact * annualRevenue;
    
    return estimatedReturn / Math.max(estimatedCost, 1);
  }

  private calculateAlignment(action: BusinessAction, request: ReasoningRequest): number {
    // Check if action aligns with persona priorities
    const personaPriorities: Record<StructuralPersona, string[]> = {
      cfo: ['cost', 'efficiency', 'margin', 'roi'],
      vp_sales: ['revenue', 'pipeline', 'conversion', 'win'],
      cto: ['technical', 'automation', 'quality', 'speed'],
      coo: ['process', 'throughput', 'quality', 'efficiency'],
      vp_engineering: ['technical', 'quality', 'speed', 'automation'],
      vp_ops: ['process', 'efficiency', 'quality', 'cost'],
      director_finance: ['cost', 'efficiency', 'accuracy', 'close'],
      data_analyst: ['accuracy', 'speed', 'quality', 'automation'],
      ct: ['technical', 'architecture', 'scale', 'reliability']
    };

    const actionStr = action.toLowerCase();
    const priorities = personaPriorities[request.persona] || [];
    
    const matches = priorities.filter(p => actionStr.includes(p)).length;
    return Math.min(matches / priorities.length, 1);
  }

  private getActionDescription(action: BusinessAction): string {
    const descriptions: Record<BusinessAction, string> = {
      'price_increase_5pct': 'Implement 5% price increase across customer base',
      'price_decrease_5pct': 'Reduce prices by 5% to drive volume',
      'freemium_to_paid': 'Convert freemium users to paid tier',
      'annual_commitment_discount': 'Offer annual discounts for commitment',
      'increase_sales_team_20pct': 'Expand sales team by 20%',
      'double_marketing_spend': 'Double marketing investment',
      'launch_abm_campaign': 'Launch account-based marketing campaign',
      'implement_lead_scoring': 'Implement lead scoring system',
      'reduce_pricing_tiers': 'Simplify pricing structure',
      'add_self_service_onboarding': 'Add self-service onboarding',
      'improve_page_load_50pct': 'Improve page load time by 50%',
      'launch_new_feature_category': 'Launch new feature category',
      'implement_health_scoring': 'Implement customer health scoring',
      'increase_csm_ratio_2x': 'Double customer success manager ratio',
      'launch_customer_education': 'Launch customer education program',
      'proactive_churn_intervention': 'Proactive churn intervention program',
      'automate_manual_processes': 'Automate manual processes',
      'reduce_support_ticket_time': 'Reduce support ticket resolution time',
      'implement_usage_based_pricing': 'Implement usage-based pricing',
      'expand_to_new_vertical': 'Expand to new vertical market'
    };

    return descriptions[action] || action;
  }

  private formatAction(action: BusinessAction): string {
    return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  private formatImpact(impact: any): string {
    const total = Object.values(impact.impact).reduce((sum: number, dist: any) => sum + dist.p50, 0);
    const confidence = impact.confidence;
    return `${(total * 100).toFixed(1)}% impact with ${(confidence * 100).toFixed(0)}% confidence`;
  }

  private estimateEffort(action: BusinessAction): 'low' | 'medium' | 'high' {
    const highEffort = ['increase_sales_team_20pct', 'double_marketing_spend', 'automate_manual_processes', 'implement_usage_based_pricing', 'expand_to_new_vertical'];
    const mediumEffort = ['launch_abm_campaign', 'implement_lead_scoring', 'launch_new_feature_category', 'increase_csm_ratio_2x'];
    
    if (highEffort.includes(action)) return 'high';
    if (mediumEffort.includes(action)) return 'medium';
    return 'low';
  }

  private getPrerequisites(action: BusinessAction): string[] {
    const prerequisites: Record<BusinessAction, string[]> = {
      'price_increase_5pct': ['Clear value proposition', 'Established product-market fit'],
      'increase_sales_team_20pct': ['Adequate pipeline', 'Onboarding process'],
      'double_marketing_spend': ['Scalable channels', 'Good creative'],
      'automate_manual_processes': ['Process documentation', 'Automation tools'],
      'implement_usage_based_pricing': ['Usage tracking', 'Customer acceptance'],
      'expand_to_new_vertical': ['Market research', 'Product fit'],
      'add_self_service_onboarding': ['Good documentation', 'Support backup'],
      'implement_health_scoring': ['Reliable data sources', 'Actionable insights'],
      'launch_abm_campaign': ['Target account list', 'Content ready'],
      'implement_lead_scoring': ['CRM integration', 'Historical data'],
      'launch_new_feature_category': ['Development capacity', 'Market demand'],
      'increase_csm_ratio_2x': ['Trained CSMs', 'Expansion opportunities'],
      'launch_customer_education': ['Content creation', 'Platform ready'],
      'proactive_churn_intervention': ['Health scoring', 'Outreach process'],
      'reduce_support_ticket_time': ['Process optimization', 'Tooling'],
      'freemium_to_paid': ['Product value proven', 'Conversion funnel'],
      'annual_commitment_discount': ['Customer base', 'Finance approval'],
      'price_decrease_5pct': ['Competitive analysis', 'Margin room'],
      'reduce_pricing_tiers': ['Customer feedback', 'Simplicity goal']
    };

    return prerequisites[action] || [];
  }

  private getRisks(action: BusinessAction): string[] {
    const risks: Record<BusinessAction, string[]> = {
      'price_increase_5pct': ['Customer churn increase', 'Competitive pressure'],
      'increase_sales_team_20pct': ['Hiring quality', 'Onboarding delays'],
      'double_marketing_spend': ['Channel saturation', 'CAC increase'],
      'automate_manual_processes': ['Implementation complexity', 'Change resistance'],
      'implement_usage_based_pricing': ['Revenue predictability', 'Customer confusion'],
      'expand_to_new_vertical': ['Market misalignment', 'Resource drain'],
      'add_self_service_onboarding': ['Support overload', 'User frustration'],
      'implement_health_scoring': ['Data quality', 'False positives'],
      'launch_abm_campaign': ['Account selection', 'Content quality'],
      'implement_lead_scoring': ['Model accuracy', 'Sales alignment'],
      'launch_new_feature_category': ['Development delays', 'Low adoption'],
      'increase_csm_ratio_2x': ['Cost increase', 'Quality maintenance'],
      'launch_customer_education': ['Engagement low', 'Content quality'],
      'proactive_churn_intervention': ['False alarms', 'Customer annoyance'],
      'reduce_support_ticket_time': ['Quality tradeoff', 'Tooling cost'],
      'freemium_to_paid': ['Conversion low', 'Support burden'],
      'annual_commitment_discount': ['Revenue deferral', 'Lock-in risk'],
      'price_decrease_5pct': ['Margin erosion', 'Brand perception'],
      'reduce_pricing_tiers': ['Customer confusion', 'Revenue impact']
    };

    return risks[action] || ['Implementation risk', 'Adoption risk'];
  }

  private getMitigation(action: BusinessAction): string[] {
    const mitigations: Record<BusinessAction, string[]> = {
      'price_increase_5pct': ['Phased rollout', 'Grandfather existing'],
      'increase_sales_team_20pct': ['Quality hiring process', 'Structured onboarding'],
      'double_marketing_spend': ['Channel testing', 'Performance monitoring'],
      'automate_manual_processes': ['Pilot program', 'Change management'],
      'implement_usage_based_pricing': ['Customer communication', 'Migration plan'],
      'expand_to_new_vertical': ['Market validation', 'Pilot program'],
      'add_self_service_onboarding': ['Support scaling', 'User testing'],
      'implement_health_scoring': ['Data validation', 'Regular calibration'],
      'launch_abm_campaign': ['Account validation', 'Content testing'],
      'implement_lead_scoring': ['Model validation', 'Sales training'],
      'launch_new_feature_category': ['Beta testing', 'Phased rollout'],
      'increase_csm_ratio_2x': ['Quality metrics', 'Training program'],
      'launch_customer_education': ['Engagement tracking', 'Content updates'],
      'proactive_churn_intervention': ['Threshold tuning', 'A/B testing'],
      'reduce_support_ticket_time': ['Quality monitoring', 'Process refinement'],
      'freemium_to_paid': ['Conversion optimization', 'Support scaling'],
      'annual_commitment_discount': ['Customer selection', 'Clear terms'],
      'price_decrease_5pct': ['Margin analysis', 'Competitive monitoring'],
      'reduce_pricing_tiers': ['Customer communication', 'Revenue monitoring']
    };

    return mitigations[action] || ['Phased rollout', 'Performance monitoring'];
  }

  private compileEvidence(): Evidence[] {
    const evidence: Evidence[] = [];
    
    // Extract evidence from reasoning chain
    for (const step of this.reasoningChain) {
      if (step.evidence && step.evidence.length > 0) {
        for (const ev of step.evidence) {
          evidence.push({
            source: step.id,
            type: step.type === 'analysis' ? 'data' : step.type === 'inference' ? 'research' : 'expert_opinion',
            relevance: step.confidence,
            strength: step.confidence,
            description: ev
          });
        }
      }
    }

    return evidence;
  }
}

// ============================================================================
// MCP TOOLS FOR REASONING ENGINE
// ============================================================================

export const ReasoningTools = {
  /**
   * Generate strategic recommendations
   */
  generate_recommendations: {
    description: 'Generate strategic recommendations based on current state and goals',
    inputSchema: {
      type: 'object',
      properties: {
        persona: { type: 'string', enum: ['cfo', 'cio', 'cto', 'coo', 'vp_sales', 'vp_ops', 'vp_engineering', 'director_finance', 'data_analyst'] },
        industry: { type: 'string', enum: ['saas', 'manufacturing', 'healthcare', 'finance', 'retail', 'technology', 'professional_services'] },
        companySize: { type: 'string', enum: ['startup', 'scaleup', 'enterprise'] },
        currentKPIs: { type: 'object' },
        goals: { type: 'array', items: { type: 'string' } },
        constraints: {
          type: 'object',
          properties: {
            maxInvestment: { type: 'number' },
            maxTime: { type: 'number' },
            minROI: { type: 'number' },
            riskTolerance: { type: 'string', enum: ['low', 'medium', 'high'] },
            preferredQuickWins: { type: 'boolean' }
          }
        }
      },
      required: ['persona', 'industry', 'companySize', 'currentKPIs', 'goals']
    }
  },

  /**
   * Get reasoning chain
   */
  get_reasoning_chain: {
    description: 'Get the complete reasoning chain for a recommendation',
    inputSchema: {
      type: 'object',
      properties: {
        requestId: { type: 'string' }
      },
      required: ['requestId']
    }
  },

  /**
   * Evaluate alternatives
   */
  evaluate_alternatives: {
    description: 'Evaluate alternative strategies',
    inputSchema: {
      type: 'object',
      properties: {
        alternatives: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              actions: { type: 'array', items: { type: 'string' } },
              persona: { type: 'string', enum: ['cfo', 'cio', 'cto', 'coo', 'vp_sales', 'vp_ops', 'vp_engineering', 'director_finance', 'data_analyst'] },
              industry: { type: 'string', enum: ['saas', 'manufacturing', 'healthcare', 'finance', 'retail', 'technology', 'professional_services'] },
              companySize: { type: 'string', enum: ['startup', 'scaleup', 'enterprise'] },
              currentKPIs: { type: 'object' }
            },
            required: ['name', 'actions', 'persona', 'industry', 'companySize', 'currentKPIs']
          }
        }
      },
      required: ['alternatives']
    }
  }
};
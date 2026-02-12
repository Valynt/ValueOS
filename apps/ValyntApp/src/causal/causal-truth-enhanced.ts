/**
 * Enhanced Causal Truth Module
 * 
 * Provides empirical evidence for business action impacts on KPIs:
 * - Elasticity curves with confidence intervals
 * - Time-to-realize curves
 * - Industry and persona-specific adjustments
 * - Cascading effect chains
 * 
 * Part of Phase 3 - Integration & Business Case Generation
 */

import { 
  BusinessAction, 
  ImpactDistribution, 
  TimeCurve, 
  CausalRelationship, 
  CausalChain,
  CausalQueryEngine,
  CAUSAL_RELATIONSHIPS
} from './causal-truth';

import { 
  StructuralIndustry, 
  StructuralPersona,
} from '../types/structural-truth';

export interface CausalTruthConfig {
  enableContextualAdjustments?: boolean;
  confidenceThreshold?: number;
  maxChainDepth?: number;
}

export interface ActionImpact {
  action: BusinessAction;
  targetKpi: string;
  impact: ImpactDistribution;
  timeCurve: TimeCurve;
  confidence: number;
  evidence: string;
  contextModifiers: string[];
}

export interface ScenarioComparison {
  scenario: string;
  actions: BusinessAction[];
  totalImpact: number;
  confidence: number;
  timeToImpact: number;
  breakdown: Array<{ action: BusinessAction; kpi: string; impact: number }>;
}

/**
 * Enhanced Causal Truth Engine
 * 
 * Extends the base causal truth with contextual adjustments and
 * integration with structural truth layer
 */
export class CausalTruth {
  private config: CausalTruthConfig;
  private queryEngine: typeof CausalQueryEngine;

  constructor(config: CausalTruthConfig = {}) {
    this.config = {
      enableContextualAdjustments: true,
      confidenceThreshold: 0.6,
      maxChainDepth: 3,
      ...config
    };

    this.queryEngine = CausalQueryEngine;
  }

  /**
   * Get impact for a business action with contextual adjustments
   */
  getImpactForAction(
    action: BusinessAction,
    persona: StructuralPersona,
    industry: StructuralIndustry,
    companySize: 'startup' | 'scaleup' | 'enterprise'
  ): ActionImpact | null {
    // Get base relationships
    const relationships = CAUSAL_RELATIONSHIPS.filter(r => 
      r.action === action &&
      (!r.industry || r.industry.includes(industry as any)) &&
      (!r.persona || r.persona.includes(persona as any)) &&
      (!r.companySize || r.companySize === companySize)
    );

    if (relationships.length === 0) return null;

    // Use most confident relationship
    const baseRelationship = relationships.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    // Apply contextual adjustments
    const adjustedRelationship = this.applyContextualAdjustments(
      baseRelationship,
      persona,
      industry,
      companySize
    );

    // Calculate impact
    const impact = this.queryEngine.calculateImpact(adjustedRelationship, 1.0, 1.0);

    // Build KPI impacts map
    const kpiImpacts: Record<string, ImpactDistribution> = {};
    kpiImpacts[adjustedRelationship.targetKpi] = {
      p10: impact.range.min,
      p50: impact.expected,
      p90: impact.range.max
    };

    return {
      action: adjustedRelationship.action,
      targetKpi: adjustedRelationship.targetKpi,
      impact: kpiImpacts[adjustedRelationship.targetKpi],
      timeCurve: adjustedRelationship.timeCurve,
      confidence: impact.confidence,
      evidence: this.queryEngine.getEvidenceSummary(adjustedRelationship),
      contextModifiers: this.getContextModifiers(persona, industry, companySize)
    };
  }

  /**
   * Get time curve for an action-KPI pair
   */
  getTimeCurve(action: BusinessAction, kpi: string): TimeCurve | null {
    const relationship = CAUSAL_RELATIONSHIPS.find(r => 
      r.action === action && r.targetKpi === kpi
    );
    
    return relationship ? relationship.timeCurve : null;
  }

  /**
   * Simulate multiple actions with cascading effects
   */
  simulateScenario(
    actions: BusinessAction[],
    baselineKPIs: Record<string, number>,
    persona: StructuralPersona,
    industry: StructuralIndustry,
    companySize: 'startup' | 'scaleup' | 'enterprise'
  ): ScenarioComparison {
    const results: Array<{ action: BusinessAction; kpi: string; impact: number }> = [];
    let totalImpact = 0;
    let confidence = 1.0;
    let maxTime = 0;

    for (const action of actions) {
      const impact = this.getImpactForAction(action, persona, industry, companySize);
      
      if (!impact) continue;

      // Calculate impact for each affected KPI
      for (const [kpi, distribution] of Object.entries(impact.impact)) {
        const baseline = baselineKPIs[kpi];
        if (baseline === undefined) continue;

        const absoluteChange = baseline * distribution.p50;
        results.push({
          action,
          kpi,
          impact: absoluteChange
        });

        totalImpact += absoluteChange;
        confidence *= impact.confidence;
        maxTime = Math.max(maxTime, impact.timeCurve.timeToFullImpact);
      }
    }

    return {
      scenario: actions.join('+'),
      actions,
      totalImpact,
      confidence,
      timeToImpact: maxTime,
      breakdown: results
    };
  }

  /**
   * Get cascading effects of an action
   */
  getCascadingEffects(
    action: BusinessAction,
    rootKpi: string,
    depth: number = 2,
    persona: StructuralPersona,
    industry: StructuralIndustry,
    companySize: 'startup' | 'scaleup' | 'enterprise'
  ): CausalChain {
    // Get direct impact
    const directImpact = this.getImpactForAction(action, persona, industry, companySize);
    
    if (!directImpact) {
      return {
        rootAction: action,
        chain: [],
        totalImpact: { p10: 0, p50: 0, p90: 0 },
        timeToFullChain: 0
      };
    }

    // Get cascading effects through formula dependencies
    const chain: CausalChain['chain'] = [];
    const visited = new Set<string>();
    
    const traverse = (currentKpi: string, multiplier: number = 1.0, currentDepth: number = 0) => {
      if (currentDepth > depth || visited.has(`${action}-${currentKpi}`)) return;
      
      visited.add(`${action}-${currentKpi}`);

      const impact = this.getImpactForAction(action, persona, industry, companySize);
      if (!impact) return;

      const currentImpact = impact.impact[currentKpi];
      if (!currentImpact) return;

      chain.push({
        kpi: currentKpi,
        impact: {
          p10: currentImpact.p10 * multiplier,
          p50: currentImpact.p50 * multiplier,
          p90: currentImpact.p90 * multiplier
        },
        timeCurve: impact.timeCurve,
        confidence: impact.confidence
      });

      // Find dependent KPIs and continue traversal
      // This would integrate with StructuralTruth to find formula dependencies
      // For now, we'll use a simplified approach
      if (currentDepth < depth) {
        // Simulate some common cascading patterns
        const dependentKPIs = this.findDependentKPIs(currentKpi, industry);
        dependentKPIs.forEach(dep => {
          traverse(dep, multiplier * 0.7, currentDepth + 1);
        });
      }
    };

    traverse(rootKpi);

    // Calculate total impact
    const totalImpact = chain.reduce((acc, item) => ({
      p10: acc.p10 + item.impact.p10,
      p50: acc.p50 + item.impact.p50,
      p90: acc.p90 + item.impact.p90
    }), { p10: 0, p50: 0, p90: 0 });

    const maxTime = chain.reduce((max, item) => 
      Math.max(max, item.timeCurve.timeToFullImpact), 0
    );

    return {
      rootAction: action,
      chain,
      totalImpact,
      timeToFullChain: maxTime
    };
  }

  /**
   * Apply contextual adjustments to a relationship
   */
  private applyContextualAdjustments(
    relationship: CausalRelationship,
    persona: StructuralPersona,
    industry: StructuralIndustry,
    companySize: 'startup' | 'scaleup' | 'enterprise'
  ): CausalRelationship {
    if (!this.config.enableContextualAdjustments) return relationship;

    let confidenceMultiplier = 1.0;
    const assumptions = [...relationship.assumptions];
    const counterIndicators = [...relationship.counterIndicators];

    // Persona-specific adjustments
    switch (persona) {
      case 'cfo':
        // CFOs are more conservative, reduce confidence slightly
        confidenceMultiplier *= 0.9;
        assumptions.push('CFO prioritizes cash flow over growth');
        break;
      case 'cto':
        // CTOs may have better implementation capability
        confidenceMultiplier *= 1.1;
        assumptions.push('CTO has strong technical execution capability');
        break;
      case 'vp_sales':
        // Sales leaders may overestimate impact
        confidenceMultiplier *= 0.95;
        counterIndicators.push('Sales leadership optimism bias');
        break;
    }

    // Industry-specific adjustments
    switch (industry) {
      case 'saas':
        // SaaS has faster time curves
        if (relationship.timeCurve.type === 'sigmoid') {
          relationship.timeCurve.timeToFirstImpact *= 0.8;
          relationship.timeCurve.timeToFullImpact *= 0.8;
        }
        break;
      case 'manufacturing':
        // Manufacturing has slower implementation
        if (relationship.timeCurve.type === 'sigmoid') {
          relationship.timeCurve.timeToFirstImpact *= 1.3;
          relationship.timeCurve.timeToFullImpact *= 1.3;
        }
        break;
      case 'healthcare':
        // Healthcare has regulatory constraints
        confidenceMultiplier *= 0.85;
        counterIndicators.push('Regulatory approval requirements');
        break;
    }

    // Company size adjustments
    switch (companySize) {
      case 'startup':
        // Startups have higher variance
        confidenceMultiplier *= 0.8;
        relationship.elasticity.p10 *= 0.7; // More downside risk
        relationship.elasticity.p90 *= 1.2; // More upside potential
        assumptions.push('Startup execution risk higher');
        break;
      case 'enterprise':
        // Enterprises have more stable outcomes
        confidenceMultiplier *= 1.1;
        relationship.elasticity.p10 *= 1.1; // Less downside
        relationship.elasticity.p90 *= 0.9; // Less upside
        assumptions.push('Enterprise execution more predictable');
        break;
    }

    // Apply confidence adjustment
    const adjustedConfidence = Math.min(1.0, relationship.confidence * confidenceMultiplier);

    return {
      ...relationship,
      confidence: adjustedConfidence,
      assumptions,
      counterIndicators,
      confidenceFactors: {
        ...relationship.confidenceFactors,
        relevance: Math.min(1.0, relationship.confidenceFactors.relevance * confidenceMultiplier)
      }
    };
  }

  /**
   * Find dependent KPIs (simplified - would integrate with StructuralTruth)
   */
  private findDependentKPIs(kpi: string, industry: StructuralIndustry): string[] {
    // Common cascading patterns by industry
    const cascades: Record<string, string[]> = {
      saas: ['saas_nrr', 'saas_ltv', 'saas_ltv_cac_ratio'],
      manufacturing: ['mfg_throughput', 'mfg_oee'],
      finance: ['fin_ccc', 'fin_cost_per_revenue'],
      healthcare: ['hc_collection_rate', 'hc_operating_margin'],
      retail: ['ret_gmroi', 'ret_gross_margin'],
      technology: ['tech_uptime', 'tech_maintenance_ratio']
    };

    return cascades[industry] || [];
  }

  /**
   * Get context modifiers for display
   */
  private getContextModifiers(
    persona: StructuralPersona,
    industry: StructuralIndustry,
    companySize: 'startup' | 'scaleup' | 'enterprise'
  ): string[] {
    const modifiers: string[] = [];

    // Persona modifiers
    switch (persona) {
      case 'cfo': modifiers.push('CFO perspective: cash flow focused'); break;
      case 'cto': modifiers.push('CTO perspective: technical execution'); break;
      case 'vp_sales': modifiers.push('VP Sales perspective: revenue focused'); break;
      case 'coo': modifiers.push('COO perspective: operational efficiency'); break;
    }

    // Industry modifiers
    switch (industry) {
      case 'saas': modifiers.push('SaaS: recurring revenue model'); break;
      case 'manufacturing': modifiers.push('Manufacturing: asset intensive'); break;
      case 'healthcare': modifiers.push('Healthcare: regulatory constraints'); break;
      case 'finance': modifiers.push('Finance: compliance requirements'); break;
    }

    // Size modifiers
    switch (companySize) {
      case 'startup': modifiers.push('Startup: high growth, high risk'); break;
      case 'scaleup': modifiers.push('Scaleup: scaling operations'); break;
      case 'enterprise': modifiers.push('Enterprise: mature processes'); break;
    }

    return modifiers;
  }

  /**
   * Get recommended actions for KPI improvement
   */
  getRecommendationsForKPI(
    targetKpi: string,
    targetImprovement: number,
    persona: StructuralPersona,
    industry: StructuralIndustry,
    companySize: 'startup' | 'scaleup' | 'enterprise',
    constraints: {
      maxTime?: number;
      minConfidence?: number;
    } = {}
  ): Array<{
    action: BusinessAction;
    expectedImpact: number;
    confidence: number;
    timeToImpact: number;
    evidence: string;
  }> {
    const candidates = this.queryEngine.findBestActionsForKpi(
      targetKpi,
      constraints.minConfidence || this.config.confidenceThreshold,
      industry as any,
      persona as any
    );

    return candidates
      .map(candidate => {
        const impact = this.getImpactForAction(candidate.action, persona, industry, companySize);
        if (!impact) return null;

        const expectedImpact = candidate.impact.p50;
        const time = impact.timeCurve.timeToFirstImpact;

        // Apply constraints
        if (constraints.maxTime && time > constraints.maxTime) return null;
        if (expectedImpact < targetImprovement * 0.5) return null;

        return {
          action: candidate.action,
          expectedImpact,
          confidence: candidate.confidence,
          timeToImpact: time,
          evidence: impact.evidence
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.expectedImpact - a.expectedImpact);
  }

  /**
   * Get all available business actions
   */
  getAvailableActions(): BusinessAction[] {
    const actions = new Set(CAUSAL_RELATIONSHIPS.map(r => r.action));
    return Array.from(actions);
  }

  /**
   * Get actions that affect a specific KPI
   */
  getActionsForKPI(kpi: string): BusinessAction[] {
    const actions = new Set(
      CAUSAL_RELATIONSHIPS.filter(r => r.targetKpi === kpi).map(r => r.action)
    );
    return Array.from(actions);
  }

  /**
   * Get evidence quality summary
   */
  getEvidenceQuality(action: BusinessAction, kpi: string): string | null {
    const relationship = CAUSAL_RELATIONSHIPS.find(r => 
      r.action === action && r.targetKpi === kpi
    );
    
    if (!relationship) return null;

    return this.queryEngine.getEvidenceSummary(relationship);
  }
}

/**
 * Causal Truth MCP Tools
 * 
 * Exposes causal analysis as MCP tools
 */
export const CausalTruthTools = {
  /**
   * Get impact of a business action
   */
  get_causal_impact: {
    description: 'Get the causal impact of a business action on a KPI',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: [
          'price_increase_5pct', 'price_decrease_5pct', 'freemium_to_paid', 'annual_commitment_discount',
          'increase_sales_team_20pct', 'double_marketing_spend', 'launch_abm_campaign', 'implement_lead_scoring',
          'reduce_pricing_tiers', 'add_self_service_onboarding', 'improve_page_load_50pct', 'launch_new_feature_category',
          'implement_health_scoring', 'increase_csm_ratio_2x', 'launch_customer_education', 'proactive_churn_intervention',
          'automate_manual_processes', 'reduce_support_ticket_time', 'implement_usage_based_pricing', 'expand_to_new_vertical'
        ]},
        kpi: { type: 'string' },
        persona: { type: 'string', enum: ['cfo', 'cio', 'cto', 'coo', 'vp_sales', 'vp_ops', 'vp_engineering', 'director_finance', 'data_analyst'] },
        industry: { type: 'string', enum: ['saas', 'manufacturing', 'healthcare', 'finance', 'retail', 'technology', 'professional_services'] },
        companySize: { type: 'string', enum: ['startup', 'scaleup', 'enterprise'] }
      },
      required: ['action', 'kpi', 'persona', 'industry', 'companySize']
    }
  },

  /**
   * Simulate action outcome
   */
  simulate_action_outcome: {
    description: 'Simulate the outcome of a business action on multiple KPIs',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        baseline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              kpi: { type: 'string' },
              value: { type: 'number' }
            },
            required: ['kpi', 'value']
          }
        },
        persona: { type: 'string', enum: ['cfo', 'cio', 'cto', 'coo', 'vp_sales', 'vp_ops', 'vp_engineering', 'director_finance', 'data_analyst'] },
        industry: { type: 'string', enum: ['saas', 'manufacturing', 'healthcare', 'finance', 'retail', 'technology', 'professional_services'] },
        companySize: { type: 'string', enum: ['startup', 'scaleup', 'enterprise'] }
      },
      required: ['action', 'baseline', 'persona', 'industry', 'companySize']
    }
  },

  /**
   * Compare scenarios
   */
  compare_scenarios: {
    description: 'Compare multiple business scenarios side by side',
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
              baseline: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    kpi: { type: 'string' },
                    value: { type: 'number' }
                  }
                }
              },
              persona: { type: 'string', enum: ['cfo', 'cio', 'cto', 'coo', 'vp_sales', 'vp_ops', 'vp_engineering', 'director_finance', 'data_analyst'] },
              industry: { type: 'string', enum: ['saas', 'manufacturing', 'healthcare', 'finance', 'retail', 'technology', 'professional_services'] },
              companySize: { type: 'string', enum: ['startup', 'scaleup', 'enterprise'] }
            },
            required: ['name', 'actions', 'baseline', 'persona', 'industry', 'companySize']
          }
        }
      },
      required: ['scenarios']
    }
  },

  /**
   * Get cascading effects
   */
  get_cascading_effects: {
    description: 'Get cascading effects of an action through multiple KPIs',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        rootKpi: { type: 'string' },
        maxDepth: { type: 'number', minimum: 1, maximum: 5 },
        persona: { type: 'string', enum: ['cfo', 'cio', 'cto', 'coo', 'vp_sales', 'vp_ops', 'vp_engineering', 'director_finance', 'data_analyst'] },
        industry: { type: 'string', enum: ['saas', 'manufacturing', 'healthcare', 'finance', 'retail', 'technology', 'professional_services'] },
        companySize: { type: 'string', enum: ['startup', 'scaleup', 'enterprise'] }
      },
      required: ['action', 'rootKpi', 'persona', 'industry', 'companySize']
    }
  },

  /**
   * Get recommendations for KPI improvement
   */
  get_recommendations_for_kpi: {
    description: 'Get recommended actions to improve a specific KPI',
    inputSchema: {
      type: 'object',
      properties: {
        targetKpi: { type: 'string' },
        targetImprovement: { type: 'number', description: 'Desired improvement as decimal (e.g., 0.1 for 10%)' },
        persona: { type: 'string', enum: ['cfo', 'cio', 'cto', 'coo', 'vp_sales', 'vp_ops', 'vp_engineering', 'director_finance', 'data_analyst'] },
        industry: { type: 'string', enum: ['saas', 'manufacturing', 'healthcare', 'finance', 'retail', 'technology', 'professional_services'] },
        companySize: { type: 'string', enum: ['startup', 'scaleup', 'enterprise'] },
        constraints: {
          type: 'object',
          properties: {
            maxTime: { type: 'number', description: 'Maximum time to impact in days' },
            minConfidence: { type: 'number', minimum: 0, maximum: 1 }
          }
        }
      },
      required: ['targetKpi', 'targetImprovement', 'persona', 'industry', 'companySize']
    }
  },

  /**
   * Get available actions
   */
  get_available_actions: {
    description: 'Get all available business actions',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  /**
   * Get actions for specific KPI
   */
  get_actions_for_kpi: {
    description: 'Get all actions that can affect a specific KPI',
    inputSchema: {
      type: 'object',
      properties: {
        kpi: { type: 'string' }
      },
      required: ['kpi']
    }
  },

  /**
   * Get evidence quality
   */
  get_evidence_quality: {
    description: 'Get evidence quality and sources for an action-KPI relationship',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string' },
        kpi: { type: 'string' }
      },
      required: ['action', 'kpi']
    }
  }
};

// Export the enhanced class
export default CausalTruth;
/**
 * CAUSAL TRUTH LAYER - Phase 2 Implementation
 *
 * This layer provides empirical evidence for how business actions cause KPI changes.
 * It includes elasticity curves, impact distributions, and time-to-realize curves
 * derived from case studies, research papers, and meta-analysis.
 */

import { IndustryType, KPI_ID, PersonaType } from "../types/eso";

// ============================================================================
// CORE CAUSAL TYPES
// ============================================================================

/**
 * Business action that can be taken to influence KPIs
 */
export type BusinessAction =
  // Pricing & Revenue
  | "price_increase_5pct"
  | "price_decrease_5pct"
  | "freemium_to_paid"
  | "annual_commitment_discount"

  // Sales & Marketing
  | "increase_sales_team_20pct"
  | "double_marketing_spend"
  | "launch_abm_campaign"
  | "implement_lead_scoring"

  // Product & Engineering
  | "reduce_pricing_tiers"
  | "add_self_service_onboarding"
  | "improve_page_load_50pct"
  | "launch_new_feature_category"

  // Customer Success
  | "implement_health_scoring"
  | "increase_csm_ratio_2x"
  | "launch_customer_education"
  | "proactive_churn_intervention"

  // Operations
  | "automate_manual_processes"
  | "reduce_support_ticket_time"
  | "implement_usage_based_pricing"
  | "expand_to_new_vertical";

/**
 * Distribution type for impact uncertainty
 */
export interface ImpactDistribution {
  p10: number; // 10th percentile (conservative)
  p50: number; // 50th percentile (median)
  p90: number; // 90th percentile (optimistic)
  mean?: number; // Weighted mean if different from p50
  sampleSize?: number; // Number of observations
  confidence?: number; // 0-1 confidence score
}

/**
 * Time-to-realize curve parameters
 */
export interface TimeCurve {
  type: "sigmoid" | "linear" | "exponential_decay" | "step";
  timeToFirstImpact: number; // Days
  timeToFullImpact: number; // Days
  plateau?: number; // Final plateau value (for sigmoid/decay)
  inflectionPoint?: number; // For sigmoid (0-1)
}

/**
 * Causal relationship between action and KPI
 */
export interface CausalRelationship {
  action: BusinessAction;
  targetKpi: KPI_ID;

  // Elasticity: % KPI change per % action magnitude
  elasticity: ImpactDistribution;

  // Time to realize the impact
  timeCurve: TimeCurve;

  // Context modifiers
  industry?: IndustryType[];
  persona?: PersonaType[];
  companySize?: "startup" | "scaleup" | "enterprise";

  // Evidence quality
  evidenceSources: string[]; // URLs, paper titles, case study IDs
  evidenceQuality: "anecdotal" | "case_study" | "research_paper" | "meta_analysis";

  // Confidence calibration
  confidence: number; // 0-1
  confidenceFactors: {
    sampleSize: number;
    replication: number; // How many independent studies
    recency: number; // 0-1, how recent is the data
    relevance: number; // 0-1, how relevant to target context
  };

  // Causal assumptions
  assumptions: string[];

  // Counter-indicators (when this doesn't work)
  counterIndicators: string[];
}

/**
 * Cascading effect chain
 */
export interface CausalChain {
  rootAction: BusinessAction;
  chain: Array<{
    kpi: KPI_ID;
    impact: ImpactDistribution;
    timeCurve: TimeCurve;
    confidence: number;
  }>;
  totalImpact: ImpactDistribution;
  timeToFullChain: number;
}

// ============================================================================
// CAUSAL DATABASE
// ============================================================================

export const CAUSAL_RELATIONSHIPS: CausalRelationship[] = [
  // Pricing Actions → Revenue & Retention
  {
    action: "price_increase_5pct",
    targetKpi: "ARR",
    elasticity: { p10: 0.02, p50: 0.04, p90: 0.06, mean: 0.042, sampleSize: 150, confidence: 0.75 },
    timeCurve: {
      type: "sigmoid",
      timeToFirstImpact: 30,
      timeToFullImpact: 180,
      inflectionPoint: 0.3,
    },
    industry: ["SaaS", "Technology"],
    persona: ["ProductLed", "SalesLed"],
    companySize: "scaleup",
    evidenceSources: ["PriceIntelligence_2023", "OpenView_SaaS_Benchmarks_2024"],
    evidenceQuality: "meta_analysis",
    confidence: 0.75,
    confidenceFactors: { sampleSize: 150, replication: 3, recency: 0.8, relevance: 0.9 },
    assumptions: [
      "Value proposition is clearly communicated",
      "Product-market fit is established",
      "Churn rate < 15% annually",
    ],
    counterIndicators: [
      "High competitive pressure",
      "Undifferentiated commodity product",
      "Price-sensitive customer segment",
    ],
  },

  {
    action: "price_increase_5pct",
    targetKpi: "GrossChurnRate",
    elasticity: {
      p10: 0.005,
      p50: 0.015,
      p90: 0.03,
      mean: 0.018,
      sampleSize: 150,
      confidence: 0.7,
    },
    timeCurve: { type: "linear", timeToFirstImpact: 60, timeToFullImpact: 240 },
    industry: ["SaaS", "Technology"],
    persona: ["ProductLed", "SalesLed"],
    companySize: "scaleup",
    evidenceSources: ["PriceIntelligence_2023", "Bain_Pricing_Study_2022"],
    evidenceQuality: "meta_analysis",
    confidence: 0.7,
    confidenceFactors: { sampleSize: 150, replication: 2, recency: 0.7, relevance: 0.85 },
    assumptions: [
      "Customer success team can handle increased complaints",
      "Product quality justifies price point",
    ],
    counterIndicators: [
      "High switching costs",
      "Strong customer lock-in",
      "Low competitive alternatives",
    ],
  },

  // Sales Actions → Revenue
  {
    action: "increase_sales_team_20pct",
    targetKpi: "ARR",
    elasticity: { p10: 0.08, p50: 0.15, p90: 0.22, mean: 0.155, sampleSize: 89, confidence: 0.65 },
    timeCurve: {
      type: "sigmoid",
      timeToFirstImpact: 90,
      timeToFullImpact: 365,
      inflectionPoint: 0.4,
    },
    industry: ["SaaS", "ProfessionalServices", "Technology"],
    persona: ["SalesLed"],
    companySize: "scaleup",
    evidenceSources: ["Salesforce_State_of_Sales_2024", "OpenView_SaaS_Benchmarks_2024"],
    evidenceQuality: "case_study",
    confidence: 0.65,
    confidenceFactors: { sampleSize: 89, replication: 2, recency: 0.9, relevance: 0.8 },
    assumptions: [
      "Sales team has adequate pipeline",
      "Hiring quality is maintained",
      "Onboarding process is efficient",
    ],
    counterIndicators: [
      "Market saturation",
      "Long sales cycles (>6 months)",
      "High CAC relative to LTV",
    ],
  },

  {
    action: "double_marketing_spend",
    targetKpi: "CAC",
    elasticity: { p10: 0.15, p50: 0.25, p90: 0.35, mean: 0.26, sampleSize: 120, confidence: 0.6 },
    timeCurve: { type: "linear", timeToFirstImpact: 30, timeToFullImpact: 120 },
    industry: ["SaaS", "Ecommerce", "Technology"],
    persona: ["ProductLed", "MarketingLed"],
    companySize: "startup",
    evidenceSources: ["Marketing_Spend_Effectiveness_2023", "Bain_Marketing_ROI_2022"],
    evidenceQuality: "research_paper",
    confidence: 0.6,
    confidenceFactors: { sampleSize: 120, replication: 1, recency: 0.7, relevance: 0.75 },
    assumptions: [
      "Marketing channels are scalable",
      "Target audience is reachable",
      "Creative quality is maintained",
    ],
    counterIndicators: ["Channel saturation", "Poor creative performance", "Wrong target audience"],
  },

  // Product Actions → Engagement & Retention
  {
    action: "add_self_service_onboarding",
    targetKpi: "TimeToValue",
    elasticity: { p10: -0.3, p50: -0.5, p90: -0.7, mean: -0.52, sampleSize: 67, confidence: 0.8 },
    timeCurve: { type: "step", timeToFirstImpact: 14, timeToFullImpact: 45 },
    industry: ["SaaS", "Technology"],
    persona: ["ProductLed"],
    companySize: "startup",
    evidenceSources: ["UserOnboarding_Best_Practices_2024", "Amplitude_Product_Metrics_2023"],
    evidenceQuality: "case_study",
    confidence: 0.8,
    confidenceFactors: { sampleSize: 67, replication: 4, recency: 0.95, relevance: 0.95 },
    assumptions: [
      "Product is intuitive",
      "Documentation is comprehensive",
      "Support can handle edge cases",
    ],
    counterIndicators: [
      "Complex product requiring customization",
      "Enterprise buyers needing hand-holding",
      "Regulatory compliance requirements",
    ],
  },

  {
    action: "improve_page_load_50pct",
    targetKpi: "ConversionRate",
    elasticity: { p10: 0.08, p50: 0.12, p90: 0.18, mean: 0.125, sampleSize: 200, confidence: 0.85 },
    timeCurve: { type: "linear", timeToFirstImpact: 7, timeToFullImpact: 30 },
    industry: ["Ecommerce", "SaaS", "Technology"],
    persona: ["ProductLed", "MarketingLed"],
    companySize: "startup",
    evidenceSources: ["Google_Page_Speed_Study_2023", "Amazon_Performance_Research"],
    evidenceQuality: "meta_analysis",
    confidence: 0.85,
    confidenceFactors: { sampleSize: 200, replication: 5, recency: 0.9, relevance: 0.9 },
    assumptions: [
      "Current load time > 3 seconds",
      "Traffic volume is significant",
      "Mobile traffic is substantial",
    ],
    counterIndicators: ["Already optimized (<1s)", "Low traffic volume", "Desktop-only audience"],
  },

  // Customer Success Actions → Retention
  {
    action: "implement_health_scoring",
    targetKpi: "GrossChurnRate",
    elasticity: {
      p10: -0.08,
      p50: -0.15,
      p90: -0.22,
      mean: -0.155,
      sampleSize: 95,
      confidence: 0.7,
    },
    timeCurve: {
      type: "sigmoid",
      timeToFirstImpact: 45,
      timeToFullImpact: 180,
      inflectionPoint: 0.35,
    },
    industry: ["SaaS", "ProfessionalServices"],
    persona: ["ProductLed", "SalesLed"],
    companySize: "scaleup",
    evidenceSources: ["Gainsight_Health_Scoring_Study_2024", "Totango_CS_Benchmarks_2023"],
    evidenceQuality: "case_study",
    confidence: 0.7,
    confidenceFactors: { sampleSize: 95, replication: 3, recency: 0.85, relevance: 0.85 },
    assumptions: [
      "Data sources are reliable",
      "Team can act on insights",
      "Proactive outreach is possible",
    ],
    counterIndicators: [
      "Low usage data availability",
      "Reactive support culture",
      "High-touch customer base",
    ],
  },

  {
    action: "increase_csm_ratio_2x",
    targetKpi: "NetRevenueRetention",
    elasticity: { p10: 0.03, p50: 0.08, p90: 0.12, mean: 0.082, sampleSize: 45, confidence: 0.55 },
    timeCurve: {
      type: "sigmoid",
      timeToFirstImpact: 90,
      timeToFullImpact: 365,
      inflectionPoint: 0.45,
    },
    industry: ["SaaS", "ProfessionalServices"],
    persona: ["SalesLed"],
    companySize: "enterprise",
    evidenceSources: ["Gainsight_CS_Ratio_Study_2023", "ChurnZero_Benchmarks_2024"],
    evidenceQuality: "case_study",
    confidence: 0.55,
    confidenceFactors: { sampleSize: 45, replication: 2, recency: 0.75, relevance: 0.8 },
    assumptions: [
      "CSMs are well-trained",
      "Customer base is large enough",
      "Expansion opportunities exist",
    ],
    counterIndicators: ["Low customer count", "Product-led motion", "Limited expansion potential"],
  },

  // Operations Actions → Efficiency
  {
    action: "automate_manual_processes",
    targetKpi: "GrossMargin",
    elasticity: { p10: 0.02, p50: 0.05, p90: 0.08, mean: 0.052, sampleSize: 78, confidence: 0.72 },
    timeCurve: { type: "linear", timeToFirstImpact: 60, timeToFullImpact: 180 },
    industry: ["SaaS", "ProfessionalServices", "Manufacturing"],
    persona: ["ProductLed", "SalesLed"],
    companySize: "scaleup",
    evidenceSources: ["Automation_Impact_Study_2024", "McKinsey_Automation_2023"],
    evidenceQuality: "research_paper",
    confidence: 0.72,
    confidenceFactors: { sampleSize: 78, replication: 3, recency: 0.85, relevance: 0.7 },
    assumptions: [
      "Processes are repetitive",
      "Automation tools are mature",
      "Change management is effective",
    ],
    counterIndicators: [
      "Creative/strategic work",
      "High variability tasks",
      "Legacy system constraints",
    ],
  },

  // Pricing Strategy → LTV
  {
    action: "implement_usage_based_pricing",
    targetKpi: "LTV",
    elasticity: { p10: 0.12, p50: 0.22, p90: 0.32, mean: 0.225, sampleSize: 56, confidence: 0.68 },
    timeCurve: {
      type: "sigmoid",
      timeToFirstImpact: 120,
      timeToFullImpact: 365,
      inflectionPoint: 0.4,
    },
    industry: ["SaaS", "Technology"],
    persona: ["ProductLed"],
    companySize: "scaleup",
    evidenceSources: ["Usage_Based_Pricing_Study_2024", "OpenView_Pricing_Research_2023"],
    evidenceQuality: "case_study",
    confidence: 0.68,
    confidenceFactors: { sampleSize: 56, replication: 2, recency: 0.9, relevance: 0.85 },
    assumptions: [
      "Usage is measurable",
      "Customers prefer variable costs",
      "Value scales with usage",
    ],
    counterIndicators: [
      "Predictable budget needs",
      "Low usage variability",
      "Complex usage tracking",
    ],
  },
];

// ============================================================================
// CAUSAL QUERY ENGINE
// ============================================================================

export class CausalQueryEngine {
  /**
   * Get all causal relationships for a specific action
   */
  static getActionImpacts(action: BusinessAction): CausalRelationship[] {
    return CAUSAL_RELATIONSHIPS.filter((r) => r.action === action);
  }

  /**
   * Get all actions that can affect a specific KPI
   */
  static getKpiInfluencers(kpi: KPI_ID): CausalRelationship[] {
    return CAUSAL_RELATIONSHIPS.filter((r) => r.targetKpi === kpi);
  }

  /**
   * Get filtered causal relationships by context
   */
  static getContextualImpacts(
    action: BusinessAction,
    kpi: KPI_ID,
    industry?: IndustryType,
    persona?: PersonaType,
    companySize?: "startup" | "scaleup" | "enterprise"
  ): CausalRelationship[] {
    return CAUSAL_RELATIONSHIPS.filter(
      (r) =>
        r.action === action &&
        r.targetKpi === kpi &&
        (!industry || r.industry?.includes(industry)) &&
        (!persona || r.persona?.includes(persona)) &&
        (!companySize || r.companySize === companySize)
    );
  }

  /**
   * Calculate expected impact with confidence intervals
   */
  static calculateImpact(
    relationship: CausalRelationship,
    actionMagnitude: number = 1.0, // 1.0 = standard action
    contextConfidence: number = 1.0 // 0-1 contextual adjustment
  ): {
    expected: number;
    range: { min: number; max: number };
    confidence: number;
    timeToImpact: number;
  } {
    const { elasticity, timeCurve, confidence } = relationship;

    // Calculate base impact
    const baseImpact = (elasticity.mean ?? 0) * actionMagnitude;

    // Adjust for context
    const adjustedImpact = baseImpact * contextConfidence;

    // Calculate range (p10 to p90)
    const minImpact = elasticity.p10 * actionMagnitude * contextConfidence;
    const maxImpact = elasticity.p90 * actionMagnitude * contextConfidence;

    // Calculate confidence
    const finalConfidence = confidence * contextConfidence;

    // Calculate time to impact
    const timeToImpact = timeCurve.timeToFirstImpact;

    return {
      expected: adjustedImpact,
      range: { min: minImpact, max: maxImpact },
      confidence: finalConfidence,
      timeToImpact: timeToImpact,
    };
  }

  /**
   * Simulate cascading effects of an action through multiple KPIs
   */
  static simulateCascadingEffects(
    action: BusinessAction,
    initialKpi: KPI_ID,
    depth: number = 3
  ): CausalChain {
    const chain: CausalChain["chain"] = [];
    const visited = new Set<string>();
    let totalImpact: ImpactDistribution = { p10: 0, p50: 0, p90: 0 };
    let maxTime = 0;

    const traverse = (currentKpi: KPI_ID, currentDepth: number, multiplier: number = 1.0) => {
      if (currentDepth > depth || visited.has(`${action}-${currentKpi}`)) return;

      visited.add(`${action}-${currentKpi}`);

      const relationships = this.getKpiInfluencers(currentKpi).filter((r) => r.action === action);

      for (const rel of relationships) {
        const impact = this.calculateImpact(rel, multiplier);

        chain.push({
          kpi: currentKpi,
          impact: {
            p10: impact.range.min,
            p50: impact.expected,
            p90: impact.range.max,
          },
          timeCurve: rel.timeCurve,
          confidence: impact.confidence,
        });

        // Update total impact
        totalImpact.p10 += impact.range.min;
        totalImpact.p50 += impact.expected;
        totalImpact.p90 += impact.range.max;

        maxTime = Math.max(maxTime, impact.timeToImpact);

        // Find next KPIs in chain
        const nextRelationships = CAUSAL_RELATIONSHIPS.filter(
          (r) => r.targetKpi === currentKpi && r.action === action
        );

        for (const nextRel of nextRelationships) {
          // Recursively traverse (simplified - in real implementation would track actual dependencies)
          if (currentDepth < depth) {
            traverse(nextRel.targetKpi, currentDepth + 1, multiplier * 0.8);
          }
        }
      }
    };

    traverse(initialKpi, 0);

    return {
      rootAction: action,
      chain: chain,
      totalImpact: totalImpact,
      timeToFullChain: maxTime,
    };
  }

  /**
   * Get evidence quality summary for a relationship
   */
  static getEvidenceSummary(relationship: CausalRelationship): string {
    const { evidenceQuality, confidenceFactors, confidence } = relationship;

    const qualityMap = {
      anecdotal: "Limited evidence (anecdotal)",
      case_study: "Case study evidence",
      research_paper: "Academic research",
      meta_analysis: "Meta-analysis (strongest)",
    };

    return (
      `${qualityMap[evidenceQuality]} | ` +
      `Sample: ${confidenceFactors.sampleSize} | ` +
      `Replication: ${confidenceFactors.replication} | ` +
      `Confidence: ${(confidence * 100).toFixed(0)}%`
    );
  }

  /**
   * Find best actions for a target KPI improvement
   */
  static findBestActionsForKpi(
    targetKpi: KPI_ID,
    minConfidence: number = 0.6,
    industry?: IndustryType,
    persona?: PersonaType
  ): Array<{ action: BusinessAction; impact: ImpactDistribution; confidence: number }> {
    const candidates = CAUSAL_RELATIONSHIPS.filter(
      (r) =>
        r.targetKpi === targetKpi &&
        r.confidence >= minConfidence &&
        (!industry || r.industry?.includes(industry)) &&
        (!persona || r.persona?.includes(persona))
    );

    return candidates
      .map((rel) => ({
        action: rel.action,
        impact: {
          p10: rel.elasticity.p10,
          p50: rel.elasticity.p50,
          p90: rel.elasticity.p90,
        },
        confidence: rel.confidence,
      }))
      .sort((a, b) => b.impact.p50 - a.impact.p50);
  }
}

// ============================================================================
// CAUSAL TRUTH API TOOLS
// ============================================================================

/**
 * Tool: Get causal impact of a business action
 */
export function get_causal_impact(
  action: BusinessAction,
  kpi: KPI_ID,
  context?: {
    industry?: IndustryType;
    persona?: PersonaType;
    companySize?: "startup" | "scaleup" | "enterprise";
    actionMagnitude?: number;
  }
): {
  action: BusinessAction;
  targetKpi: KPI_ID;
  impact: ImpactDistribution;
  timeCurve: TimeCurve;
  confidence: number;
  evidence: string;
} | null {
  const relationships = CausalQueryEngine.getContextualImpacts(
    action,
    kpi,
    context?.industry,
    context?.persona,
    context?.companySize
  );

  if (relationships.length === 0) return null;

  // Use most confident relationship
  const relationship = relationships.reduce((best, current) =>
    current.confidence > best.confidence ? current : best
  );

  const impact = CausalQueryEngine.calculateImpact(
    relationship,
    context?.actionMagnitude || 1.0,
    1.0
  );

  return {
    action: relationship.action,
    targetKpi: relationship.targetKpi,
    impact: {
      p10: impact.range.min,
      p50: impact.expected,
      p90: impact.range.max,
    },
    timeCurve: relationship.timeCurve,
    confidence: impact.confidence,
    evidence: CausalQueryEngine.getEvidenceSummary(relationship),
  };
}

/**
 * Tool: Simulate action outcome with multiple KPIs
 */
export function simulate_action_outcome(
  action: BusinessAction,
  baseline: {
    kpi: KPI_ID;
    value: number;
  }[],
  context?: {
    industry?: IndustryType;
    persona?: PersonaType;
    companySize?: "startup" | "scaleup" | "enterprise";
  }
): {
  action: BusinessAction;
  results: Array<{
    kpi: KPI_ID;
    baseline: number;
    expected: number;
    range: { min: number; max: number };
    timeToImpact: number;
    confidence: number;
  }>;
  totalImpact: {
    expected: number;
    range: { min: number; max: number };
  };
} {
  const results = [];
  let totalExpected = 0;
  let totalMin = 0;
  let totalMax = 0;

  for (const { kpi, value } of baseline) {
    const impact = get_causal_impact(action, kpi, context);

    if (impact) {
      const expectedChange = value * impact.impact.p50;
      const minChange = value * impact.impact.p10;
      const maxChange = value * impact.impact.p90;

      results.push({
        kpi,
        baseline: value,
        expected: value + expectedChange,
        range: {
          min: value + minChange,
          max: value + maxChange,
        },
        timeToImpact: impact.timeCurve.timeToFirstImpact,
        confidence: impact.confidence,
      });

      totalExpected += expectedChange;
      totalMin += minChange;
      totalMax += maxChange;
    }
  }

  return {
    action,
    results,
    totalImpact: {
      expected: totalExpected,
      range: { min: totalMin, max: totalMax },
    },
  };
}

/**
 * Tool: Compare multiple scenarios
 */
export function compare_scenarios(
  scenarios: Array<{
    name: string;
    actions: BusinessAction[];
    baseline: Array<{ kpi: KPI_ID; value: number }>;
    context?: {
      industry?: IndustryType;
      persona?: PersonaType;
      companySize?: "startup" | "scaleup" | "enterprise";
    };
  }>
): {
  scenario: string;
  totalImpact: number;
  confidence: number;
  timeToImpact: number;
  breakdown: Array<{ action: BusinessAction; kpi: KPI_ID; impact: number }>;
}[] {
  return scenarios
    .map((scenario) => {
      let totalImpact = 0;
      let confidence = 1.0;
      let maxTime = 0;
      const breakdown: Array<{ action: BusinessAction; kpi: KPI_ID; impact: number }> = [];

      for (const action of scenario.actions) {
        const result = simulate_action_outcome(action, scenario.baseline, scenario.context);

        totalImpact += result.totalImpact.expected;
        confidence *= result.results.reduce((acc, r) => acc * r.confidence, 1.0);
        maxTime = Math.max(maxTime, ...result.results.map((r) => r.timeToImpact));

        result.results.forEach((r) => {
          breakdown.push({
            action,
            kpi: r.kpi,
            impact: r.expected - r.baseline,
          });
        });
      }

      return {
        scenario: scenario.name,
        totalImpact,
        confidence,
        timeToImpact: maxTime,
        breakdown,
      };
    })
    .sort((a, b) => b.totalImpact - a.totalImpact);
}

/**
 * Tool: Get cascading effects of an action
 */
export function get_cascading_effects(
  action: BusinessAction,
  rootKpi: KPI_ID,
  maxDepth: number = 3,
  context?: {
    industry?: IndustryType;
    persona?: PersonaType;
    companySize?: "startup" | "scaleup" | "enterprise";
  }
): CausalChain {
  // Filter relationships by context first
  const filteredRelationships = CAUSAL_RELATIONSHIPS.filter(
    (r) =>
      r.action === action &&
      (!context?.industry || r.industry?.includes(context.industry)) &&
      (!context?.persona || r.persona?.includes(context.persona)) &&
      (!context?.companySize || r.companySize === context.companySize)
  );

  // Temporarily replace global CAUSAL_RELATIONSHIPS with filtered version
  const original = CAUSAL_RELATIONSHIPS;
  (global as any).CAUSAL_RELATIONSHIPS = filteredRelationships;

  const result = CausalQueryEngine.simulateCascadingEffects(action, rootKpi, maxDepth);

  // Restore original
  (global as any).CAUSAL_RELATIONSHIPS = original;

  return result;
}

/**
 * Tool: Get recommended actions for KPI improvement
 */
export function get_recommendations_for_kpi(
  targetKpi: KPI_ID,
  targetImprovement: number, // e.g., 0.1 for 10% improvement
  constraints: {
    maxTime?: number; // days
    minConfidence?: number;
    industry?: IndustryType;
    persona?: PersonaType;
  } = {}
): Array<{
  action: BusinessAction;
  expectedImpact: number;
  confidence: number;
  timeToImpact: number;
  evidence: string;
}> {
  const candidates = CausalQueryEngine.findBestActionsForKpi(
    targetKpi,
    constraints.minConfidence || 0.6,
    constraints.industry,
    constraints.persona
  );

  return candidates
    .map((candidate) => {
      const rel = CAUSAL_RELATIONSHIPS.find(
        (r) => r.action === candidate.action && r.targetKpi === targetKpi
      );

      if (!rel) return null;

      const impact = candidate.impact.p50;
      const time = rel.timeCurve.timeToFirstImpact;

      // Filter by constraints
      if (constraints.maxTime && time > constraints.maxTime) return null;
      if (impact < targetImprovement * 0.5) return null; // Too small

      return {
        action: candidate.action,
        expectedImpact: impact,
        confidence: candidate.confidence,
        timeToImpact: time,
        evidence: CausalQueryEngine.getEvidenceSummary(rel),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.expectedImpact - a.expectedImpact);
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-exports are already handled by inline export declarations above.

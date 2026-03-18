/**
 * Business Action Catalog
 *
 * Research-backed business actions with impact coefficients for SaaS companies.
 * Sources: OpenView SaaS Benchmarks, Bessemer Cloud Index, KeyBanc Research
 *
 * Actions model real-world interventions like pricing changes, sales investments,
 * and operational improvements with quantified impacts on SaaS KPIs.
 */

import type { ESOIndustry, ESOPersona } from "@backend/types/eso";

/** Business action categories */
export type ActionCategory =
  | "pricing"
  | "sales"
  | "marketing"
  | "product"
  | "customer_success"
  | "operations"
  | "expansion";

/** Business action identifiers */
export type BusinessActionId =
  | "price_increase_5pct"
  | "price_decrease_5pct"
  | "freemium_to_paid"
  | "annual_commitment_discount"
  | "increase_sales_team_20pct"
  | "double_marketing_spend"
  | "launch_abm_campaign"
  | "implement_lead_scoring"
  | "reduce_pricing_tiers"
  | "add_self_service_onboarding"
  | "improve_page_load_50pct"
  | "launch_new_feature_category"
  | "implement_health_scoring"
  | "increase_csm_ratio_2x"
  | "launch_customer_education"
  | "proactive_churn_intervention"
  | "automate_manual_processes"
  | "reduce_support_ticket_time"
  | "implement_usage_based_pricing"
  | "expand_to_new_vertical";

/** Impact on a specific KPI */
export interface KPIImpact {
  kpiId: string;
  /** Percentage change (0.05 = +5%) */
  medianImpact: number;
  /** 10th-90th percentile range */
  range: [number, number];
  /** Time to see initial impact (days) */
  timeToImpact: number;
  /** Confidence based on research quality (0-1) */
  confidence: number;
}

/** Business action definition */
export interface BusinessAction {
  id: BusinessActionId;
  name: string;
  category: ActionCategory;
  description: string;
  /** Typical implementation cost range */
  costRange: [number, number];
  /** Key performance indicators this action affects */
  impacts: KPIImpact[];
  /** Primary personas who care about this action */
  relevantPersonas: ESOPersona[];
  /** Industries where this applies */
  applicableIndustries: ESOIndustry[];
  /** Required company maturity (startup/scaleup/enterprise) */
  maturityLevel: "startup" | "scaleup" | "enterprise" | "all";
  /** Implementation complexity */
  complexity: "low" | "medium" | "high";
  /** Common risks */
  risks: string[];
  /** Success factors */
  prerequisites: string[];
}

// ============================================================================
// Pricing Actions
// ============================================================================

export const PRICE_INCREASE_5PCT: BusinessAction = {
  id: "price_increase_5pct",
  name: "5% Price Increase",
  category: "pricing",
  description: "Increase list prices by 5% for new customers while grandfathering existing customers",
  costRange: [5000, 20000],
  impacts: [
    {
      kpiId: "saas_arr",
      medianImpact: 0.045,
      range: [0.02, 0.08],
      timeToImpact: 90,
      confidence: 0.75,
    },
    {
      kpiId: "saas_logo_churn",
      medianImpact: 0.02,
      range: [-0.01, 0.05],
      timeToImpact: 180,
      confidence: 0.6,
    },
    {
      kpiId: "saas_nrr",
      medianImpact: 0.03,
      range: [0.01, 0.06],
      timeToImpact: 180,
      confidence: 0.65,
    },
  ],
  relevantPersonas: ["cfo", "vp_sales"],
  applicableIndustries: ["saas"],
  maturityLevel: "all",
  complexity: "low",
  risks: ["Customer pushback", "Competitive disadvantage"],
  prerequisites: ["Strong product-market fit", "Low current churn"],
};

export const ANNUAL_COMMITMENT_DISCOUNT: BusinessAction = {
  id: "annual_commitment_discount",
  name: "Annual Commitment Discount",
  category: "pricing",
  description: "Offer 15-20% discount for annual upfront payments to improve cash flow",
  costRange: [10000, 50000],
  impacts: [
    {
      kpiId: "saas_cac",
      medianImpact: -0.15,
      range: [-0.25, -0.05],
      timeToImpact: 30,
      confidence: 0.8,
    },
    {
      kpiId: "saas_logo_churn",
      medianImpact: -0.08,
      range: [-0.15, -0.02],
      timeToImpact: 180,
      confidence: 0.75,
    },
    {
      kpiId: "fin_dso",
      medianImpact: -0.3,
      range: [-0.5, -0.15],
      timeToImpact: 30,
      confidence: 0.85,
    },
  ],
  relevantPersonas: ["cfo", "vp_sales"],
  applicableIndustries: ["saas"],
  maturityLevel: "all",
  complexity: "low",
  risks: ["Cash flow timing impact", "Customer preference for monthly"],
  prerequisites: ["Strong unit economics", "Cash to cover CAC"],
};

// ============================================================================
// Sales Actions
// ============================================================================

export const INCREASE_SALES_TEAM_20PCT: BusinessAction = {
  id: "increase_sales_team_20pct",
  name: "Expand Sales Team 20%",
  category: "sales",
  description: "Hire additional account executives and SDRs to increase pipeline capacity",
  costRange: [150000, 400000],
  impacts: [
    {
      kpiId: "saas_arr",
      medianImpact: 0.18,
      range: [0.1, 0.3],
      timeToImpact: 180,
      confidence: 0.7,
    },
    {
      kpiId: "saas_cac",
      medianImpact: 0.05,
      range: [-0.05, 0.15],
      timeToImpact: 180,
      confidence: 0.5,
    },
    {
      kpiId: "ops_revenue_per_employee",
      medianImpact: -0.08,
      range: [-0.15, 0],
      timeToImpact: 180,
      confidence: 0.6,
    },
  ],
  relevantPersonas: ["vp_sales", "cfo"],
  applicableIndustries: ["saas"],
  maturityLevel: "scaleup",
  complexity: "high",
  risks: ["Hiring delays", "Ramp time", "Market saturation"],
  prerequisites: ["Proven sales playbook", "Sufficient leads"],
};

// ============================================================================
// Customer Success Actions
// ============================================================================

export const IMPLEMENT_HEALTH_SCORING: BusinessAction = {
  id: "implement_health_scoring",
  name: "Implement Customer Health Scoring",
  category: "customer_success",
  description: "Deploy predictive health scores to identify at-risk customers early",
  costRange: [30000, 80000],
  impacts: [
    {
      kpiId: "saas_logo_churn",
      medianImpact: -0.12,
      range: [-0.2, -0.05],
      timeToImpact: 90,
      confidence: 0.75,
    },
    {
      kpiId: "saas_nrr",
      medianImpact: 0.05,
      range: [0.02, 0.1],
      timeToImpact: 180,
      confidence: 0.7,
    },
    {
      kpiId: "saas_expansion_rate",
      medianImpact: 0.08,
      range: [0.03, 0.15],
      timeToImpact: 180,
      confidence: 0.65,
    },
  ],
  relevantPersonas: ["vp_ops", "cfo"],
  applicableIndustries: ["saas"],
  maturityLevel: "scaleup",
  complexity: "medium",
  risks: ["Data quality issues", "False positives"],
  prerequisites: ["Product usage data", "Integration capabilities"],
};

export const INCREASE_CSM_RATIO_2X: BusinessAction = {
  id: "increase_csm_ratio_2x",
  name: "Double CSM-to-Customer Ratio",
  category: "customer_success",
  description: "Reduce CSM book size for more proactive customer engagement",
  costRange: [200000, 500000],
  impacts: [
    {
      kpiId: "saas_logo_churn",
      medianImpact: -0.15,
      range: [-0.25, -0.08],
      timeToImpact: 180,
      confidence: 0.8,
    },
    {
      kpiId: "saas_nrr",
      medianImpact: 0.08,
      range: [0.03, 0.15],
      timeToImpact: 270,
      confidence: 0.75,
    },
    {
      kpiId: "saas_expansion_rate",
      medianImpact: 0.12,
      range: [0.05, 0.2],
      timeToImpact: 270,
      confidence: 0.7,
    },
  ],
  relevantPersonas: ["vp_ops", "cfo"],
  applicableIndustries: ["saas"],
  maturityLevel: "scaleup",
  complexity: "medium",
  risks: ["Hiring pipeline", "Training time"],
  prerequisites: ["CSM playbooks", "Upsell motion"],
};

// ============================================================================
// Product/Operations Actions
// ============================================================================

export const IMPROVE_PAGE_LOAD_50PCT: BusinessAction = {
  id: "improve_page_load_50pct",
  name: "Reduce Page Load Time 50%",
  category: "product",
  description: "Performance optimization to improve user experience and conversion",
  costRange: [50000, 150000],
  impacts: [
    {
      kpiId: "saas_cac",
      medianImpact: -0.08,
      range: [-0.15, -0.02],
      timeToImpact: 60,
      confidence: 0.7,
    },
    {
      kpiId: "cust_time_to_value",
      medianImpact: -0.2,
      range: [-0.3, -0.1],
      timeToImpact: 30,
      confidence: 0.75,
    },
    {
      kpiId: "saas_logo_churn",
      medianImpact: -0.05,
      range: [-0.1, -0.01],
      timeToImpact: 180,
      confidence: 0.6,
    },
  ],
  relevantPersonas: ["cto", "vp_sales"],
  applicableIndustries: ["saas"],
  maturityLevel: "all",
  complexity: "medium",
  risks: ["Technical debt", "Scope creep"],
  prerequisites: ["Performance monitoring", "A/B testing"],
};

export const ADD_SELF_SERVICE_ONBOARDING: BusinessAction = {
  id: "add_self_service_onboarding",
  name: "Self-Service Onboarding",
  category: "product",
  description: "Reduce friction with guided product tours and automated setup",
  costRange: [40000, 120000],
  impacts: [
    {
      kpiId: "saas_cac",
      medianImpact: -0.15,
      range: [-0.25, -0.08],
      timeToImpact: 90,
      confidence: 0.75,
    },
    {
      kpiId: "saas_magic_number",
      medianImpact: 0.12,
      range: [0.05, 0.2],
      timeToImpact: 90,
      confidence: 0.7,
    },
    {
      kpiId: "cust_time_to_value",
      medianImpact: -0.3,
      range: [-0.5, -0.15],
      timeToImpact: 60,
      confidence: 0.8,
    },
  ],
  relevantPersonas: ["cto", "vp_sales"],
  applicableIndustries: ["saas"],
  maturityLevel: "scaleup",
  complexity: "medium",
  risks: ["Low-touch doesn't work for complex products"],
  prerequisites: ["Product simplicity", "Good UX foundation"],
};

// ============================================================================
// Marketing Actions
// ============================================================================

export const LAUNCH_ABM_CAMPAIGN: BusinessAction = {
  id: "launch_abm_campaign",
  name: "Launch ABM Campaign",
  category: "marketing",
  description: "Account-based marketing for enterprise accounts with personalized content",
  costRange: [100000, 300000],
  impacts: [
    {
      kpiId: "saas_arr",
      medianImpact: 0.25,
      range: [0.1, 0.4],
      timeToImpact: 180,
      confidence: 0.65,
    },
    {
      kpiId: "saas_cac",
      medianImpact: 0.1,
      range: [0, 0.2],
      timeToImpact: 180,
      confidence: 0.55,
    },
    {
      kpiId: "saas_ltv_cac",
      medianImpact: 0.15,
      range: [0.05, 0.25],
      timeToImpact: 365,
      confidence: 0.6,
    },
  ],
  relevantPersonas: ["cmo", "vp_sales"],
  applicableIndustries: ["saas"],
  maturityLevel: "enterprise",
  complexity: "high",
  risks: ["Long sales cycles", "High CAC", "Team coordination"],
  prerequisites: ["Target account list", "Sales alignment"],
};

// ============================================================================
// Action Registry
// ============================================================================

/** All available business actions */
export const ALL_BUSINESS_ACTIONS: BusinessAction[] = [
  PRICE_INCREASE_5PCT,
  ANNUAL_COMMITMENT_DISCOUNT,
  INCREASE_SALES_TEAM_20PCT,
  IMPLEMENT_HEALTH_SCORING,
  INCREASE_CSM_RATIO_2X,
  IMPROVE_PAGE_LOAD_50PCT,
  ADD_SELF_SERVICE_ONBOARDING,
  LAUNCH_ABM_CAMPAIGN,
];

/** Get action by ID */
export function getBusinessAction(id: BusinessActionId): BusinessAction | undefined {
  return ALL_BUSINESS_ACTIONS.find((a) => a.id === id);
}

/** Get actions by category */
export function getActionsByCategory(category: ActionCategory): BusinessAction[] {
  return ALL_BUSINESS_ACTIONS.filter((a) => a.category === category);
}

/** Get actions relevant to a persona */
export function getActionsForPersona(persona: ESOPersona): BusinessAction[] {
  return ALL_BUSINESS_ACTIONS.filter((a) => a.relevantPersonas.includes(persona));
}

/** Get actions applicable to company maturity */
export function getActionsForMaturity(
  level: "startup" | "scaleup" | "enterprise"
): BusinessAction[] {
  return ALL_BUSINESS_ACTIONS.filter(
    (a) => a.maturityLevel === "all" || a.maturityLevel === level
  );
}

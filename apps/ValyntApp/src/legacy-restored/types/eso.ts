/**
 * ESO (Economic Structure Ontology) Types
 *
 * The ESO is a graph database that defines 500+ industry-standard KPIs
 * and their mathematical dependencies. It maps:
 * - Personas to their primary pain points
 * - Pain points to measurable KPIs
 * - KPIs to financial drivers (EBITDA impact)
 *
 * Based on: ValueOS Agent and Value Fabric Architectural Specification
 */

import { z } from "zod";

// ============================================================================
// Core Types
// ============================================================================

/**
 * Industry verticals covered by the ESO
 */
export type ESOIndustry =
  | "saas"
  | "manufacturing"
  | "healthcare"
  | "finance"
  | "retail"
  | "technology"
  | "professional_services";

/**
 * Stakeholder personas with economic interests
 * 8 core personas covering all major decision-making roles in B2B organizations
 */
export type ESOPersona =
  | "ceo"
  | "cfo"
  | "cio"
  | "cto"
  | "coo"
  | "vp_sales"
  | "vp_marketing"
  | "vp_engineering";

/**
 * KPI improvement direction
 */
export type ImprovementDirection = "higher_is_better" | "lower_is_better";

/**
 * Relationship types between nodes
 */
export type ESORelationType =
  | "causal_driver"
  | "inverse_correlation"
  | "linear_correlation"
  | "component_of"
  | "influences";

/**
 * Financial driver categories
 */
export type FinancialDriver =
  | "revenue_uplift"
  | "cost_reduction"
  | "risk_mitigation"
  | "capital_efficiency"
  | "productivity_gain"
  | "fcf_improvement"
  | "ebitda_expansion";

/**
 * Data types for KPI values
 */
export type ESODataType =
  | "currency"
  | "percentage"
  | "duration"
  | "float"
  | "ratio"
  | "index"
  | "count";

// ============================================================================
// Node Types
// ============================================================================

/**
 * Benchmark data for a KPI
 */
export interface ESOBenchmark {
  p25: number; // 25th percentile (lagging)
  p50: number; // 50th percentile (median)
  p75: number; // 75th percentile (leading)
  p90?: number; // 90th percentile (if available)
  worldClass?: number;
  source: string;
  vintage: string; // e.g., "2025-Q4"
}

/**
 * KPI node in the ontology
 */
export interface ESOKPINode {
  id: string; // e.g., "saas_nrr", "mfg_oee"
  name: string; // Human-readable name
  domain: ESOIndustry;
  category: string; // e.g., "Revenue", "Operations", "Finance"
  dataType?: ESODataType; // e.g., "currency", "percentage", "duration"
  unit: string; // e.g., "percentage", "days", "usd"
  description: string;
  formulaString?: string; // Mathematical formula if calculated
  dependencies: string[]; // IDs of KPIs this depends on
  improvementDirection: ImprovementDirection;
  benchmarks: ESOBenchmark;
  contextualFactors?: string[]; // Additional context like "High automation reduces cost by ~81%"
  usage?: string; // Description of how the metric is used, e.g., "Input for NRR calculation"
}

/**
 * Persona value map - connects personas to their economic interests
 */
export interface ESOPersonaValueMap {
  persona: ESOPersona;
  primaryPain: string;
  painDescription: string;
  keyKPIs: string[]; // KPI node IDs
  financialDriver: FinancialDriver;
  typicalGoals: string[];
  communicationPreference: "technical" | "strategic" | "hybrid";
}

/**
 * Edge between nodes in the ontology
 */
export interface ESOEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: ESORelationType;
  strength: number; // -1.0 to 1.0
  logic?: string; // Calculation logic
  description?: string;
}

/**
 * Complete ESO graph structure
 */
export interface ESOGraph {
  version: string;
  lastUpdated: string;
  nodes: ESOKPINode[];
  edges: ESOEdge[];
  personaMaps: ESOPersonaValueMap[];
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const ESOBenchmarkSchema = z.object({
  p25: z.number(),
  p50: z.number(),
  p75: z.number(),
  p90: z.number().optional(),
  worldClass: z.number().optional(),
  source: z.string(),
  vintage: z.string(),
});

export const ESOKPINodeSchema = z.object({
  id: z.string().regex(/^[a-z_]+$/),
  name: z.string(),
  domain: z.enum([
    "saas",
    "manufacturing",
    "healthcare",
    "finance",
    "retail",
    "technology",
    "professional_services",
  ]),
  category: z.string(),
  dataType: z
    .enum(["currency", "percentage", "duration", "float", "ratio", "index", "count"])
    .optional(),
  unit: z.string(),
  description: z.string(),
  formulaString: z.string().optional(),
  dependencies: z.array(z.string()),
  improvementDirection: z.enum(["higher_is_better", "lower_is_better"]),
  benchmarks: ESOBenchmarkSchema,
  contextualFactors: z.array(z.string()).optional(),
  usage: z.string().optional(),
});

export const ESOPersonaValueMapSchema = z.object({
  persona: z.enum([
    "ceo",
    "cfo",
    "cio",
    "cto",
    "coo",
    "vp_sales",
    "vp_marketing",
    "vp_engineering",
  ]),
  primaryPain: z.string(),
  painDescription: z.string(),
  keyKPIs: z.array(z.string()),
  financialDriver: z.enum([
    "revenue_uplift",
    "cost_reduction",
    "risk_mitigation",
    "capital_efficiency",
    "productivity_gain",
    "fcf_improvement",
    "ebitda_expansion",
  ]),
  typicalGoals: z.array(z.string()),
  communicationPreference: z.enum(["technical", "strategic", "hybrid"]),
});

export const ESOEdgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  type: z.enum([
    "causal_driver",
    "inverse_correlation",
    "linear_correlation",
    "component_of",
    "influences",
  ]),
  strength: z.number().min(-1).max(1),
  logic: z.string().optional(),
  description: z.string().optional(),
});

export const ESOGraphSchema = z.object({
  version: z.string(),
  lastUpdated: z.string().datetime(),
  nodes: z.array(ESOKPINodeSchema),
  edges: z.array(ESOEdgeSchema),
  personaMaps: z.array(ESOPersonaValueMapSchema),
});

// ============================================================================
// Seed Data - Core KPI Nodes
// ============================================================================

export const ESO_SEED_KPIS: ESOKPINode[] = [
  // SaaS Metrics
  {
    id: "saas_nrr",
    name: "Net Revenue Retention",
    domain: "saas",
    category: "Revenue",
    dataType: "percentage",
    unit: "%",
    description:
      "Percentage of recurring revenue retained from existing customers including expansion",
    formulaString: "(starting_arr + expansion - churn) / starting_arr * 100",
    dependencies: ["saas_logo_churn", "saas_expansion_revenue"],
    improvementDirection: "higher_is_better",
    benchmarks: {
      p25: 97,
      p50: 104,
      p75: 112,
      p90: 118,
      worldClass: 130,
      source: "ScaleMetrics",
      vintage: "2025",
    },
    contextualFactors: [
      "Healthy Target: >100% (ideally >120% for high growth)",
      "Bootstrapped vs VC: Bootstrapped median ~104%",
    ],
    usage: "Key valuation metric for SaaS companies",
  },
  {
    id: "saas_logo_churn",
    name: "Logo Churn Rate",
    domain: "saas",
    category: "Revenue",
    unit: "percentage",
    description: "Percentage of customers lost in a period",
    dependencies: [],
    improvementDirection: "lower_is_better",
    benchmarks: {
      p25: 15,
      p50: 10,
      p75: 5,
      worldClass: 2,
      source: "SaaS Capital",
      vintage: "2025-Q4",
    },
  },
  {
    id: "saas_cac",
    name: "Customer Acquisition Cost",
    domain: "saas",
    category: "Sales",
    unit: "usd",
    description: "Total cost to acquire a new customer",
    dependencies: [],
    improvementDirection: "lower_is_better",
    benchmarks: {
      p25: 1000,
      p50: 656,
      p75: 239,
      source: "FirstPageSage",
      vintage: "2025-Q4",
    },
  },

  // Finance Metrics
  {
    id: "fin_dso",
    name: "Days Sales Outstanding",
    domain: "finance",
    category: "Working Capital",
    unit: "days",
    description: "Average number of days to collect payment after a sale",
    dependencies: [],
    improvementDirection: "lower_is_better",
    benchmarks: { p25: 48, p50: 38, p75: 30, source: "APQC", vintage: "2023" },
  },
  {
    id: "fin_ap_cost",
    name: "AP Invoice Processing Cost",
    domain: "finance",
    category: "Operations",
    unit: "usd",
    description: "Cost to process a single accounts payable invoice",
    dependencies: [],
    improvementDirection: "lower_is_better",
    benchmarks: {
      p25: 12.5,
      p50: 5.83,
      p75: 2.5,
      source: "APQC",
      vintage: "2023",
    },
  },

  // Manufacturing Metrics
  {
    id: "mfg_oee",
    name: "Overall Equipment Effectiveness",
    domain: "manufacturing",
    category: "Operations",
    unit: "percentage",
    description: "Measure of how well manufacturing equipment is utilized",
    formulaString: "availability * performance * quality",
    dependencies: ["mfg_availability", "mfg_performance", "mfg_quality"],
    improvementDirection: "higher_is_better",
    benchmarks: {
      p25: 45,
      p50: 60,
      p75: 85,
      worldClass: 95,
      source: "Industry Reports",
      vintage: "2025",
    },
  },
  {
    id: "mfg_throughput",
    name: "Manufacturing Throughput",
    domain: "manufacturing",
    category: "Operations",
    unit: "units_per_hour",
    description: "Number of units produced per time period",
    formulaString: "theoretical_max_output * mfg_oee",
    dependencies: ["mfg_oee"],
    improvementDirection: "higher_is_better",
    benchmarks: {
      p25: 100,
      p50: 150,
      p75: 200,
      source: "Internal",
      vintage: "2025",
    },
  },

  // Marketing Metrics
  {
    id: "mkt_cac_ratio",
    name: "Customer Acquisition Cost Ratio",
    domain: "saas",
    category: "Marketing",
    unit: "ratio",
    description: "Ratio of customer acquisition cost to customer lifetime value",
    formulaString: "cac / clv",
    dependencies: ["saas_cac"],
    improvementDirection: "lower_is_better",
    benchmarks: {
      p25: 0.8,
      p50: 0.5,
      p75: 0.3,
      worldClass: 0.1,
      source: "Marketing Benchmarks",
      vintage: "2025",
    },
    contextualFactors: ["Target: <0.5 for profitable customer acquisition"],
    usage: "Key metric for marketing efficiency and ROI",
  },
  {
    id: "mkt_lead_velocity",
    name: "Lead Velocity Rate",
    domain: "saas",
    category: "Marketing",
    unit: "percentage",
    description: "Month-over-month growth rate of qualified leads",
    dependencies: [],
    improvementDirection: "higher_is_better",
    benchmarks: {
      p25: 10,
      p50: 25,
      p75: 50,
      worldClass: 100,
      source: "HubSpot Benchmarks",
      vintage: "2025",
    },
    usage: "Indicates marketing momentum and sales pipeline health",
  },
  {
    id: "mkt_brand_awareness",
    name: "Brand Awareness Score",
    domain: "saas",
    category: "Marketing",
    unit: "percentage",
    description: "Percentage of target market aware of brand",
    dependencies: [],
    improvementDirection: "higher_is_better",
    benchmarks: {
      p25: 15,
      p50: 30,
      p75: 60,
      worldClass: 85,
      source: "Brand Analytics",
      vintage: "2025",
    },
    usage: "Measures brand strength in target market",
  },

  // Engineering Metrics
  {
    id: "eng_deployment_freq",
    name: "Deployment Frequency",
    domain: "technology",
    category: "Engineering",
    unit: "deployments_per_day",
    description: "Number of production deployments per day",
    dependencies: [],
    improvementDirection: "higher_is_better",
    benchmarks: {
      p25: 0.1,
      p50: 1,
      p75: 10,
      worldClass: 50,
      source: "DORA Metrics",
      vintage: "2025",
    },
    contextualFactors: ["Elite performers deploy multiple times per day"],
    usage: "Key DevOps metric for delivery speed",
  },
  {
    id: "eng_change_failure_rate",
    name: "Change Failure Rate",
    domain: "technology",
    category: "Engineering",
    unit: "percentage",
    description: "Percentage of deployments that fail or require remediation",
    dependencies: [],
    improvementDirection: "lower_is_better",
    benchmarks: {
      p25: 30,
      p50: 15,
      p75: 5,
      worldClass: 0,
      source: "DORA Metrics",
      vintage: "2025",
    },
    usage: "Measures deployment quality and reliability",
  },
  {
    id: "eng_mttr",
    name: "Mean Time to Recovery",
    domain: "technology",
    category: "Engineering",
    unit: "hours",
    description: "Average time to recover from production incidents",
    dependencies: [],
    improvementDirection: "lower_is_better",
    benchmarks: {
      p25: 168, // 1 week
      p50: 24, // 1 day
      p75: 1, // 1 hour
      worldClass: 0.1, // 6 minutes
      source: "DORA Metrics",
      vintage: "2025",
    },
    usage: "Measures system resilience and incident response",
  },
  {
    id: "eng_cycle_time",
    name: "Software Development Cycle Time",
    domain: "technology",
    category: "Engineering",
    unit: "days",
    description: "Average time from code commit to production deployment",
    dependencies: [],
    improvementDirection: "lower_is_better",
    benchmarks: {
      p25: 30,
      p50: 14,
      p75: 3,
      worldClass: 1,
      source: "Engineering Benchmarks",
      vintage: "2025",
    },
    usage: "Measures development speed and agility",
  },

  // CEO-Level Business Metrics
  {
    id: "biz_revenue_growth",
    name: "Revenue Growth Rate",
    domain: "saas",
    category: "Business",
    unit: "percentage",
    description: "Year-over-year revenue growth percentage",
    dependencies: [],
    improvementDirection: "higher_is_better",
    benchmarks: {
      p25: 10,
      p50: 25,
      p75: 50,
      worldClass: 100,
      source: "Public Company Data",
      vintage: "2025",
    },
    contextualFactors: ["High-growth SaaS targets: 50%+ YoY growth"],
    usage: "Primary business growth metric",
  },
  {
    id: "biz_gross_margin",
    name: "Gross Margin",
    domain: "saas",
    category: "Business",
    unit: "percentage",
    description: "Revenue minus cost of goods sold as percentage of revenue",
    dependencies: [],
    improvementDirection: "higher_is_better",
    benchmarks: {
      p25: 60,
      p50: 75,
      p75: 85,
      worldClass: 90,
      source: "Industry Benchmarks",
      vintage: "2025",
    },
    usage: "Measures business profitability and pricing power",
  },
  {
    id: "biz_customer_satisfaction",
    name: "Customer Satisfaction Score",
    domain: "saas",
    category: "Business",
    unit: "score",
    description: "Average customer satisfaction rating (1-10 scale)",
    dependencies: [],
    improvementDirection: "higher_is_better",
    benchmarks: {
      p25: 7,
      p50: 8,
      p75: 9,
      worldClass: 9.5,
      source: "NPS Benchmarks",
      vintage: "2025",
    },
    usage: "Measures customer experience and loyalty",
  },
];

// ============================================================================
// Seed Data - Persona Value Maps
// ============================================================================

export const ESO_SEED_PERSONA_MAPS: ESOPersonaValueMap[] = [
  {
    persona: "ceo",
    primaryPain: "Business Growth & Market Leadership",
    painDescription:
      "Pressure to deliver consistent revenue growth while maintaining profitability and competitive advantage",
    keyKPIs: ["biz_revenue_growth", "biz_gross_margin", "biz_customer_satisfaction", "saas_nrr"],
    financialDriver: "ebitda_expansion",
    typicalGoals: [
      "Achieve 30%+ annual revenue growth",
      "Maintain 80%+ gross margins",
      "Lead market share in key segments",
      "Deliver consistent EBITDA expansion",
    ],
    communicationPreference: "strategic",
  },
  {
    persona: "cfo",
    primaryPain: "Capital Efficiency & Cash Flow Optimization",
    painDescription:
      "Balancing growth investments with cash preservation and working capital management",
    keyKPIs: ["fin_dso", "fin_ap_cost", "biz_gross_margin", "saas_nrr"],
    financialDriver: "fcf_improvement",
    typicalGoals: [
      "Reduce DSO by 10 days",
      "Improve cash conversion cycle",
      "Optimize working capital efficiency",
      "Maintain strong balance sheet ratios",
    ],
    communicationPreference: "strategic",
  },
  {
    persona: "cio",
    primaryPain: "Digital Transformation & Technology ROI",
    painDescription:
      "Justifying technology investments while managing legacy systems and digital transformation complexity",
    keyKPIs: ["fin_ap_cost", "eng_mttr", "biz_customer_satisfaction"],
    financialDriver: "cost_reduction",
    typicalGoals: [
      "Reduce IT operational costs by 15%",
      "Improve system uptime to 99.9%",
      "Accelerate digital transformation initiatives",
      "Demonstrate clear technology ROI",
    ],
    communicationPreference: "technical",
  },
  {
    persona: "cto",
    primaryPain: "Innovation Velocity & Technical Excellence",
    painDescription:
      "Balancing rapid innovation with system reliability and technical debt management",
    keyKPIs: ["eng_deployment_freq", "eng_change_failure_rate", "eng_cycle_time"],
    financialDriver: "productivity_gain",
    typicalGoals: [
      "Increase deployment frequency to daily",
      "Reduce change failure rate below 5%",
      "Achieve world-class engineering metrics",
      "Drive breakthrough product innovation",
    ],
    communicationPreference: "technical",
  },
  {
    persona: "coo",
    primaryPain: "Operational Scalability & Efficiency",
    painDescription: "Scaling operations while maintaining quality and managing cost pressures",
    keyKPIs: ["mfg_oee", "mfg_throughput", "fin_ap_cost"],
    financialDriver: "productivity_gain",
    typicalGoals: [
      "Achieve 85%+ OEE across operations",
      "Scale throughput by 25% YoY",
      "Reduce operational costs by 10%",
      "Improve process consistency",
    ],
    communicationPreference: "hybrid",
  },
  {
    persona: "vp_sales",
    primaryPain: "Revenue Predictability & Growth Acceleration",
    painDescription: "Inconsistent pipeline and sales velocity challenges in competitive markets",
    keyKPIs: ["saas_cac", "saas_nrr", "mkt_lead_velocity"],
    financialDriver: "revenue_uplift",
    typicalGoals: [
      "Increase ARR growth rate to 40%+",
      "Reduce CAC payback period to <12 months",
      "Improve win rates by 15%",
      "Expand market penetration",
    ],
    communicationPreference: "strategic",
  },
  {
    persona: "vp_marketing",
    primaryPain: "Demand Generation & Brand Equity",
    painDescription: "Creating consistent demand while building brand strength in crowded markets",
    keyKPIs: [
      "mkt_cac_ratio",
      "mkt_lead_velocity",
      "mkt_brand_awareness",
      "biz_customer_satisfaction",
    ],
    financialDriver: "revenue_uplift",
    typicalGoals: [
      "Improve CAC ratio to <0.5",
      "Grow qualified leads by 50% YoY",
      "Increase brand awareness by 25%",
      "Enhance customer lifetime value",
    ],
    communicationPreference: "strategic",
  },
  {
    persona: "vp_engineering",
    primaryPain: "Product Delivery & Quality Balance",
    painDescription: "Delivering high-quality products quickly while managing technical complexity",
    keyKPIs: ["eng_deployment_freq", "eng_change_failure_rate", "eng_cycle_time", "eng_mttr"],
    financialDriver: "productivity_gain",
    typicalGoals: [
      "Reduce development cycle time by 40%",
      "Maintain <5% change failure rate",
      "Achieve multiple daily deployments",
      "Deliver products ahead of schedule",
    ],
    communicationPreference: "technical",
  },
];

// ============================================================================
// Seed Data - Edges
// ============================================================================

export const ESO_SEED_EDGES: ESOEdge[] = [
  {
    id: "edge_oee_throughput",
    sourceId: "mfg_oee",
    targetId: "mfg_throughput",
    type: "causal_driver",
    strength: 0.85,
    logic: "linear_correlation",
    description: "Higher OEE directly increases throughput capacity",
  },
  {
    id: "edge_churn_nrr",
    sourceId: "saas_logo_churn",
    targetId: "saas_nrr",
    type: "inverse_correlation",
    strength: -0.9,
    description: "Higher churn reduces NRR",
  },
  {
    id: "edge_dso_fcf",
    sourceId: "fin_dso",
    targetId: "fin_dso", // Would link to FCF node
    type: "inverse_correlation",
    strength: -0.7,
    description: "Higher DSO reduces free cash flow",
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get complete seed ESO graph
 */
export function getESOSeedGraph(): ESOGraph {
  return {
    version: "1.0.0",
    lastUpdated: new Date().toISOString(),
    nodes: ESO_SEED_KPIS,
    edges: ESO_SEED_EDGES,
    personaMaps: ESO_SEED_PERSONA_MAPS,
  };
}

/**
 * Find KPIs relevant to a persona
 */
export function getKPIsForPersona(persona: ESOPersona): ESOKPINode[] {
  const map = ESO_SEED_PERSONA_MAPS.find((m) => m.persona === persona);
  if (!map) return [];

  return ESO_SEED_KPIS.filter((kpi) => map.keyKPIs.includes(kpi.id));
}

/**
 * Get financial driver for a persona
 */
export function getFinancialDriver(persona: ESOPersona): FinancialDriver | undefined {
  const map = ESO_SEED_PERSONA_MAPS.find((m) => m.persona === persona);
  return map?.financialDriver;
}

/**
 * Find all downstream KPIs affected by a change
 */
export function findDependentKPIs(kpiId: string): ESOKPINode[] {
  const dependents: ESOKPINode[] = [];

  for (const kpi of ESO_SEED_KPIS) {
    if (kpi.dependencies.includes(kpiId)) {
      dependents.push(kpi);
      // Recursively find downstream
      dependents.push(...findDependentKPIs(kpi.id));
    }
  }

  return dependents;
}

/**
 * Check if a projected improvement exceeds 90th percentile (FCC check)
 */
export function checkBenchmarkAlignment(
  kpiId: string,
  projectedValue: number
): { aligned: boolean; percentile: string; warning?: string } {
  const kpi = ESO_SEED_KPIS.find((k) => k.id === kpiId);
  if (!kpi) return { aligned: true, percentile: "unknown" };

  const { p25, p50, p75 } = kpi.benchmarks;
  const isHigherBetter = kpi.improvementDirection === "higher_is_better";

  // Check if value exceeds reasonable bounds (proxy for 90th percentile)
  const p90Estimate = isHigherBetter ? p75 + (p75 - p50) * 0.5 : p25 - (p50 - p25) * 0.5;

  const exceeds90th = isHigherBetter ? projectedValue > p90Estimate : projectedValue < p90Estimate;

  if (exceeds90th) {
    return {
      aligned: false,
      percentile: ">90th",
      warning: `Projected ${kpi.name} of ${projectedValue} exceeds 90th percentile. Flag for SME review.`,
    };
  }

  // Determine which percentile the value falls into
  if (isHigherBetter) {
    if (projectedValue >= p75) return { aligned: true, percentile: "75th+" };
    if (projectedValue >= p50) return { aligned: true, percentile: "50th-75th" };
    return { aligned: true, percentile: "<50th" };
  } else {
    if (projectedValue <= p75) return { aligned: true, percentile: "75th+" };
    if (projectedValue <= p50) return { aligned: true, percentile: "50th-75th" };
    return { aligned: true, percentile: "<50th" };
  }
}

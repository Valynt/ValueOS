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
 */
export type ESOPersona =
  | "cfo"
  | "cio"
  | "cto"
  | "coo"
  | "vp_sales"
  | "vp_ops"
  | "vp_engineering"
  | "director_finance"
  | "data_analyst";

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
    .enum([
      "currency",
      "percentage",
      "duration",
      "float",
      "ratio",
      "index",
      "count",
    ])
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
    "cfo",
    "cio",
    "cto",
    "coo",
    "vp_sales",
    "vp_ops",
    "vp_engineering",
    "director_finance",
    "data_analyst",
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
];

// ============================================================================
// Seed Data - Persona Value Maps
// ============================================================================

export const ESO_SEED_PERSONA_MAPS: ESOPersonaValueMap[] = [
  {
    persona: "cfo",
    primaryPain: "Working Capital Friction",
    painDescription:
      "Cash flow visibility and working capital optimization challenges",
    keyKPIs: ["fin_dso", "fin_ap_cost", "saas_nrr"],
    financialDriver: "fcf_improvement",
    typicalGoals: [
      "Reduce DSO by 10 days",
      "Improve cash conversion cycle",
      "Optimize working capital",
    ],
    communicationPreference: "strategic",
  },
  {
    persona: "cio",
    primaryPain: "Technical Debt",
    painDescription:
      "Maintenance burden and integration complexity limiting innovation",
    keyKPIs: ["fin_ap_cost"],
    financialDriver: "cost_reduction",
    typicalGoals: [
      "Reduce maintenance ratio",
      "Improve system uptime",
      "Decrease integration costs",
    ],
    communicationPreference: "technical",
  },
  {
    persona: "vp_ops",
    primaryPain: "Asset Downtime & Process Variability",
    painDescription: "Equipment efficiency and process consistency challenges",
    keyKPIs: ["mfg_oee", "mfg_throughput"],
    financialDriver: "productivity_gain",
    typicalGoals: [
      "Achieve 85% OEE",
      "Reduce cycle time by 15%",
      "Minimize unplanned downtime",
    ],
    communicationPreference: "hybrid",
  },
  {
    persona: "vp_sales",
    primaryPain: "Pipeline Volatility",
    painDescription: "Inconsistent pipeline and deal velocity challenges",
    keyKPIs: ["saas_cac", "saas_nrr"],
    financialDriver: "revenue_uplift",
    typicalGoals: [
      "Improve win rate by 10%",
      "Reduce sales cycle length",
      "Increase deal size",
    ],
    communicationPreference: "strategic",
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
export function getFinancialDriver(
  persona: ESOPersona
): FinancialDriver | undefined {
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
  const p90Estimate = isHigherBetter
    ? p75 + (p75 - p50) * 0.5
    : p25 - (p50 - p25) * 0.5;

  const exceeds90th = isHigherBetter
    ? projectedValue > p90Estimate
    : projectedValue < p90Estimate;

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
    if (projectedValue >= p50)
      return { aligned: true, percentile: "50th-75th" };
    return { aligned: true, percentile: "<50th" };
  } else {
    if (projectedValue <= p75) return { aligned: true, percentile: "75th+" };
    if (projectedValue <= p50)
      return { aligned: true, percentile: "50th-75th" };
    return { aligned: true, percentile: "<50th" };
  }
}

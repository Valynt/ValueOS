/**
 * Structural Truth Types
 *
 * The Structural Truth layer defines mathematical relationships, formulas,
 * and computational logic for KPIs. It provides the foundation for
 * economic reasoning and business case generation.
 *
 * Based on: ValueOS Agent and Value Fabric Architectural Specification
 */

import { z } from "zod";

// ============================================================================
// Core Types
// ============================================================================

/**
 * Industry verticals covered by the Structural Truth layer
 */
export type StructuralIndustry =
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
export type StructuralPersona =
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
export type StructuralRelationType =
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
export type StructuralDataType =
  | "currency"
  | "percentage"
  | "duration"
  | "float"
  | "ratio"
  | "index"
  | "count";

/**
 * Functional form of a formula
 */
export type FormulaFunctionalForm = "ratio" | "difference" | "product" | "custom";

// ============================================================================
// Node Types
// ============================================================================

/**
 * Benchmark data for a KPI
 */
export interface StructuralBenchmark {
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
export interface StructuralKPINode {
  id: string; // e.g., "saas_nrr", "mfg_oee"
  name: string; // Human-readable name
  domain: StructuralIndustry;
  category: string; // e.g., "Revenue", "Operations", "Finance"
  dataType?: StructuralDataType; // e.g., "currency", "percentage", "duration"
  unit: string; // e.g., "percentage", "days", "usd"
  description: string;
  formulaString?: string; // Mathematical formula if calculated
  dependencies: string[]; // IDs of KPIs this depends on
  improvementDirection: ImprovementDirection;
  benchmarks: StructuralBenchmark;
  contextualFactors?: string[]; // Additional context like "High automation reduces cost by ~81%"
  usage?: string; // Description of how the metric is used, e.g., "Input for NRR calculation"
}

/**
 * Formula registry entry
 */
export interface FormulaRegistry {
  formula_id: string;
  formula_name: string;
  output_kpi: string;
  input_kpis: string[];
  functional_form: FormulaFunctionalForm;
  formula: string; // Mathematical expression
  directionality: Record<string, ImprovementDirection>;
  domain: StructuralIndustry;
  required_units: string[];
  validation_constraints: {
    output_range: [number, number];
    logical_checks: string[];
  };
  dependencies: string[]; // Formula dependencies
  complexity_score: number; // 1-10 for computational cost
}

/**
 * Persona value map - connects personas to their economic interests
 */
export interface StructuralPersonaValueMap {
  persona: StructuralPersona;
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
export interface StructuralEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: StructuralRelationType;
  strength: number; // -1.0 to 1.0
  logic?: string; // Calculation logic
  description?: string;
}

/**
 * Complete Structural Truth graph structure
 */
export interface StructuralGraph {
  version: string;
  lastUpdated: string;
  nodes: StructuralKPINode[];
  edges: StructuralEdge[];
  personaMaps: StructuralPersonaValueMap[];
  formulas: FormulaRegistry[];
}

// ============================================================================
// Calculation Types
// ============================================================================

/**
 * Variable definition for formula calculation
 */
export interface FormulaVariable {
  name: string;
  value: number;
  unit?: string;
  source?: string;
}

/**
 * Context for formula evaluation
 */
export interface CalculationContext {
  variables: Record<string, FormulaVariable>;
  functions: Record<string, (...args: number[]) => number>;
}

/**
 * Result of a formula calculation
 */
export interface FormulaResult {
  value: number;
  unit?: string;
  intermediateSteps?: FormulaStep[];
  error?: string;
  confidence?: number;
}

/**
 * Individual step in a calculation chain
 */
export interface FormulaStep {
  calculation: string;
  result: number;
  unit?: string;
}

/**
 * Validation result for a calculation
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  confidence: number;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const StructuralBenchmarkSchema = z.object({
  p25: z.number(),
  p50: z.number(),
  p75: z.number(),
  p90: z.number().optional(),
  worldClass: z.number().optional(),
  source: z.string(),
  vintage: z.string(),
});

export const StructuralKPINodeSchema = z.object({
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
  benchmarks: StructuralBenchmarkSchema,
  contextualFactors: z.array(z.string()).optional(),
  usage: z.string().optional(),
});

export const FormulaRegistrySchema = z.object({
  formula_id: z.string(),
  formula_name: z.string(),
  output_kpi: z.string(),
  input_kpis: z.array(z.string()),
  functional_form: z.enum(["ratio", "difference", "product", "custom"]),
  formula: z.string(),
  directionality: z.record(z.enum(["higher_is_better", "lower_is_better"])),
  domain: z.enum([
    "saas",
    "manufacturing",
    "healthcare",
    "finance",
    "retail",
    "technology",
    "professional_services",
  ]),
  required_units: z.array(z.string()),
  validation_constraints: z.object({
    output_range: z.tuple([z.number(), z.number()]),
    logical_checks: z.array(z.string()),
  }),
  dependencies: z.array(z.string()),
  complexity_score: z.number().min(1).max(10),
});

export const StructuralPersonaValueMapSchema = z.object({
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

export const StructuralEdgeSchema = z.object({
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

export const StructuralGraphSchema = z.object({
  version: z.string(),
  lastUpdated: z.string().datetime(),
  nodes: z.array(StructuralKPINodeSchema),
  edges: z.array(StructuralEdgeSchema),
  personaMaps: z.array(StructuralPersonaValueMapSchema),
  formulas: z.array(FormulaRegistrySchema),
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get complete seed Structural Truth graph
 */
export function getStructuralSeedGraph(): StructuralGraph {
  return {
    version: "1.0.0",
    lastUpdated: new Date().toISOString(),
    nodes: [], // Will be populated from structural-data.ts
    edges: [], // Will be populated from structural-data.ts
    personaMaps: [], // Will be populated from structural-data.ts
    formulas: [], // Will be populated from structural-data.ts
  };
}

/**
 * Find KPIs relevant to a persona
 */
export function getKPIsForPersona(persona: StructuralPersona): StructuralKPINode[] {
  // This will be implemented to work with the new structural data
  return [];
}

/**
 * Get financial driver for a persona
 */
export function getFinancialDriver(
  persona: StructuralPersona
): FinancialDriver | undefined {
  // This will be implemented to work with the new structural data
  return undefined;
}

/**
 * Find all downstream KPIs affected by a change
 */
export function findDependentKPIs(kpiId: string, graph: StructuralGraph): StructuralKPINode[] {
  const dependents: StructuralKPINode[] = [];

  for (const kpi of graph.nodes) {
    if (kpi.dependencies.includes(kpiId)) {
      dependents.push(kpi);
      // Recursively find downstream
      dependents.push(...findDependentKPIs(kpi.id, graph));
    }
  }

  return dependents;
}

/**
 * Check if a projected improvement exceeds 90th percentile (FCC check)
 */
export function checkBenchmarkAlignment(
  kpiId: string,
  projectedValue: number,
  graph: StructuralGraph
): { aligned: boolean; percentile: string; warning?: string } {
  const kpi = graph.nodes.find((k) => k.id === kpiId);
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
// ============================================================================
// Economic Structure Ontology (ESO) — Core Type Definitions
//
// Models causal relationships between business KPIs, industry benchmarks,
// and stakeholder personas for value engineering.
// ============================================================================

export type ESOIndustry = string;
export type IndustryType = string;
export type KPI_ID = string;
export type PersonaType = string;
export type ESOPersona = string;
export type FinancialDriver = string;

// ============================================================================
// KPI Benchmarks
// ============================================================================

export interface ESOBenchmarks {
  p25: number;
  p50: number;
  p75: number;
  worldClass?: number;
  source: string;
}

// ============================================================================
// KPI Node — a single metric in the ontology graph
// ============================================================================

export type ImprovementDirection = 'higher_is_better' | 'lower_is_better' | 'target_range';

export interface ESOKPINode {
  id: KPI_ID;
  name: string;
  description: string;
  unit: string;
  domain: string;
  category: 'saas' | 'financial' | 'operational' | 'customer' | 'workforce' | 'growth';
  improvementDirection: ImprovementDirection;
  dependencies: KPI_ID[];
  benchmarks: ESOBenchmarks;
}

// ============================================================================
// Edge — causal / correlational link between two KPIs
// ============================================================================

export type EdgeRelationship = 'drives' | 'inhibits' | 'correlates' | 'leads';

export interface ESOEdge {
  sourceId: KPI_ID;
  targetId: KPI_ID;
  relationship: EdgeRelationship;
  weight: number;           // 0–1 strength of relationship
  lagMonths?: number;       // time-lag before effect is observable
  description: string;
}

// ============================================================================
// Persona Value Map — links a stakeholder persona to the KPIs they care about
// ============================================================================

export interface ESOPersonaValueMap {
  persona: PersonaType;
  title: string;
  primaryPain: string;
  financialDriver: FinancialDriver;
  keyKPIs: KPI_ID[];
  communicationPreference: 'quantitative' | 'narrative' | 'visual' | 'executive_summary';
}

// ============================================================================
// Company Size — benchmark adjustments by company maturity / scale
// ============================================================================

export type CompanySize = 'smb' | 'mid_market' | 'enterprise';

export interface SizeMultiplier {
  smb: number;
  mid_market: number;
  enterprise: number;
}

// ============================================================================
// Severity Classification — granular claim assessment beyond pass/fail
// ============================================================================

export type ClaimSeverity =
  | 'plausible'       // within p25–p75 range
  | 'optimistic'      // above p75 but below world-class
  | 'aspirational'    // at or above world-class
  | 'implausible';    // beyond statistical fence (IQR outlier)

// ============================================================================
// Feasibility Scoring — how realistic is a projected improvement?
// ============================================================================

export interface FeasibilityResult {
  feasible: boolean;
  score: number;               // 0–1, higher = more achievable
  percentileJump: number;      // how many percentile bands the improvement crosses
  estimatedMonths: number;     // rough time estimate based on lag + magnitude
  riskLevel: 'low' | 'moderate' | 'high' | 'extreme';
  rationale: string;
}

// ============================================================================
// Composite KPI Health — aggregate score across multiple KPIs
// ============================================================================

export interface KPIHealthEntry {
  metricId: KPI_ID;
  name: string;
  currentPercentile: string;
  score: number;               // 0–1 normalized position within benchmarks
  severity: ClaimSeverity;
  gap: number;                 // distance to p75 (or p25 for lower_is_better)
}

export interface CompositeHealthResult {
  overallScore: number;        // 0–1 weighted average
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  entries: KPIHealthEntry[];
  strongestKPIs: KPI_ID[];
  weakestKPIs: KPI_ID[];
  improvementPriority: KPI_ID[];  // ordered by impact-weighted gap
}

// ============================================================================
// Impact Simulation — cascading what-if analysis through the causal graph
// ============================================================================

export interface ImpactNode {
  metricId: KPI_ID;
  name: string;
  baselineValue: number;
  projectedValue: number;
  deltaPercent: number;
  confidence: number;          // decays with graph distance
  pathLength: number;          // hops from root change
  relationship: EdgeRelationship;
}

export interface ImpactSimulationResult {
  rootMetricId: KPI_ID;
  rootDeltaPercent: number;
  impactedMetrics: ImpactNode[];
  totalFinancialImpact: number;
  confidenceDecayRate: number;
  maxDepthReached: number;
}

// ============================================================================
// Confidence Model — data-quality-aware confidence scoring
// ============================================================================

export type SourceTier = 1 | 2 | 3;  // 1 = primary research, 2 = aggregated, 3 = estimated

export interface ConfidenceFactors {
  sourceTier: SourceTier;
  dataFreshnessYears: number;
  sampleSize: 'large' | 'medium' | 'small' | 'unknown';
  industrySpecific: boolean;
  sizeAdjusted: boolean;
}

export interface ConfidenceScore {
  value: number;               // 0–1 composite confidence
  factors: ConfidenceFactors;
  explanation: string;
}

// Re-export checkBenchmarkAlignment from its own module to avoid
// a circular import between eso.ts and eso-data.ts.
export {
  checkBenchmarkAlignment,
  classifyClaimSeverity,
  assessImprovementFeasibility,
  computeCompositeHealth,
  computeConfidenceScore,
} from './eso-checks';
export type { BenchmarkAlignmentResult } from './eso-checks';

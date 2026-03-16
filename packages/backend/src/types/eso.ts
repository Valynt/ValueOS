/**
 * ESO (External Service Orchestration) Types
 *
 * Types for external service integrations and orchestration
 */

export interface ESOConfig {
  service_id: string;
  service_name: string;
  provider: string;
  endpoint: string;
  auth_type: 'api_key' | 'oauth2' | 'jwt' | 'basic';
  credentials: ESOCredentials;
  retry_policy: RetryPolicy;
  circuit_breaker: CircuitBreakerConfig;
}

export interface ESOCredentials {
  api_key?: string;
  oauth_token?: string;
  client_id?: string;
  client_secret?: string;
  username?: string;
  password?: string;
}

export interface RetryPolicy {
  max_attempts: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
}

export interface CircuitBreakerConfig {
  failure_threshold: number;
  success_threshold: number;
  timeout_ms: number;
  reset_timeout_ms: number;
}

export interface ESORequest {
  service_id: string;
  operation: string;
  parameters: Record<string, any>;
  idempotency_key?: string;
  timeout_ms?: number;
}

export interface ESOResponse {
  service_id: string;
  operation: string;
  status: 'success' | 'failure' | 'timeout';
  data?: Record<string, any>;
  error?: ESOError;
  metadata: ESOMetadata;
}

export interface ESOError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, any>;
}

export interface ESOMetadata {
  request_id: string;
  duration_ms: number;
  attempt_number: number;
  timestamp: string;
}

// ============================================================================
// ESO Ground Truth Domain Types
// ============================================================================

export type ESOIndustry = string;
export type IndustryType = string;
export type KPI_ID = string;
export type PersonaType = string;

export type ESOPersona =
  | "cfo"
  | "cio"
  | "vp_ops"
  | "vp_sales"
  | "vp_cs"
  | "ceo"
  | "cto"
  | "cmo";

export type FinancialDriver =
  | "cost_reduction"
  | "revenue_growth"
  | "margin_improvement"
  | "risk_mitigation"
  | "efficiency_gain"
  | "Enterprise value creation";

export type ImprovementDirection =
  | "higher_is_better"
  | "lower_is_better"
  | "target_range";

export interface ESOBenchmarks {
  p25: number;
  p50: number;
  p75: number;
  worldClass?: number;
  source: string;
  vintage?: string;
}

export interface ESOKPINode {
  id: KPI_ID;
  name: string;
  description: string;
  unit: string;
  domain: string;
  category:
    | "saas"
    | "financial"
    | "operational"
    | "customer"
    | "workforce"
    | "growth";
  improvementDirection: ImprovementDirection;
  dependencies: KPI_ID[];
  benchmarks: ESOBenchmarks;
}

export type EdgeRelationship = "drives" | "inhibits" | "correlates" | "leads";

export interface ESOEdge {
  sourceId: KPI_ID;
  targetId: KPI_ID;
  relationship: EdgeRelationship;
  weight: number;
  lagMonths?: number;
  description: string;
}

export interface ESOPersonaValueMap {
  persona: PersonaType;
  title: string;
  primaryPain: string;
  financialDriver: FinancialDriver;
  keyKPIs: KPI_ID[];
  communicationPreference:
    | "quantitative"
    | "narrative"
    | "visual"
    | "executive_summary";
}

// ============================================================================
// Company Size — benchmark adjustments by company maturity / scale
// ============================================================================

export type CompanySize = "smb" | "mid_market" | "enterprise";

export interface SizeMultiplier {
  smb: number;
  mid_market: number;
  enterprise: number;
}

// ============================================================================
// Severity Classification
// ============================================================================

export type ClaimSeverity =
  | "plausible"
  | "optimistic"
  | "aspirational"
  | "implausible";

// ============================================================================
// Feasibility Scoring
// ============================================================================

export interface FeasibilityResult {
  feasible: boolean;
  score: number;
  percentileJump: number;
  estimatedMonths: number;
  riskLevel: "low" | "moderate" | "high" | "extreme";
  rationale: string;
}

// ============================================================================
// Composite KPI Health
// ============================================================================

export interface KPIHealthEntry {
  metricId: KPI_ID;
  name: string;
  currentPercentile: string;
  score: number;
  severity: ClaimSeverity;
  gap: number;
}

export interface CompositeHealthResult {
  overallScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  entries: KPIHealthEntry[];
  strongestKPIs: KPI_ID[];
  weakestKPIs: KPI_ID[];
  improvementPriority: KPI_ID[];
}

// ============================================================================
// Impact Simulation
// ============================================================================

export interface ImpactNode {
  metricId: KPI_ID;
  name: string;
  baselineValue: number;
  projectedValue: number;
  deltaPercent: number;
  confidence: number;
  pathLength: number;
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
// Confidence Model
// ============================================================================

export type SourceTier = 1 | 2 | 3;

export interface ConfidenceFactors {
  sourceTier: SourceTier;
  dataFreshnessYears: number;
  sampleSize: "large" | "medium" | "small" | "unknown";
  industrySpecific: boolean;
  sizeAdjusted: boolean;
}

export interface ConfidenceScore {
  value: number;
  factors: ConfidenceFactors;
  explanation: string;
}

export interface BenchmarkAlignmentResult {
  aligned: boolean;
  percentile: string;
  warning?: string;
}

// Re-export production implementations from eso-checks
export {
  checkBenchmarkAlignment,
  classifyClaimSeverity,
  assessImprovementFeasibility,
  computeCompositeHealth,
  computeConfidenceScore,
} from "./eso-checks";

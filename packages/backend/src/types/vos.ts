/**
 * VOS (Value Operating System) Type Definitions
 *
 * Core ValueOS domain types for value lifecycle management,
 * manifesto validation, benchmarking, and ROI modeling.
 */

// ============================================================================
// Lifecycle Types
// ============================================================================

// Canonical LifecycleStage is defined in packages/shared/src/domain/Opportunity.ts.
// Re-exported here for backward compatibility. ADR-0010.
export type { LifecycleStage } from '@valueos/shared';

// ============================================================================
// Manifesto Validation
// ============================================================================

export interface ManifestoValidationResult {
  valid: boolean;
  errors: ManifestoValidationError[];
  warnings: string[];
  score: number;
  passed_rules: string[];
  failed_rules: string[];
}

export interface ManifestoValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

// ============================================================================
// Target Agent Output
// ============================================================================

export interface TargetAgentOutput {
  target_description: string;
  success_criteria: string[];
  kpis: TargetKPI[];
  timeline: TargetTimeline;
  resources_required: ResourceRequirement[];
  risks: RiskAssessment[];
  assumptions: string[];
  dependencies: string[];
  confidence_level: ConfidenceLevel;
  valueTree?: Record<string, unknown>;
  businessCase?: Record<string, unknown>;
  roiModel?: Record<string, unknown>;
}

export interface TargetKPI {
  name: string;
  description: string;
  baseline_value?: number;
  target_value: number;
  unit: string;
  measurement_frequency: string;
}

export interface TargetTimeline {
  planned_start: string;
  planned_end: string;
  milestones: Milestone[];
}

export interface Milestone {
  name: string;
  description: string;
  due_date: string;
  dependencies: string[];
}

export interface ResourceRequirement {
  type: "human" | "financial" | "technical" | "infrastructure";
  description: string;
  quantity?: number;
  cost_estimate?: number;
  currency?: string;
}

export interface RiskAssessment {
  description: string;
  probability: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  mitigation_strategy?: string;
}

// ============================================================================
// Confidence Levels
// ============================================================================

export type ConfidenceLevel = "very_low" | "low" | "medium" | "high" | "very_high";

export interface ConfidenceScore {
  level: ConfidenceLevel;
  score: number; // 0-100
  factors: ConfidenceFactor[];
}

export interface ConfidenceFactor {
  name: string;
  weight: number;
  score: number;
  rationale: string;
}

// ============================================================================
// Benchmarking
// ============================================================================

export interface Benchmark {
  id: string;
  name: string;
  description: string;
  industry: string;
  metric_name: string;
  metric_value: number;
  value?: number;
  unit: string;
  percentile?: number;
  source: string;
  date_collected: string;
  sample_size?: number;
  kpi_name?: string;
  vertical?: string;
  company_size?: string;
  region?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface BenchmarkComparison {
  target_value: number;
  benchmark_value: number;
  variance: number;
  variance_percentage: number;
  interpretation: "below" | "at" | "above";
}

// ============================================================================
// Value Fabric Ontology
// ============================================================================

export interface Capability {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  category?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UseCase {
  id: string;
  name: string;
  description?: string;
  persona?: string;
  industry?: string;
  is_template: boolean;
  created_at: string;
  updated_at: string;
}

export interface UseCaseCapability {
  use_case_id: string;
  capability_id: string;
  relevance_score: number;
}

// ============================================================================
// Domain Types (BusinessObjective, ValueTree)
// ============================================================================

export interface BusinessObjective {
  id: string;
  name: string;
  description?: string;
  owner?: string;
  target_value?: number;
  unit?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ValueTreeNode {
  id: string;
  label: string;
  driverType?: string;
  value?: number;
  children?: ValueTreeNode[];
}

export interface ValueTree {
  id: string;
  name: string;
  root_id?: string;
  nodes: ValueTreeNode[];
}

export interface ValueFabricQuery {
  lifecycle_stage?: LifecycleStage;
  value_case_id?: string;
  use_case_id?: string;
  industry?: string;
  persona?: string;
}

export interface ValueCommit {
  id: string;
  tenant_id?: string;
  value_tree_id: string;
  value_case_id: string;
  committed_by?: string;
  committed_by_name?: string;
  status: "active" | "achieved" | "at_risk" | "missed" | "cancelled";
  date_committed: string;
  target_date?: string;
  notes?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RealizationReport {
  id: string;
  value_commit_id: string;
  value_case_id: string;
  report_period_start: string;
  report_period_end: string;
  overall_status?: "on_track" | "at_risk" | "achieved" | "missed";
  executive_summary?: string;
  generated_at: string;
  generated_by?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ExpansionModel {
  id: string;
  value_case_id: string;
  value_tree_id?: string;
  realization_report_id?: string;
  name: string;
  executive_summary?: string;
  opportunity_type: "upsell" | "cross_sell" | "optimization" | "expansion";
  estimated_value?: number;
  confidence_score?: number;
  status: "proposed" | "under_review" | "approved" | "rejected" | "implemented";
  created_at: string;
  updated_at: string;
}

export interface TelemetrySummary {
  total_events: number;
  kpis_tracked: number;
  last_event_timestamp?: string;
  coverage_percentage: number;
}

export interface ValueFabricSnapshot {
  value_case_id: string;
  lifecycle_stage: LifecycleStage;
  business_objectives: BusinessObjective[];
  capabilities: Capability[];
  use_cases: UseCase[];
  value_trees: ValueTree[];
  roi_models: ROIModel[];
  value_commits: ValueCommit[];
  telemetry_summary?: TelemetrySummary;
  realization_reports?: RealizationReport[];
  expansion_models?: ExpansionModel[];
}

// ============================================================================
// ROI Modeling
// ============================================================================

export interface ROIModel {
  id: string;
  name: string;
  description: string;
  formula: string;
  parameters: ROIParameter[];
  assumptions: string[];
  timeframe_months: number;
}

export interface ROIParameter {
  name: string;
  value: number;
  unit: string;
  description?: string;
  source?: string;
}

export interface ROIModelCalculation {
  model_id: string;
  calculation_date: string;
  input_parameters: Record<string, number>;
  roi_percentage: number;
  payback_period_months: number;
  net_present_value: number;
  internal_rate_of_return?: number;
  break_even_analysis: BreakEvenPoint;
  sensitivity_analysis?: SensitivityAnalysis;
}

export interface BreakEvenPoint {
  months: number;
  cumulative_investment: number;
  cumulative_return: number;
}

export interface SensitivityAnalysis {
  parameter?: string;
  /** Alias for parameter — used by ROIFormulaInterpreter. */
  variable?: string;
  baseline?: number;
  scenarios: SensitivityScenario[];
}

export interface SensitivityScenario {
  label: string;
  parameter_change_percentage: number;
  roi_impact_percentage: number;
}

// ============================================================================
// Value Metrics
// ============================================================================

export interface ValueMetric {
  id: string;
  name: string;
  description: string;
  category: "financial" | "operational" | "strategic" | "customer";
  value: number;
  unit: string;
  lifecycle_stage: LifecycleStage;
  confidence: ConfidenceLevel;
  last_updated: string;
}

// ============================================================================
// VMRT (Value Metrics Reference Templates) Seeds
// ============================================================================

export interface VMRTSeed {
  id: string;
  name: string;
  description: string;
  category: string;
  lifecycle_stage: LifecycleStage;
  default_kpis: string[];
  suggested_benchmarks: string[];
  template_data: Record<string, unknown>;
  traceId?: string;
  context?: Record<string, unknown>;
  reasoningSteps?: unknown[];
  valueModel?: Record<string, unknown>;
  assumptions?: unknown[];
  kpis?: unknown[];
  benchmarks?: Record<string, unknown>;
  citations?: unknown[];
  provenance?: Record<string, unknown>;
}

export interface VMRTTrace {
  trace_type: string;
  reasoning_steps: {
    step: number;
    logic: string;
    formula?: string;
    variables: Record<string, unknown>;
    outcome: string;
  }[];
  outcome_category: string;
  timestamp: string;
}

export const ALL_VMRT_SEEDS: VMRTSeed[] = [];

// ============================================================================
// Value Case
// ============================================================================

export interface ValueCase {
  id: string;
  title: string;
  description: string;
  lifecycle_stage: LifecycleStage;
  status: "draft" | "active" | "completed" | "archived";
  target_output?: TargetAgentOutput;
  roi_calculation?: ROIModelCalculation;
  metrics: ValueMetric[];
  created_at: string;
  updated_at: string;
  organization_id: string;
}

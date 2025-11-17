/**
 * Value Operating System (VOS) TypeScript Type Definitions
 *
 * This file contains all type definitions for the VOS Value Fabric,
 * including lifecycle stages: Opportunity, Target, Realization, and Expansion.
 *
 * Generated from VOS blueprint schema and database migration.
 */

// =====================================================
// CORE VOS TYPES
// =====================================================

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type LifecycleStage = 'opportunity' | 'target' | 'realization' | 'expansion';

export type ValueCommitStatus = 'active' | 'achieved' | 'at_risk' | 'missed' | 'cancelled';

export type RealizationStatus = 'on_track' | 'at_risk' | 'achieved' | 'missed';

export type ResultStatus = 'exceeded' | 'achieved' | 'on_track' | 'at_risk' | 'missed';

export type ExpansionOpportunityType = 'upsell' | 'cross_sell' | 'optimization' | 'expansion';

export type ExpansionStatus = 'proposed' | 'under_review' | 'approved' | 'rejected' | 'implemented';

export type KPIMeasurement = 'percentage' | 'currency' | 'time' | 'count';

export type KPITargetDirection = 'increase' | 'decrease';

export type FinancialMetricType = 'revenue' | 'cost' | 'risk';

export type ValueTreeNodeType = 'capability' | 'outcome' | 'kpi' | 'financialMetric' | 'driver';

export type ROICalculationType = 'revenue' | 'cost' | 'risk' | 'intermediate';

// =====================================================
// OPPORTUNITY STAGE TYPES
// =====================================================

export interface BusinessObjective {
  id: string;
  value_case_id: string;
  name: string;
  description?: string;
  priority: 1 | 2 | 3 | 4 | 5;
  owner?: string;
  created_at: string;
  updated_at: string;
}

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

export interface UseCaseKPI {
  use_case_id: string;
  kpi_hypothesis_id: string;
}

// =====================================================
// TARGET STAGE TYPES
// =====================================================

export interface ValueTree {
  id: string;
  value_case_id: string;
  use_case_id?: string;
  name: string;
  description?: string;
  version: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface ValueTreeNode {
  id: string;
  value_tree_id: string;
  node_id: string;
  label: string;
  type: ValueTreeNodeType;
  reference_id?: string;
  properties: Record<string, any>;
  position_x?: number;
  position_y?: number;
  created_at: string;
}

export interface ValueTreeLink {
  parent_id: string;
  child_id: string;
  link_type: string;
  weight: number;
  metadata: Record<string, any>;
}

export interface ROIModel {
  id: string;
  value_tree_id: string;
  financial_model_id?: string;
  name: string;
  assumptions: string[];
  version: string;
  confidence_level?: ConfidenceLevel;
  created_at: string;
  updated_at: string;
}

export interface ROIModelCalculation {
  id: string;
  roi_model_id: string;
  name: string;
  formula: string;
  description?: string;
  calculation_order: number;
  result_type: ROICalculationType;
  unit?: string;
  created_at: string;
}

export interface Benchmark {
  id: string;
  kpi_hypothesis_id: string;
  kpi_name: string;
  industry?: string;
  vertical?: string;
  company_size?: string;
  region?: string;
  value: number;
  unit: string;
  percentile?: number;
  source?: string;
  sample_size?: number;
  data_date?: string;
  confidence_level?: ConfidenceLevel;
  created_at: string;
}

export interface ValueCommit {
  id: string;
  value_tree_id: string;
  value_case_id: string;
  committed_by?: string;
  committed_by_name?: string;
  status: ValueCommitStatus;
  date_committed: string;
  target_date?: string;
  notes?: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface KPITarget {
  id: string;
  value_commit_id: string;
  kpi_hypothesis_id: string;
  kpi_name: string;
  baseline_value?: number;
  target_value: number;
  unit: string;
  deadline?: string;
  confidence_level?: ConfidenceLevel;
  created_at: string;
}

// =====================================================
// REALIZATION STAGE TYPES
// =====================================================

export interface TelemetryEvent {
  id: string;
  value_case_id: string;
  kpi_hypothesis_id: string;
  kpi_target_id?: string;
  event_timestamp: string;
  value: number;
  unit: string;
  source?: string;
  metadata: Record<string, any>;
  ingested_at: string;
}

export interface RealizationReport {
  id: string;
  value_commit_id: string;
  value_case_id: string;
  report_period_start: string;
  report_period_end: string;
  overall_status?: RealizationStatus;
  executive_summary?: string;
  generated_at: string;
  generated_by?: string;
  metadata: Record<string, any>;
}

export interface RealizationResult {
  id: string;
  realization_report_id: string;
  kpi_target_id: string;
  kpi_name: string;
  actual_value: number;
  target_value: number;
  baseline_value?: number;
  unit: string;
  variance?: number;
  variance_percentage?: number;
  status?: ResultStatus;
  confidence_level?: ConfidenceLevel;
  created_at: string;
}

// =====================================================
// EXPANSION STAGE TYPES
// =====================================================

export interface ExpansionModel {
  id: string;
  value_case_id: string;
  value_tree_id?: string;
  realization_report_id?: string;
  name: string;
  executive_summary?: string;
  opportunity_type: ExpansionOpportunityType;
  estimated_value?: number;
  confidence_score?: number;
  status: ExpansionStatus;
  created_at: string;
  updated_at: string;
}

export interface ExpansionImprovement {
  id: string;
  expansion_model_id: string;
  kpi_hypothesis_id: string;
  kpi_name: string;
  current_value?: number;
  proposed_value: number;
  incremental_value: number;
  unit: string;
  confidence?: number;
  rationale?: string;
  created_at: string;
}

// =====================================================
// FORMULA INTERPRETER TYPES
// =====================================================

export interface FormulaVariable {
  name: string;
  value: number;
  unit?: string;
  source?: string;
}

export interface FormulaContext {
  variables: Record<string, FormulaVariable>;
  functions: Record<string, (...args: number[]) => number>;
}

export interface FormulaResult {
  value: number;
  unit?: string;
  intermediateSteps?: FormulaStep[];
  error?: string;
}

export interface FormulaStep {
  calculation: string;
  result: number;
  unit?: string;
}

export interface SensitivityAnalysis {
  variable: string;
  baseline: number;
  scenarios: SensitivityScenario[];
}

export interface SensitivityScenario {
  label: string;
  adjustment: number;
  adjustmentType: 'percentage' | 'absolute';
  result: number;
  variance: number;
}

// =====================================================
// MANIFESTO COMPLIANCE TYPES
// =====================================================

export interface ManifestoRule {
  id: string;
  name: string;
  description: string;
  rule_type: 'value_reduction' | 'assumption_validation' | 'kpi_existence' | 'explainability';
  validation_function: string;
  is_active: boolean;
}

export interface ManifestoValidationResult {
  rule_id: string;
  rule_name: string;
  passed: boolean;
  message: string;
  evidence?: any[];
}

export interface ManifestoComplianceReport {
  validated_at: string;
  overall_compliance: boolean;
  total_rules: number;
  passed_rules: number;
  failed_rules: number;
  results: ManifestoValidationResult[];
}

// =====================================================
// VALUE FABRIC QUERY TYPES
// =====================================================

export interface ValueFabricQuery {
  lifecycle_stage?: LifecycleStage;
  value_case_id?: string;
  use_case_id?: string;
  industry?: string;
  persona?: string;
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

export interface TelemetrySummary {
  total_events: number;
  kpis_tracked: number;
  last_event_timestamp?: string;
  coverage_percentage: number;
}

// =====================================================
// COMPONENT PROPS TYPES (for UI)
// =====================================================

export interface ValueTreeCardProps {
  valueTree: ValueTree;
  nodes: ValueTreeNode[];
  links: ValueTreeLink[];
  onNodeClick?: (node: ValueTreeNode) => void;
  interactive?: boolean;
}

export interface ROIBlockProps {
  roiModel: ROIModel;
  calculations: ROIModelCalculation[];
  results?: Record<string, number>;
  showSensitivity?: boolean;
}

export interface LifecyclePanelProps {
  currentStage: LifecycleStage;
  valueCaseId: string;
  onStageChange: (stage: LifecycleStage) => void;
  stageProgress: Record<LifecycleStage, number>;
}

export interface MetricBadgeProps {
  kpiName: string;
  value: number;
  unit: string;
  target?: number;
  status?: ResultStatus;
  trend?: 'up' | 'down' | 'neutral';
  confidenceLevel?: ConfidenceLevel;
}

export interface ValueCommitCardProps {
  valueCommit: ValueCommit;
  kpiTargets: KPITarget[];
  latestResults?: RealizationResult[];
  onViewDetails?: () => void;
}

export interface RealizationDashboardProps {
  valueCaseId: string;
  reportPeriod?: {
    start: string;
    end: string;
  };
  valueCommits: ValueCommit[];
  telemetryData?: TelemetryEvent[];
}

export interface ExpansionOpportunityListProps {
  expansionModels: ExpansionModel[];
  onSelectOpportunity: (model: ExpansionModel) => void;
  sortBy?: 'estimated_value' | 'confidence_score' | 'created_at';
}

export interface AssumptionTraceViewProps {
  assumption: string;
  evidence: any[];
  source?: string;
  confidenceLevel: ConfidenceLevel;
  relatedItems?: Array<{
    type: string;
    id: string;
    name: string;
  }>;
}

export interface SensitivityAnalysisChartProps {
  analysis: SensitivityAnalysis[];
  baselineValue: number;
  unit: string;
}

export interface BenchmarkComparisonViewProps {
  kpiName: string;
  actualValue: number;
  benchmarks: Benchmark[];
  showPercentiles?: boolean;
}

// =====================================================
// AGENT LIFECYCLE TYPES
// =====================================================

export interface OpportunityAgentInput {
  customerProfile: any;
  discoveryData: string[];
}

export interface OpportunityAgentOutput {
  opportunitySummary: string;
  personaFit: any;
  initialValueModel: any;
  businessObjectives: BusinessObjective[];
  recommendedCapabilities: Capability[];
}

export interface TargetAgentInput {
  valueCaseId: string;
  businessObjectives: BusinessObjective[];
  capabilities: Capability[];
}

export interface TargetAgentOutput {
  valueTree: ValueTree;
  roiModel: ROIModel;
  valueCommit: ValueCommit;
  businessCase: any;
}

export interface RealizationAgentInput {
  valueCaseId: string;
  valueCommitId: string;
  telemetryEvents: TelemetryEvent[];
  reportPeriod: {
    start: string;
    end: string;
  };
}

export interface RealizationAgentOutput {
  realizationReport: RealizationReport;
  realizationResults: RealizationResult[];
  insights: string[];
  recommendations: string[];
}

export interface ExpansionAgentInput {
  valueCaseId: string;
  realizationReportId: string;
  currentValueTree: ValueTree;
}

export interface ExpansionAgentOutput {
  expansionModel: ExpansionModel;
  expansionImprovements: ExpansionImprovement[];
  opportunityScore: number;
  executiveSummary: string;
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface VOSApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    duration_ms: number;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export type WithTimestamps<T> = T & {
  created_at: string;
  updated_at?: string;
};

export type Partial<T> = {
  [P in keyof T]?: T[P];
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Re-export from agent fabric types for convenience
export type {
  Agent,
  AgentSession,
  AgentMemory,
  Workflow,
  WorkflowExecution,
  AuditLog,
  ValueCase,
  CompanyProfile,
  ValueMap,
  KPIHypothesis,
  FinancialModel,
  Assumption
} from '../lib/agent-fabric/types';

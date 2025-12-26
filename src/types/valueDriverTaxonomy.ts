/**
 * Value Driver Taxonomy v2 - Structured Ontology
 * 
 * Unified ontology for value drivers that enables:
 * - Composable, comparable results
 * - ROI modeling readiness
 * - Benchmark anchoring
 * - Evidence-based validation
 */

// =====================================================
// CORE VALUE DRIVER TYPES
// =====================================================

export type ValueDriverCategory = 'revenue' | 'cost' | 'risk';

export type RevenueSubcategory = 
  | 'conversion_rate'
  | 'deal_size'
  | 'sales_cycle'
  | 'win_rate'
  | 'expansion_rate'
  | 'churn_reduction'
  | 'market_share'
  | 'pricing_power'
  | 'customer_lifetime_value';

export type CostSubcategory = 
  | 'labor_efficiency'
  | 'cycle_time'
  | 'throughput'
  | 'error_rate'
  | 'rework_reduction'
  | 'automation_savings'
  | 'resource_utilization'
  | 'operational_overhead'
  | 'infrastructure_cost';

export type RiskSubcategory = 
  | 'compliance_violation'
  | 'data_breach'
  | 'downtime'
  | 'reputation_damage'
  | 'customer_satisfaction'
  | 'employee_turnover'
  | 'audit_findings'
  | 'regulatory_penalty';

export type ValueDriverSubcategory = 
  | RevenueSubcategory 
  | CostSubcategory 
  | RiskSubcategory;

/**
 * Economic mechanism describes how the driver scales
 */
export type EconomicMechanism = 
  | 'ratio'        // Linear proportion (e.g., conversion rate × deal count)
  | 'linear'       // Direct linear relationship (e.g., hours saved × hourly rate)
  | 'logarithmic'  // Diminishing returns (e.g., market share gains)
  | 'exponential'  // Compounding effects (e.g., network effects)
  | 'step'         // Threshold-based (e.g., hiring headcount)
  | 'hybrid';      // Combination of mechanisms

export type ConfidenceScore = number; // 0.0 to 1.0

/**
 * Benchmark anchor links to external ground truth
 */
export interface BenchmarkAnchor {
  /** Ground Truth API reference */
  source: 'gartner' | 'forrester' | 'idc' | 'mckinsey' | 'industry_report' | 'internal_data';
  
  /** Specific benchmark identifier */
  benchmark_id: string;
  
  /** Industry/vertical context */
  industry?: string;
  
  /** Company size segment */
  company_size?: 'smb' | 'mid_market' | 'enterprise';
  
  /** Benchmark value */
  value: number;
  
  /** Unit of measurement */
  unit: string;
  
  /** Percentile (P10, P50, P90) */
  percentile?: number;
  
  /** Last updated timestamp */
  updated_at: string;
  
  /** Link to full report/data */
  reference_url?: string;
}

/**
 * Evidence snippet extracted from discovery sources
 */
export interface EvidenceSnippet {
  /** Source document/transcript ID */
  source_id: string;
  
  /** Type of source */
  source_type: 'transcript' | 'email' | 'document' | 'survey' | 'interview' | 'web_scrape';
  
  /** Exact text excerpt */
  text: string;
  
  /** Character offset in source */
  offset?: number;
  
  /** Speaker/author if known */
  speaker?: string;
  
  /** Timestamp in source */
  timestamp?: string;
  
  /** Relevance score (0-1) */
  relevance: number;
  
  /** Sentiment polarity (-1 to 1) */
  sentiment?: number;
}

/**
 * Structured Value Driver (Ontology v2)
 */
export interface ValueDriver {
  /** Unique identifier */
  id: string;
  
  /** Organization context */
  organization_id: string;
  
  /** Value case/opportunity link */
  value_case_id?: string;
  
  /** Primary category */
  category: ValueDriverCategory;
  
  /** Specific subcategory */
  subcategory: ValueDriverSubcategory;
  
  /** Human-readable name */
  name: string;
  
  /** Detailed description */
  description: string;
  
  /** How this driver creates value */
  economic_mechanism: EconomicMechanism;
  
  /** Overall confidence in this driver (0-1) */
  confidence_score: ConfidenceScore;
  
  /** Supporting evidence snippets */
  evidence: EvidenceSnippet[];
  
  /** Benchmark comparisons */
  benchmarks: BenchmarkAnchor[];
  
  /** Current state quantification */
  baseline_value?: number;
  baseline_unit?: string;
  
  /** Target state quantification */
  target_value?: number;
  target_unit?: string;
  
  /** Expected delta/impact */
  expected_delta?: number;
  delta_unit?: string;
  
  /** Timeframe for realization */
  timeframe_months?: number;
  
  /** Financial impact estimate */
  financial_impact?: {
    annual_value: number;
    currency: string;
    calculation_method: string;
    confidence: ConfidenceScore;
  };
  
  /** Metadata */
  created_by?: string;
  created_at: string;
  updated_at: string;
  
  /** Agent provenance */
  extracted_by_agent?: string;
  validated_by_agent?: string;
  
  /** Linked entities */
  capability_ids?: string[];
  kpi_ids?: string[];
}

/**
 * Value Driver Extraction Result
 */
export interface ValueDriverExtractionResult {
  /** Extracted drivers */
  drivers: ValueDriver[];
  
  /** Overall extraction confidence */
  extraction_confidence: ConfidenceScore;
  
  /** Processing metadata */
  metadata: {
    source_count: number;
    evidence_count: number;
    benchmark_count: number;
    processing_time_ms: number;
    agent_version: string;
  };
}

/**
 * Value Driver Validation Result
 */
export interface ValueDriverValidationResult {
  driver_id: string;
  is_valid: boolean;
  validation_issues: string[];
  supporting_evidence_count: number;
  contradicting_evidence_count: number;
  benchmark_alignment: 'aligned' | 'below' | 'above' | 'unknown';
  final_confidence: ConfidenceScore;
  recommendations: string[];
}

/**
 * Composite Value Model
 * 
 * Aggregates multiple value drivers into cohesive ROI model
 */
export interface CompositeValueModel {
  id: string;
  organization_id: string;
  value_case_id: string;
  
  /** Aggregated drivers by category */
  drivers_by_category: {
    revenue: ValueDriver[];
    cost: ValueDriver[];
    risk: ValueDriver[];
  };
  
  /** Total impact by category */
  category_totals: {
    revenue: number;
    cost: number;
    risk: number;
  };
  
  /** Overall financial summary */
  total_annual_impact: number;
  currency: string;
  
  /** Weighted confidence score */
  model_confidence: ConfidenceScore;
  
  /** Sensitivity analysis */
  sensitivity: {
    pessimistic: number;
    realistic: number;
    optimistic: number;
  };
  
  /** Key assumptions */
  assumptions: string[];
  
  /** Created timestamp */
  created_at: string;
  updated_at: string;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Calculate weighted confidence score across multiple drivers
 */
export function calculateWeightedConfidence(drivers: ValueDriver[]): ConfidenceScore {
  if (drivers.length === 0) return 0;
  
  const totalImpact = drivers.reduce((sum, d) => 
    sum + (d.financial_impact?.annual_value || 0), 0);
  
  if (totalImpact === 0) {
    // Equal weighting if no financial data
    return drivers.reduce((sum, d) => sum + d.confidence_score, 0) / drivers.length;
  }
  
  // Weight by financial impact
  const weightedSum = drivers.reduce((sum, d) => {
    const impact = d.financial_impact?.annual_value || 0;
    const weight = impact / totalImpact;
    return sum + (d.confidence_score * weight);
  }, 0);
  
  return Math.min(1, Math.max(0, weightedSum));
}

/**
 * Validate value driver structure and completeness
 */
export function validateValueDriver(driver: Partial<ValueDriver>): { 
  valid: boolean; 
  errors: string[] 
} {
  const errors: string[] = [];
  
  if (!driver.category) errors.push('Missing category');
  if (!driver.subcategory) errors.push('Missing subcategory');
  if (!driver.name) errors.push('Missing name');
  if (!driver.economic_mechanism) errors.push('Missing economic mechanism');
  
  if (driver.confidence_score !== undefined) {
    if (driver.confidence_score < 0 || driver.confidence_score > 1) {
      errors.push('Confidence score must be between 0 and 1');
    }
  }
  
  if (driver.evidence && driver.evidence.length === 0) {
    errors.push('At least one evidence snippet required');
  }
  
  if (driver.financial_impact) {
    if (!driver.financial_impact.calculation_method) {
      errors.push('Financial impact requires calculation method');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Map driver to appropriate ROI calculation formula
 */
export function getROIFormula(driver: ValueDriver): string {
  const mechanism = driver.economic_mechanism;
  
  switch (mechanism) {
    case 'ratio':
      return `(target_value / baseline_value - 1) * baseline_financial_impact`;
    
    case 'linear':
      return `(target_value - baseline_value) * unit_financial_value`;
    
    case 'logarithmic':
      return `log(1 + (target_value - baseline_value)) * scaling_factor`;
    
    case 'exponential':
      return `baseline_value * (1 + growth_rate) ^ timeframe_months`;
    
    case 'step':
      return `floor(delta / threshold) * step_value`;
    
    case 'hybrid':
      return `custom_formula_required`;
    
    default:
      return `unknown_mechanism`;
  }
}

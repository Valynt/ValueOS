/**
 * ESO Data Types
 *
 * Data structures for external service orchestration payloads
 */

import type { CompanySize, ESOEdge, ESOKPINode, ESOPersonaValueMap, SizeMultiplier } from "./eso";

// ============================================================================
// Ground Truth Seed Data
//
// Real benchmark values sourced from:
//   - OpenView SaaS Benchmarks (2024)
//   - Bessemer Cloud Index
//   - KeyBanc SaaS Survey
//   - APQC (financial operations)
//   - Gartner IT Key Metrics
//   - McKinsey Organizational Health Index
// ============================================================================

export const ALL_ESO_KPIS: ESOKPINode[] = [
  // -- SaaS Metrics ----------------------------------------------------------
  {
    id: "saas_nrr",
    name: "Net Revenue Retention",
    description: "Revenue retained from existing customers including expansion, contraction, and churn.",
    unit: "%",
    domain: "SaaS",
    category: "saas",
    improvementDirection: "higher_is_better",
    dependencies: ["saas_gross_churn", "saas_expansion_rate"],
    benchmarks: { p25: 95, p50: 105, p75: 120, worldClass: 140, source: "OpenView 2024" },
  },
  {
    id: "saas_gross_churn",
    name: "Gross Revenue Churn",
    description: "Percentage of recurring revenue lost from downgrades and cancellations.",
    unit: "%",
    domain: "SaaS",
    category: "saas",
    improvementDirection: "lower_is_better",
    dependencies: ["cust_nps", "cust_time_to_value"],
    benchmarks: { p25: 15, p50: 10, p75: 5, worldClass: 2, source: "KeyBanc 2024" },
  },
  {
    id: "saas_expansion_rate",
    name: "Expansion Revenue Rate",
    description: "Additional revenue from upsells and cross-sells as a percentage of beginning ARR.",
    unit: "%",
    domain: "SaaS",
    category: "saas",
    improvementDirection: "higher_is_better",
    dependencies: ["cust_nps", "ops_revenue_per_employee"],
    benchmarks: { p25: 5, p50: 15, p75: 30, worldClass: 50, source: "OpenView 2024" },
  },
  {
    id: "saas_cac",
    name: "Customer Acquisition Cost",
    description: "Fully loaded cost to acquire one new customer.",
    unit: "USD",
    domain: "SaaS",
    category: "saas",
    improvementDirection: "lower_is_better",
    dependencies: ["growth_sales_efficiency"],
    benchmarks: { p25: 25000, p50: 15000, p75: 8000, worldClass: 3000, source: "Bessemer 2024" },
  },
  {
    id: "saas_ltv_cac",
    name: "LTV:CAC Ratio",
    description: "Customer lifetime value divided by acquisition cost.",
    unit: "x",
    domain: "SaaS",
    category: "saas",
    improvementDirection: "higher_is_better",
    dependencies: ["saas_cac", "saas_nrr"],
    benchmarks: { p25: 2, p50: 3.5, p75: 5, worldClass: 8, source: "Bessemer 2024" },
  },
  {
    id: "saas_magic_number",
    name: "SaaS Magic Number",
    description: "Net new ARR divided by prior-quarter sales & marketing spend.",
    unit: "x",
    domain: "SaaS",
    category: "growth",
    improvementDirection: "higher_is_better",
    dependencies: ["saas_cac", "growth_arr_growth"],
    benchmarks: { p25: 0.5, p50: 0.75, p75: 1.0, worldClass: 1.5, source: "Bessemer 2024" },
  },
  // -- Financial Metrics -----------------------------------------------------
  {
    id: "fin_dso",
    name: "Days Sales Outstanding",
    description: "Average number of days to collect payment after a sale.",
    unit: "days",
    domain: "Financial Operations",
    category: "financial",
    improvementDirection: "lower_is_better",
    dependencies: [],
    benchmarks: { p25: 55, p50: 42, p75: 30, worldClass: 20, source: "APQC 2024" },
  },
  {
    id: "fin_gross_margin",
    name: "Gross Margin",
    description: "Revenue minus cost of goods sold as a percentage of revenue.",
    unit: "%",
    domain: "Financial Operations",
    category: "financial",
    improvementDirection: "higher_is_better",
    dependencies: ["ops_cost_of_revenue"],
    benchmarks: { p25: 60, p50: 72, p75: 80, worldClass: 88, source: "KeyBanc 2024" },
  },
  {
    id: "fin_operating_margin",
    name: "Operating Margin",
    description: "Operating income as a percentage of revenue.",
    unit: "%",
    domain: "Financial Operations",
    category: "financial",
    improvementDirection: "higher_is_better",
    dependencies: ["fin_gross_margin", "ops_revenue_per_employee", "growth_rd_spend_pct"],
    benchmarks: { p25: -10, p50: 5, p75: 20, worldClass: 35, source: "KeyBanc 2024" },
  },
  {
    id: "fin_rule_of_40",
    name: "Rule of 40",
    description: "Sum of revenue growth rate and profit margin.",
    unit: "%",
    domain: "Financial Operations",
    category: "financial",
    improvementDirection: "higher_is_better",
    dependencies: ["growth_arr_growth", "fin_operating_margin"],
    benchmarks: { p25: 20, p50: 40, p75: 60, worldClass: 80, source: "Bessemer 2024" },
  },
  {
    id: "fin_burn_multiple",
    name: "Burn Multiple",
    description: "Net burn divided by net new ARR. Lower means more efficient growth.",
    unit: "x",
    domain: "Financial Operations",
    category: "financial",
    improvementDirection: "lower_is_better",
    dependencies: ["growth_arr_growth", "fin_operating_margin"],
    benchmarks: { p25: 3.0, p50: 1.5, p75: 0.8, worldClass: 0.5, source: "Bessemer 2024" },
  },
  // -- Operational Metrics ---------------------------------------------------
  {
    id: "ops_revenue_per_employee",
    name: "Revenue per Employee",
    description: "Total revenue divided by full-time equivalent headcount.",
    unit: "USD",
    domain: "Operations",
    category: "operational",
    improvementDirection: "higher_is_better",
    dependencies: ["wf_utilization_rate"],
    benchmarks: { p25: 150000, p50: 250000, p75: 400000, worldClass: 700000, source: "KeyBanc 2024" },
  },
  {
    id: "ops_cost_of_revenue",
    name: "Cost of Revenue %",
    description: "Hosting, support, and services cost as a percentage of revenue.",
    unit: "%",
    domain: "Operations",
    category: "operational",
    improvementDirection: "lower_is_better",
    dependencies: [],
    benchmarks: { p25: 40, p50: 28, p75: 20, worldClass: 12, source: "APQC 2024" },
  },
  // -- Customer Metrics ------------------------------------------------------
  {
    id: "cust_nps",
    name: "Net Promoter Score",
    description: "Customer loyalty metric from -100 to 100.",
    unit: "score",
    domain: "Customer Success",
    category: "customer",
    improvementDirection: "higher_is_better",
    dependencies: ["cust_time_to_value"],
    benchmarks: { p25: 20, p50: 40, p75: 60, worldClass: 80, source: "Bain 2024" },
  },
  {
    id: "cust_time_to_value",
    name: "Time to Value",
    description: "Days from contract signing to first measurable customer outcome.",
    unit: "days",
    domain: "Customer Success",
    category: "customer",
    improvementDirection: "lower_is_better",
    dependencies: [],
    benchmarks: { p25: 90, p50: 45, p75: 21, worldClass: 7, source: "Gainsight 2024" },
  },
  // -- Workforce Metrics -----------------------------------------------------
  {
    id: "wf_utilization_rate",
    name: "Employee Utilization Rate",
    description: "Percentage of available work hours spent on billable / productive work.",
    unit: "%",
    domain: "Workforce",
    category: "workforce",
    improvementDirection: "higher_is_better",
    dependencies: [],
    benchmarks: { p25: 60, p50: 72, p75: 82, worldClass: 90, source: "SPI Research 2024" },
  },
  {
    id: "wf_voluntary_attrition",
    name: "Voluntary Attrition Rate",
    description: "Annual percentage of employees who leave voluntarily.",
    unit: "%",
    domain: "Workforce",
    category: "workforce",
    improvementDirection: "lower_is_better",
    dependencies: [],
    benchmarks: { p25: 20, p50: 14, p75: 9, worldClass: 5, source: "Radford 2024" },
  },
  // -- Growth Metrics --------------------------------------------------------
  {
    id: "growth_arr_growth",
    name: "ARR Growth Rate",
    description: "Year-over-year annual recurring revenue growth.",
    unit: "%",
    domain: "Growth",
    category: "growth",
    improvementDirection: "higher_is_better",
    dependencies: ["saas_nrr", "growth_sales_efficiency"],
    benchmarks: { p25: 15, p50: 30, p75: 60, worldClass: 100, source: "Bessemer 2024" },
  },
  {
    id: "growth_sales_efficiency",
    name: "Sales Efficiency",
    description: "Net new ARR per dollar of sales & marketing spend.",
    unit: "x",
    domain: "Growth",
    category: "growth",
    improvementDirection: "higher_is_better",
    dependencies: [],
    benchmarks: { p25: 0.3, p50: 0.6, p75: 1.0, worldClass: 1.5, source: "Bessemer 2024" },
  },
  {
    id: "growth_rd_spend_pct",
    name: "R&D Spend as % of Revenue",
    description: "Research and development expense as a percentage of total revenue.",
    unit: "%",
    domain: "Growth",
    category: "growth",
    improvementDirection: "target_range",
    dependencies: [],
    benchmarks: { p25: 15, p50: 25, p75: 35, worldClass: 20, source: "KeyBanc 2024" },
  },
];

// ============================================================================
// Causal Edges — relationships between KPIs
// ============================================================================

export const EXTENDED_ESO_EDGES: ESOEdge[] = [
  { sourceId: "saas_gross_churn", targetId: "saas_nrr", relationship: "inhibits", weight: 0.85, description: "Gross churn directly reduces net revenue retention." },
  { sourceId: "saas_expansion_rate", targetId: "saas_nrr", relationship: "drives", weight: 0.80, description: "Expansion revenue offsets and exceeds gross churn in high-NRR companies." },
  { sourceId: "cust_nps", targetId: "saas_gross_churn", relationship: "inhibits", weight: 0.70, description: "Higher customer satisfaction reduces voluntary churn." },
  { sourceId: "cust_time_to_value", targetId: "cust_nps", relationship: "drives", weight: 0.65, lagMonths: 3, description: "Faster time to value increases customer satisfaction scores." },
  { sourceId: "cust_nps", targetId: "saas_expansion_rate", relationship: "drives", weight: 0.60, lagMonths: 6, description: "Satisfied customers are more likely to expand their contracts." },
  { sourceId: "ops_revenue_per_employee", targetId: "fin_operating_margin", relationship: "drives", weight: 0.75, description: "Higher revenue per employee directly improves operating leverage." },
  { sourceId: "wf_utilization_rate", targetId: "ops_revenue_per_employee", relationship: "drives", weight: 0.70, description: "Better utilization increases effective output per headcount." },
  { sourceId: "ops_cost_of_revenue", targetId: "fin_gross_margin", relationship: "inhibits", weight: 0.95, description: "Cost of revenue is the primary determinant of gross margin." },
  { sourceId: "fin_gross_margin", targetId: "fin_operating_margin", relationship: "drives", weight: 0.80, description: "Gross margin sets the ceiling for operating margin." },
  { sourceId: "growth_sales_efficiency", targetId: "saas_cac", relationship: "inhibits", weight: 0.85, description: "Higher sales efficiency means lower customer acquisition costs." },
  { sourceId: "saas_cac", targetId: "saas_ltv_cac", relationship: "inhibits", weight: 0.80, description: "Higher CAC reduces the LTV:CAC ratio." },
  { sourceId: "saas_nrr", targetId: "saas_ltv_cac", relationship: "drives", weight: 0.75, description: "Higher retention increases customer lifetime value." },
  { sourceId: "saas_nrr", targetId: "growth_arr_growth", relationship: "drives", weight: 0.70, lagMonths: 3, description: "Strong retention compounds into higher ARR growth." },
  { sourceId: "growth_sales_efficiency", targetId: "growth_arr_growth", relationship: "drives", weight: 0.65, description: "Efficient sales motions accelerate new logo acquisition." },
  { sourceId: "growth_arr_growth", targetId: "fin_rule_of_40", relationship: "drives", weight: 0.50, description: "Growth is one half of the Rule of 40 equation." },
  { sourceId: "fin_operating_margin", targetId: "fin_rule_of_40", relationship: "drives", weight: 0.50, description: "Profitability is the other half of the Rule of 40 equation." },
  { sourceId: "growth_arr_growth", targetId: "fin_burn_multiple", relationship: "inhibits", weight: 0.60, description: "Faster growth reduces the burn multiple (more ARR per dollar burned)." },
  { sourceId: "fin_operating_margin", targetId: "fin_burn_multiple", relationship: "inhibits", weight: 0.70, description: "Higher margin reduces net burn and thus the burn multiple." },
  { sourceId: "growth_rd_spend_pct", targetId: "fin_operating_margin", relationship: "inhibits", weight: 0.55, description: "R&D spend reduces operating margin in the short term." },
  { sourceId: "wf_voluntary_attrition", targetId: "ops_revenue_per_employee", relationship: "inhibits", weight: 0.50, lagMonths: 6, description: "High attrition reduces institutional knowledge and productivity." },
  { sourceId: "fin_dso", targetId: "fin_burn_multiple", relationship: "drives", weight: 0.40, lagMonths: 1, description: "Longer collection cycles increase cash burn." },
];

// ============================================================================
// Persona Value Maps
// ============================================================================

export const EXTENDED_PERSONA_MAPS: ESOPersonaValueMap[] = [
  {
    persona: "cfo",
    title: "Chief Financial Officer",
    primaryPain: "Unpredictable cash flow and inability to forecast reliably",
    financialDriver: "margin_improvement",
    keyKPIs: ["fin_operating_margin", "fin_rule_of_40", "fin_burn_multiple", "fin_dso", "fin_gross_margin", "saas_ltv_cac"],
    communicationPreference: "quantitative",
  },
  {
    persona: "cro",
    title: "Chief Revenue Officer",
    primaryPain: "Slowing growth and declining sales efficiency",
    financialDriver: "revenue_growth",
    keyKPIs: ["growth_arr_growth", "growth_sales_efficiency", "saas_magic_number", "saas_cac", "saas_nrr", "saas_expansion_rate"],
    communicationPreference: "quantitative",
  },
  {
    persona: "cio",
    title: "Chief Information Officer",
    primaryPain: "Technical debt slowing delivery and increasing incidents",
    financialDriver: "cost_reduction",
    keyKPIs: ["ops_revenue_per_employee", "growth_rd_spend_pct", "wf_utilization_rate", "cust_time_to_value"],
    communicationPreference: "visual",
  },
  {
    persona: "vp_cs",
    title: "VP Customer Success",
    primaryPain: "High churn eroding hard-won ARR",
    financialDriver: "revenue_growth",
    keyKPIs: ["saas_nrr", "saas_gross_churn", "saas_expansion_rate", "cust_nps", "cust_time_to_value"],
    communicationPreference: "narrative",
  },
  {
    persona: "vp_ops",
    title: "VP Operations",
    primaryPain: "Low utilization and rising operational costs",
    financialDriver: "efficiency_gain",
    keyKPIs: ["ops_revenue_per_employee", "ops_cost_of_revenue", "wf_utilization_rate", "wf_voluntary_attrition", "fin_dso"],
    communicationPreference: "visual",
  },
  {
    persona: "ceo",
    title: "Chief Executive Officer",
    primaryPain: "Board pressure on growth-profitability balance",
    financialDriver: "Enterprise value creation",
    keyKPIs: ["fin_rule_of_40", "growth_arr_growth", "fin_operating_margin", "saas_nrr", "ops_revenue_per_employee"],
    communicationPreference: "executive_summary",
  },
];

// ============================================================================
// Company-Size Benchmark Multipliers
// ============================================================================

export const SIZE_MULTIPLIERS: Record<string, SizeMultiplier> = {
  saas_nrr:             { smb: 0.90, mid_market: 1.00, enterprise: 1.08 },
  saas_gross_churn:     { smb: 1.30, mid_market: 1.00, enterprise: 0.75 },
  saas_expansion_rate:  { smb: 0.80, mid_market: 1.00, enterprise: 1.15 },
  saas_cac:             { smb: 0.50, mid_market: 1.00, enterprise: 2.00 },
  saas_ltv_cac:         { smb: 0.85, mid_market: 1.00, enterprise: 1.10 },
  saas_magic_number:    { smb: 1.10, mid_market: 1.00, enterprise: 0.90 },
  fin_dso:              { smb: 1.20, mid_market: 1.00, enterprise: 0.85 },
  fin_gross_margin:     { smb: 0.92, mid_market: 1.00, enterprise: 1.05 },
  fin_operating_margin: { smb: 0.80, mid_market: 1.00, enterprise: 1.15 },
  fin_rule_of_40:       { smb: 1.10, mid_market: 1.00, enterprise: 0.95 },
  fin_burn_multiple:    { smb: 1.30, mid_market: 1.00, enterprise: 0.80 },
  ops_revenue_per_employee: { smb: 0.60, mid_market: 1.00, enterprise: 1.40 },
  ops_cost_of_revenue:      { smb: 1.15, mid_market: 1.00, enterprise: 0.90 },
  cust_nps:             { smb: 1.05, mid_market: 1.00, enterprise: 0.95 },
  cust_time_to_value:   { smb: 0.70, mid_market: 1.00, enterprise: 1.50 },
  wf_utilization_rate:     { smb: 0.95, mid_market: 1.00, enterprise: 1.05 },
  wf_voluntary_attrition:  { smb: 1.15, mid_market: 1.00, enterprise: 0.90 },
  growth_arr_growth:       { smb: 1.30, mid_market: 1.00, enterprise: 0.70 },
  growth_sales_efficiency: { smb: 1.10, mid_market: 1.00, enterprise: 0.85 },
  growth_rd_spend_pct:     { smb: 1.20, mid_market: 1.00, enterprise: 0.90 },
};

/**
 * Adjust a benchmark value for company size.
 * Returns the original value multiplied by the size-specific factor.
 */
export function adjustBenchmarkForSize(
  metricId: string,
  baseValue: number,
  size: CompanySize,
): number {
  const multiplier = SIZE_MULTIPLIERS[metricId];
  if (!multiplier) return baseValue;
  return baseValue * multiplier[size];
}

// ============================================================================
// Data Mapping Types
// ============================================================================

export interface ESODataMapping {
  id: string;
  source_service: string;
  target_service: string;
  field_mappings: FieldMapping[];
  transformations: DataTransformation[];
}

export interface FieldMapping {
  source_field: string;
  target_field: string;
  data_type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required: boolean;
  default_value?: unknown;
}

export interface DataTransformation {
  type: 'map' | 'filter' | 'aggregate' | 'format' | 'custom';
  function_name: string;
  parameters: Record<string, any>;
}

export interface ESODataBatch {
  batch_id: string;
  service_id: string;
  records: ESODataRecord[];
  metadata: {
    total_count: number;
    processed_count: number;
    failed_count: number;
    started_at: string;
    completed_at?: string;
  };
}

export interface ESODataRecord {
  id: string;
  data: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface ESOSyncStatus {
  service_id: string;
  last_sync: string;
  next_sync?: string;
  sync_interval_minutes: number;
  records_synced: number;
  errors: string[];
}

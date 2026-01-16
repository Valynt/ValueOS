/**
 * Value Metric Template Types
 * 
 * Defines the structure for value case templates with
 * metrics organized by stakeholder view (CFO, User, Executive).
 */

// Metric categories by stakeholder
export type MetricCategory = 
  | 'justification'  // CFO View - ROI, NPV, TCO
  | 'speed'          // Risk View - TTV, Payback Period
  | 'impact'         // User View - FTE Savings, Revenue Uplift
  | 'urgency';       // Sales View - Cost of Inaction

// Metric calculation types
export type MetricType =
  | 'roi'              // Return on Investment (%)
  | 'npv'              // Net Present Value ($)
  | 'tco'              // Total Cost of Ownership ($)
  | 'ttv'              // Time to Value (months)
  | 'payback'          // Payback Period (months)
  | 'irr'              // Internal Rate of Return (%)
  | 'fte_savings'      // FTE Equivalent Savings (headcount)
  | 'coi'              // Cost of Inaction ($/month)
  | 'rmv'              // Risk Mitigation Value ($)
  | 'revenue_uplift'   // Revenue Uplift ($)
  | 'nrr'              // Net Revenue Retention (%)
  | 'custom';          // Custom metric

// Individual metric definition
export interface MetricDefinition {
  id: string;
  type: MetricType;
  name: string;
  description: string;
  category: MetricCategory;
  
  // Display
  format: 'currency' | 'percent' | 'number' | 'months' | 'headcount';
  icon?: string;
  color?: string;
  
  // Calculation
  formula?: string;           // Formula description
  inputs?: MetricInput[];     // Required inputs for calculation
  defaultValue?: number;
  
  // Validation
  minValue?: number;
  maxValue?: number;
  
  // Metadata
  bestUsedFor: string;
  stakeholder: 'cfo' | 'user' | 'executive' | 'sales';
}

// Input for metric calculation
export interface MetricInput {
  id: string;
  label: string;
  type: 'number' | 'currency' | 'percent';
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  description?: string;
}

// Value driver in a template
export interface ValueDriverTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  
  // Impact calculation
  impactType: 'cost_savings' | 'revenue_increase' | 'risk_reduction' | 'efficiency';
  baseImpact?: number;
  impactFormula?: string;
  
  // Adjustable assumptions
  assumptions: AssumptionTemplate[];
  
  // Confidence
  defaultConfidence: number;
}

// Assumption template
export interface AssumptionTemplate {
  id: string;
  label: string;
  description?: string;
  type: 'number' | 'currency' | 'percent';
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  impactMultiplier: number;
}

// Complete value case template
export interface ValueCaseTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  
  // Template content
  metrics: MetricDefinition[];
  valueDrivers: ValueDriverTemplate[];
  
  // Display settings
  primaryMetrics: string[];    // IDs of metrics to show prominently
  secondaryMetrics: string[];  // IDs of metrics to show in detail view
  
  // Metadata
  industry?: string;
  useCase?: string;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  isCustom: boolean;
  
  // Versioning
  version: string;
  author?: string;
}

export type TemplateCategory = 
  | 'general'
  | 'saas'
  | 'infrastructure'
  | 'security'
  | 'productivity'
  | 'custom';

// Template summary for list views
export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  metricCount: number;
  driverCount: number;
  isDefault: boolean;
  isCustom: boolean;
  lastUsed?: string;
  usageCount: number;
}

/**
 * VMRT (Value Metrics Reference Templates) Types
 * 
 * Types for value metrics templates and references
 */

export interface VMRTTemplate {
  id: string;
  name: string;
  description: string;
  category: VMRTCategory;
  lifecycle_stage: string;
  metric_definitions: MetricDefinition[];
  formula_templates: FormulaTemplate[];
  benchmark_references: BenchmarkReference[];
}

export type VMRTCategory =
  | 'financial'
  | 'operational'
  | 'strategic'
  | 'customer'
  | 'employee';

export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  unit: string;
  calculation_method: string;
  data_sources: string[];
  update_frequency: string;
}

export interface FormulaTemplate {
  id: string;
  name: string;
  formula: string;
  variables: FormulaVariable[];
  example_calculation: Record<string, any>;
}

export interface FormulaVariable {
  name: string;
  description: string;
  unit: string;
  default_value?: number;
}

export interface BenchmarkReference {
  metric_name: string;
  industry: string;
  source: string;
  value: number;
  unit: string;
  date_published: string;
}

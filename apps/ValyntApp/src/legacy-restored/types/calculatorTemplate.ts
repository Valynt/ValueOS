/**
 * Calculator Template Types
 * 
 * Defines the structure for industry-specific calculator templates
 */

// Industry types
export enum Industry {
  SAAS = 'saas',
  ECOMMERCE = 'ecommerce',
  MANUFACTURING = 'manufacturing',
  HEALTHCARE = 'healthcare',
  FINANCIAL_SERVICES = 'financial_services',
}

// Metric category
export enum MetricCategory {
  REVENUE = 'revenue',
  COST = 'cost',
  EFFICIENCY = 'efficiency',
  QUALITY = 'quality',
  CUSTOMER = 'customer',
}

// Input field type
export enum InputFieldType {
  NUMBER = 'number',
  CURRENCY = 'currency',
  PERCENTAGE = 'percentage',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  TEXT = 'text',
}

// Pain point
export interface PainPoint {
  id: string;
  label: string;
  description: string;
  category: MetricCategory;
  impactLevel: 'low' | 'medium' | 'high';
  commonSolutions: string[];
}

// Metric definition
export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  category: MetricCategory;
  unit: string;
  inputType: InputFieldType;
  required: boolean;
  defaultValue?: number | string;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
  placeholder?: string;
}

// Benchmark data
export interface BenchmarkData {
  metricId: string;
  p25: number;
  median: number;
  p75: number;
  bestInClass: number;
  source: string;
  lastUpdated: string;
}

// ROI calculation formula
export interface ROIFormula {
  id: string;
  name: string;
  description: string;
  formula: string; // JavaScript expression
  dependencies: string[]; // Metric IDs required
  outputUnit: string;
}

// Template validation rule
export interface ValidationRule {
  field: string;
  rule: 'required' | 'min' | 'max' | 'range' | 'custom';
  value?: number | string;
  message: string;
  customValidator?: (value: any, allValues: Record<string, any>) => boolean;
}

// Calculator template
export interface CalculatorTemplate {
  id: string;
  industry: Industry;
  name: string;
  description: string;
  version: string;
  painPoints: PainPoint[];
  metrics: MetricDefinition[];
  benchmarks: BenchmarkData[];
  roiFormulas: ROIFormula[];
  validationRules: ValidationRule[];
  estimatedTimeMinutes: number;
  createdAt: string;
  updatedAt: string;
}

// User input for calculator
export interface CalculatorInput {
  templateId: string;
  companyName: string;
  industry: Industry;
  companySize: 'small' | 'medium' | 'large' | 'enterprise';
  selectedPainPoints: string[];
  metricValues: Record<string, number | string>;
  goals: Record<string, number>;
}

// Calculator result
export interface CalculatorResult {
  templateId: string;
  input: CalculatorInput;
  calculations: Record<string, number>;
  roiMetrics: {
    totalSavings: number;
    totalCosts: number;
    netBenefit: number;
    roi: number;
    paybackPeriodMonths: number;
    npv?: number;
    irr?: number;
  };
  benchmarkComparison: Array<{
    metricId: string;
    metricName: string;
    currentValue: number;
    industryMedian: number;
    percentile: number;
    gap: number;
    potentialImprovement: number;
  }>;
  confidenceScore: number; // 0-100
  confidenceFactors: Array<{
    factor: string;
    impact: 'positive' | 'negative';
    description: string;
  }>;
  recommendations: string[];
  calculatedAt: string;
}

// Template metadata for listing
export interface TemplateMetadata {
  id: string;
  industry: Industry;
  name: string;
  description: string;
  painPointCount: number;
  metricCount: number;
  estimatedTimeMinutes: number;
  popularity: number;
  lastUpdated: string;
}
